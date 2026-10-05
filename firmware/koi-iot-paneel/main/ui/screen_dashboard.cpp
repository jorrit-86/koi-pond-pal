// KOIoT Paneel - Overzicht-dashboard (implementatie).
#include "ui/screen_dashboard.h"

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <ctime>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "lvgl.h"

#include "app_config.h"
#include "core/app_state.h"
#include "data/live_store.h"
#include "data/measurement_queue.h"
#include "data/param_catalog.h"
#include "data/status_store.h"
#include "data/vent_store.h"
#include "io/ha_client.h"
#include "ui/screen_measure.h"
#include "ui/ui_chrome.h"
#include "ui/ui_root.h"

static const lv_color_t COL_BG     = lv_color_hex(0x0E1216);
static const lv_color_t COL_TEXT   = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED  = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_ORANGE = lv_color_hex(0xF39C12);
static const lv_color_t COL_BLUE   = lv_color_hex(0x3498DB);
static const lv_color_t COL_GREEN  = lv_color_hex(0x2ECC71);
static const lv_color_t COL_BTN    = lv_color_hex(0x2A3540);
static const lv_color_t COL_CARD   = lv_color_hex(0x1B2229);
static const lv_color_t COL_CARD_OFF = lv_color_hex(0x14181C);
static const lv_color_t COL_BORDER = lv_color_hex(0x2E3A45);

static const char* MONTHS_NL[12] = {"jan", "feb", "mrt", "apr", "mei", "jun",
                                    "jul", "aug", "sep", "okt", "nov", "dec"};

static lv_obj_t* s_scr = nullptr;
static UiStatusBar s_status;
static UiNav s_nav;

static lv_obj_t* s_water_value = nullptr;
static lv_obj_t* s_water_meta = nullptr;
static lv_obj_t* s_air_temp = nullptr;
static lv_obj_t* s_air_rh = nullptr;
static lv_obj_t* s_air_meta = nullptr;
static lv_obj_t* s_ph_value = nullptr;
static lv_obj_t* s_ph_meta = nullptr;
static lv_obj_t* s_flow_rate = nullptr;
static lv_obj_t* s_flow_today = nullptr;
static lv_obj_t* s_flow_meta = nullptr;
static lv_obj_t* s_season_card = nullptr;
static lv_obj_t* s_season_line = nullptr;
static lv_obj_t* s_feed_line = nullptr;
static lv_obj_t* s_vent_meta = nullptr;
static lv_obj_t* s_vent_btn[3] = {};
static lv_obj_t* s_vent_lbl[3] = {};
static lv_obj_t* s_vent_auto_btn = nullptr;
static lv_obj_t* s_vent_auto_lbl = nullptr;
static lv_obj_t* s_tasks_count = nullptr;
static lv_obj_t* s_tasks_title = nullptr;
static lv_obj_t* s_man_val[k_param_count] = {};
static lv_obj_t* s_man_meta[k_param_count] = {};
static MeasSnapshot* s_meas_snap = nullptr;

static const char* TAG = "screen_dash";

static void format_age(const LiveFieldSnap& f, char* out, size_t out_len)
{
    if (!f.present) {
        snprintf(out, out_len, "wacht op data");
        return;
    }
    const char* src = f.from_database ? "laatst opgeslagen" : nullptr;
    if (f.age_s < 0) {
        snprintf(out, out_len, "%s", src != nullptr ? src : "");
        return;
    }
    if (f.stale) {
        int mins = f.age_s / 60;
        if (mins < 1) {
            mins = 1;
        }
        if (src != nullptr) {
            snprintf(out, out_len, "%s, verouderd (%d min)", src, mins);
        } else {
            snprintf(out, out_len, "verouderd (%d min)", mins);
        }
        return;
    }
    char age[24];
    if (f.age_s < 60) {
        snprintf(age, sizeof(age), "%d s", static_cast<int>(f.age_s));
    } else {
        snprintf(age, sizeof(age), "%d min", static_cast<int>(f.age_s / 60));
    }
    if (src != nullptr) {
        snprintf(out, out_len, "%s, %s", src, age);
    } else {
        snprintf(out, out_len, "%s", age);
    }
}

static lv_color_t age_color(const LiveFieldSnap& f)
{
    if (!f.present) {
        return COL_MUTED;
    }
    return f.stale ? COL_ORANGE : COL_MUTED;
}

static lv_color_t value_color(const LiveFieldSnap& f)
{
    if (!f.present) {
        return COL_MUTED;
    }
    return f.stale ? COL_MUTED : COL_TEXT;
}

static void on_open_tasks(lv_event_t*)
{
    ui_root_show(UiPage::Tasks);
}

static void on_manual_tile(lv_event_t* e)
{
    const int idx = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    screen_measure_open_manual(idx);
}

static void on_measure(lv_event_t* e)
{
    const MeasureKind k = static_cast<MeasureKind>(
        reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    screen_measure_open(k);
}

static void make_measure_card(lv_obj_t* card, MeasureKind k)
{
    lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(card, on_measure, LV_EVENT_CLICKED,
                        reinterpret_cast<void*>(static_cast<intptr_t>(k)));
}

static void on_vent_stand(lv_event_t* e)
{
    const int stand = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    ESP_LOGI(TAG, "ventilatie tik knop %d", stand - 1);
    ha_client_request_set_stand(stand);
}

static void on_vent_auto(lv_event_t*)
{
    const VentSnapshot vent = vent_store_snapshot();
    if (!vent.auto_configured || vent.auto_pending || !vent.auto_known) {
        return;
    }
    const bool want = !vent.auto_on;
    ESP_LOGI(TAG, "ventilatie auto tik -> %s", want ? "aan" : "uit");
    ha_client_request_set_auto(want);
}

void screen_dashboard_touch_feedback()
{
    if (ui_root_current() != UiPage::Overview) {
        return;
    }
    lv_indev_t* indev = lv_indev_active();
    if (indev == nullptr) {
        return;
    }
    lv_point_t p = {};
    lv_indev_get_point(indev, &p);
    ESP_LOGI(TAG, "touch %d,%d", (int)p.x, (int)p.y);
}

static void capitalize_ascii(char* s)
{
    if (s != nullptr && s[0] >= 'a' && s[0] <= 'z') {
        s[0] = static_cast<char>(s[0] - 32);
    }
}

static void format_season_since(const char* iso, char* out, size_t out_len)
{
    out[0] = '\0';
    if (iso == nullptr || iso[0] == '\0') {
        return;
    }
    int y = 0, mo = 0, d = 0;
    if (sscanf(iso, "%d-%d-%d", &y, &mo, &d) < 3 || mo < 1 || mo > 12) {
        return;
    }
    snprintf(out, out_len, "%d %s", d, MONTHS_NL[mo - 1]);
}

lv_obj_t* screen_dashboard_create()
{
    s_scr = lv_obj_create(nullptr);
    lv_obj_set_style_bg_color(s_scr, COL_BG, 0);
    lv_obj_set_style_bg_opa(s_scr, LV_OPA_COVER, 0);
    lv_obj_set_scroll_dir(s_scr, LV_DIR_VER);
    lv_obj_add_flag(s_scr, LV_OBJ_FLAG_SCROLLABLE);

    if (s_meas_snap == nullptr) {
        s_meas_snap = static_cast<MeasSnapshot*>(
            heap_caps_calloc(1, sizeof(MeasSnapshot), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    }

    s_status = ui_status_bar_create(s_scr);

    lv_obj_t* banner_slot = lv_obj_create(s_scr);
    lv_obj_set_pos(banner_slot, 0, APP_UI_STATUS_H);
    lv_obj_set_size(banner_slot, 1024, APP_UI_BANNER_H);
    lv_obj_set_style_bg_color(banner_slot, COL_BG, 0);
    lv_obj_set_style_bg_opa(banner_slot, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(banner_slot, 0, 0);
    lv_obj_set_style_radius(banner_slot, 0, 0);
    lv_obj_set_style_pad_all(banner_slot, 0, 0);
    lv_obj_remove_flag(banner_slot, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(banner_slot, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(banner_slot, LV_OBJ_FLAG_FLOATING);

    const int gap = APP_UI_GRID_GAP;
    const int area_x = APP_UI_GRID_MARGIN;
    const int area_y = APP_UI_STATUS_H + APP_UI_BANNER_H + APP_UI_GRID_MARGIN;
    const int area_w = APP_UI_SCREEN_W - 2 * APP_UI_GRID_MARGIN;
    const int area_h = APP_UI_SCREEN_H - APP_UI_STATUS_H - APP_UI_BANNER_H - APP_UI_NAV_H -
                       2 * APP_UI_GRID_MARGIN;
    const int col_w = (area_w - (APP_UI_GRID_COLS - 1) * gap) / APP_UI_GRID_COLS;
    const int row_h = (area_h - (APP_UI_GRID_ROWS - 1) * gap) / APP_UI_GRID_ROWS;
    const int wide_w = col_w * 2 + gap;
    const int inner_wide = wide_w - 24;
    const int inner_small = col_w - 24;

    const int x0 = area_x;
    const int x2 = area_x + 2 * (col_w + gap);
    const int x3 = area_x + 3 * (col_w + gap);
    const int y0 = area_y;
    const int y1 = area_y + row_h + gap;

    lv_obj_t* water = ui_make_card(s_scr, x0, y0, wide_w, row_h);
    make_measure_card(water, MeasureKind::WaterTemp);
    ui_make_label(water, 0, 0, &lv_font_montserrat_20, COL_BLUE, "Watertemperatuur");
    s_water_value = ui_make_label(water, 0, 40, &lv_font_montserrat_42, COL_MUTED, "-- C");
    lv_obj_set_width(s_water_value, inner_wide);
    s_water_meta = ui_make_label(water, 0, row_h - 48, &lv_font_montserrat_14, COL_MUTED, "wacht op data");
    lv_obj_set_width(s_water_meta, inner_wide);

    lv_obj_t* air = ui_make_card(s_scr, x2, y0, col_w, row_h);
    make_measure_card(air, MeasureKind::AirTemp);
    ui_make_label(air, 0, 0, &lv_font_montserrat_20, COL_BLUE, "Lucht");
    s_air_temp = ui_make_label(air, 0, 36, &lv_font_montserrat_24, COL_MUTED, "-- C");
    lv_obj_set_width(s_air_temp, inner_small);
    lv_obj_t* rh_hit = lv_obj_create(air);
    lv_obj_set_pos(rh_hit, 0, 68);
    lv_obj_set_size(rh_hit, inner_small, 36);
    lv_obj_set_style_bg_opa(rh_hit, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(rh_hit, 0, 0);
    lv_obj_set_style_pad_all(rh_hit, 0, 0);
    lv_obj_set_style_radius(rh_hit, 0, 0);
    lv_obj_set_style_shadow_width(rh_hit, 0, 0);
    lv_obj_remove_flag(rh_hit, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(rh_hit, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(rh_hit, on_measure, LV_EVENT_CLICKED,
                        reinterpret_cast<void*>(static_cast<intptr_t>(MeasureKind::Humidity)));
    s_air_rh = ui_make_label(rh_hit, 0, 0, &lv_font_montserrat_24, COL_MUTED, "RV  -- %");
    lv_obj_set_width(s_air_rh, inner_small);
    s_air_meta = ui_make_label(air, 0, row_h - 48, &lv_font_montserrat_14, COL_MUTED, "wacht op data");
    lv_obj_set_width(s_air_meta, inner_small);

    s_season_card = ui_make_card(s_scr, x3, y0, col_w, row_h);
    // Kolom: titel Ventilatie, daarna 0/1/2, daarna auto, daarna status.
    lv_obj_set_flex_flow(s_season_card, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(s_season_card, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_START);
    lv_obj_set_style_pad_row(s_season_card, 4, 0);

    lv_obj_t* vent_title = lv_label_create(s_season_card);
    lv_label_set_text(vent_title, "Ventilatie");
    lv_obj_set_style_text_font(vent_title, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(vent_title, COL_BLUE, 0);
    lv_obj_set_width(vent_title, LV_PCT(100));
    lv_obj_remove_flag(vent_title, LV_OBJ_FLAG_CLICKABLE);

    lv_obj_t* vent_row = lv_obj_create(s_season_card);
    lv_obj_set_width(vent_row, LV_PCT(100));
    lv_obj_set_height(vent_row, 80);
    lv_obj_set_flex_flow(vent_row, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(vent_row, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_all(vent_row, 0, 0);
    lv_obj_set_style_pad_column(vent_row, 8, 0);
    lv_obj_set_style_bg_opa(vent_row, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(vent_row, 0, 0);
    lv_obj_set_style_radius(vent_row, 0, 0);
    lv_obj_set_style_shadow_width(vent_row, 0, 0);
    lv_obj_remove_flag(vent_row, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(vent_row, LV_OBJ_FLAG_CLICKABLE);

    for (int i = 0; i < 3; i++) {
        lv_obj_t* btn = lv_obj_create(vent_row);
        lv_obj_set_height(btn, 80);
        lv_obj_set_width(btn, 0);
        lv_obj_set_style_min_width(btn, 0, 0);
        lv_obj_set_flex_grow(btn, 1);
        lv_obj_set_style_bg_color(btn, COL_BTN, 0);
        lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
        lv_obj_set_style_border_color(btn, COL_BORDER, 0);
        lv_obj_set_style_border_width(btn, 2, 0);
        lv_obj_set_style_radius(btn, 10, 0);
        lv_obj_set_style_shadow_width(btn, 0, 0);
        lv_obj_set_style_pad_all(btn, 0, 0);
        lv_obj_remove_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(btn, on_vent_stand, LV_EVENT_CLICKED,
                            reinterpret_cast<void*>(static_cast<intptr_t>(i + 1)));
        lv_obj_t* lbl = lv_label_create(btn);
        lv_label_set_text_fmt(lbl, "%d", i);
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_30, 0);
        lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
        lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_center(lbl);
        s_vent_btn[i] = btn;
        s_vent_lbl[i] = lbl;
    }

    s_vent_auto_btn = lv_obj_create(s_season_card);
    lv_obj_set_width(s_vent_auto_btn, LV_PCT(100));
    lv_obj_set_height(s_vent_auto_btn, 48);
    lv_obj_set_style_bg_color(s_vent_auto_btn, COL_BTN, 0);
    lv_obj_set_style_bg_opa(s_vent_auto_btn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(s_vent_auto_btn, COL_BORDER, 0);
    lv_obj_set_style_border_width(s_vent_auto_btn, 2, 0);
    lv_obj_set_style_radius(s_vent_auto_btn, 10, 0);
    lv_obj_set_style_shadow_width(s_vent_auto_btn, 0, 0);
    lv_obj_set_style_pad_all(s_vent_auto_btn, 0, 0);
    lv_obj_remove_flag(s_vent_auto_btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_vent_auto_btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s_vent_auto_btn, on_vent_auto, LV_EVENT_CLICKED, nullptr);
    s_vent_auto_lbl = lv_label_create(s_vent_auto_btn);
    lv_label_set_text(s_vent_auto_lbl, "Auto");
    lv_obj_set_style_text_font(s_vent_auto_lbl, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_vent_auto_lbl, COL_TEXT, 0);
    lv_obj_remove_flag(s_vent_auto_lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(s_vent_auto_lbl);

    s_vent_meta = lv_label_create(s_season_card);
    lv_label_set_text(s_vent_meta, "wacht op HA");
    lv_obj_set_style_text_font(s_vent_meta, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_vent_meta, COL_MUTED, 0);
    lv_obj_set_width(s_vent_meta, LV_PCT(100));
    lv_label_set_long_mode(s_vent_meta, LV_LABEL_LONG_DOT);
    lv_obj_remove_flag(s_vent_meta, LV_OBJ_FLAG_CLICKABLE);

    s_season_line = lv_label_create(s_season_card);
    lv_label_set_text(s_season_line, "");
    lv_obj_set_style_text_font(s_season_line, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_season_line, COL_MUTED, 0);
    lv_obj_set_width(s_season_line, LV_PCT(100));
    lv_label_set_long_mode(s_season_line, LV_LABEL_LONG_DOT);
    lv_obj_remove_flag(s_season_line, LV_OBJ_FLAG_CLICKABLE);
    s_feed_line = lv_label_create(s_season_card);
    lv_label_set_text(s_feed_line, "");
    lv_obj_set_style_text_font(s_feed_line, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_feed_line, COL_MUTED, 0);
    lv_obj_set_width(s_feed_line, LV_PCT(100));
    lv_label_set_long_mode(s_feed_line, LV_LABEL_LONG_DOT);
    lv_obj_remove_flag(s_feed_line, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_season_line, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_season_line, LV_OBJ_FLAG_IGNORE_LAYOUT);
    lv_obj_add_flag(s_feed_line, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_feed_line, LV_OBJ_FLAG_IGNORE_LAYOUT);

    const int row2_y = y1;
    lv_obj_t* flow = ui_make_card(s_scr, x0, row2_y, wide_w, row_h);
    make_measure_card(flow, MeasureKind::Flow);
    ui_make_label(flow, 0, 0, &lv_font_montserrat_20, COL_BLUE, "Bijvulwater");
    s_flow_rate = ui_make_label(flow, 0, 36, &lv_font_montserrat_30, COL_MUTED, "-- L/min");
    lv_obj_set_width(s_flow_rate, inner_wide);
    s_flow_today = ui_make_label(flow, 0, 80, &lv_font_montserrat_20, COL_MUTED, "vandaag: -- L");
    lv_obj_set_width(s_flow_today, inner_wide);
    s_flow_meta = ui_make_label(flow, 0, row_h - 48, &lv_font_montserrat_14, COL_MUTED, "wacht op data");
    lv_obj_set_width(s_flow_meta, inner_wide);

    lv_obj_t* ph = ui_make_card(s_scr, x2, row2_y, col_w, row_h);
    make_measure_card(ph, MeasureKind::Ph);
    ui_make_label(ph, 0, 0, &lv_font_montserrat_20, COL_BLUE, "pH");
    s_ph_value = ui_make_label(ph, 0, 48, &lv_font_montserrat_24, COL_MUTED, "geen sensor");
    lv_obj_set_width(s_ph_value, inner_small);
    lv_label_set_long_mode(s_ph_value, LV_LABEL_LONG_DOT);
    s_ph_meta = ui_make_label(ph, 0, row_h - 48, &lv_font_montserrat_14, COL_MUTED, "");
    lv_obj_set_width(s_ph_meta, inner_small);

    lv_obj_t* tasks = ui_make_card(s_scr, x3, row2_y, col_w, row_h);
    lv_obj_add_flag(tasks, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(tasks, on_open_tasks, LV_EVENT_CLICKED, nullptr);
    ui_make_label(tasks, 0, 0, &lv_font_montserrat_20, COL_BLUE, "Open taken");
    s_tasks_count = ui_make_label(tasks, 0, 40, &lv_font_montserrat_42, COL_MUTED, "-");
    lv_obj_set_width(s_tasks_count, inner_small);
    s_tasks_title = ui_make_label(tasks, 0, 100, &lv_font_montserrat_14, COL_MUTED, "");
    lv_obj_set_width(s_tasks_title, inner_small);
    lv_label_set_long_mode(s_tasks_title, LV_LABEL_LONG_DOT);

    const int man_h = APP_MEAS_TILE_H;
    const int y2 = row2_y + row_h + gap;
    const int y3 = y2 + man_h + gap;
    const int xs[4] = {x0, area_x + (col_w + gap), x2, x3};
    for (int i = 0; i < k_param_count; i++) {
        const ParamDef* p = param_catalog_get(i);
        const int col = i % 4;
        const int row = i / 4;
        const int y = (row == 0) ? y2 : y3;
        lv_obj_t* card = ui_make_card(s_scr, xs[col], y, col_w, man_h);
        lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(card, on_manual_tile, LV_EVENT_CLICKED,
                            reinterpret_cast<void*>(static_cast<intptr_t>(i)));
        ui_make_label(card, 0, 0, &lv_font_montserrat_14, COL_BLUE,
                      p != nullptr ? p->label : "");
        s_man_val[i] = ui_make_label(card, 0, 28, &lv_font_montserrat_20, COL_MUTED, "--");
        lv_obj_set_width(s_man_val[i], inner_small);
        s_man_meta[i] = ui_make_label(card, 0, man_h - 40, &lv_font_montserrat_14, COL_MUTED, "");
        lv_obj_set_width(s_man_meta[i], inner_small);
        lv_label_set_long_mode(s_man_meta[i], LV_LABEL_LONG_DOT);
    }

    s_nav = ui_nav_create(s_scr, 0);
    screen_measure_create(s_scr);
    ESP_LOGI(TAG, "tegelraster: marge=%d gap=%d kolom=%d rij=%d breed=%d (status %d banner %d nav %d)",
             APP_UI_GRID_MARGIN, gap, col_w, row_h, wide_w,
             APP_UI_STATUS_H, APP_UI_BANNER_H, APP_UI_NAV_H);
    return s_scr;
}

void screen_dashboard_set_nav_badge(int open_tasks)
{
    ui_nav_set_badge(s_nav, open_tasks);
}

void screen_dashboard_dismiss_popup()
{
    screen_measure_close();
}

void screen_dashboard_update(const AppState& st, const LiveSnapshot& live,
                             const StatusSnapshot& app)
{
    ui_status_bar_update(s_status, st, app);
    ui_nav_set_badge(s_nav, app.due_now_count);

    char num[24];
    char age[72];

    if (live.water_temp.present) {
        ui_format_nl(num, sizeof(num), live.water_temp.value, 1);
        lv_label_set_text_fmt(s_water_value, "%s C", num);
    } else {
        lv_label_set_text(s_water_value, "-- C");
    }
    lv_obj_set_style_text_color(s_water_value, value_color(live.water_temp), 0);
    format_age(live.water_temp, age, sizeof(age));
    lv_label_set_text(s_water_meta, age);
    lv_obj_set_style_text_color(s_water_meta, age_color(live.water_temp), 0);

    if (live.air_temp.present) {
        ui_format_nl(num, sizeof(num), live.air_temp.value, 1);
        lv_label_set_text_fmt(s_air_temp, "%s C", num);
    } else {
        lv_label_set_text(s_air_temp, "-- C");
    }
    lv_obj_set_style_text_color(s_air_temp, value_color(live.air_temp), 0);

    if (live.humidity.present) {
        ui_format_nl(num, sizeof(num), live.humidity.value, 1);
        lv_label_set_text_fmt(s_air_rh, "RV  %s %%", num);
    } else {
        lv_label_set_text(s_air_rh, "RV  -- %");
    }
    lv_obj_set_style_text_color(s_air_rh, value_color(live.humidity), 0);

    if (!live.air_temp.present && !live.humidity.present) {
        lv_label_set_text(s_air_meta, "wacht op data");
        lv_obj_set_style_text_color(s_air_meta, COL_MUTED, 0);
    } else if ((live.air_temp.present && live.air_temp.stale) ||
               (live.humidity.present && live.humidity.stale)) {
        const LiveFieldSnap& worst = (live.air_temp.stale || !live.humidity.present)
                                         ? live.air_temp : live.humidity;
        format_age(worst.present ? worst : live.humidity, age, sizeof(age));
        lv_label_set_text(s_air_meta, age);
        lv_obj_set_style_text_color(s_air_meta, COL_ORANGE, 0);
    } else if (live.air_temp.present) {
        format_age(live.air_temp, age, sizeof(age));
        lv_label_set_text(s_air_meta, age);
        lv_obj_set_style_text_color(s_air_meta, COL_MUTED, 0);
    } else {
        format_age(live.humidity, age, sizeof(age));
        lv_label_set_text(s_air_meta, age);
        lv_obj_set_style_text_color(s_air_meta, COL_MUTED, 0);
    }

    if (live.ph.present) {
        ui_format_nl(num, sizeof(num), live.ph.value, 1);
        lv_label_set_text(s_ph_value, num);
        lv_obj_set_style_text_color(s_ph_value, value_color(live.ph), 0);
        format_age(live.ph, age, sizeof(age));
        lv_label_set_text(s_ph_meta, age);
        lv_obj_set_style_text_color(s_ph_meta, age_color(live.ph), 0);
    } else {
        lv_label_set_text(s_ph_value, "geen sensor");
        lv_obj_set_style_text_color(s_ph_value, COL_MUTED, 0);
        lv_label_set_text(s_ph_meta, "");
    }

    if (live.flow_rate.present) {
        ui_format_nl(num, sizeof(num), live.flow_rate.value, 2);
        lv_label_set_text_fmt(s_flow_rate, "%s L/min", num);
    } else {
        lv_label_set_text(s_flow_rate, "-- L/min");
    }
    lv_obj_set_style_text_color(s_flow_rate, value_color(live.flow_rate), 0);

    if (live.today_ok) {
        ui_format_nl(num, sizeof(num), static_cast<double>(live.today_l), 1);
        lv_label_set_text_fmt(s_flow_today, "vandaag: %s L", num);
        lv_obj_set_style_text_color(s_flow_today, COL_TEXT, 0);
    } else if (!st.time_synced) {
        lv_label_set_text(s_flow_today, "vandaag: wacht op tijd");
        lv_obj_set_style_text_color(s_flow_today, COL_MUTED, 0);
    } else {
        lv_label_set_text(s_flow_today, "vandaag: -- L");
        lv_obj_set_style_text_color(s_flow_today, COL_MUTED, 0);
    }
    format_age(live.flow_rate, age, sizeof(age));
    lv_label_set_text(s_flow_meta, age);
    lv_obj_set_style_text_color(s_flow_meta, age_color(live.flow_rate), 0);

    const VentSnapshot vent = vent_store_snapshot();
    const bool vent_grey = (vent.ui == VentUiState::Unreachable ||
                            vent.ui == VentUiState::TokenInvalid ||
                            vent.ui == VentUiState::NoConfig);
    if (s_season_card != nullptr) {
        lv_obj_remove_flag(s_season_card, LV_OBJ_FLAG_HIDDEN);
        lv_obj_set_style_bg_color(s_season_card, vent_grey ? COL_CARD_OFF : COL_CARD, 0);
    }
    if (s_vent_meta != nullptr) {
        const char* meta = "";
        lv_color_t mc = COL_MUTED;
        if (vent.ui == VentUiState::TokenInvalid) {
            meta = vent.message[0] != '\0' ? vent.message : "HA-token ongeldig - controleer HA_TOKEN";
            mc = COL_ORANGE;
        } else if (vent.ui == VentUiState::Unreachable) {
            meta = vent.message[0] != '\0' ? vent.message : "Home Assistant niet bereikbaar";
            mc = COL_ORANGE;
        } else if (vent.ui == VentUiState::NoConfig) {
            meta = vent.message[0] != '\0' ? vent.message : "wacht op entiteit (B7)";
            mc = COL_MUTED;
        } else if (vent.ui == VentUiState::Pending) {
            meta = "bezig...";
            mc = COL_ORANGE;
        } else if (vent.ui == VentUiState::Ok) {
            // Na GET 200: groene knop is de stand. Nooit "wacht op HA" laten staan.
            if (vent.message[0] != '\0' && strcmp(vent.message, "wacht op HA") != 0) {
                meta = vent.message;
                mc = COL_ORANGE;
            } else if (vent.marked_stand == 0 && vent.raw_label[0] != '\0') {
                meta = vent.raw_label;
                mc = COL_TEXT;
            } else {
                meta = "";
            }
        } else if (vent.ui == VentUiState::Idle) {
            meta = "wacht op HA";
            mc = COL_MUTED;
        }
        lv_label_set_text(s_vent_meta, meta);
        lv_obj_set_style_text_color(s_vent_meta, mc, 0);
    }
    for (int i = 0; i < 3; i++) {
        lv_obj_t* btn = s_vent_btn[i];
        lv_obj_t* lbl = s_vent_lbl[i];
        if (btn == nullptr || !lv_obj_is_valid(btn) || lbl == nullptr || !lv_obj_is_valid(lbl)) {
            continue;
        }
        const int stand = i + 1;
        const bool pending = (vent.ui == VentUiState::Pending && vent.pending_stand == stand);
        const bool marked = (vent.marked_stand == stand && vent.ui != VentUiState::Pending);
        lv_obj_set_style_bg_color(btn, marked ? COL_GREEN : COL_BTN, 0);
        lv_obj_set_style_border_color(btn, marked ? COL_GREEN : COL_BORDER, 0);
        lv_obj_set_style_bg_color(btn, marked ? COL_GREEN : COL_BTN, LV_STATE_DISABLED);
        lv_obj_set_style_border_color(btn, marked ? COL_GREEN : COL_BORDER, LV_STATE_DISABLED);
        if (pending) {
            lv_label_set_text(lbl, "bezig");
            lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, 0);
            lv_obj_set_style_text_color(lbl, COL_ORANGE, 0);
        } else {
            lv_label_set_text_fmt(lbl, "%d", stand - 1);
            lv_obj_set_style_text_font(lbl, &lv_font_montserrat_30, 0);
            lv_obj_set_style_text_color(lbl, marked ? COL_BG : COL_TEXT, 0);
        }
        if (vent.buttons_enabled) {
            lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_remove_state(btn, LV_STATE_DISABLED);
        } else {
            lv_obj_remove_flag(btn, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_add_state(btn, LV_STATE_DISABLED);
        }
        lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    }

    if (s_vent_auto_btn != nullptr && lv_obj_is_valid(s_vent_auto_btn) &&
        s_vent_auto_lbl != nullptr && lv_obj_is_valid(s_vent_auto_lbl)) {
        if (!vent.auto_configured) {
            lv_obj_add_flag(s_vent_auto_btn, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(s_vent_auto_btn, LV_OBJ_FLAG_IGNORE_LAYOUT);
        } else {
            lv_obj_remove_flag(s_vent_auto_btn, LV_OBJ_FLAG_HIDDEN);
            lv_obj_remove_flag(s_vent_auto_btn, LV_OBJ_FLAG_IGNORE_LAYOUT);
            const bool pending = vent.auto_pending;
            const bool on = vent.auto_known && vent.auto_on && !pending;
            lv_obj_set_style_bg_color(s_vent_auto_btn, on ? COL_GREEN : COL_BTN, 0);
            lv_obj_set_style_border_color(s_vent_auto_btn, on ? COL_GREEN : COL_BORDER, 0);
            lv_obj_set_style_bg_color(s_vent_auto_btn, on ? COL_GREEN : COL_BTN, LV_STATE_DISABLED);
            lv_obj_set_style_border_color(s_vent_auto_btn, on ? COL_GREEN : COL_BORDER,
                                         LV_STATE_DISABLED);
            if (pending) {
                lv_label_set_text(s_vent_auto_lbl, "bezig");
                lv_obj_set_style_text_color(s_vent_auto_lbl, COL_ORANGE, 0);
            } else if (!vent.auto_known) {
                lv_label_set_text(s_vent_auto_lbl, "Auto");
                lv_obj_set_style_text_color(s_vent_auto_lbl, COL_MUTED, 0);
            } else {
                lv_label_set_text(s_vent_auto_lbl, on ? "Auto aan" : "Auto uit");
                lv_obj_set_style_text_color(s_vent_auto_lbl, on ? COL_BG : COL_TEXT, 0);
            }
            lv_obj_remove_flag(s_vent_auto_lbl, LV_OBJ_FLAG_CLICKABLE);
            const bool auto_en = vent.auto_known && !pending && !vent_grey;
            if (auto_en) {
                lv_obj_add_flag(s_vent_auto_btn, LV_OBJ_FLAG_CLICKABLE);
                lv_obj_remove_state(s_vent_auto_btn, LV_STATE_DISABLED);
            } else {
                lv_obj_remove_flag(s_vent_auto_btn, LV_OBJ_FLAG_CLICKABLE);
                lv_obj_add_state(s_vent_auto_btn, LV_STATE_DISABLED);
            }
        }
    }

    const bool season_ui = app.season_present || app.feed_present ||
                           (app.data_ok_present && !app.data_ok);
    if (season_ui) {
        if (s_season_line != nullptr) {
            lv_obj_remove_flag(s_season_line, LV_OBJ_FLAG_HIDDEN);
            lv_obj_remove_flag(s_season_line, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
        if (s_feed_line != nullptr) {
            lv_obj_remove_flag(s_feed_line, LV_OBJ_FLAG_HIDDEN);
            lv_obj_remove_flag(s_feed_line, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
        if (app.season_present) {
            char season[80];
            char cap[40];
            snprintf(cap, sizeof(cap), "%s", app.season);
            capitalize_ascii(cap);
            char sinds[24];
            format_season_since(app.season_since, sinds, sizeof(sinds));
            if (sinds[0] != '\0') {
                snprintf(season, sizeof(season), "%s sinds %s", cap, sinds);
            } else {
                snprintf(season, sizeof(season), "%s", cap);
            }
            lv_label_set_text(s_season_line, season);
            lv_obj_set_style_text_color(s_season_line, COL_TEXT, 0);
        } else {
            lv_label_set_text(s_season_line, "");
        }

        if (app.data_ok_present && !app.data_ok) {
            lv_label_set_text(s_feed_line, "Te weinig recente temperatuurdata; adviezen staan even stil.");
            lv_obj_set_style_text_color(s_feed_line, COL_ORANGE, 0);
        } else if (app.feed_present) {
            lv_label_set_text(s_feed_line, app.feed_label);
            lv_obj_set_style_text_color(s_feed_line, COL_TEXT, 0);
        } else {
            lv_label_set_text(s_feed_line, "");
        }
    } else {
        if (s_season_line != nullptr) {
            lv_obj_add_flag(s_season_line, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(s_season_line, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
        if (s_feed_line != nullptr) {
            lv_obj_add_flag(s_feed_line, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(s_feed_line, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
    }

    if (!app.has_data) {
        lv_label_set_text(s_tasks_count, "-");
        lv_obj_set_style_text_color(s_tasks_count, COL_MUTED, 0);
        if (app.fetch == StatusFetchState::TokenInvalid) {
            lv_label_set_text(s_tasks_title, "Token ongeldig");
            lv_obj_set_style_text_color(s_tasks_title, COL_ORANGE, 0);
        } else {
            lv_label_set_text(s_tasks_title, "");
        }
    } else {
        lv_label_set_text_fmt(s_tasks_count, "%d", app.due_now_count);
        lv_obj_set_style_text_color(s_tasks_count, COL_TEXT, 0);
        lv_obj_set_style_text_color(s_tasks_title, COL_MUTED, 0);
        const char* title = nullptr;
        for (int i = 0; i < app.task_count; i++) {
            if (app.tasks[i].due_now && app.tasks[i].title[0] != '\0') {
                title = app.tasks[i].title;
                break;
            }
        }
        if (title == nullptr) {
            for (int i = 0; i < app.task_count; i++) {
                if (app.tasks[i].title[0] != '\0') {
                    title = app.tasks[i].title;
                    break;
                }
            }
        }
        if (title != nullptr) {
            lv_label_set_text(s_tasks_title, title);
        } else if (app.due_now_count == 0 && app.task_count == 0) {
            lv_label_set_text(s_tasks_title, "Geen open taken");
        } else {
            lv_label_set_text(s_tasks_title, "");
        }
    }

    screen_measure_update(live, app);

    if (s_meas_snap != nullptr) {
        measurement_queue_snapshot(s_meas_snap);
        const int64_t now = st.time_synced ? static_cast<int64_t>(time(nullptr)) : 0;
        for (int i = 0; i < k_param_count; i++) {
            if (s_man_val[i] == nullptr) {
                continue;
            }
            const ParamDef* p = param_catalog_get(i);
            const MeasLast& last = s_meas_snap->last[i];
            if (p == nullptr || !last.present) {
                lv_label_set_text(s_man_val[i], "--");
                lv_obj_set_style_text_color(s_man_val[i], COL_MUTED, 0);
                lv_label_set_text(s_man_meta[i], "geen meting");
                lv_obj_set_style_text_color(s_man_meta[i], COL_MUTED, 0);
                continue;
            }
            const int u = (last.unit < p->unit_count) ? last.unit : 0;
            char nbuf[24];
            ui_format_nl(nbuf, sizeof(nbuf), last.value, p->decimals[u]);
            const char* unit = (p->units[u] != nullptr) ? p->units[u] : "";
            lv_label_set_text_fmt(s_man_val[i], "%s %s", nbuf, unit);
            lv_obj_set_style_text_color(s_man_val[i], COL_TEXT, 0);
            int32_t days = -1;
            const Freshness fr = param_freshness(i, last.measured_at, now, &days);
            const char* badge = "paneel";
            lv_color_t bc = COL_MUTED;
            if (fr == Freshness::Fresh) {
                badge = "vers";
                bc = COL_GREEN;
            } else if (fr == Freshness::Soon) {
                badge = "bijna";
                bc = COL_ORANGE;
            } else if (fr == Freshness::Expired) {
                badge = "verouderd";
                bc = COL_ORANGE;
            } else if (last.from_app) {
                badge = "app";
            }
            lv_label_set_text(s_man_meta[i], badge);
            lv_obj_set_style_text_color(s_man_meta[i], bc, 0);
        }
    }
}
