// KOIoT Paneel - chrome (statusbalk + 5 tabs).
#include "ui/ui_chrome.h"

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <ctime>

#include "esp_log.h"
#include "lvgl.h"

#include "app_config.h"
#include "core/app_state.h"
#include "data/measurement_queue.h"
#include "data/status_store.h"
#include "ui/ui_root.h"

static const char* TAG = "ui_chrome";

static const lv_color_t COL_BAR     = lv_color_hex(0x151B21);
static const lv_color_t COL_CARD    = lv_color_hex(0x1B2229);
static const lv_color_t COL_BORDER  = lv_color_hex(0x2E3A45);
static const lv_color_t COL_TEXT    = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED   = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_GREEN   = lv_color_hex(0x2ECC71);
static const lv_color_t COL_ORANGE  = lv_color_hex(0xF39C12);
static const lv_color_t COL_RED     = lv_color_hex(0xE74C3C);
static const lv_color_t COL_NAV_ON  = lv_color_hex(0x243040);

static const char* WEEKDAYS_NL[7] = {"zo", "ma", "di", "wo", "do", "vr", "za"};
static const char* MONTHS_NL[12]  = {"jan", "feb", "mrt", "apr", "mei", "jun",
                                     "jul", "aug", "sep", "okt", "nov", "dec"};

static const char* k_nav_titles[5] = {
    "Overzicht", "Taken", "Meting invoeren", "Historie", "Instellingen"
};

lv_obj_t* ui_make_bar(lv_obj_t* parent, int y, int h)
{
    lv_obj_t* bar = lv_obj_create(parent);
    lv_obj_set_pos(bar, 0, y);
    lv_obj_set_size(bar, 1024, h);
    lv_obj_set_style_bg_color(bar, COL_BAR, 0);
    lv_obj_set_style_bg_opa(bar, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(bar, 0, 0);
    lv_obj_set_style_radius(bar, 0, 0);
    lv_obj_set_style_pad_all(bar, 0, 0);
    lv_obj_remove_flag(bar, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(bar, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(bar, LV_OBJ_FLAG_FLOATING);
    return bar;
}

lv_obj_t* ui_make_card(lv_obj_t* parent, int x, int y, int w, int h)
{
    lv_obj_t* card = lv_obj_create(parent);
    lv_obj_set_pos(card, x, y);
    lv_obj_set_size(card, w, h);
    lv_obj_set_style_bg_color(card, COL_CARD, 0);
    lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(card, COL_BORDER, 0);
    lv_obj_set_style_border_width(card, 2, 0);
    lv_obj_set_style_radius(card, 12, 0);
    lv_obj_set_style_pad_all(card, 12, 0);
    lv_obj_remove_flag(card, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(card, LV_OBJ_FLAG_CLICKABLE);
    return card;
}

lv_obj_t* ui_make_label(lv_obj_t* parent, int x, int y, const lv_font_t* font,
                        lv_color_t color, const char* text)
{
    lv_obj_t* lbl = lv_label_create(parent);
    lv_obj_set_pos(lbl, x, y);
    lv_obj_set_style_text_font(lbl, font, 0);
    lv_obj_set_style_text_color(lbl, color, 0);
    lv_label_set_text(lbl, text);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    return lbl;
}

void ui_format_nl(char* out, size_t out_len, double v, int decimals)
{
    char tmp[32];
    snprintf(tmp, sizeof(tmp), "%.*f", decimals, v);
    for (char* p = tmp; *p != '\0'; p++) {
        if (*p == '.') {
            *p = ',';
        }
    }
    snprintf(out, out_len, "%s", tmp);
}

UiStatusBar ui_status_bar_create(lv_obj_t* parent)
{
    UiStatusBar bar;
    lv_obj_t* status = ui_make_bar(parent, 0, APP_UI_STATUS_H);
    bar.clock = ui_make_label(status, 16, 8, &lv_font_montserrat_30, COL_TEXT, "--:--");
    bar.date = ui_make_label(status, 150, 14, &lv_font_montserrat_20, COL_MUTED, "-- --- ----");
    bar.backend = ui_make_label(status, 0, 12, &lv_font_montserrat_20, COL_MUTED, "app  -");
    lv_obj_align(bar.backend, LV_ALIGN_RIGHT_MID, -16, 0);
    bar.mqtt = ui_make_label(status, 0, 12, &lv_font_montserrat_20, COL_MUTED, "MQTT  --");
    lv_obj_align(bar.mqtt, LV_ALIGN_RIGHT_MID, -200, 0);
    bar.wifi = ui_make_label(status, 0, 12, &lv_font_montserrat_20, COL_MUTED, LV_SYMBOL_WIFI "  --");
    lv_obj_align(bar.wifi, LV_ALIGN_RIGHT_MID, -360, 0);
    return bar;
}

void ui_status_bar_update(const UiStatusBar& bar, const AppState& st, const StatusSnapshot& app)
{
    if (st.time_synced) {
        time_t now = time(nullptr);
        struct tm tm_local = {};
        localtime_r(&now, &tm_local);
        lv_label_set_text_fmt(bar.clock, "%02d:%02d:%02d",
                              tm_local.tm_hour, tm_local.tm_min, tm_local.tm_sec);
        lv_label_set_text_fmt(bar.date, "%s %d %s %d",
                              WEEKDAYS_NL[tm_local.tm_wday], tm_local.tm_mday,
                              MONTHS_NL[tm_local.tm_mon], tm_local.tm_year + 1900);
    } else {
        lv_label_set_text(bar.clock, "--:--");
        lv_label_set_text(bar.date, "-- --- ----");
    }

    switch (st.wifi) {
        case WifiStatus::Connected:
            lv_label_set_text_fmt(bar.wifi, LV_SYMBOL_WIFI "  %d", (int)st.rssi);
            lv_obj_set_style_text_color(bar.wifi, COL_GREEN, 0);
            break;
        case WifiStatus::Connecting:
            lv_label_set_text(bar.wifi, LV_SYMBOL_WIFI "  ...");
            lv_obj_set_style_text_color(bar.wifi, COL_ORANGE, 0);
            break;
        case WifiStatus::WaitPowerCycle:
            lv_label_set_text(bar.wifi, LV_SYMBOL_WIFI "  C6");
            lv_obj_set_style_text_color(bar.wifi, COL_ORANGE, 0);
            break;
        case WifiStatus::Disconnected:
            lv_label_set_text(bar.wifi, LV_SYMBOL_WIFI "  --");
            lv_obj_set_style_text_color(bar.wifi, COL_RED, 0);
            break;
        case WifiStatus::Idle:
        default:
            lv_label_set_text(bar.wifi, LV_SYMBOL_WIFI "  --");
            lv_obj_set_style_text_color(bar.wifi, COL_MUTED, 0);
            break;
    }

    switch (st.mqtt) {
        case MqttStatus::Connected:
            lv_label_set_text(bar.mqtt, "MQTT  OK");
            lv_obj_set_style_text_color(bar.mqtt, COL_GREEN, 0);
            break;
        case MqttStatus::Connecting:
            lv_label_set_text(bar.mqtt, "MQTT  ...");
            lv_obj_set_style_text_color(bar.mqtt, COL_ORANGE, 0);
            break;
        case MqttStatus::Error:
            lv_label_set_text(bar.mqtt, "MQTT  fout");
            lv_obj_set_style_text_color(bar.mqtt, COL_RED, 0);
            break;
        case MqttStatus::Disconnected:
            lv_label_set_text(bar.mqtt, "MQTT  --");
            lv_obj_set_style_text_color(bar.mqtt, COL_ORANGE, 0);
            break;
        case MqttStatus::Idle:
        default:
            lv_label_set_text(bar.mqtt, "MQTT  --");
            lv_obj_set_style_text_color(bar.mqtt, COL_MUTED, 0);
            break;
    }

    switch (app.fetch) {
        case StatusFetchState::Ok:
            if (measurement_queue_pending_count() > 0) {
                lv_label_set_text_fmt(bar.backend, "app  OK  q%d",
                                      measurement_queue_pending_count());
            } else {
                lv_label_set_text(bar.backend, "app  OK");
            }
            lv_obj_set_style_text_color(bar.backend,
                                        app.data_stale_warn ? COL_ORANGE : COL_GREEN, 0);
            break;
        case StatusFetchState::Fetching:
            lv_label_set_text(bar.backend, "app  ...");
            lv_obj_set_style_text_color(bar.backend, COL_ORANGE, 0);
            break;
        case StatusFetchState::TokenInvalid:
            lv_label_set_text(bar.backend, "app  token");
            lv_obj_set_style_text_color(bar.backend, COL_RED, 0);
            break;
        case StatusFetchState::Error:
            lv_label_set_text(bar.backend, app.has_data ? "app  fout" : "app  fout");
            lv_obj_set_style_text_color(bar.backend, COL_ORANGE, 0);
            break;
        case StatusFetchState::Never:
        default:
            if (measurement_queue_pending_count() > 0) {
                lv_label_set_text_fmt(bar.backend, "app  q%d",
                                      measurement_queue_pending_count());
                lv_obj_set_style_text_color(bar.backend, COL_ORANGE, 0);
            } else {
                lv_label_set_text(bar.backend, "app  -");
                lv_obj_set_style_text_color(bar.backend, COL_MUTED, 0);
            }
            break;
    }
}

static void on_nav(lv_event_t* e)
{
    const int idx = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    if (idx == 0) {
        ui_root_show(UiPage::Overview);
        return;
    }
    if (idx == 1) {
        ui_root_show(UiPage::Tasks);
        return;
    }
    if (idx == 2) {
        ui_root_show(UiPage::Entry);
        return;
    }
    if (idx == 3) {
        ui_root_show(UiPage::History);
        return;
    }
    if (idx == 4) {
        ui_root_show(UiPage::Settings);
        return;
    }
    ESP_LOGI(TAG, "navigatie '%s' is nog niet beschikbaar", k_nav_titles[idx]);
}

UiNav ui_nav_create(lv_obj_t* parent, int active)
{
    UiNav nav;
    nav.bar = ui_make_bar(parent, 600 - APP_UI_NAV_H, APP_UI_NAV_H);
    const int w = 204;
    for (int i = 0; i < 5; i++) {
        lv_obj_t* tab = lv_obj_create(nav.bar);
        lv_obj_set_pos(tab, i * w, 0);
        lv_obj_set_size(tab, (i == 4) ? (1024 - 4 * w) : w, APP_UI_NAV_H);
        lv_obj_set_style_bg_color(tab, (i == active) ? COL_NAV_ON : COL_BAR, 0);
        lv_obj_set_style_bg_opa(tab, LV_OPA_COVER, 0);
        lv_obj_set_style_border_width(tab, 0, 0);
        lv_obj_set_style_radius(tab, 0, 0);
        lv_obj_set_style_pad_all(tab, 0, 0);
        lv_obj_remove_flag(tab, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_style_bg_color(tab, COL_NAV_ON, LV_STATE_PRESSED);
        if (i != active) {
            lv_obj_add_flag(tab, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_add_event_cb(tab, on_nav, LV_EVENT_CLICKED,
                                reinterpret_cast<void*>(static_cast<intptr_t>(i)));
        } else {
            lv_obj_remove_flag(tab, LV_OBJ_FLAG_CLICKABLE);
        }

        lv_obj_t* lbl = lv_label_create(tab);
        lv_label_set_text(lbl, k_nav_titles[i]);
        lv_obj_set_style_text_font(lbl, (i == 2) ? &lv_font_montserrat_14 : &lv_font_montserrat_20, 0);
        lv_obj_set_style_text_color(lbl, (i == active) ? COL_TEXT : COL_MUTED, 0);
        lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_center(lbl);

        if (i == 1) {
            nav.badge = lv_label_create(tab);
            lv_label_set_text(nav.badge, "");
            lv_obj_set_style_text_font(nav.badge, &lv_font_montserrat_14, 0);
            lv_obj_set_style_text_color(nav.badge, COL_TEXT, 0);
            lv_obj_set_style_bg_color(nav.badge, COL_RED, 0);
            lv_obj_set_style_bg_opa(nav.badge, LV_OPA_COVER, 0);
            lv_obj_set_style_radius(nav.badge, 10, 0);
            lv_obj_set_style_pad_left(nav.badge, 6, 0);
            lv_obj_set_style_pad_right(nav.badge, 6, 0);
            lv_obj_set_style_pad_top(nav.badge, 2, 0);
            lv_obj_set_style_pad_bottom(nav.badge, 2, 0);
            lv_obj_remove_flag(nav.badge, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_align(nav.badge, LV_ALIGN_TOP_RIGHT, -8, 6);
            lv_obj_add_flag(nav.badge, LV_OBJ_FLAG_HIDDEN);
        }
    }
    return nav;
}

void ui_nav_set_badge(UiNav& nav, int count)
{
    if (nav.badge == nullptr) {
        return;
    }
    if (count <= 0) {
        lv_obj_add_flag(nav.badge, LV_OBJ_FLAG_HIDDEN);
        return;
    }
    if (count > 9) {
        lv_label_set_text(nav.badge, "9+");
    } else {
        lv_label_set_text_fmt(nav.badge, "%d", count);
    }
    lv_obj_remove_flag(nav.badge, LV_OBJ_FLAG_HIDDEN);
}
