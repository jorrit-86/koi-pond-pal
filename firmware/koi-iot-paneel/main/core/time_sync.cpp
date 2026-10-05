// KOIoT Paneel - SNTP-klok (R5): pool.ntp.org, tijdzone CET/CEST, "--:--" tot gesynchroniseerd.
#include "core/time_sync.h"

#include <cstdlib>
#include <ctime>

#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "esp_sntp.h"
#include "esp_timer.h"

#include "app_config.h"
#include "core/app_state.h"

static const char* TAG = "time_sync";

static volatile bool s_synced = false;
static bool s_sntp_initialized = false;
static int64_t s_network_up_since_us = 0;   // 0 = geen netwerk
static bool s_warned_no_sync = false;

// Callback van de SNTP-client (loopt in de lwIP/tcpip-taak; niets LVGL doen hier).
static void on_time_synced(struct timeval* tv)
{
    s_synced = true;
    s_warned_no_sync = false;

    struct tm tm_local = {};
    time_t now = tv ? tv->tv_sec : time(nullptr);
    localtime_r(&now, &tm_local);
    char buf[40];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S %Z", &tm_local);
    ESP_LOGI(TAG, "SNTP: tijd gesynchroniseerd via %s -> %s (epoch %lld)",
             APP_SNTP_SERVER, buf, (long long)now);

    AppState& st = app_state_lock();
    st.time_synced = true;
    app_state_unlock();
}

void time_sync_init()
{
    setenv("TZ", APP_TIMEZONE, 1);
    tzset();
    ESP_LOGI(TAG, "tijdzone ingesteld: TZ=%s", APP_TIMEZONE);

    // Struct veld-voor-veld vullen (het IDF-macro gebruikt designated initializers die in C++17 niet werken).
    esp_sntp_config_t cfg = {};
    cfg.smooth_sync = false;
    cfg.server_from_dhcp = false;
    cfg.wait_for_sync = false;
    cfg.start = false;                        // pas starten als er een IP is
    cfg.sync_cb = on_time_synced;
    cfg.renew_servers_after_new_IP = false;
    cfg.ip_event_to_renew = IP_EVENT_STA_GOT_IP;
    cfg.index_of_first_server = 0;
    cfg.num_of_servers = 1;
    cfg.servers[0] = APP_SNTP_SERVER;

    esp_err_t err = esp_netif_sntp_init(&cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "SNTP: initialisatie mislukt: %s (0x%x)", esp_err_to_name(err), err);
        return;
    }
    s_sntp_initialized = true;
    ESP_LOGI(TAG, "SNTP: voorbereid (server %s, interval %d s), wacht op netwerk",
             APP_SNTP_SERVER, CONFIG_LWIP_SNTP_UPDATE_DELAY / 1000);
}

void time_sync_on_network_up()
{
    s_network_up_since_us = esp_timer_get_time();
    s_warned_no_sync = false;
    if (!s_sntp_initialized) {
        ESP_LOGW(TAG, "SNTP: niet geinitialiseerd, start overgeslagen");
        return;
    }
    ESP_LOGI(TAG, "SNTP: poging - client (her)starten richting %s", APP_SNTP_SERVER);
    // esp_netif_sntp_start() doet sntp_stop()+sntp_init(): veilig om bij elke reconnect aan te roepen.
    esp_err_t err = esp_netif_sntp_start();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "SNTP: starten mislukt: %s (0x%x)", esp_err_to_name(err), err);
    }
}

void time_sync_on_network_down()
{
    s_network_up_since_us = 0;
    if (s_synced) {
        ESP_LOGI(TAG, "SNTP: netwerk weg; klok loopt door op de laatst gesynchroniseerde tijd");
    } else {
        ESP_LOGW(TAG, "SNTP: netwerk weg voordat de tijd gesynchroniseerd was; klok blijft --:--");
    }
}

bool time_sync_is_synced()
{
    return s_synced;
}

void time_sync_tick(bool network_up)
{
    if (!network_up || s_synced || s_warned_no_sync || s_network_up_since_us == 0) {
        return;
    }
    int64_t up_for_s = (esp_timer_get_time() - s_network_up_since_us) / 1000000;
    if (up_for_s >= APP_SNTP_WARN_AFTER_S) {
        ESP_LOGW(TAG, "SNTP: al %lld s netwerk maar nog geen tijdsync van %s (DNS/UDP 123 geblokkeerd?); "
                      "client blijft het proberen", (long long)up_for_s, APP_SNTP_SERVER);
        s_warned_no_sync = true;
    }
}
