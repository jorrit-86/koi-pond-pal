// KOIoT Paneel - ui_root (implementatie).
#include "ui/ui_root.h"

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_lvgl_port.h"
#include "lvgl.h"

#include "app_config.h"
#include "core/app_state.h"
#include "core/screen_manager.h"
#include "data/live_store.h"
#include "data/status_store.h"
#include "io/ha_client.h"
#include "ui/screen_dashboard.h"
#include "ui/screen_entry.h"
#include "ui/screen_history.h"
#include "ui/screen_idle.h"
#include "ui/screen_settings.h"
#include "ui/screen_tasks.h"

static const char* TAG = "ui_root";

static lv_obj_t* s_leak_banner = nullptr;
static lv_obj_t* s_leak_label = nullptr;
static bool s_leak_shown = false;
static lv_obj_t* s_c6_banner = nullptr;
static lv_obj_t* s_c6_label = nullptr;
static bool s_c6_shown = false;
static UiPage s_page = UiPage::Overview;
static lv_obj_t* s_scr_dash = nullptr;
static lv_obj_t* s_scr_tasks = nullptr;
static lv_obj_t* s_scr_entry = nullptr;
static lv_obj_t* s_scr_history = nullptr;
static lv_obj_t* s_scr_idle = nullptr;
static lv_obj_t* s_scr_settings = nullptr;
static bool s_idle_shown = false;
static StatusSnapshot* s_status_snap_ptr = nullptr;
#define s_status_snap (*s_status_snap_ptr)

static const lv_color_t COL_LEAK = lv_color_hex(0xE74C3C);
static const lv_color_t COL_LEAK_TEXT = lv_color_hex(0xFFFFFF);
static const lv_color_t COL_C6 = lv_color_hex(0xF39C12);
static const lv_color_t COL_C6_TEXT = lv_color_hex(0x0E1216);

static void log_ui_heap(const char* wanneer)
{
    const size_t intern = heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
    const size_t dma = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA);
    const size_t psram = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
    ESP_LOGI(TAG, "heap %s: intern vrij %u KB, intern+DMA %u KB, PSRAM %u KB",
             wanneer,
             static_cast<unsigned>(intern / 1024),
             static_cast<unsigned>(dma / 1024),
             static_cast<unsigned>(psram / 1024));
}

static void leak_banner_set(bool on)
{
    if (s_leak_banner == nullptr) {
        return;
    }
    if (on) {
        lv_obj_remove_flag(s_leak_banner, LV_OBJ_FLAG_HIDDEN);
        lv_obj_remove_flag(s_leak_banner, LV_OBJ_FLAG_CLICKABLE);
        if (s_leak_label != nullptr) {
            lv_obj_remove_flag(s_leak_label, LV_OBJ_FLAG_CLICKABLE);
        }
    } else {
        lv_obj_add_flag(s_leak_banner, LV_OBJ_FLAG_HIDDEN);
        lv_obj_remove_flag(s_leak_banner, LV_OBJ_FLAG_CLICKABLE);
    }
    if (on != s_leak_shown) {
        s_leak_shown = on;
        if (on) {
            ESP_LOGW(TAG, "lekbanner zichtbaar (flow_leak=ON); energiestand wekt bij lek (M1.7)");
        } else {
            ESP_LOGI(TAG, "lekbanner weg (flow_leak=OFF)");
        }
    }
}

static void c6_banner_set(bool on)
{
    if (s_c6_banner == nullptr) {
        return;
    }
    if (on) {
        lv_obj_remove_flag(s_c6_banner, LV_OBJ_FLAG_HIDDEN);
        lv_obj_remove_flag(s_c6_banner, LV_OBJ_FLAG_CLICKABLE);
        if (s_c6_label != nullptr) {
            lv_obj_remove_flag(s_c6_label, LV_OBJ_FLAG_CLICKABLE);
        }
        lv_obj_move_foreground(s_c6_banner);
    } else {
        lv_obj_add_flag(s_c6_banner, LV_OBJ_FLAG_HIDDEN);
        lv_obj_remove_flag(s_c6_banner, LV_OBJ_FLAG_CLICKABLE);
    }
    if (on != s_c6_shown) {
        s_c6_shown = on;
        if (on) {
            ESP_LOGW(TAG, "C6-banner: Wifi wacht op stroom-eraf (C6)");
        }
    }
}

static void ui_refresh_timer_cb(lv_timer_t*)
{
    screen_manager_tick();
    const ScreenMode mode = screen_manager_mode();
    if (mode == ScreenMode::Off) {
        return;
    }

    const AppState snap = app_state_snapshot();
    const LiveSnapshot live = live_store_snapshot();
    if (s_status_snap_ptr != nullptr) {
        status_store_snapshot(&s_status_snap);
        if (mode == ScreenMode::Idle) {
            screen_idle_update(snap, live, s_status_snap);
            return;
        }
        screen_dashboard_update(snap, live, s_status_snap);
        if (s_page == UiPage::Tasks) {
            screen_tasks_update(snap, live, s_status_snap);
        } else if (s_page == UiPage::Entry) {
            screen_entry_update(snap, s_status_snap);
            screen_tasks_pump_unload();
        } else if (s_page == UiPage::History) {
            screen_history_update(snap, s_status_snap);
            screen_tasks_pump_unload();
        } else if (s_page == UiPage::Settings) {
            screen_settings_update(snap, s_status_snap);
            screen_tasks_pump_unload();
        } else {
            screen_tasks_pump_unload();
        }
    }
    leak_banner_set(live.leak_alarm);
    c6_banner_set(snap.wifi == WifiStatus::WaitPowerCycle && !live.leak_alarm);
}

static void create_leak_banner(lv_obj_t* parent)
{
    s_leak_banner = lv_obj_create(parent);
    lv_obj_set_pos(s_leak_banner, 0, APP_UI_STATUS_H);
    lv_obj_set_size(s_leak_banner, 1024, APP_UI_BANNER_H);
    lv_obj_set_style_bg_color(s_leak_banner, COL_LEAK, 0);
    lv_obj_set_style_bg_opa(s_leak_banner, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(s_leak_banner, 0, 0);
    lv_obj_set_style_radius(s_leak_banner, 0, 0);
    lv_obj_set_style_pad_all(s_leak_banner, 0, 0);
    lv_obj_remove_flag(s_leak_banner, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_leak_banner, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_leak_banner, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_leak_banner, LV_OBJ_FLAG_FLOATING);

    s_leak_label = lv_label_create(s_leak_banner);
    lv_label_set_text(s_leak_label, "LEK ALARM  bijvulwater");
    lv_obj_set_style_text_font(s_leak_label, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(s_leak_label, COL_LEAK_TEXT, 0);
    lv_obj_remove_flag(s_leak_label, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(s_leak_label);
}

static void create_c6_banner(lv_obj_t* parent)
{
    s_c6_banner = lv_obj_create(parent);
    lv_obj_set_pos(s_c6_banner, 0, APP_UI_STATUS_H);
    lv_obj_set_size(s_c6_banner, 1024, APP_UI_BANNER_H);
    lv_obj_set_style_bg_color(s_c6_banner, COL_C6, 0);
    lv_obj_set_style_bg_opa(s_c6_banner, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(s_c6_banner, 0, 0);
    lv_obj_set_style_radius(s_c6_banner, 0, 0);
    lv_obj_set_style_pad_all(s_c6_banner, 0, 0);
    lv_obj_remove_flag(s_c6_banner, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_c6_banner, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_c6_banner, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_c6_banner, LV_OBJ_FLAG_FLOATING);

    s_c6_label = lv_label_create(s_c6_banner);
    lv_label_set_text(s_c6_label, "Wifi wacht op stroom-eraf (C6)");
    lv_obj_set_style_text_font(s_c6_label, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(s_c6_label, COL_C6_TEXT, 0);
    lv_obj_remove_flag(s_c6_label, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(s_c6_label);
}

static void ensure_status_snap()
{
    if (s_status_snap_ptr != nullptr) {
        return;
    }
    s_status_snap_ptr = static_cast<StatusSnapshot*>(
        heap_caps_calloc(1, sizeof(StatusSnapshot), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (s_status_snap_ptr == nullptr) {
        ESP_LOGE(TAG, "UI-snapshot: geen PSRAM (%u B); geen interne fallback (hosted-DMA)",
                 static_cast<unsigned>(sizeof(StatusSnapshot)));
    } else {
        ESP_LOGI(TAG, "UI-snapshot %u B in PSRAM",
                 static_cast<unsigned>(sizeof(StatusSnapshot)));
    }
}

static void ensure_tasks_screen()
{
    if (s_scr_tasks != nullptr) {
        return;
    }
    s_scr_tasks = screen_tasks_create();
    log_ui_heap("na Taken-scherm (chrome, nog geen kaarten)");
}

static void ensure_settings_screen()
{
    if (s_scr_settings != nullptr) {
        return;
    }
    s_scr_settings = screen_settings_create();
    log_ui_heap("na Instellingen-scherm");
}

static bool s_entry_want_show = false;
static lv_timer_t* s_entry_boot_timer = nullptr;
static bool s_settings_want_show = false;
static lv_timer_t* s_settings_boot_timer = nullptr;

static void ensure_entry_screen()
{
    if (s_scr_entry != nullptr) {
        return;
    }
    s_scr_entry = screen_entry_create();
    log_ui_heap("na invoerscherm (boot-timer, niet in click)");
}

static void settings_boot_timer_cb(lv_timer_t* t)
{
    if (t != nullptr) {
        lv_timer_pause(t);
    }
    ensure_settings_screen();
    if (s_settings_want_show && s_scr_settings != nullptr) {
        s_settings_want_show = false;
        ui_root_show(UiPage::Settings);
    }
}

static void entry_boot_timer_cb(lv_timer_t* t)
{
    if (t != nullptr) {
        lv_timer_pause(t);
    }
    ensure_entry_screen();
    if (s_settings_boot_timer != nullptr) {
        lv_timer_reset(s_settings_boot_timer);
        lv_timer_resume(s_settings_boot_timer);
    }
    if (s_entry_want_show && s_scr_entry != nullptr) {
        s_entry_want_show = false;
        ui_root_show(UiPage::Entry);
    }
}

static void ensure_history_screen()
{
    if (s_scr_history != nullptr) {
        return;
    }
    s_scr_history = screen_history_create();
    log_ui_heap("na historie-scherm");
}

static void ensure_idle_screen()
{
    if (s_scr_idle != nullptr) {
        return;
    }
    s_scr_idle = screen_idle_create();
}

static void on_pointer_pressed(lv_event_t*)
{
    screen_manager_on_pointer_pressed();
    if (screen_manager_mode() == ScreenMode::Active) {
        screen_dashboard_touch_feedback();
    }
}

static void install_pointer_hook()
{
    static bool hooked = false;
    if (hooked) {
        return;
    }
    lv_indev_t* indev = nullptr;
    while ((indev = lv_indev_get_next(indev)) != nullptr) {
        if (lv_indev_get_type(indev) == LV_INDEV_TYPE_POINTER) {
            lv_indev_add_event_cb(indev, on_pointer_pressed, LV_EVENT_PRESSED, nullptr);
        }
    }
    hooked = true;
}

void ui_root_init()
{
    if (!lvgl_port_lock(0)) {
        ESP_LOGE(TAG, "LVGL-lock niet verkregen; UI niet opgebouwd");
        return;
    }
    ensure_status_snap();
    s_scr_dash = screen_dashboard_create();
    create_leak_banner(s_scr_dash);
    create_c6_banner(s_scr_dash);
    ensure_idle_screen();
    {
        const AppState st = app_state_snapshot();
        c6_banner_set(st.wifi == WifiStatus::WaitPowerCycle);
    }
    lv_screen_load(s_scr_dash);
    s_page = UiPage::Overview;
    s_idle_shown = false;
    install_pointer_hook();
    lv_timer_create(ui_refresh_timer_cb, APP_UI_REFRESH_MS, nullptr);
    s_entry_boot_timer = lv_timer_create(entry_boot_timer_cb, 80, nullptr);
    if (s_entry_boot_timer == nullptr) {
        ESP_LOGE(TAG, "invoer-boot-timer faalde; scherm volgt bij eerste veilige tick");
    }
    s_settings_boot_timer = lv_timer_create(settings_boot_timer_cb, 80, nullptr);
    if (s_settings_boot_timer != nullptr) {
        lv_timer_pause(s_settings_boot_timer);
    } else {
        ESP_LOGE(TAG, "instellingen-boot-timer faalde; scherm volgt bij eerste tab");
    }
    lvgl_port_unlock();
    log_ui_heap("na Overzicht (invoerscherm via 80 ms-timer, niet bij tab-click)");
    ESP_LOGI(TAG, "Overzicht geladen; invoerscherm pre-build via timer. UI-refresh elke %d ms (geen LVGL vanuit HTTP/MQTT)",
             APP_UI_REFRESH_MS);
}

void ui_root_show(UiPage page)
{
    if (page == s_page && !s_idle_shown) {
        return;
    }
    if (page != UiPage::Overview) {
        screen_dashboard_dismiss_popup();
    }
    if (page != UiPage::Entry) {
        screen_entry_dismiss();
    }
    if (page != UiPage::History) {
        screen_history_dismiss();
    }
    if (page != UiPage::Settings) {
        screen_settings_dismiss();
    }
    if (page == UiPage::Tasks) {
        ensure_tasks_screen();
    }
    if (page == UiPage::Settings) {
        if (s_scr_settings == nullptr) {
            s_settings_want_show = true;
            if (s_settings_boot_timer != nullptr) {
                lv_timer_reset(s_settings_boot_timer);
                lv_timer_resume(s_settings_boot_timer);
                ESP_LOGI(TAG, "instellingen nog niet klaar; tab wacht op boot-timer");
                return;
            }
            ensure_settings_screen();
        }
    }
    if (page == UiPage::Entry) {
        if (s_scr_entry == nullptr) {
            s_entry_want_show = true;
            if (s_entry_boot_timer != nullptr) {
                lv_timer_reset(s_entry_boot_timer);
                lv_timer_resume(s_entry_boot_timer);
            }
            ESP_LOGI(TAG, "invoerscherm nog niet klaar; tab wacht op boot-timer");
            return;
        }
    }
    if (page == UiPage::History) {
        ensure_history_screen();
    }
    lv_obj_t* next = s_scr_dash;
    const char* name = "Overzicht";
    if (page == UiPage::Tasks) {
        next = s_scr_tasks;
        name = "Taken";
    } else if (page == UiPage::Settings) {
        next = s_scr_settings;
        name = "Instellingen";
    } else if (page == UiPage::Entry) {
        next = s_scr_entry;
        name = "Meting invoeren";
    } else if (page == UiPage::History) {
        next = s_scr_history;
        name = "Historie";
    }
    if (next == nullptr) {
        return;
    }
    lv_screen_load(next);
    s_page = page;
    s_idle_shown = false;
    ha_client_set_fast_poll(page == UiPage::Overview);
    ESP_LOGI(TAG, "scherm %s", name);
    if (page == UiPage::Tasks && s_status_snap_ptr != nullptr) {
        screen_tasks_set_visible(true);
        const AppState snap = app_state_snapshot();
        const LiveSnapshot live = live_store_snapshot();
        screen_tasks_update(snap, live, s_status_snap);
    } else {
        screen_tasks_set_visible(false);
    }
    screen_history_set_visible(page == UiPage::History);
}

void ui_root_enter_idle()
{
    ensure_idle_screen();
    if (s_scr_idle == nullptr) {
        return;
    }
    lv_screen_load(s_scr_idle);
    s_idle_shown = true;
    ha_client_set_fast_poll(false);
    screen_tasks_set_visible(false);
    screen_history_set_visible(false);
    screen_entry_dismiss();
    screen_history_dismiss();
    screen_settings_dismiss();
    screen_idle_on_enter();
}

void ui_root_enter_active()
{
    if (s_scr_dash == nullptr) {
        return;
    }
    lv_screen_load(s_scr_dash);
    s_page = UiPage::Overview;
    s_idle_shown = false;
    ha_client_set_fast_poll(true);
    screen_tasks_set_visible(false);
    screen_history_set_visible(false);
    ESP_LOGI(TAG, "scherm Overzicht (gewekt)");
}

UiPage ui_root_current()
{
    return s_page;
}
