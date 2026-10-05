// KOIoT Paneel - meetgegevens-pop-up (M1.8).
//
// Objecten eenmalig bij Overzicht-create (geen create in de tik).
// Labels niet klikbaar. Geen HTTP, geen StatusSnapshot op de LVGL-stack.
#include "ui/screen_measure.h"

#include <cstdio>
#include <cstring>
#include <ctime>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "lvgl.h"

#include "app_config.h"
#include "data/live_store.h"
#include "data/measurement_queue.h"
#include "data/param_catalog.h"
#include "data/status_store.h"
#include "io/backend_client.h"
#include "ui/screen_entry.h"
#include "ui/ui_chrome.h"
#include "ui/ui_root.h"

static const char* TAG = "screen_meas";

static const lv_color_t COL_DIM    = lv_color_hex(0x000000);
static const lv_color_t COL_BOX    = lv_color_hex(0x1B2229);
static const lv_color_t COL_BORDER = lv_color_hex(0x2E3A45);
static const lv_color_t COL_TEXT   = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED  = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_ORANGE = lv_color_hex(0xF39C12);
static const lv_color_t COL_BLUE   = lv_color_hex(0x3498DB);
static const lv_color_t COL_BTN    = lv_color_hex(0x2A3540);

static const char* MONTHS_NL[12] = {"jan", "feb", "mrt", "apr", "mei", "jun",
                                    "jul", "aug", "sep", "okt", "nov", "dec"};

static lv_obj_t* s_dim = nullptr;
static lv_obj_t* s_box = nullptr;
static lv_obj_t* s_title = nullptr;
static lv_obj_t* s_value = nullptr;
static lv_obj_t* s_status = nullptr;
static lv_obj_t* s_measured = nullptr;
static lv_obj_t* s_source = nullptr;
static lv_obj_t* s_sensor = nullptr;
static lv_obj_t* s_hist_stats = nullptr;
static lv_obj_t* s_hist_since = nullptr;
static lv_obj_t* s_chart = nullptr;
static lv_obj_t* s_line = nullptr;
static lv_obj_t* s_app_24h = nullptr;
static lv_obj_t* s_app_week = nullptr;
static lv_obj_t* s_app_trend = nullptr;
static lv_obj_t* s_app_season = nullptr;
static lv_obj_t* s_app_note = nullptr;
static lv_obj_t* s_flow_now = nullptr;
static lv_obj_t* s_flow_today = nullptr;
static lv_obj_t* s_flow_total = nullptr;
static lv_obj_t* s_hold = nullptr;
static lv_obj_t* s_upload = nullptr;
static lv_obj_t* s_newbtn = nullptr;
static lv_obj_t* s_close = nullptr;

static MeasureKind s_kind = MeasureKind::None;
static int s_manual_idx = -1;
static MeasItem s_manual_item;
static bool s_manual_from_history = false;
static int s_line_drawn_n = -1;
static lv_point_precise_t* s_pts = nullptr;
static float* s_hist = nullptr;

static lv_obj_t* make_row(lv_obj_t* parent, const lv_font_t* font, lv_color_t color)
{
    lv_obj_t* lbl = lv_label_create(parent);
    lv_label_set_text(lbl, "");
    lv_obj_set_style_text_font(lbl, font, 0);
    lv_obj_set_style_text_color(lbl, color, 0);
    lv_obj_set_width(lbl, LV_PCT(100));
    lv_label_set_long_mode(lbl, LV_LABEL_LONG_DOT);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    return lbl;
}

static void set_row(lv_obj_t* lbl, bool on, const char* text, lv_color_t color)
{
    if (lbl == nullptr || !lv_obj_is_valid(lbl)) {
        return;
    }
    if (!on || text == nullptr || text[0] == '\0') {
        lv_label_set_text(lbl, "");
        lv_obj_add_flag(lbl, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(lbl, LV_OBJ_FLAG_IGNORE_LAYOUT);
        return;
    }
    lv_label_set_text(lbl, text);
    lv_obj_set_style_text_color(lbl, color, 0);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_HIDDEN);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_IGNORE_LAYOUT);
}

static LiveField field_of(MeasureKind k)
{
    switch (k) {
        case MeasureKind::WaterTemp: return LiveField::WaterTemp;
        case MeasureKind::AirTemp:   return LiveField::AirTemp;
        case MeasureKind::Humidity:  return LiveField::Humidity;
        case MeasureKind::Ph:        return LiveField::Ph;
        case MeasureKind::Flow:      return LiveField::FlowRate;
        default:                     return LiveField::Count;
    }
}

static const LiveFieldSnap* snap_of(MeasureKind k, const LiveSnapshot& live)
{
    switch (k) {
        case MeasureKind::WaterTemp: return &live.water_temp;
        case MeasureKind::AirTemp:   return &live.air_temp;
        case MeasureKind::Humidity:  return &live.humidity;
        case MeasureKind::Ph:        return &live.ph;
        case MeasureKind::Flow:      return &live.flow_rate;
        default:                     return nullptr;
    }
}

static const char* title_of(MeasureKind k)
{
    switch (k) {
        case MeasureKind::WaterTemp: return "Watertemperatuur";
        case MeasureKind::AirTemp:   return "Luchttemperatuur";
        case MeasureKind::Humidity:  return "Luchtvochtigheid";
        case MeasureKind::Ph:        return "pH";
        case MeasureKind::Flow:      return "Bijvulwater";
        default:                     return "";
    }
}

static const char* kind_log(MeasureKind k)
{
    switch (k) {
        case MeasureKind::WaterTemp: return "watertemp";
        case MeasureKind::AirTemp:   return "luchttemp";
        case MeasureKind::Humidity:  return "rv";
        case MeasureKind::Ph:        return "ph";
        case MeasureKind::Flow:      return "bijvulwater";
        default:                     return "?";
    }
}

static void format_age_ago(const LiveFieldSnap& f, char* out, size_t out_len)
{
    out[0] = '\0';
    if (!f.present || f.age_s < 0) {
        return;
    }
    if (f.age_s < 60) {
        snprintf(out, out_len, "%d s geleden", static_cast<int>(f.age_s));
        return;
    }
    const int mins = f.age_s / 60;
    if (mins < 60) {
        snprintf(out, out_len, "%d min geleden", mins < 1 ? 1 : mins);
        return;
    }
    snprintf(out, out_len, "%d u geleden", mins / 60);
}

static void format_measured_at(int64_t unix_s, char* out, size_t out_len)
{
    out[0] = '\0';
    if (unix_s < 1700000000) {
        return;
    }
    const time_t t = static_cast<time_t>(unix_s);
    struct tm tm_local = {};
    localtime_r(&t, &tm_local);
    if (tm_local.tm_mon < 0 || tm_local.tm_mon > 11) {
        return;
    }
    snprintf(out, out_len, "%d %s %d %02d:%02d",
             tm_local.tm_mday, MONTHS_NL[tm_local.tm_mon], tm_local.tm_year + 1900,
             tm_local.tm_hour, tm_local.tm_min);
}

static void close_with_reason(const char* why)
{
    if (s_dim == nullptr || !lv_obj_is_valid(s_dim)) {
        s_kind = MeasureKind::None;
        return;
    }
    if (lv_obj_has_flag(s_dim, LV_OBJ_FLAG_HIDDEN) && s_kind == MeasureKind::None) {
        return;
    }
    ESP_LOGI(TAG, "meetgegevens dicht (%s)", why != nullptr ? why : "sluiten");
    lv_obj_add_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
    s_kind = MeasureKind::None;
    s_manual_idx = -1;
    s_line_drawn_n = -1;
}

static void on_dim_click(lv_event_t*)
{
    close_with_reason("ernaast");
}

static void on_close_click(lv_event_t*)
{
    close_with_reason("sluiten");
}

static void on_new_meas(lv_event_t*)
{
    const int idx = s_manual_idx;
    close_with_reason("nieuwe meting");
    if (idx >= 0) {
        ui_root_show(UiPage::Entry);
        screen_entry_start(idx);
    }
}

static bool draw_line_graph(int n, float mn, float mx)
{
    if (s_line == nullptr || !lv_obj_is_valid(s_line) || s_chart == nullptr ||
        !lv_obj_is_valid(s_chart) || s_pts == nullptr || s_hist == nullptr) {
        return false;
    }
    if (n < 1) {
        lv_obj_add_flag(s_chart, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(s_chart, LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_add_flag(s_line, LV_OBJ_FLAG_HIDDEN);
        return true;
    }
    lv_obj_remove_flag(s_chart, LV_OBJ_FLAG_HIDDEN);
    lv_obj_remove_flag(s_chart, LV_OBJ_FLAG_IGNORE_LAYOUT);
    lv_obj_remove_flag(s_line, LV_OBJ_FLAG_HIDDEN);

    lv_obj_update_layout(s_box);
    lv_obj_update_layout(s_chart);
    const int32_t w = lv_obj_get_content_width(s_chart);
    const int32_t h = lv_obj_get_content_height(s_chart);
    if (w <= 4 || h <= 4) {
        return false;
    }

    float span = mx - mn;
    if (span < 0.05f) {
        span = 0.05f;
        mn -= 0.025f;
        mx += 0.025f;
    }
    const int pts = (n == 1) ? 2 : n;
    for (int i = 0; i < pts; i++) {
        const float v = (n == 1) ? s_hist[0] : s_hist[i];
        const int xi = (pts <= 1) ? 0 : (i * (w - 1) / (pts - 1));
        float t = (v - mn) / span;
        if (t < 0) {
            t = 0;
        }
        if (t > 1) {
            t = 1;
        }
        const int yi = (h - 1) - static_cast<int>(t * static_cast<float>(h - 1));
        s_pts[i].x = xi;
        s_pts[i].y = yi;
    }
    lv_line_set_points(s_line, s_pts, static_cast<uint32_t>(pts));
    return true;
}

void screen_measure_create(lv_obj_t* parent)
{
    if (parent == nullptr || s_dim != nullptr) {
        return;
    }

    s_pts = static_cast<lv_point_precise_t*>(
        heap_caps_calloc(static_cast<size_t>(APP_HIST_POINTS), sizeof(lv_point_precise_t),
                         MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    s_hist = static_cast<float*>(
        heap_caps_calloc(static_cast<size_t>(APP_HIST_POINTS), sizeof(float),
                         MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (s_pts == nullptr || s_hist == nullptr) {
        ESP_LOGE(TAG, "geen PSRAM voor grafiekpunten; pop-up zonder lijn");
    }

    s_dim = lv_obj_create(parent);
    lv_obj_set_pos(s_dim, 0, 0);
    lv_obj_set_size(s_dim, APP_UI_SCREEN_W, APP_UI_SCREEN_H);
    lv_obj_set_style_bg_color(s_dim, COL_DIM, 0);
    lv_obj_set_style_bg_opa(s_dim, LV_OPA_70, 0);
    lv_obj_set_style_border_width(s_dim, 0, 0);
    lv_obj_set_style_radius(s_dim, 0, 0);
    lv_obj_set_style_pad_all(s_dim, 0, 0);
    lv_obj_remove_flag(s_dim, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_dim, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(s_dim, on_dim_click, LV_EVENT_CLICKED, nullptr);

    const int box_w = (APP_UI_SCREEN_W * APP_MEASURE_POPUP_PCT) / 100;
    s_box = lv_obj_create(s_dim);
    lv_obj_set_size(s_box, box_w, 520);
    lv_obj_center(s_box);
    lv_obj_set_flex_flow(s_box, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(s_box, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
    lv_obj_set_style_bg_color(s_box, COL_BOX, 0);
    lv_obj_set_style_bg_opa(s_box, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(s_box, COL_BORDER, 0);
    lv_obj_set_style_border_width(s_box, 2, 0);
    lv_obj_set_style_radius(s_box, 12, 0);
    lv_obj_set_style_pad_all(s_box, 16, 0);
    lv_obj_set_style_pad_row(s_box, 4, 0);
    lv_obj_set_style_shadow_width(s_box, 0, 0);
    lv_obj_remove_flag(s_box, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_box, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_flag(s_box, LV_OBJ_FLAG_EVENT_BUBBLE);

    s_title = make_row(s_box, &lv_font_montserrat_20, COL_BLUE);
    s_value = make_row(s_box, &lv_font_montserrat_42, COL_TEXT);
    s_status = make_row(s_box, &lv_font_montserrat_20, COL_MUTED);
    s_measured = make_row(s_box, &lv_font_montserrat_14, COL_MUTED);
    s_source = make_row(s_box, &lv_font_montserrat_14, COL_MUTED);
    s_sensor = make_row(s_box, &lv_font_montserrat_14, COL_MUTED);
    s_hist_stats = make_row(s_box, &lv_font_montserrat_14, COL_MUTED);
    s_hist_since = make_row(s_box, &lv_font_montserrat_14, COL_MUTED);

    s_chart = lv_obj_create(s_box);
    lv_obj_set_width(s_chart, LV_PCT(100));
    lv_obj_set_height(s_chart, 88);
    lv_obj_set_style_bg_color(s_chart, lv_color_hex(0x14181C), 0);
    lv_obj_set_style_bg_opa(s_chart, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(s_chart, COL_BORDER, 0);
    lv_obj_set_style_border_width(s_chart, 1, 0);
    lv_obj_set_style_radius(s_chart, 8, 0);
    lv_obj_set_style_pad_all(s_chart, 6, 0);
    lv_obj_set_style_shadow_width(s_chart, 0, 0);
    lv_obj_remove_flag(s_chart, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_chart, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_chart, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_chart, LV_OBJ_FLAG_IGNORE_LAYOUT);

    s_line = lv_line_create(s_chart);
    lv_obj_set_style_line_color(s_line, COL_BLUE, 0);
    lv_obj_set_style_line_width(s_line, 2, 0);
    lv_obj_set_style_line_rounded(s_line, true, 0);
    lv_obj_remove_flag(s_line, LV_OBJ_FLAG_CLICKABLE);

    s_app_24h = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);
    s_app_week = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);
    s_app_trend = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);
    s_app_season = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);
    s_app_note = make_row(s_box, &lv_font_montserrat_14, COL_MUTED);
    s_flow_now = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);
    s_flow_today = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);
    s_flow_total = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);
    s_hold = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);
    s_upload = make_row(s_box, &lv_font_montserrat_14, COL_TEXT);

    s_newbtn = lv_obj_create(s_box);
    lv_obj_set_width(s_newbtn, LV_PCT(100));
    lv_obj_set_height(s_newbtn, 64);
    lv_obj_set_style_bg_color(s_newbtn, COL_BTN, 0);
    lv_obj_set_style_bg_opa(s_newbtn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(s_newbtn, COL_BORDER, 0);
    lv_obj_set_style_border_width(s_newbtn, 2, 0);
    lv_obj_set_style_radius(s_newbtn, 10, 0);
    lv_obj_set_style_shadow_width(s_newbtn, 0, 0);
    lv_obj_set_style_pad_all(s_newbtn, 0, 0);
    lv_obj_remove_flag(s_newbtn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_newbtn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s_newbtn, on_new_meas, LV_EVENT_CLICKED, nullptr);
    lv_obj_t* new_lbl = lv_label_create(s_newbtn);
    lv_label_set_text(new_lbl, "Nieuwe meting invoeren");
    lv_obj_set_style_text_font(new_lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(new_lbl, COL_TEXT, 0);
    lv_obj_remove_flag(new_lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(new_lbl);
    lv_obj_add_flag(s_newbtn, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_newbtn, LV_OBJ_FLAG_IGNORE_LAYOUT);

    s_close = lv_obj_create(s_box);
    lv_obj_set_width(s_close, LV_PCT(100));
    lv_obj_set_height(s_close, 64);
    lv_obj_set_style_bg_color(s_close, COL_BTN, 0);
    lv_obj_set_style_bg_opa(s_close, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(s_close, COL_BORDER, 0);
    lv_obj_set_style_border_width(s_close, 2, 0);
    lv_obj_set_style_radius(s_close, 10, 0);
    lv_obj_set_style_shadow_width(s_close, 0, 0);
    lv_obj_set_style_pad_all(s_close, 0, 0);
    lv_obj_set_style_min_height(s_close, 64, 0);
    lv_obj_remove_flag(s_close, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_close, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s_close, on_close_click, LV_EVENT_CLICKED, nullptr);
    lv_obj_t* close_lbl = lv_label_create(s_close);
    lv_label_set_text(close_lbl, "Sluiten");
    lv_obj_set_style_text_font(close_lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(close_lbl, COL_TEXT, 0);
    lv_obj_remove_flag(close_lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(close_lbl);

    set_row(s_app_24h, false, "", COL_TEXT);
    set_row(s_app_week, false, "", COL_TEXT);
    set_row(s_app_trend, false, "", COL_TEXT);
    set_row(s_app_season, false, "", COL_TEXT);
    set_row(s_app_note, false, "", COL_MUTED);
    set_row(s_flow_now, false, "", COL_TEXT);
    set_row(s_flow_today, false, "", COL_TEXT);
    set_row(s_flow_total, false, "", COL_TEXT);
    set_row(s_hold, false, "", COL_TEXT);
    set_row(s_upload, false, "", COL_TEXT);

    ESP_LOGI(TAG, "meetgegevens-pop-up klaar (70%% breed, ringbuffer %d punten)", APP_HIST_POINTS);
}

void screen_measure_open(MeasureKind kind)
{
    if (kind == MeasureKind::None || kind == MeasureKind::Manual ||
        s_dim == nullptr || !lv_obj_is_valid(s_dim)) {
        return;
    }
    s_kind = kind;
    s_manual_idx = -1;
    s_manual_from_history = false;
    s_line_drawn_n = -1;
    lv_obj_remove_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(s_dim);
    backend_client_request_history();
    ESP_LOGI(TAG, "meetgegevens open: %s", kind_log(kind));
}

void screen_measure_open_manual(int param_idx)
{
    MeasItem item;
    if (!measurement_queue_get_last(param_idx, &item)) {
        item = MeasItem{};
        item.param = static_cast<uint8_t>(param_idx);
    }
    screen_measure_open_record(&item);
}

void screen_measure_open_record(const MeasItem* item)
{
    if (item == nullptr || s_dim == nullptr || !lv_obj_is_valid(s_dim)) {
        return;
    }
    s_kind = MeasureKind::Manual;
    s_manual_item = *item;
    s_manual_idx = item->param;
    s_manual_from_history = (item->client_id[0] != '\0');
    s_line_drawn_n = -1;
    lv_obj_remove_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(s_dim);
    ESP_LOGI(TAG, "meetgegevens open: handmatig param=%d", s_manual_idx);
}

void screen_measure_close()
{
    close_with_reason("T1");
}

void screen_measure_update(const LiveSnapshot& live, const StatusSnapshot& app)
{
    if (s_kind == MeasureKind::None || s_dim == nullptr || !lv_obj_is_valid(s_dim) ||
        lv_obj_has_flag(s_dim, LV_OBJ_FLAG_HIDDEN)) {
        return;
    }

    if (s_kind == MeasureKind::Manual) {
        const ParamDef* p = param_catalog_get(s_manual_idx);
        MeasItem item = s_manual_item;
        if (!s_manual_from_history) {
            measurement_queue_get_last(s_manual_idx, &item);
        }
        const int u = (p != nullptr && item.unit < p->unit_count) ? item.unit : 0;
        lv_label_set_text(s_title, p != nullptr ? p->label : "Meting");
        char num[24];
        char line[96];
        if (p == nullptr || (item.client_id[0] == '\0' && item.queued_at == 0 &&
                             item.measured_at == 0 && !s_manual_from_history &&
                             item.value == 0.f && s_manual_item.client_id[0] == '\0')) {
            MeasItem last = {};
            const bool has = measurement_queue_get_last(s_manual_idx, &last);
            if (!has) {
                lv_label_set_text(s_value, "--");
                lv_obj_set_style_text_color(s_value, COL_MUTED, 0);
                set_row(s_status, false, "", COL_MUTED);
                set_row(s_measured, false, "", COL_MUTED);
                set_row(s_source, false, "", COL_MUTED);
                set_row(s_sensor, false, "", COL_MUTED);
                set_row(s_hist_stats, false, "", COL_MUTED);
                set_row(s_hist_since, false, "", COL_MUTED);
                set_row(s_app_24h, false, "", COL_TEXT);
                set_row(s_app_week, false, "", COL_TEXT);
                set_row(s_app_trend, false, "", COL_TEXT);
                set_row(s_app_season, false, "", COL_TEXT);
                set_row(s_app_note, false, "", COL_MUTED);
                set_row(s_flow_now, false, "", COL_TEXT);
                set_row(s_flow_today, false, "", COL_TEXT);
                set_row(s_flow_total, false, "", COL_TEXT);
                set_row(s_hold, false, "", COL_TEXT);
                set_row(s_upload, false, "", COL_TEXT);
                if (s_chart != nullptr) {
                    lv_obj_add_flag(s_chart, LV_OBJ_FLAG_HIDDEN);
                    lv_obj_add_flag(s_chart, LV_OBJ_FLAG_IGNORE_LAYOUT);
                }
                if (s_newbtn != nullptr) {
                    lv_obj_remove_flag(s_newbtn, LV_OBJ_FLAG_HIDDEN);
                    lv_obj_remove_flag(s_newbtn, LV_OBJ_FLAG_IGNORE_LAYOUT);
                }
                return;
            }
            item = last;
        }
        if (p != nullptr) {
            ui_format_nl(num, sizeof(num), item.value, p->decimals[u]);
            const char* unit = (p->units[u] != nullptr) ? p->units[u] : "";
            snprintf(line, sizeof(line), "%s %s", num, unit);
            lv_label_set_text(s_value, line);
            lv_obj_set_style_text_color(s_value, COL_TEXT, 0);
        }

        const time_t nowt = time(nullptr);
        int32_t days = -1;
        const Freshness fr = param_freshness(s_manual_idx, item.measured_at,
                                            static_cast<int64_t>(nowt), &days);
        if (fr == Freshness::Fresh) {
            set_row(s_status, true, "vers", COL_MUTED);
        } else if (fr == Freshness::Soon) {
            set_row(s_status, true, "bijna verlopen", COL_ORANGE);
        } else if (fr == Freshness::Expired) {
            set_row(s_status, true, "verouderd", COL_ORANGE);
        } else {
            set_row(s_status, false, "", COL_MUTED);
        }

        char when[40];
        format_measured_at(item.measured_at, when, sizeof(when));
        if (when[0] != '\0') {
            snprintf(line, sizeof(line), "Gemeten  %s", when);
            set_row(s_measured, true, line, COL_MUTED);
        } else {
            set_row(s_measured, false, "", COL_MUTED);
        }
        set_row(s_source, true, "Bron  Ingevoerd op het paneel", COL_MUTED);
        set_row(s_sensor, false, "", COL_MUTED);
        set_row(s_hist_stats, false, "", COL_MUTED);
        set_row(s_hist_since, false, "", COL_MUTED);
        if (s_chart != nullptr) {
            lv_obj_add_flag(s_chart, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(s_chart, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
        set_row(s_app_24h, false, "", COL_TEXT);
        set_row(s_app_week, false, "", COL_TEXT);
        set_row(s_app_trend, false, "", COL_TEXT);
        set_row(s_app_season, false, "", COL_TEXT);
        set_row(s_app_note, false, "", COL_MUTED);
        set_row(s_flow_now, false, "", COL_TEXT);
        set_row(s_flow_today, false, "", COL_TEXT);
        set_row(s_flow_total, false, "", COL_TEXT);

        if (fr == Freshness::None) {
            set_row(s_hold, false, "", COL_TEXT);
        } else if (item.measured_at >= 1700000000 && p != nullptr && p->shelf_days > 0) {
            const int64_t exp = item.measured_at + static_cast<int64_t>(p->shelf_days) * 86400LL;
            char expd[40];
            format_measured_at(exp, expd, sizeof(expd));
            if (expd[0] != '\0') {
                snprintf(line, sizeof(line), "Houdbaar tot  %s", expd);
                set_row(s_hold, true, line, COL_MUTED);
            } else {
                set_row(s_hold, false, "", COL_TEXT);
            }
        } else {
            set_row(s_hold, false, "", COL_TEXT);
        }

        if (item.status == MeasStatus::Uploaded) {
            set_row(s_upload, true, "Upload  geupload", COL_MUTED);
        } else if (item.status == MeasStatus::Rejected) {
            snprintf(line, sizeof(line), "Upload  afgewezen%s%s",
                     item.reject[0] ? "  " : "", item.reject);
            set_row(s_upload, true, line, COL_ORANGE);
        } else if (item.client_id[0] != '\0') {
            set_row(s_upload, true, "Upload  in wachtrij", COL_ORANGE);
        } else {
            set_row(s_upload, false, "", COL_MUTED);
        }
        if (s_newbtn != nullptr) {
            lv_obj_remove_flag(s_newbtn, LV_OBJ_FLAG_HIDDEN);
            lv_obj_remove_flag(s_newbtn, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
        return;
    }

    if (s_newbtn != nullptr) {
        lv_obj_add_flag(s_newbtn, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(s_newbtn, LV_OBJ_FLAG_IGNORE_LAYOUT);
    }
    set_row(s_hold, false, "", COL_TEXT);
    set_row(s_upload, false, "", COL_TEXT);

    const LiveFieldSnap* f = snap_of(s_kind, live);
    if (f == nullptr) {
        return;
    }

    lv_label_set_text(s_title, title_of(s_kind));

    char num[24];
    char line[96];
    if (s_kind == MeasureKind::Ph && !f->present) {
        lv_label_set_text(s_value, "geen sensor");
        lv_obj_set_style_text_color(s_value, COL_MUTED, 0);
    } else if (!f->present) {
        if (s_kind == MeasureKind::Humidity) {
            lv_label_set_text(s_value, "-- %");
        } else if (s_kind == MeasureKind::Flow) {
            lv_label_set_text(s_value, "-- L/min");
        } else {
            lv_label_set_text(s_value, "-- C");
        }
        lv_obj_set_style_text_color(s_value, COL_MUTED, 0);
    } else {
        if (s_kind == MeasureKind::Humidity) {
            ui_format_nl(num, sizeof(num), f->value, 1);
            snprintf(line, sizeof(line), "%s %%", num);
        } else if (s_kind == MeasureKind::Flow) {
            ui_format_nl(num, sizeof(num), f->value, 2);
            snprintf(line, sizeof(line), "%s L/min", num);
        } else if (s_kind == MeasureKind::Ph) {
            ui_format_nl(num, sizeof(num), f->value, 1);
            snprintf(line, sizeof(line), "%s", num);
        } else {
            ui_format_nl(num, sizeof(num), f->value, 1);
            snprintf(line, sizeof(line), "%s C", num);
        }
        lv_label_set_text(s_value, line);
        lv_obj_set_style_text_color(s_value, f->stale ? COL_MUTED : COL_TEXT, 0);
    }

    if (!f->present) {
        set_row(s_status, false, "", COL_MUTED);
    } else if (f->stale) {
        set_row(s_status, true, "verouderd", COL_ORANGE);
    } else {
        set_row(s_status, true, "vers", COL_MUTED);
    }

    char when[40];
    char ago[32];
    format_measured_at(f->measured_at_unix, when, sizeof(when));
    format_age_ago(*f, ago, sizeof(ago));
    if (when[0] != '\0' && ago[0] != '\0') {
        snprintf(line, sizeof(line), "Gemeten  %s  (%s)", when, ago);
        set_row(s_measured, true, line, COL_MUTED);
    } else if (when[0] != '\0') {
        snprintf(line, sizeof(line), "Gemeten  %s", when);
        set_row(s_measured, true, line, COL_MUTED);
    } else if (ago[0] != '\0') {
        snprintf(line, sizeof(line), "Gemeten  %s", ago);
        set_row(s_measured, true, line, COL_MUTED);
    } else {
        set_row(s_measured, false, "", COL_MUTED);
    }

    if (f->present && f->from_database) {
        set_row(s_source, true, "Bron  Laatst opgeslagen (database)", COL_MUTED);
    } else if (f->present) {
        set_row(s_source, true, "Bron  Live (MQTT)", COL_MUTED);
    } else {
        set_row(s_source, false, "", COL_MUTED);
    }

    if (f->sensor_id[0] != '\0') {
        snprintf(line, sizeof(line), "Sensor  %s  (%s)", f->sensor_id, MQTT_DEVICE_ID);
        set_row(s_sensor, true, line, COL_MUTED);
    } else if (f->present) {
        snprintf(line, sizeof(line), "Sensor  %s", MQTT_DEVICE_ID);
        set_row(s_sensor, true, line, COL_MUTED);
    } else {
        set_row(s_sensor, false, "", COL_MUTED);
    }

    float mn = 0;
    float mx = 0;
    float avg = 0;
    int64_t first_unix = 0;
    bool from_db = false;
    const LiveField hf = field_of(s_kind);
    int n = 0;
    if (hf != LiveField::Count && s_hist != nullptr) {
        n = live_store_history_copy(hf, s_hist, APP_HIST_POINTS, &mn, &mx, &avg,
                                    &first_unix, &from_db);
    }
    if (s_kind == MeasureKind::Ph && !f->present) {
        set_row(s_hist_stats, false, "", COL_MUTED);
        set_row(s_hist_since, false, "", COL_MUTED);
        if (s_chart != nullptr && lv_obj_is_valid(s_chart)) {
            lv_obj_add_flag(s_chart, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(s_chart, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
        s_line_drawn_n = 0;
    } else if (n > 0) {
        char a[16], b[16], c[16];
        const int dec = (s_kind == MeasureKind::Flow) ? 2 : 1;
        ui_format_nl(a, sizeof(a), static_cast<double>(mn), dec);
        ui_format_nl(b, sizeof(b), static_cast<double>(mx), dec);
        ui_format_nl(c, sizeof(c), static_cast<double>(avg), dec);
        snprintf(line, sizeof(line), "Verloop  min %s  max %s  gem. %s", a, b, c);
        set_row(s_hist_stats, true, line, COL_MUTED);
        if (n == 1) {
            set_row(s_hist_since, true, "geen 24 u-historie (alleen huidige waarde)", COL_MUTED);
        } else if (from_db) {
            set_row(s_hist_since, true, "laatste 24 uur (database)", COL_MUTED);
        } else {
            char since[40];
            format_measured_at(first_unix, since, sizeof(since));
            if (since[0] != '\0') {
                const time_t t = static_cast<time_t>(first_unix);
                struct tm tm_local = {};
                localtime_r(&t, &tm_local);
                snprintf(line, sizeof(line), "sinds opstart %02d:%02d", tm_local.tm_hour, tm_local.tm_min);
            } else {
                snprintf(line, sizeof(line), "sinds opstart");
            }
            set_row(s_hist_since, true, line, COL_MUTED);
        }
        if (n != s_line_drawn_n) {
            if (draw_line_graph(n, mn, mx)) {
                s_line_drawn_n = n;
            }
        }
    } else {
        set_row(s_hist_stats, false, "", COL_MUTED);
        set_row(s_hist_since, true, "sinds opstart (buffer nog leeg)", COL_MUTED);
        if (s_chart != nullptr && lv_obj_is_valid(s_chart)) {
            lv_obj_add_flag(s_chart, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(s_chart, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
        s_line_drawn_n = 0;
    }

    if (s_kind == MeasureKind::WaterTemp) {
        if (app.water_temp_24h_present) {
            ui_format_nl(num, sizeof(num), static_cast<double>(app.water_temp_24h), 1);
            snprintf(line, sizeof(line), "Gem. 24 u  %s C", num);
            set_row(s_app_24h, true, line, COL_TEXT);
        } else {
            set_row(s_app_24h, false, "", COL_TEXT);
        }
        if (app.water_temp_week_present) {
            ui_format_nl(num, sizeof(num), static_cast<double>(app.water_temp_week), 1);
            snprintf(line, sizeof(line), "Gem. week  %s C", num);
            set_row(s_app_week, true, line, COL_TEXT);
        } else {
            set_row(s_app_week, false, "", COL_TEXT);
        }
        if (app.trend_present && app.trend[0] != '\0') {
            snprintf(line, sizeof(line), "Trend  %s", app.trend);
            set_row(s_app_trend, true, line, COL_TEXT);
        } else {
            set_row(s_app_trend, false, "", COL_TEXT);
        }
        if (app.season_present && app.season[0] != '\0') {
            snprintf(line, sizeof(line), "Seizoen  %s", app.season);
            set_row(s_app_season, true, line, COL_TEXT);
        } else {
            set_row(s_app_season, false, "", COL_TEXT);
        }
        const bool any_app = app.water_temp_24h_present || app.water_temp_week_present ||
                             app.trend_present || app.season_present;
        set_row(s_app_note, any_app, "berekend door de app", COL_MUTED);
    } else {
        set_row(s_app_24h, false, "", COL_TEXT);
        set_row(s_app_week, false, "", COL_TEXT);
        set_row(s_app_trend, false, "", COL_TEXT);
        set_row(s_app_season, false, "", COL_TEXT);
        set_row(s_app_note, false, "", COL_MUTED);
    }

    if (s_kind == MeasureKind::Flow) {
        if (live.flow_rate.present) {
            ui_format_nl(num, sizeof(num), live.flow_rate.value, 2);
            snprintf(line, sizeof(line), "Debiet nu  %s L/min", num);
            set_row(s_flow_now, true, line, COL_TEXT);
        } else {
            set_row(s_flow_now, false, "", COL_TEXT);
        }
        if (live.today_ok) {
            ui_format_nl(num, sizeof(num), static_cast<double>(live.today_l), 1);
            snprintf(line, sizeof(line), "Vandaag  %s L", num);
            set_row(s_flow_today, true, line, COL_TEXT);
        } else {
            set_row(s_flow_today, false, "", COL_TEXT);
        }
        if (live.flow_total.present) {
            ui_format_nl(num, sizeof(num), live.flow_total.value, 1);
            snprintf(line, sizeof(line), "Meterstand  %s L", num);
            set_row(s_flow_total, true, line, COL_TEXT);
        } else {
            set_row(s_flow_total, false, "", COL_TEXT);
        }
    } else {
        set_row(s_flow_now, false, "", COL_TEXT);
        set_row(s_flow_today, false, "", COL_TEXT);
        set_row(s_flow_total, false, "", COL_TEXT);
    }
}

bool screen_measure_is_open()
{
    return s_kind != MeasureKind::None && s_dim != nullptr && lv_obj_is_valid(s_dim) &&
           !lv_obj_has_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
}
