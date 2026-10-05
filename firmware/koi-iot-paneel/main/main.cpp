// KOIoT Paneel - hoofdprogramma (M2: handmatige metingen).
//
// Init-volgorde: LDO3 -> NVS -> lichte stores -> I2C/touch -> display_init
// (esp_lvgl_port, backlight 0) -> **direct** bsp_wifi_init -> pas daarna
// status_store (PSRAM-snapshots) en de applicatie-UI. Hosted SDIO-RX eist
// interne DMA-heap (sdio_rx_get_buffer / _h_malloc_align INTERNAL|DMA).
// live_store_init + NVS-middernachtstand staan eerder en gebruiken geen DMA.
//
// Hosted 2.7.0 mag bij C6-timeout (0x107) de P4 zelf herstarten. GPIO54 wekt
// een zieke C6 niet. Na hosted-assert/0x107: wifi/MQTT overslaan tot echte
// POWERON (beide USB-C). Dashboard + banner, geen 8 s retry (dat was de freeze).
#include <cstdio>
#include <cstring>

#include "esp_attr.h"
#include "esp_chip_info.h"
#include "esp_flash.h"
#include "esp_heap_caps.h"
#include "esp_ldo_regulator.h"
#include "esp_log.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "bsp_display.h"
#include "bsp_i2c.h"

#include "app_config.h"
#include "secrets.h"
#include "core/app_state.h"
#include "core/net_manager.h"
#include "core/panel_id.h"
#include "core/time_sync.h"
#include "core/settings_store.h"
#include "data/diag_store.h"
#include "data/live_store.h"
#include "data/measurement_queue.h"
#include "data/status_store.h"
#include "data/vent_store.h"
#include "io/backend_client.h"
#include "io/ha_client.h"
#include "io/mqtt_link.h"
#include "io/ota_client.h"
#include "core/screen_manager.h"
#include "ui/ui_root.h"

static const char* TAG = "main";

// Hosted 2.7.0 roept bij SDIO 0x107 (C6 niet klaar / geen INIT-event)
// _h_restart_host() → esp_restart(). RTC_NOINIT overleeft SW_CPU_RESET en PANIC,
// niet POWERON.
static constexpr uint32_t k_hosted_init_busy = 0xC60B0071u;
static constexpr uint32_t k_hosted_skip_until_power = 0xC60B5C10u;
static RTC_NOINIT_ATTR uint32_t s_hosted_init_guard;

static const char* reset_reason_text(esp_reset_reason_t reason)
{
    switch (reason) {
        case ESP_RST_POWERON: return "POWERON";
        case ESP_RST_SW:      return "SW_CPU_RESET";
        case ESP_RST_PANIC:   return "PANIC";
        case ESP_RST_INT_WDT: return "INT_WDT";
        case ESP_RST_TASK_WDT: return "TASK_WDT";
        case ESP_RST_WDT:     return "WDT";
        case ESP_RST_BROWNOUT: return "BROWNOUT";
        case ESP_RST_SDIO:    return "SDIO";
        default:              return "overig";
    }
}

// Vorige start strandde in hosted-init (0x107-self-reset of sdio_rx_get_buffer-assert).
static bool hosted_failed_last_boot()
{
    const esp_reset_reason_t r = esp_reset_reason();
    if (r != ESP_RST_SW && r != ESP_RST_PANIC) {
        return false;
    }
    return s_hosted_init_guard == k_hosted_init_busy ||
           s_hosted_init_guard == k_hosted_skip_until_power;
}

static void log_hosted_boot_hint(bool skip)
{
    if (skip) {
        ESP_LOGW(TAG,
                 "hosted faalde vorige start (C6/SDIO, reset %s). "
                 "wifi/MQTT overgeslagen tot stroom eraf. Dashboard aan. "
                 "GPIO54-reset wekt een zieke C6 niet; beide USB-C eraf, 5 s wachten.",
                 reset_reason_text(esp_reset_reason()));
        return;
    }
    if (esp_reset_reason() == ESP_RST_SW) {
        ESP_LOGW(TAG,
                 "start na SW_CPU_RESET. Als de C6-slave niet klaar komt: beide USB-C eraf, "
                 "5 s wachten (GPIO54-reset wekt een zieke C6 niet).");
    }
}

static void set_wifi_wait_power()
{
    AppState& st = app_state_lock();
    st.wifi = WifiStatus::WaitPowerCycle;
    st.next_retry_in_s = -1;
    app_state_unlock();
}

static void start_wifi_stack()
{
    s_hosted_init_guard = k_hosted_init_busy;
    char wifi_ssid[APP_WIFI_SSID_MAX + 1] = "";
    char wifi_pass[APP_WIFI_PASS_MAX + 1] = "";
    if (settings_store_wifi_get(wifi_ssid, sizeof(wifi_ssid), wifi_pass, sizeof(wifi_pass))) {
        ESP_LOGI(TAG, "wifi uit NVS: SSID '%s'", wifi_ssid);
    } else {
        strncpy(wifi_ssid, WIFI_SSID, sizeof(wifi_ssid) - 1);
        strncpy(wifi_pass, WIFI_PASS, sizeof(wifi_pass) - 1);
        ESP_LOGI(TAG, "wifi uit secrets.h-fallback: SSID '%s'", wifi_ssid);
    }
    net_manager_init(wifi_ssid, wifi_pass);
    s_hosted_init_guard = 0;
    time_sync_init();
    mqtt_link_init();
    backend_client_init();
    ha_client_init();
    ota_client_start();
}

static void log_boot_banner()
{
    esp_chip_info_t chip = {};
    esp_chip_info(&chip);
    uint32_t flash_size = 0;
    esp_flash_get_size(nullptr, &flash_size);
    const esp_reset_reason_t reason = esp_reset_reason();
    ESP_LOGI(TAG, "==== %s %s ====", APP_FW_NAME, APP_FW_VERSION);
    ESP_LOGI(TAG, "hardware: %s; chip rev v%d.%d, %d cores; flash %lu MB; resetoorzaak %d (%s)",
             APP_HW_VERSION, chip.revision / 100, chip.revision % 100, chip.cores,
             (unsigned long)(flash_size / (1024 * 1024)), (int)reason, reset_reason_text(reason));
}

static void log_heap(const char* wanneer)
{
    const size_t intern = heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
    const size_t intern_blok = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
    const size_t dma = heap_caps_get_free_size(MALLOC_CAP_DMA);
    const size_t dma_blok = heap_caps_get_largest_free_block(MALLOC_CAP_DMA);
    const size_t intern_dma = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA);
    const size_t intern_dma_blok = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA);
    const size_t psram = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
    ESP_LOGI(TAG,
             "heap %s: intern vrij %u KB (grootste %u KB), DMA vrij %u KB (grootste %u KB), "
             "intern+DMA vrij %u KB (grootste %u KB), PSRAM vrij %u KB",
             wanneer,
             (unsigned)(intern / 1024), (unsigned)(intern_blok / 1024),
             (unsigned)(dma / 1024), (unsigned)(dma_blok / 1024),
             (unsigned)(intern_dma / 1024), (unsigned)(intern_dma_blok / 1024),
             (unsigned)(psram / 1024));
    ESP_LOGI(TAG,
             "hosted-DMA: grootste intern+DMA-blok %u KB (doel ~300 KB; "
             "SPIRAM_MALLOC_RESERVE_INTERNAL %u KB)",
             (unsigned)(intern_dma_blok / 1024),
             (unsigned)(CONFIG_SPIRAM_MALLOC_RESERVE_INTERNAL / 1024));
}

extern "C" void app_main(void)
{
    log_boot_banner();

    // LDO3 (2,5 V) zoals in het Elecrow-voorbeeld (MIPI-DSI PHY / IO-domein).
    static esp_ldo_channel_handle_t ldo3 = nullptr;
    esp_ldo_channel_config_t ldo3_cfg = {};
    ldo3_cfg.chan_id = 3;
    ldo3_cfg.voltage_mv = 2500;
    esp_err_t err = esp_ldo_acquire_channel(&ldo3_cfg, &ldo3);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "LDO3 (2,5 V) inschakelen mislukt: %s (0x%x)", esp_err_to_name(err), err);
    }

    // NVS (nodig voor wifi-kalibratie; later ook instellingen).
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "NVS: partitie wordt gewist (%s)", esp_err_to_name(ret));
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    app_state_init();
    diag_store_init();
    live_store_init();   // mutex + NVS-read; PSRAM-velden, geen DMA/SDIO
    measurement_queue_init();  // NVS-blob metingen; compact, geen DMA
    panel_id_init();
    vent_store_init();   // klein, geen DMA; ha_client_init schrijft hiernaar
    settings_store_init();  // NVS schermtijden; klein, geen DMA
    ota_client_init();      // partitie + rollback-state; geen DMA/HTTP
    // status_store_init pas ná wifi: ~18 KB snapshot mag nooit INTERNAL/DMA opeten
    // vóór hosted-RX (m15e fallback intern bij mislukte PSRAM-alloc).

    log_heap("na lichte stores, voor display");

    // Board-init uit Elecrow bsp_* (W4): I2C-bus -> GT911 touch -> MIPI-DSI display + LVGL-port.
    err = i2c_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "I2C-init mislukt: %s (0x%x)", esp_err_to_name(err), err);
    }
    err = touch_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "touch-init (GT911) mislukt: %s (0x%x)", esp_err_to_name(err), err);
    }
    err = display_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "display-init (EK79007/LVGL) mislukt: %s (0x%x)", esp_err_to_name(err), err);
    }

    log_heap("na display/LVGL, voor wifi");
    const bool hosted_skip = hosted_failed_last_boot();
    log_hosted_boot_hint(hosted_skip);

    if (hosted_skip) {
        // Geen 8 s pauze, geen bsp_wifi_init: hosted-self-reset bij 0x107 is de freeze.
        s_hosted_init_guard = k_hosted_skip_until_power;
        set_wifi_wait_power();
        VentSnapshot vent;
        vent.ui = VentUiState::Unreachable;
        snprintf(vent.message, sizeof(vent.message), "Home Assistant niet bereikbaar");
        vent_store_set(vent);
    } else {
        // Lesson16: display_init -> bsp_wifi_init -> applicatie-UI.
        start_wifi_stack();
    }

    status_store_init();
    ui_root_init();
    screen_manager_init();
    ota_client_confirm_running();  // na UI: goede image bevestigen, anders rollback
    log_heap("na dashboard");

    if (!hosted_skip) {
        net_manager_start();
        backend_client_start();
        ha_client_start();
        ESP_LOGI(TAG, "app_main klaar; taken lopen (LVGL, net_task, mqtt, backend, ha, event loop)");
    } else {
        ESP_LOGW(TAG, "app_main klaar zonder wifi/MQTT; wacht op POWERON (beide USB-C eraf)");
    }
}
