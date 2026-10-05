// KOIoT Paneel - net_manager (implementatie).
#include "core/net_manager.h"

#include <cstdio>
#include <cstring>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_event.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_system.h"
#include "esp_task_wdt.h"
#include "esp_timer.h"
#include "esp_wifi.h"

#include "bsp_wifi.h"

#include "app_config.h"
#include "core/app_state.h"
#include "core/settings_store.h"
#include "core/time_sync.h"
#include "io/backend_client.h"
#include "io/ha_client.h"
#include "io/mqtt_link.h"

static const char* TAG = "net_manager";

static char s_ssid[APP_WIFI_SSID_MAX + 1] = "";
static char s_pass[APP_WIFI_PASS_MAX + 1] = "";
static bool s_inited = false;

static char s_apply_ssid[APP_WIFI_SSID_MAX + 1] = "";
static char s_apply_pass[APP_WIFI_PASS_MAX + 1] = "";
static volatile bool s_apply_pending = false;
static volatile bool s_scan_req = false;
static volatile bool s_scan_busy = false;
static WifiScanSnapshot s_scan;
static portMUX_TYPE s_wifi_mux = portMUX_INITIALIZER_UNLOCKED;

// Alleen door de netwerktaak en de eventhandler gebruikt; eenvoudige vlaggen zijn hier voldoende.
static volatile bool s_got_ip = false;
static volatile bool s_connect_in_progress = false;
static volatile int s_last_reason = 0;

static int64_t s_last_attempt_us = 0;
static int64_t s_offline_since_us = 0;     // moment waarop we (voor het laatst) offline raakten / boot
static uint32_t s_attempts = 0;
static uint32_t s_failures_in_a_row = 0;
static int64_t s_last_rssi_poll_us = 0;

// -----------------------------------------------------------------------------
// Hulpfuncties
// -----------------------------------------------------------------------------
static const char* wifi_reason_text(int reason)
{
    switch (reason) {
        case WIFI_REASON_UNSPECIFIED:                       return "niet gespecificeerd";
        case WIFI_REASON_AUTH_EXPIRE:                       return "authenticatie verlopen";
        case WIFI_REASON_AUTH_LEAVE:                        return "AP heeft ons afgemeld";
        case WIFI_REASON_ASSOC_EXPIRE:                      return "associatie verlopen";
        case WIFI_REASON_ASSOC_LEAVE:                       return "verbinding beeindigd (leave)";
        case WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT:            return "4-way handshake timeout (wachtwoord fout?)";
        case WIFI_REASON_BEACON_TIMEOUT:                    return "beacon timeout (AP buiten bereik/uit)";
        case WIFI_REASON_NO_AP_FOUND:                       return "AP niet gevonden (SSID fout of AP uit)";
        case WIFI_REASON_AUTH_FAIL:                         return "authenticatie mislukt (wachtwoord fout?)";
        case WIFI_REASON_ASSOC_FAIL:                        return "associatie mislukt";
        case WIFI_REASON_HANDSHAKE_TIMEOUT:                 return "handshake timeout";
        case WIFI_REASON_CONNECTION_FAIL:                   return "verbinding mislukt";
        case WIFI_REASON_AP_TSF_RESET:                      return "AP TSF reset";
        case WIFI_REASON_ROAMING:                           return "roaming";
        case WIFI_REASON_NO_AP_FOUND_W_COMPATIBLE_SECURITY: return "geen AP met passende beveiliging (WPA3-only?)";
        case WIFI_REASON_NO_AP_FOUND_IN_AUTHMODE_THRESHOLD: return "geen AP binnen authmode-drempel";
        case WIFI_REASON_NO_AP_FOUND_IN_RSSI_THRESHOLD:     return "geen AP binnen RSSI-drempel";
        default:                                            return "onbekende reden";
    }
}

static void set_state(WifiStatus status)
{
    AppState& st = app_state_lock();
    st.wifi = status;
    if (status != WifiStatus::Connected) {
        st.ip[0] = '\0';
        st.rssi = 0;
    }
    app_state_unlock();
}

static void poll_rssi()
{
    wifi_ap_record_t ap = {};
    esp_err_t err = esp_wifi_sta_get_ap_info(&ap);
    AppState& st = app_state_lock();
    if (err == ESP_OK) {
        st.rssi = ap.rssi;
        strncpy(st.ssid, reinterpret_cast<const char*>(ap.ssid), sizeof(st.ssid) - 1);
        st.ssid[sizeof(st.ssid) - 1] = '\0';
    } else {
        st.rssi = 0;
    }
    app_state_unlock();
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "RSSI opvragen mislukt: %s (0x%x)", esp_err_to_name(err), err);
    }
}

// -----------------------------------------------------------------------------
// Wifi-/IP-events (lopen in de default event loop task; hier geen LVGL, geen blokkerend werk)
// -----------------------------------------------------------------------------
static void on_wifi_event(void*, esp_event_base_t base, int32_t id, void* data)
{
    if (base == WIFI_EVENT) {
        switch (id) {
            case WIFI_EVENT_STA_START:
                ESP_LOGI(TAG, "wifi-driver gestart (STA-modus) via esp_hosted/C6");
                break;
            case WIFI_EVENT_STA_CONNECTED: {
                auto* ev = static_cast<wifi_event_sta_connected_t*>(data);
                ESP_LOGI(TAG, "geassocieerd met AP '%.*s' (kanaal %d, authmode %d); wacht op IP-adres (DHCP)",
                         ev->ssid_len, reinterpret_cast<const char*>(ev->ssid), ev->channel, ev->authmode);
                break;
            }
            case WIFI_EVENT_SCAN_DONE: {
                auto* ev = static_cast<wifi_event_sta_scan_done_t*>(data);
                s_scan_busy = false;
                if (ev != nullptr && ev->status != 0) {
                    portENTER_CRITICAL(&s_wifi_mux);
                    s_scan.state = WifiScanState::Fail;
                    s_scan.count = 0;
                    snprintf(s_scan.message, sizeof(s_scan.message), "scan mislukt");
                    portEXIT_CRITICAL(&s_wifi_mux);
                    ESP_LOGW(TAG, "wifi-scan MISLUKT: status %u", (unsigned)ev->status);
                    break;
                }
                uint16_t n = 0;
                esp_err_t err = esp_wifi_scan_get_ap_num(&n);
                if (err != ESP_OK) {
                    portENTER_CRITICAL(&s_wifi_mux);
                    s_scan.state = WifiScanState::Fail;
                    s_scan.count = 0;
                    snprintf(s_scan.message, sizeof(s_scan.message), "scan lezen mislukt");
                    portEXIT_CRITICAL(&s_wifi_mux);
                    ESP_LOGE(TAG, "mislukt: scan-aantal: %s (0x%x)",
                             esp_err_to_name(err), err);
                    break;
                }
                static wifi_ap_record_t recs[20];
                if (n > 20) {
                    n = 20;
                }
                uint16_t got = n;
                if (n == 0) {
                    got = 0;
                    err = ESP_OK;
                } else {
                    err = esp_wifi_scan_get_ap_records(&got, recs);
                }
                WifiScanSnapshot next = {};
                next.state = WifiScanState::Done;
                if (err != ESP_OK) {
                    next.state = WifiScanState::Fail;
                    snprintf(next.message, sizeof(next.message), "scan lezen mislukt");
                    ESP_LOGE(TAG, "mislukt: scan-records: %s (0x%x)",
                             esp_err_to_name(err), err);
                } else {
                    for (uint16_t i = 0; i < got && next.count < APP_WIFI_SCAN_MAX; i++) {
                        const char* ssid = reinterpret_cast<const char*>(recs[i].ssid);
                        if (ssid == nullptr || ssid[0] == '\0') {
                            continue;
                        }
                        int found = -1;
                        for (int k = 0; k < next.count; k++) {
                            if (strncmp(next.aps[k].ssid, ssid, APP_WIFI_SSID_MAX) == 0) {
                                found = k;
                                break;
                            }
                        }
                        const bool open = (recs[i].authmode == WIFI_AUTH_OPEN);
                        if (found >= 0) {
                            if (recs[i].rssi > next.aps[found].rssi) {
                                next.aps[found].rssi = recs[i].rssi;
                                next.aps[found].open = open;
                            }
                            continue;
                        }
                        WifiScanAp& ap = next.aps[next.count];
                        strncpy(ap.ssid, ssid, sizeof(ap.ssid) - 1);
                        ap.ssid[sizeof(ap.ssid) - 1] = '\0';
                        ap.rssi = recs[i].rssi;
                        ap.open = open;
                        next.count++;
                    }
                    // Sterkste eerst (eenvoudige insert is al bijna gesorteerd; bubble is klein).
                    for (int i = 0; i < next.count; i++) {
                        for (int j = i + 1; j < next.count; j++) {
                            if (next.aps[j].rssi > next.aps[i].rssi) {
                                const WifiScanAp tmp = next.aps[i];
                                next.aps[i] = next.aps[j];
                                next.aps[j] = tmp;
                            }
                        }
                    }
                    snprintf(next.message, sizeof(next.message),
                             next.count == 1 ? "%d netwerk" : "%d netwerken",
                             next.count);
                    ESP_LOGI(TAG, "wifi-scan klaar: %d unieke SSID(s) van %u AP(s)",
                             next.count, (unsigned)got);
                    for (int i = 0; i < next.count; i++) {
                        ESP_LOGI(TAG, "  scan[%d] '%s' rssi=%d %s",
                                 i, next.aps[i].ssid, (int)next.aps[i].rssi,
                                 next.aps[i].open ? "open" : "beveiligd");
                    }
                }
                portENTER_CRITICAL(&s_wifi_mux);
                s_scan = next;
                portEXIT_CRITICAL(&s_wifi_mux);
                break;
            }
            case WIFI_EVENT_STA_DISCONNECTED: {
                auto* ev = static_cast<wifi_event_sta_disconnected_t*>(data);
                s_last_reason = ev->reason;
                bool was_connected = s_got_ip;
                s_got_ip = false;
                s_connect_in_progress = false;
                if (was_connected) {
                    ESP_LOGW(TAG, "VERBINDING VERLOREN met '%.*s': reden %d (%s); volgende poging over max. %d s",
                             ev->ssid_len, reinterpret_cast<const char*>(ev->ssid), ev->reason,
                             wifi_reason_text(ev->reason), APP_WIFI_RECONNECT_INTERVAL_S);
                    s_offline_since_us = esp_timer_get_time();
                    time_sync_on_network_down();
                    mqtt_link_on_network_down();
                    backend_client_on_network_down();
                    ha_client_on_network_down();
                } else {
                    const bool handshake_leave = (ev->reason == WIFI_REASON_ASSOC_LEAVE);
                    if (handshake_leave) {
                        ESP_LOGI(TAG, "STA-leave tijdens handshake (reden %d, %s); "
                                      "bekend bij hosted 2.7.0 / C6 2.12.0, opnieuw verbinden",
                                 ev->reason, wifi_reason_text(ev->reason));
                        // Eerste leave: niet 15 s wachten — C6 is vaak meteen klaar voor de volgende poging.
                        if (s_attempts <= 2 && APP_WIFI_RECONNECT_INTERVAL_S > 2) {
                            s_last_attempt_us = esp_timer_get_time() -
                                (static_cast<int64_t>(APP_WIFI_RECONNECT_INTERVAL_S) - 2) * 1000000LL;
                        }
                    } else {
                        ESP_LOGW(TAG, "verbindingspoging MISLUKT: reden %d (%s)",
                                 ev->reason, wifi_reason_text(ev->reason));
                    }
                }
                AppState& st = app_state_lock();
                st.last_disconnect_reason = ev->reason;
                app_state_unlock();
                set_state(WifiStatus::Disconnected);
                break;
            }
            default:
                break;
        }
    } else if (base == IP_EVENT) {
        if (id == IP_EVENT_STA_GOT_IP) {
            auto* ev = static_cast<ip_event_got_ip_t*>(data);
            s_got_ip = true;
            s_connect_in_progress = false;
            s_failures_in_a_row = 0;
            s_offline_since_us = 0;
            ESP_LOGI(TAG, "VERBONDEN: IP " IPSTR " netmask " IPSTR " gateway " IPSTR " (poging %lu)",
                     IP2STR(&ev->ip_info.ip), IP2STR(&ev->ip_info.netmask), IP2STR(&ev->ip_info.gw),
                     (unsigned long)s_attempts);

            uint8_t mac[6] = {0};
            if (esp_wifi_get_mac(WIFI_IF_STA, mac) == ESP_OK) {
                ESP_LOGI(TAG, "wifi-STA-MAC (C6) = %02X:%02X:%02X:%02X:%02X:%02X",
                         mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
            }

            AppState& st = app_state_lock();
            st.wifi = WifiStatus::Connected;
            snprintf(st.ip, sizeof(st.ip), IPSTR, IP2STR(&ev->ip_info.ip));
            st.next_retry_in_s = -1;
            st.offline_for_s = 0;
            app_state_unlock();

            time_sync_on_network_up();
            mqtt_link_on_network_up();
            backend_client_on_network_up();
            ha_client_on_network_up();
        } else if (id == IP_EVENT_STA_LOST_IP) {
            ESP_LOGW(TAG, "IP-adres verloren (DHCP-lease weg?); wacht op nieuw adres of disconnect");
        }
    }
}

// -----------------------------------------------------------------------------
// Verbindingspoging
// -----------------------------------------------------------------------------
static void try_connect()
{
    s_attempts++;
    s_last_attempt_us = esp_timer_get_time();
    s_connect_in_progress = true;
    set_state(WifiStatus::Connecting);

    AppState& st = app_state_lock();
    st.connect_attempts = s_attempts;
    st.next_retry_in_s = -1;
    strncpy(st.ssid, s_ssid, sizeof(st.ssid) - 1);
    st.ssid[sizeof(st.ssid) - 1] = '\0';
    app_state_unlock();

    bool full_restart = (s_attempts == 1) ||
                        (APP_WIFI_FULL_RESTART_EVERY_N > 0 && (s_failures_in_a_row % APP_WIFI_FULL_RESTART_EVERY_N) == 0
                         && s_failures_in_a_row > 0);
    if (full_restart) {
        // bsp_wifi_connect() doet esp_wifi_stop() + set_config + start + connect (Elecrow-volgorde).
        ESP_LOGI(TAG, "poging %lu: verbinden met '%s' (volledige start via bsp_wifi_connect)",
                 (unsigned long)s_attempts, s_ssid);
        bsp_wifi_connect(s_ssid, s_pass);
    } else {
        ESP_LOGI(TAG, "poging %lu: opnieuw verbinden met '%s' (esp_wifi_connect)", (unsigned long)s_attempts, s_ssid);
        esp_err_t err = esp_wifi_connect();
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "poging %lu: esp_wifi_connect() geweigerd: %s (0x%x)",
                     (unsigned long)s_attempts, esp_err_to_name(err), err);
            s_connect_in_progress = false;
            set_state(WifiStatus::Disconnected);
        }
    }
}

// -----------------------------------------------------------------------------
// Netwerktaak: reconnect-beleid, herstart-bewaking, RSSI, SNTP-bewaking
// -----------------------------------------------------------------------------
static void net_task(void*)
{
    esp_err_t wdt_err = esp_task_wdt_add(nullptr);
    if (wdt_err != ESP_OK) {
        ESP_LOGW(TAG, "aanmelden bij task-watchdog mislukt: %s", esp_err_to_name(wdt_err));
    }

    s_offline_since_us = esp_timer_get_time();
    try_connect();

    while (true) {
        vTaskDelay(pdMS_TO_TICKS(APP_NET_TASK_TICK_MS));
        esp_task_wdt_reset();

        const int64_t now_us = esp_timer_get_time();

        if (mqtt_link_process_apply()) {
            if (s_got_ip) {
                mqtt_link_on_network_up();
            } else {
                ESP_LOGI(TAG, "MQTT-instellingen bewaard; start wacht op wifi-IP");
            }
        }

        if (s_apply_pending) {
            portENTER_CRITICAL(&s_wifi_mux);
            strncpy(s_ssid, s_apply_ssid, sizeof(s_ssid) - 1);
            s_ssid[sizeof(s_ssid) - 1] = '\0';
            strncpy(s_pass, s_apply_pass, sizeof(s_pass) - 1);
            s_pass[sizeof(s_pass) - 1] = '\0';
            s_apply_pending = false;
            portEXIT_CRITICAL(&s_wifi_mux);
            ESP_LOGI(TAG, "netwerk wisselen naar '%s'", s_ssid);
            settings_store_set_wifi(s_ssid, s_pass);
            const bool was_up = s_got_ip;
            s_attempts = 0;
            s_failures_in_a_row = 0;
            s_connect_in_progress = false;
            s_got_ip = false;
            s_offline_since_us = now_us;
            s_last_attempt_us = 0;
            if (was_up) {
                time_sync_on_network_down();
                mqtt_link_on_network_down();
                backend_client_on_network_down();
                ha_client_on_network_down();
            }
            try_connect();
            continue;
        }

        if (s_scan_req && !s_scan_busy) {
            s_scan_req = false;
            wifi_scan_config_t cfg = {};
            cfg.scan_type = WIFI_SCAN_TYPE_ACTIVE;
            cfg.show_hidden = false;
            ESP_LOGI(TAG, "poging: wifi-scan starten");
            const esp_err_t scan_err = esp_wifi_scan_start(&cfg, false);
            if (scan_err != ESP_OK) {
                portENTER_CRITICAL(&s_wifi_mux);
                s_scan.state = WifiScanState::Fail;
                snprintf(s_scan.message, sizeof(s_scan.message), "scan start mislukt");
                portEXIT_CRITICAL(&s_wifi_mux);
                ESP_LOGE(TAG, "mislukt: wifi-scan starten: %s (0x%x)",
                         esp_err_to_name(scan_err), scan_err);
            } else {
                s_scan_busy = true;
                portENTER_CRITICAL(&s_wifi_mux);
                s_scan.state = WifiScanState::Busy;
                snprintf(s_scan.message, sizeof(s_scan.message), "zoeken...");
                portEXIT_CRITICAL(&s_wifi_mux);
                ESP_LOGI(TAG, "wifi-scan gestart");
            }
        }

        if (s_got_ip) {
            if (now_us - s_last_rssi_poll_us >= (int64_t)APP_WIFI_RSSI_POLL_S * 1000000) {
                s_last_rssi_poll_us = now_us;
                poll_rssi();
            }
            time_sync_tick(true);
            continue;
        }

        // --- offline ---
        const int64_t offline_s = (now_us - s_offline_since_us) / 1000000;
        const int64_t since_attempt_s = (now_us - s_last_attempt_us) / 1000000;

        // R1: na 10 min onafgebroken zonder verbinding herstarten
        if (offline_s >= APP_WIFI_RESTART_AFTER_S) {
            ESP_LOGE(TAG, "al %lld s zonder wifi-verbinding (%lu pogingen, laatste reden %d: %s) -> esp_restart()",
                     (long long)offline_s, (unsigned long)s_attempts, (int)s_last_reason, wifi_reason_text(s_last_reason));
            vTaskDelay(pdMS_TO_TICKS(200));   // log laten wegschrijven
            esp_restart();
        }

        // Poging die te lang duurt (geen disconnect-event ontvangen) als mislukt beschouwen
        if (s_connect_in_progress && since_attempt_s >= APP_WIFI_RECONNECT_INTERVAL_S) {
            ESP_LOGW(TAG, "poging %lu: geen resultaat binnen %d s; wordt als mislukt beschouwd",
                     (unsigned long)s_attempts, APP_WIFI_RECONNECT_INTERVAL_S);
            s_connect_in_progress = false;
        }

        if (!s_connect_in_progress) {
            if (since_attempt_s >= APP_WIFI_RECONNECT_INTERVAL_S) {
                s_failures_in_a_row++;
                try_connect();
            } else {
                AppState& st = app_state_lock();
                st.next_retry_in_s = (int32_t)(APP_WIFI_RECONNECT_INTERVAL_S - since_attempt_s);
                st.offline_for_s = (int32_t)offline_s;
                app_state_unlock();
            }
        } else {
            AppState& st = app_state_lock();
            st.offline_for_s = (int32_t)offline_s;
            app_state_unlock();
        }
    }
}

// -----------------------------------------------------------------------------
// Publieke API
// -----------------------------------------------------------------------------
void net_manager_init(const char* ssid, const char* pass)
{
    strncpy(s_ssid, ssid ? ssid : "", sizeof(s_ssid) - 1);
    strncpy(s_pass, pass ? pass : "", sizeof(s_pass) - 1);

    if (s_ssid[0] == '\0' || strcmp(s_ssid, "JOUW_WIFI_SSID") == 0) {
        ESP_LOGW(TAG, "LET OP: WIFI_SSID in main/secrets.h is nog een placeholder ('%s'); verbinden zal mislukken", s_ssid);
    }

    ESP_LOGI(TAG, "wifi initialiseren (esp_hosted SDIO -> ESP32-C6) ...");
    ESP_LOGI(TAG,
             "heap vlak voor bsp_wifi_init: intern vrij %u KB (grootste %u KB), "
             "intern+DMA vrij %u KB (grootste %u KB)",
             (unsigned)(heap_caps_get_free_size(MALLOC_CAP_INTERNAL) / 1024),
             (unsigned)(heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL) / 1024),
             (unsigned)(heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA) / 1024),
             (unsigned)(heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA) / 1024));
    bsp_wifi_init();            // nvs, esp_netif, default event loop, esp_wifi_init (Elecrow)
    bsp_wifi_sta_init();        // STA-netif, Elecrow-eventhandler, esp_wifi_start (Elecrow)
    bsp_wifi_set_auto_reconnect(false);   // reconnect-beleid ligt bij net_manager (R1)

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &on_wifi_event, nullptr));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &on_wifi_event, nullptr));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_LOST_IP, &on_wifi_event, nullptr));
    s_inited = true;
    ESP_LOGI(TAG, "wifi-driver gereed; reconnect elke %d s, herstart na %d s offline",
             APP_WIFI_RECONNECT_INTERVAL_S, APP_WIFI_RESTART_AFTER_S);
}

void net_manager_start()
{
    BaseType_t ok = xTaskCreate(net_task, "net_task", APP_NET_TASK_STACK, nullptr, APP_NET_TASK_PRIO, nullptr);
    if (ok != pdPASS) {
        ESP_LOGE(TAG, "netwerktaak aanmaken mislukt (geheugen?)");
    }
}

bool net_manager_is_connected()
{
    return s_got_ip;
}

void net_manager_request_scan()
{
    if (!s_inited) {
        portENTER_CRITICAL(&s_wifi_mux);
        s_scan.state = WifiScanState::Fail;
        snprintf(s_scan.message, sizeof(s_scan.message), "wifi wacht op stroom-eraf");
        portEXIT_CRITICAL(&s_wifi_mux);
        ESP_LOGW(TAG, "wifi-scan geweigerd: driver niet gestart (C6-skip)");
        return;
    }
    if (s_scan_busy) {
        ESP_LOGI(TAG, "wifi-scan al bezig; verzoek genegeerd");
        return;
    }
    portENTER_CRITICAL(&s_wifi_mux);
    s_scan.state = WifiScanState::Busy;
    snprintf(s_scan.message, sizeof(s_scan.message), "zoeken...");
    portEXIT_CRITICAL(&s_wifi_mux);
    s_scan_req = true;
    ESP_LOGI(TAG, "wifi-scan aangevraagd");
}

void net_manager_scan_snapshot(WifiScanSnapshot* out)
{
    if (out == nullptr) {
        return;
    }
    portENTER_CRITICAL(&s_wifi_mux);
    *out = s_scan;
    portEXIT_CRITICAL(&s_wifi_mux);
}

void net_manager_request_apply(const char* ssid, const char* pass)
{
    if (ssid == nullptr || ssid[0] == '\0') {
        ESP_LOGW(TAG, "wifi toepassen geweigerd: lege SSID");
        return;
    }
    if (!s_inited) {
        ESP_LOGW(TAG, "wifi toepassen geweigerd: driver niet gestart (C6-skip)");
        return;
    }

    char use_ssid[APP_WIFI_SSID_MAX + 1] = "";
    char use_pass[APP_WIFI_PASS_MAX + 1] = "";
    strncpy(use_ssid, ssid, sizeof(use_ssid) - 1);
    if (pass != nullptr && pass[0] != '\0') {
        strncpy(use_pass, pass, sizeof(use_pass) - 1);
    } else if (strncmp(ssid, s_ssid, APP_WIFI_SSID_MAX) == 0) {
        strncpy(use_pass, s_pass, sizeof(use_pass) - 1);
        ESP_LOGI(TAG, "wifi toepassen: SSID '%s', huidig wachtwoord houden", use_ssid);
    } else {
        ESP_LOGI(TAG, "wifi toepassen: SSID '%s', geen wachtwoord (open of leeg)", use_ssid);
    }

    portENTER_CRITICAL(&s_wifi_mux);
    strncpy(s_apply_ssid, use_ssid, sizeof(s_apply_ssid) - 1);
    s_apply_ssid[sizeof(s_apply_ssid) - 1] = '\0';
    strncpy(s_apply_pass, use_pass, sizeof(s_apply_pass) - 1);
    s_apply_pass[sizeof(s_apply_pass) - 1] = '\0';
    s_apply_pending = true;
    portEXIT_CRITICAL(&s_wifi_mux);

    AppState& st = app_state_lock();
    strncpy(st.ssid, use_ssid, sizeof(st.ssid) - 1);
    st.ssid[sizeof(st.ssid) - 1] = '\0';
    st.wifi = WifiStatus::Connecting;
    app_state_unlock();
}

void net_manager_current_ssid(char* out, size_t out_len)
{
    if (out == nullptr || out_len == 0) {
        return;
    }
    strncpy(out, s_ssid, out_len - 1);
    out[out_len - 1] = '\0';
}

bool net_manager_apply_pending()
{
    return s_apply_pending;
}
