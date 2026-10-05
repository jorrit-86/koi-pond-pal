// KOIoT Paneel - screen_manager (M1.7).
#include "core/screen_manager.h"

#include "esp_log.h"
#include "esp_timer.h"
#include "lvgl.h"

#include "app_config.h"
#include "bsp_display.h"
#include "core/settings_store.h"
#include "data/live_store.h"
#include "data/status_store.h"
#include "data/vent_store.h"
#include "io/mqtt_link.h"
#include "io/ota_client.h"
#include "ui/screen_dashboard.h"
#include "ui/screen_entry.h"
#include "ui/screen_history.h"
#include "ui/screen_settings.h"
#include "ui/screen_tasks.h"
#include "ui/ui_root.h"

static const char* TAG = "screen_mgr";

enum class HaScreenCmd : uint8_t {
    None = 0,
    On,
    Off,
};

static ScreenMode s_mode = ScreenMode::Active;
static int64_t s_last_touch_us = 0;
static int64_t s_idle_since_us = 0;
static volatile HaScreenCmd s_ha_cmd = HaScreenCmd::None;
static bool s_leak_was = false;
static bool s_inited = false;

static const char* mode_text(ScreenMode m)
{
    switch (m) {
        case ScreenMode::Idle: return "Rust";
        case ScreenMode::Off:  return "Uit";
        case ScreenMode::Active:
        default:               return "Actief";
    }
}

static bool request_running()
{
    if (status_store_is_close_busy()) {
        return true;
    }
    if (ota_client_is_busy()) {
        return true;
    }
    const VentSnapshot v = vent_store_snapshot();
    return v.ui == VentUiState::Pending || v.auto_pending;
}

static void apply_blight(uint32_t percent)
{
    const esp_err_t err = set_lcd_blight(percent);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: backlight %u%%: %s (0x%x)",
                 (unsigned)percent, esp_err_to_name(err), err);
        return;
    }
    ESP_LOGI(TAG, "backlight %u%%", (unsigned)percent);
}

static void publish_ha()
{
    mqtt_link_publish_screen_state(s_mode != ScreenMode::Off);
}

static void enter_active(const char* why)
{
    const ScreenMode prev = s_mode;
    const bool was_active = (prev == ScreenMode::Active);
    s_mode = ScreenMode::Active;
    s_last_touch_us = esp_timer_get_time();
    s_idle_since_us = 0;
    if (was_active) {
        ESP_LOGI(TAG, "T1 opnieuw (%s)", why);
        return;
    }
    ui_root_enter_active();
    const ScreenSettings cfg = settings_store_screen();
    apply_blight(cfg.brightness_active);
    publish_ha();
    ESP_LOGI(TAG, "scherm %s -> Actief (%s)", mode_text(prev), why);
}

static void enter_idle(const char* why)
{
    screen_tasks_dismiss_popups();
    screen_dashboard_dismiss_popup();
    screen_entry_dismiss();
    screen_history_dismiss();
    screen_settings_dismiss();
    const ScreenMode prev = s_mode;
    s_mode = ScreenMode::Idle;
    s_idle_since_us = esp_timer_get_time();
    ui_root_enter_idle();
    const ScreenSettings cfg = settings_store_screen();
    apply_blight(cfg.brightness_idle);
    publish_ha();
    ESP_LOGI(TAG, "scherm %s -> Rust (%s)", mode_text(prev), why);
}

static void enter_off(const char* why)
{
    screen_tasks_dismiss_popups();
    screen_dashboard_dismiss_popup();
    screen_entry_dismiss();
    screen_history_dismiss();
    screen_settings_dismiss();
    const ScreenMode prev = s_mode;
    s_mode = ScreenMode::Off;
    s_idle_since_us = 0;
    ui_root_enter_idle();
    apply_blight(0);
    publish_ha();
    ESP_LOGI(TAG, "scherm %s -> Uit (%s)", mode_text(prev), why);
}

void screen_manager_init()
{
    s_mode = ScreenMode::Active;
    s_last_touch_us = esp_timer_get_time();
    s_idle_since_us = 0;
    s_ha_cmd = HaScreenCmd::None;
    s_leak_was = false;
    s_inited = true;
    const ScreenSettings cfg = settings_store_screen();
    apply_blight(cfg.brightness_active);
    ESP_LOGI(TAG, "energiestand klaar: Actief, T1=%u s T2=%u s rustscherm=%s",
             (unsigned)cfg.t1_s, (unsigned)cfg.t2_s,
             cfg.idle_screen_enabled ? "aan" : "uit");
}

void screen_manager_apply_brightness()
{
    if (!s_inited) {
        return;
    }
    const ScreenSettings cfg = settings_store_screen();
    if (s_mode == ScreenMode::Active) {
        apply_blight(cfg.brightness_active);
    } else if (s_mode == ScreenMode::Idle) {
        apply_blight(cfg.brightness_idle);
    }
}

ScreenMode screen_manager_mode()
{
    return s_mode;
}

bool screen_manager_ha_switch_on()
{
    return s_mode != ScreenMode::Off;
}

void screen_manager_request_ha_on()
{
    s_ha_cmd = HaScreenCmd::On;
}

void screen_manager_request_ha_off()
{
    s_ha_cmd = HaScreenCmd::Off;
}

void screen_manager_on_pointer_pressed()
{
    if (!s_inited) {
        return;
    }
    lv_indev_t* indev = lv_indev_active();
    if (s_mode != ScreenMode::Active) {
        if (indev != nullptr) {
            lv_indev_wait_release(indev);
        }
        enter_active("aanraking");
        return;
    }
    s_last_touch_us = esp_timer_get_time();
}

void screen_manager_tick()
{
    if (!s_inited) {
        return;
    }

    const HaScreenCmd cmd = s_ha_cmd;
    if (cmd != HaScreenCmd::None) {
        s_ha_cmd = HaScreenCmd::None;
        if (cmd == HaScreenCmd::On) {
            enter_active("HA schakelaar ON");
        } else if (request_running()) {
            ESP_LOGW(TAG, "HA schakelaar OFF genegeerd: verzoek loopt");
        } else {
            enter_off("HA schakelaar OFF");
        }
    }

    const LiveSnapshot live = live_store_snapshot();
    if (live.leak_alarm && !s_leak_was && s_mode != ScreenMode::Active) {
        enter_active("lekalarm");
    }
    s_leak_was = live.leak_alarm;

    if (s_mode == ScreenMode::Idle) {
        if (request_running()) {
            return;
        }
        const ScreenSettings idle_cfg = settings_store_screen();
        if (idle_cfg.t2_s == 0) {
            return;
        }
        const int64_t now = esp_timer_get_time();
        const int64_t t2_us = static_cast<int64_t>(idle_cfg.t2_s) * 1000000LL;
        if (s_idle_since_us != 0 && now - s_idle_since_us >= t2_us) {
            enter_off("T2 na Rust");
        }
        return;
    }
    if (s_mode != ScreenMode::Active) {
        return;
    }
    if (request_running()) {
        return;
    }

    const ScreenSettings cfg = settings_store_screen();
    const int64_t now = esp_timer_get_time();
    const int64_t idle_us = static_cast<int64_t>(cfg.t1_s) * 1000000LL;
    if (now - s_last_touch_us < idle_us) {
        return;
    }

    if (cfg.idle_screen_enabled) {
        enter_idle("T1 zonder aanraking");
        return;
    }
    enter_off("T1, rustscherm uit");
}
