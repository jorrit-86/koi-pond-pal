// KOIoT Paneel - Meting invoeren (M2 §7.2). Objecten eenmalig; geen HTTP in LVGL.
#include "ui/screen_entry.h"

#include <cstdlib>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <ctime>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "lvgl.h"

#include "app_config.h"
#include "core/app_state.h"
#include "data/measurement_queue.h"
#include "data/param_catalog.h"
#include "data/status_store.h"
#include "io/backend_client.h"
#include "io/mqtt_link.h"
#include "ui/ui_chrome.h"
#include "ui/ui_numpad.h"
#include "ui/ui_root.h"

extern "C" {
extern const lv_obj_class_t lv_label_class;
}

static const char* TAG = "screen_ent";

static const lv_color_t COL_BG     = lv_color_hex(0x0E1216);
static const lv_color_t COL_TEXT   = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED  = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_ORANGE = lv_color_hex(0xF39C12);
static const lv_color_t COL_BLUE   = lv_color_hex(0x3498DB);
static const lv_color_t COL_GREEN  = lv_color_hex(0x2ECC71);
static const lv_color_t COL_BTN    = lv_color_hex(0x2A3540);
static const lv_color_t COL_CARD   = lv_color_hex(0x1B2229);
static const lv_color_t COL_BORDER = lv_color_hex(0x2E3A45);
static const lv_color_t COL_DIM    = lv_color_hex(0x000000);

static lv_obj_t* s_scr = nullptr;
static UiStatusBar s_status;
static UiNav s_nav;
static lv_obj_t* s_card[k_param_count] = {};
static lv_obj_t* s_val[k_param_count] = {};
static lv_obj_t* s_meta[k_param_count] = {};
static lv_obj_t* s_toast = nullptr;
static int64_t s_toast_until_us = 0;

static UiNumpad s_pad;
static lv_obj_t* s_unit_bar = nullptr;
static lv_obj_t* s_unit_btn[2] = {};
static lv_obj_t* s_unit_lbl[2] = {};
static lv_obj_t* s_time_bar = nullptr;
static lv_obj_t* s_time_btn[5] = {};
static lv_obj_t* s_time_lbl[5] = {};
static lv_obj_t* s_time_summary = nullptr;

static lv_obj_t* s_dialog = nullptr;
static lv_obj_t* s_dialog_txt = nullptr;

// Eén host voor numpad/warn/confirm, eenmalig bij scherm-create. Nooit create,
// delete, clean of reparent in een click of in de eerste timer-tick daarna.
// Click zet alleen de stap. Timer 80 ms: eerst de volgende overlay unhiden
// (vorige blijft staan), daarna HidePrev. hide van de aangeklikte boom nooit
// in dezelfde tick als de click of als de unhide. Host is FLOATING zodat de
// nav-balk (ook FLOATING) geen tikken steelt. Geen move_foreground op s_scr.
static lv_obj_t* s_overlay_host = nullptr;
static constexpr uint32_t k_flow_timer_ms = 80;
static lv_timer_t* s_flow_timer = nullptr;

enum class FlowStep : uint8_t {
    Idle = 0,
    Numpad,
    Time,
    Warn,
    Confirm,
    Save,
    Close,
    HidePrev,
};
static FlowStep s_flow_next = FlowStep::Idle;
static FlowStep s_flow_visible = FlowStep::Idle;

static void request_step(FlowStep step);

static int s_param = -1;
static int s_unit = 0;
static int s_when = 0;  // 0 nu, 1 1u, 2 2u, 3 4u, 4 gisteren
static float s_value = 0;
static char s_value_ui[16] = "";
static bool s_flow_open = false;
static MeasSnapshot* s_snap = nullptr;
static int s_start_when_ready = -1;

enum class OvBuild : uint8_t {
    Idle = 0,
    Numpad,
    Bars,
    Dialog,
    Done,
};
static OvBuild s_ov_build = OvBuild::Idle;
static lv_timer_t* s_ov_timer = nullptr;
static constexpr uint32_t k_ov_timer_ms = 50;

static const char* k_when_lbl[5] = {"Nu", "1 u", "2 u", "4 u", "Gisteren"};

static bool obj_alive(const lv_obj_t* o)
{
    return o != nullptr && lv_obj_is_valid(o);
}

static bool parent_ok(lv_obj_t* p, const char* where)
{
    if (obj_alive(p)) {
        return true;
    }
    ESP_LOGE(TAG, "geen geldige parent (%s); create overgeslagen",
             (where != nullptr) ? where : "?");
    return false;
}

static lv_obj_t* safe_obj(lv_obj_t* parent, const char* where)
{
    if (parent != nullptr && !parent_ok(parent, where)) {
        return nullptr;
    }
    lv_obj_t* o = lv_obj_class_create_obj(&lv_obj_class, parent);
    if (o == nullptr) {
        ESP_LOGE(TAG, "obj create faalde (%s); overlay overgeslagen",
                 (where != nullptr) ? where : "?");
        return nullptr;
    }
    lv_obj_class_init_obj(o);
    return o;
}

static lv_obj_t* safe_label(lv_obj_t* parent, const char* where)
{
    if (!parent_ok(parent, where)) {
        return nullptr;
    }
    lv_obj_t* lbl = lv_obj_class_create_obj(&lv_label_class, parent);
    if (lbl == nullptr) {
        ESP_LOGE(TAG, "label create faalde (%s); overlay overgeslagen",
                 (where != nullptr) ? where : "?");
        return nullptr;
    }
    lv_obj_class_init_obj(lbl);
    return lbl;
}

static lv_obj_t* overlay_parent()
{
    if (obj_alive(s_overlay_host)) {
        return s_overlay_host;
    }
    s_overlay_host = nullptr;
    ESP_LOGE(TAG, "geen geldige parent (overlay-host); create overgeslagen");
    return nullptr;
}

static void show_overlay_host()
{
    if (!obj_alive(s_overlay_host)) {
        return;
    }
    lv_obj_add_flag(s_overlay_host, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_flag(s_overlay_host, LV_OBJ_FLAG_HIDDEN);
}

static void hide_overlay_host()
{
    if (obj_alive(s_overlay_host)) {
        lv_obj_remove_flag(s_overlay_host, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_flag(s_overlay_host, LV_OBJ_FLAG_HIDDEN);
    }
}

static int64_t measured_unix(const AppState& st)
{
    if (!st.time_synced) {
        return 0;
    }
    const time_t now = time(nullptr);
    if (now < 1700000000) {
        return 0;
    }
    if (s_when == 0) {
        return static_cast<int64_t>(now);
    }
    if (s_when == 1) {
        return static_cast<int64_t>(now) - 3600;
    }
    if (s_when == 2) {
        return static_cast<int64_t>(now) - 2 * 3600;
    }
    if (s_when == 3) {
        return static_cast<int64_t>(now) - 4 * 3600;
    }
    struct tm tm_l = {};
    localtime_r(&now, &tm_l);
    tm_l.tm_mday -= 1;
    const time_t y = mktime(&tm_l);
    return (y > 1700000000) ? static_cast<int64_t>(y) : 0;
}

static void hide_flow()
{
    s_flow_next = FlowStep::Idle;
    s_flow_visible = FlowStep::Idle;
    if (s_flow_timer != nullptr) {
        lv_timer_pause(s_flow_timer);
    }
    ui_numpad_hide(&s_pad);
    if (obj_alive(s_dialog)) {
        lv_obj_add_flag(s_dialog, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_unit_bar)) {
        lv_obj_add_flag(s_unit_bar, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_time_bar)) {
        lv_obj_add_flag(s_time_bar, LV_OBJ_FLAG_HIDDEN);
    }
    hide_overlay_host();
    s_flow_open = false;
    s_param = -1;
}

static void hide_prev_overlays()
{
    if (s_flow_visible != FlowStep::Numpad && s_flow_visible != FlowStep::Time) {
        ui_numpad_hide(&s_pad);
        if (obj_alive(s_unit_bar)) {
            lv_obj_add_flag(s_unit_bar, LV_OBJ_FLAG_HIDDEN);
        }
        if (obj_alive(s_time_bar)) {
            lv_obj_add_flag(s_time_bar, LV_OBJ_FLAG_HIDDEN);
        }
    }
    if (s_flow_visible != FlowStep::Warn && s_flow_visible != FlowStep::Confirm &&
        obj_alive(s_dialog)) {
        lv_obj_add_flag(s_dialog, LV_OBJ_FLAG_HIDDEN);
    }
}

static void style_seg(lv_obj_t* btn, lv_obj_t* lbl, bool on)
{
    if (!obj_alive(btn) || !obj_alive(lbl)) {
        return;
    }
    lv_obj_set_style_bg_color(btn, on ? COL_GREEN : COL_BTN, 0);
    lv_obj_set_style_border_color(btn, on ? COL_GREEN : COL_BORDER, 0);
    lv_obj_set_style_text_color(lbl, on ? COL_BG : COL_TEXT, 0);
}

static void set_range_hint()
{
    const ParamDef* p = param_catalog_get(s_param);
    if (p == nullptr || !obj_alive(s_pad.hint)) {
        return;
    }
    const char* u = (s_unit < p->unit_count && p->units[s_unit] != nullptr)
                        ? p->units[s_unit] : "";
    char lo[16];
    ui_format_nl(lo, sizeof(lo), p->range_min[s_unit], p->decimals[s_unit]);
    char hi[16];
    ui_format_nl(hi, sizeof(hi), p->range_max[s_unit], p->decimals[s_unit]);
    char line[128];
    snprintf(line, sizeof(line), "Bereik %s .. %s %s", lo, hi, u);
    lv_label_set_text(s_pad.hint, line);
    lv_obj_set_style_text_color(s_pad.hint, COL_MUTED, 0);
}

static void refresh_unit_time()
{
    const ParamDef* p = param_catalog_get(s_param);
    const int uc = (p != nullptr) ? p->unit_count : 1;
    for (int i = 0; i < 2; i++) {
        if (!obj_alive(s_unit_btn[i])) {
            continue;
        }
        if (uc < 2 || i >= uc) {
            lv_obj_add_flag(s_unit_btn[i], LV_OBJ_FLAG_HIDDEN);
            continue;
        }
        lv_obj_remove_flag(s_unit_btn[i], LV_OBJ_FLAG_HIDDEN);
        lv_obj_set_size(s_unit_btn[i], 136, 64);
        if (obj_alive(s_unit_lbl[i]) && p != nullptr && p->units[i] != nullptr) {
            lv_label_set_text(s_unit_lbl[i], p->units[i]);
        }
        style_seg(s_unit_btn[i], s_unit_lbl[i], s_unit == i);
    }
    for (int i = 0; i < 5; i++) {
        style_seg(s_time_btn[i], s_time_lbl[i], s_when == i);
    }
}

static void apply_numpad()
{
    const ParamDef* p = param_catalog_get(s_param);
    if (p == nullptr) {
        hide_flow();
        return;
    }
    const bool keep_value = (s_flow_visible == FlowStep::Warn ||
                             s_flow_visible == FlowStep::Confirm ||
                             s_flow_visible == FlowStep::Time);
    show_overlay_host();
    if (!keep_value) {
        s_pad.buf[0] = '\0';
    }
    if (obj_alive(s_pad.title)) {
        lv_label_set_text(s_pad.title, p->label);
    }
    set_range_hint();
    if (obj_alive(s_pad.btn_ok_lbl)) {
        lv_label_set_text(s_pad.btn_ok_lbl, "Volgende");
    }
    ui_numpad_set_cancel_label(&s_pad, "Annuleren");
    ui_numpad_refresh_value(&s_pad);
    ui_numpad_set_step_value(&s_pad);
    ui_numpad_set_units_visible(&s_pad, p->unit_count >= 2);
    if (obj_alive(s_pad.overlay)) {
        lv_obj_remove_flag(s_pad.overlay, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_unit_bar)) {
        if (p->unit_count >= 2) {
            lv_obj_remove_flag(s_unit_bar, LV_OBJ_FLAG_HIDDEN);
        } else {
            lv_obj_add_flag(s_unit_bar, LV_OBJ_FLAG_HIDDEN);
        }
    }
    if (obj_alive(s_time_bar)) {
        lv_obj_add_flag(s_time_bar, LV_OBJ_FLAG_HIDDEN);
    }
    refresh_unit_time();
    s_flow_open = true;
    s_flow_visible = FlowStep::Numpad;
    request_step(FlowStep::HidePrev);
}

static void apply_time()
{
    const ParamDef* p = param_catalog_get(s_param);
    if (p == nullptr) {
        hide_flow();
        return;
    }
    const char* u = (s_unit < p->unit_count && p->units[s_unit] != nullptr)
                        ? p->units[s_unit] : "";
    if (obj_alive(s_time_summary)) {
        lv_label_set_text_fmt(s_time_summary, "%s %s %s", p->label, s_value_ui, u);
    }
    show_overlay_host();
    if (obj_alive(s_pad.btn_ok_lbl)) {
        lv_label_set_text(s_pad.btn_ok_lbl, "Volgende");
    }
    ui_numpad_set_cancel_label(&s_pad, "Terug");
    ui_numpad_set_step_time(&s_pad);
    if (obj_alive(s_pad.overlay)) {
        lv_obj_remove_flag(s_pad.overlay, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_unit_bar)) {
        lv_obj_add_flag(s_unit_bar, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_time_bar)) {
        lv_obj_remove_flag(s_time_bar, LV_OBJ_FLAG_HIDDEN);
    }
    refresh_unit_time();
    s_flow_open = true;
    s_flow_visible = FlowStep::Time;
    request_step(FlowStep::HidePrev);
}

static void apply_confirm()
{
    const ParamDef* p = param_catalog_get(s_param);
    if (p == nullptr || !obj_alive(s_dialog) || !obj_alive(s_dialog_txt)) {
        hide_flow();
        return;
    }
    const char* u = (s_unit < p->unit_count && p->units[s_unit] != nullptr)
                        ? p->units[s_unit] : "";
    lv_label_set_text_fmt(s_dialog_txt, "%s %s %s - opslaan?",
                          p->label, s_value_ui, u);
    show_overlay_host();
    lv_obj_remove_flag(s_dialog, LV_OBJ_FLAG_HIDDEN);
    s_flow_open = true;
    s_flow_visible = FlowStep::Confirm;
    request_step(FlowStep::HidePrev);
}

static void apply_warn()
{
    if (!obj_alive(s_dialog) || !obj_alive(s_dialog_txt)) {
        hide_flow();
        return;
    }
    lv_label_set_text(s_dialog_txt,
                      "Weet je het zeker? Waarde valt buiten het gebruikelijke bereik.");
    show_overlay_host();
    lv_obj_remove_flag(s_dialog, LV_OBJ_FLAG_HIDDEN);
    s_flow_open = true;
    s_flow_visible = FlowStep::Warn;
    request_step(FlowStep::HidePrev);
}

static bool parse_value(float* out)
{
    char json[16];
    if (!ui_numpad_value_json(&s_pad, json, sizeof(json))) {
        return false;
    }
    char* end = nullptr;
    const float v = strtof(json, &end);
    if (end == json) {
        return false;
    }
    *out = v;
    snprintf(s_value_ui, sizeof(s_value_ui), "%s", ui_numpad_value_ui(&s_pad));
    return true;
}

static bool in_range(const ParamDef* p, float v)
{
    if (p == nullptr) {
        return false;
    }
    const float lo = p->range_min[s_unit];
    const float hi = p->range_max[s_unit];
    return v >= lo && v <= hi;
}

static bool in_warn(const ParamDef* p, float v)
{
    if (p == nullptr || !p->has_warn[s_unit]) {
        return true;
    }
    return v >= p->warn_min[s_unit] && v <= p->warn_max[s_unit];
}

static void commit_save()
{
    const ParamDef* p = param_catalog_get(s_param);
    if (p == nullptr) {
        hide_flow();
        return;
    }
    const AppState st = app_state_snapshot();
    const int64_t at = measured_unix(st);
    char id[37] = "";
    if (!measurement_queue_enqueue(s_param, s_unit, s_value, at, id, sizeof(id))) {
        ESP_LOGE(TAG, "mislukt: meting niet in wachtrij");
        hide_flow();
        return;
    }
    const char* unit = (s_unit < p->unit_count && p->units[s_unit] != nullptr)
                           ? p->units[s_unit] : "";
    mqtt_link_publish_manual_state(p->key, s_value, unit, at, "in wachtrij");
    mqtt_link_publish_diagnostics();
    backend_client_request_upload();
    ESP_LOGI(TAG, "opgeslagen: %s %s %s client_id=%s (upload volgt)",
             p->label, s_value_ui, unit, id);
    hide_flow();
    if (obj_alive(s_toast)) {
        lv_label_set_text(s_toast, "Opgeslagen - wordt geupload");
        lv_obj_remove_flag(s_toast, LV_OBJ_FLAG_HIDDEN);
        lv_obj_move_foreground(s_toast);
        s_toast_until_us = esp_timer_get_time() + 2500000;
    }
    ui_root_show(UiPage::Overview);
}

static void request_step(FlowStep step)
{
    s_flow_next = step;
    if (s_flow_timer == nullptr) {
        ESP_LOGE(TAG, "geen flow-timer; stap overgeslagen");
        return;
    }
    lv_timer_set_period(s_flow_timer, k_flow_timer_ms);
    lv_timer_reset(s_flow_timer);
    lv_timer_resume(s_flow_timer);
}

static void flow_timer_cb(lv_timer_t*)
{
    if (s_flow_timer != nullptr) {
        lv_timer_pause(s_flow_timer);
    }
    const FlowStep step = s_flow_next;
    s_flow_next = FlowStep::Idle;
    switch (step) {
        case FlowStep::Numpad:
            apply_numpad();
            break;
        case FlowStep::Time:
            apply_time();
            break;
        case FlowStep::Warn:
            apply_warn();
            break;
        case FlowStep::Confirm:
            apply_confirm();
            break;
        case FlowStep::Save:
            commit_save();
            break;
        case FlowStep::Close:
            hide_flow();
            break;
        case FlowStep::HidePrev:
            hide_prev_overlays();
            break;
        case FlowStep::Idle:
        default:
            break;
    }
}

static void on_pad_ok(lv_event_t*)
{
    const ParamDef* p = param_catalog_get(s_param);
    if (p == nullptr) {
        return;
    }
    if (s_flow_visible == FlowStep::Time) {
        if (!in_warn(p, s_value)) {
            ESP_LOGW(TAG, "waarde buiten waarschuwing: %s %.4f; extra bevestiging",
                     p->key, static_cast<double>(s_value));
            request_step(FlowStep::Warn);
            return;
        }
        request_step(FlowStep::Confirm);
        return;
    }
    if (!parse_value(&s_value)) {
        ui_numpad_set_error(&s_pad, "Voer een getal in");
        return;
    }
    if (!in_range(p, s_value)) {
        ui_numpad_set_error(&s_pad, "Buiten bereik - opslaan geblokkeerd");
        ESP_LOGW(TAG, "invoer buiten fysiek bereik: %s %.4f", p->key,
                 static_cast<double>(s_value));
        return;
    }
    request_step(FlowStep::Time);
}

static void on_pad_cancel(lv_event_t*)
{
    if (s_flow_visible == FlowStep::Time) {
        request_step(FlowStep::Numpad);
        return;
    }
    request_step(FlowStep::Close);
}

static void on_unit(lv_event_t* e)
{
    const int u = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    s_unit = u;
    measurement_queue_set_unit_pref(s_param, s_unit);
    refresh_unit_time();
    set_range_hint();
}

static void on_when(lv_event_t* e)
{
    s_when = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    refresh_unit_time();
}

static void on_dialog_yes(lv_event_t*)
{
    if (s_flow_visible == FlowStep::Warn) {
        ESP_LOGI(TAG, "waarschuwing: Ja; bevestigen via timer");
        request_step(FlowStep::Confirm);
        return;
    }
    request_step(FlowStep::Save);
}

static void on_dialog_no(lv_event_t*)
{
    if (s_flow_visible == FlowStep::Warn) {
        ESP_LOGI(TAG, "waarschuwing: Annuleren; numpad via timer");
        request_step(FlowStep::Numpad);
        return;
    }
    request_step(FlowStep::Close);
}

static void on_param(lv_event_t* e)
{
    const int idx = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    screen_entry_start(idx);
}

static lv_obj_t* make_btn(lv_obj_t* parent, const char* title, lv_event_cb_t cb, void* ud)
{
    lv_obj_t* btn = safe_obj(parent, "knop");
    if (btn == nullptr) {
        return nullptr;
    }
    lv_obj_set_style_bg_color(btn, COL_BTN, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(btn, COL_BORDER, 0);
    lv_obj_set_style_border_width(btn, 2, 0);
    lv_obj_set_style_radius(btn, 10, 0);
    lv_obj_set_style_pad_all(btn, 0, 0);
    lv_obj_remove_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, ud);
    lv_obj_t* lbl = safe_label(btn, "knop-label");
    if (lbl != nullptr) {
        lv_label_set_text(lbl, title);
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, 0);
        lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
        lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_center(lbl);
    }
    return btn;
}

static lv_obj_t* make_dialog(lv_obj_t* parent)
{
    s_dialog_txt = nullptr;
    lv_obj_t* dim = safe_obj(parent, "dialog");
    if (dim == nullptr) {
        return nullptr;
    }
    lv_obj_set_size(dim, 1024, 600);
    lv_obj_set_pos(dim, 0, 0);
    lv_obj_set_style_bg_color(dim, COL_DIM, 0);
    lv_obj_set_style_bg_opa(dim, LV_OPA_70, 0);
    lv_obj_set_style_border_width(dim, 0, 0);
    lv_obj_set_style_radius(dim, 0, 0);
    lv_obj_set_style_pad_all(dim, 0, 0);
    lv_obj_remove_flag(dim, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(dim, LV_SCROLLBAR_MODE_OFF);
    lv_obj_add_flag(dim, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(dim, LV_OBJ_FLAG_HIDDEN);

    lv_obj_t* box = safe_obj(dim, "modal-box");
    if (box == nullptr) {
        ESP_LOGE(TAG, "modal-box ontbreekt; overlay afgebroken");
        return dim;
    }
    lv_obj_set_size(box, 720, 280);
    lv_obj_center(box);
    lv_obj_set_style_bg_color(box, COL_CARD, 0);
    lv_obj_set_style_border_color(box, COL_BORDER, 0);
    lv_obj_set_style_border_width(box, 2, 0);
    lv_obj_set_style_radius(box, 12, 0);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(box, LV_SCROLLBAR_MODE_OFF);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_CLICKABLE);

    lv_obj_t* txt = safe_label(box, "dialog-tekst");
    if (txt != nullptr) {
        lv_obj_set_width(txt, 680);
        lv_label_set_long_mode(txt, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_text_font(txt, &lv_font_montserrat_24, 0);
        lv_obj_set_style_text_color(txt, COL_TEXT, 0);
        lv_obj_remove_flag(txt, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_align(txt, LV_ALIGN_TOP_MID, 0, 16);
    }
    s_dialog_txt = txt;

    lv_obj_t* yesb = make_btn(box, "Ja", on_dialog_yes, nullptr);
    if (yesb != nullptr) {
        lv_obj_set_size(yesb, 300, 80);
        lv_obj_align(yesb, LV_ALIGN_BOTTOM_LEFT, 20, -16);
    }
    lv_obj_t* nob = make_btn(box, "Annuleren", on_dialog_no, nullptr);
    if (nob != nullptr) {
        lv_obj_set_size(nob, 300, 80);
        lv_obj_align(nob, LV_ALIGN_BOTTOM_RIGHT, -20, -16);
    }
    return dim;
}

static void create_unit_bar(lv_obj_t* host)
{
    if (obj_alive(s_unit_bar) || host == nullptr) {
        return;
    }
    s_unit_bar = safe_obj(host, "eenheid-balk");
    if (!obj_alive(s_unit_bar)) {
        return;
    }
    lv_obj_set_pos(s_unit_bar, 0, 0);
    lv_obj_set_size(s_unit_bar, 284, 64);
    lv_obj_set_style_bg_opa(s_unit_bar, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(s_unit_bar, 0, 0);
    lv_obj_set_style_pad_all(s_unit_bar, 0, 0);
    lv_obj_remove_flag(s_unit_bar, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_unit_bar, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_unit_bar, LV_OBJ_FLAG_HIDDEN);
    for (int i = 0; i < 2; i++) {
        s_unit_btn[i] = safe_obj(s_unit_bar, "eenheid-knop");
        if (s_unit_btn[i] == nullptr) {
            continue;
        }
        lv_obj_set_pos(s_unit_btn[i], i * 148, 0);
        lv_obj_set_size(s_unit_btn[i], 136, 64);
        lv_obj_set_style_bg_color(s_unit_btn[i], COL_BTN, 0);
        lv_obj_set_style_border_color(s_unit_btn[i], COL_BORDER, 0);
        lv_obj_set_style_border_width(s_unit_btn[i], 2, 0);
        lv_obj_set_style_radius(s_unit_btn[i], 10, 0);
        lv_obj_set_style_pad_all(s_unit_btn[i], 0, 0);
        lv_obj_remove_flag(s_unit_btn[i], LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(s_unit_btn[i], LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(s_unit_btn[i], on_unit, LV_EVENT_CLICKED,
                            reinterpret_cast<void*>(static_cast<intptr_t>(i)));
        s_unit_lbl[i] = safe_label(s_unit_btn[i], "eenheid-label");
        if (s_unit_lbl[i] != nullptr) {
            lv_obj_set_style_text_font(s_unit_lbl[i], &lv_font_montserrat_20, 0);
            lv_obj_set_style_text_color(s_unit_lbl[i], COL_TEXT, 0);
            lv_obj_remove_flag(s_unit_lbl[i], LV_OBJ_FLAG_CLICKABLE);
            lv_obj_center(s_unit_lbl[i]);
        }
    }
}

static void create_time_bar(lv_obj_t* host)
{
    if (obj_alive(s_time_bar) || host == nullptr) {
        return;
    }
    s_time_bar = safe_obj(host, "tijd-balk");
    if (!obj_alive(s_time_bar)) {
        return;
    }
    int bar_w = 976;
    int bar_h = 400;
    if (obj_alive(host)) {
        const int host_w = static_cast<int>(lv_obj_get_width(host));
        const int host_h = static_cast<int>(lv_obj_get_height(host));
        if (host_w >= 400) {
            bar_w = host_w;
        }
        if (host_h >= 200) {
            bar_h = host_h;
        }
    }
    lv_obj_set_pos(s_time_bar, 0, 0);
    lv_obj_set_size(s_time_bar, bar_w, bar_h);
    lv_obj_set_style_bg_opa(s_time_bar, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(s_time_bar, 0, 0);
    lv_obj_set_style_pad_all(s_time_bar, 0, 0);
    lv_obj_remove_flag(s_time_bar, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_time_bar, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_time_bar, LV_OBJ_FLAG_HIDDEN);

    lv_obj_t* title = safe_label(s_time_bar, "tijd-titel");
    if (title != nullptr) {
        lv_label_set_text(title, "Moment van meten");
        lv_obj_set_style_text_font(title, &lv_font_montserrat_20, 0);
        lv_obj_set_style_text_color(title, COL_MUTED, 0);
        lv_obj_remove_flag(title, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_width(title, bar_w);
        lv_label_set_long_mode(title, LV_LABEL_LONG_DOT);
        lv_obj_set_pos(title, 0, 8);
    }
    s_time_summary = safe_label(s_time_bar, "tijd-samenvatting");
    if (s_time_summary != nullptr) {
        lv_label_set_text(s_time_summary, "");
        lv_obj_set_style_text_font(s_time_summary, &lv_font_montserrat_30, 0);
        lv_obj_set_style_text_color(s_time_summary, COL_TEXT, 0);
        lv_obj_remove_flag(s_time_summary, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_width(s_time_summary, bar_w);
        lv_label_set_long_mode(s_time_summary, LV_LABEL_LONG_DOT);
        lv_obj_set_pos(s_time_summary, 0, 36);
    }

    const int head_h = 88;
    const int gap = 16;
    const int btn_area_h = bar_h - head_h - 8;
    const int row_h = (btn_area_h - gap) / 2;
    const int row1_w = (bar_w - gap) / 2;
    const int row2_w = (bar_w - 2 * gap) / 3;
    const int row2_y = head_h + row_h + gap;
    const int xs[5] = {0, row1_w + gap, 0, row2_w + gap, 2 * (row2_w + gap)};
    const int ys[5] = {head_h, head_h, row2_y, row2_y, row2_y};
    const int ws[5] = {row1_w, row1_w, row2_w, row2_w, row2_w};
    for (int i = 0; i < 5; i++) {
        s_time_btn[i] = safe_obj(s_time_bar, "tijd-knop");
        if (s_time_btn[i] == nullptr) {
            continue;
        }
        lv_obj_set_pos(s_time_btn[i], xs[i], ys[i]);
        lv_obj_set_size(s_time_btn[i], ws[i], row_h);
        lv_obj_set_style_bg_color(s_time_btn[i], COL_BTN, 0);
        lv_obj_set_style_border_color(s_time_btn[i], COL_BORDER, 0);
        lv_obj_set_style_border_width(s_time_btn[i], 2, 0);
        lv_obj_set_style_radius(s_time_btn[i], 10, 0);
        lv_obj_set_style_pad_all(s_time_btn[i], 0, 0);
        lv_obj_remove_flag(s_time_btn[i], LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(s_time_btn[i], LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(s_time_btn[i], on_when, LV_EVENT_CLICKED,
                            reinterpret_cast<void*>(static_cast<intptr_t>(i)));
        s_time_lbl[i] = safe_label(s_time_btn[i], "tijd-label");
        if (s_time_lbl[i] != nullptr) {
            lv_label_set_text(s_time_lbl[i], k_when_lbl[i]);
            lv_obj_set_style_text_font(s_time_lbl[i], &lv_font_montserrat_30, 0);
            lv_obj_set_style_text_color(s_time_lbl[i], COL_TEXT, 0);
            lv_obj_remove_flag(s_time_lbl[i], LV_OBJ_FLAG_CLICKABLE);
            lv_obj_center(s_time_lbl[i]);
        }
    }
}

static void overlay_build_cb(lv_timer_t*)
{
    if (s_ov_timer != nullptr) {
        lv_timer_pause(s_ov_timer);
    }
    lv_obj_t* host = overlay_parent();
    if (host == nullptr) {
        s_ov_build = OvBuild::Done;
        ESP_LOGE(TAG, "overlay-opbouw gestopt: geen host");
        return;
    }
    switch (s_ov_build) {
        case OvBuild::Numpad:
            if (s_pad.overlay == nullptr) {
                ui_numpad_create(&s_pad, host, on_pad_ok, on_pad_cancel);
            }
            if (s_pad.overlay == nullptr) {
                ESP_LOGE(TAG, "numpad ontbreekt; overlay-opbouw gaat door");
            }
            s_ov_build = OvBuild::Bars;
            break;
        case OvBuild::Bars:
            create_unit_bar(s_pad.unit_slot);
            create_time_bar(s_pad.time_slot);
            s_ov_build = OvBuild::Dialog;
            break;
        case OvBuild::Dialog:
            if (!obj_alive(s_dialog)) {
                s_dialog = make_dialog(host);
                if (!obj_alive(s_dialog)) {
                    ESP_LOGE(TAG, "dialog ontbreekt; invoer zonder bevestiging");
                }
            }
            s_ov_build = OvBuild::Done;
            ESP_LOGI(TAG, "invoer-overlays klaar (numpad + 1 dialog, gestaggerd)");
            if (s_start_when_ready >= 0) {
                const int idx = s_start_when_ready;
                s_start_when_ready = -1;
                screen_entry_start(idx);
            }
            return;
        case OvBuild::Idle:
        case OvBuild::Done:
        default:
            return;
    }
    if (s_ov_timer != nullptr) {
        lv_timer_set_period(s_ov_timer, k_ov_timer_ms);
        lv_timer_reset(s_ov_timer);
        lv_timer_resume(s_ov_timer);
    }
}

lv_obj_t* screen_entry_create()
{
    if (s_scr != nullptr && lv_obj_is_valid(s_scr)) {
        ESP_LOGI(TAG, "invoerscherm bestaat al; geen recreate");
        return s_scr;
    }
    if (s_snap == nullptr) {
        s_snap = static_cast<MeasSnapshot*>(
            heap_caps_calloc(1, sizeof(MeasSnapshot), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    }
    s_scr = safe_obj(nullptr, "invoerscherm");
    if (s_scr == nullptr) {
        ESP_LOGE(TAG, "invoerscherm create faalde");
        return nullptr;
    }
    lv_obj_set_size(s_scr, 1024, 600);
    lv_obj_set_style_bg_color(s_scr, COL_BG, 0);
    lv_obj_set_style_bg_opa(s_scr, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(s_scr, 0, 0);
    lv_obj_set_style_pad_all(s_scr, 0, 0);
    lv_obj_remove_flag(s_scr, LV_OBJ_FLAG_SCROLLABLE);

    s_status = ui_status_bar_create(s_scr);

    const int gap = 12;
    const int area_x = 12;
    const int area_y = APP_UI_STATUS_H + 8;
    const int area_w = 1024 - 24;
    const int area_h = 600 - APP_UI_STATUS_H - APP_UI_NAV_H - 16;
    const int cols = 4;
    const int rows = 2;
    const int col_w = (area_w - (cols - 1) * gap) / cols;
    const int row_h = (area_h - (rows - 1) * gap) / rows;

    for (int i = 0; i < k_param_count; i++) {
        const ParamDef* p = param_catalog_get(i);
        const int c = i % cols;
        const int r = i / cols;
        const int x = area_x + c * (col_w + gap);
        const int y = area_y + r * (row_h + gap);
        lv_obj_t* card = ui_make_card(s_scr, x, y, col_w, row_h);
        if (card == nullptr) {
            ESP_LOGE(TAG, "tegel %d create faalde", i);
            continue;
        }
        lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(card, on_param, LV_EVENT_CLICKED,
                            reinterpret_cast<void*>(static_cast<intptr_t>(i)));
        lv_obj_t* title = ui_make_label(card, 0, 0, &lv_font_montserrat_20, COL_BLUE,
                                        p != nullptr ? p->label : "");
        if (title != nullptr) {
            lv_obj_remove_flag(title, LV_OBJ_FLAG_CLICKABLE);
        }
        s_val[i] = ui_make_label(card, 0, 40, &lv_font_montserrat_24, COL_MUTED, "--");
        if (s_val[i] != nullptr) {
            lv_obj_set_width(s_val[i], col_w - 24);
            lv_obj_remove_flag(s_val[i], LV_OBJ_FLAG_CLICKABLE);
        }
        s_meta[i] = ui_make_label(card, 0, row_h - 48, &lv_font_montserrat_14, COL_MUTED, "");
        if (s_meta[i] != nullptr) {
            lv_obj_set_width(s_meta[i], col_w - 24);
            lv_label_set_long_mode(s_meta[i], LV_LABEL_LONG_DOT);
            lv_obj_remove_flag(s_meta[i], LV_OBJ_FLAG_CLICKABLE);
        }
        s_card[i] = card;
    }

    s_nav = ui_nav_create(s_scr, 2);

    s_overlay_host = safe_obj(s_scr, "overlay-host");
    if (s_overlay_host == nullptr) {
        ESP_LOGE(TAG, "overlay-host create faalde");
    } else {
        lv_obj_set_size(s_overlay_host, 1024, 600);
        lv_obj_set_pos(s_overlay_host, 0, 0);
        lv_obj_set_style_bg_opa(s_overlay_host, LV_OPA_TRANSP, 0);
        lv_obj_set_style_border_width(s_overlay_host, 0, 0);
        lv_obj_set_style_pad_all(s_overlay_host, 0, 0);
        lv_obj_set_style_radius(s_overlay_host, 0, 0);
        lv_obj_remove_flag(s_overlay_host, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_scrollbar_mode(s_overlay_host, LV_SCROLLBAR_MODE_OFF);
        lv_obj_remove_flag(s_overlay_host, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_flag(s_overlay_host, LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_add_flag(s_overlay_host, LV_OBJ_FLAG_FLOATING);
        lv_obj_add_flag(s_overlay_host, LV_OBJ_FLAG_HIDDEN);
    }

    s_toast = safe_label(s_scr, "toast");
    if (s_toast != nullptr) {
        lv_label_set_text(s_toast, "");
        lv_obj_set_style_text_font(s_toast, &lv_font_montserrat_20, 0);
        lv_obj_set_style_text_color(s_toast, COL_TEXT, 0);
        lv_obj_set_style_bg_color(s_toast, COL_GREEN, 0);
        lv_obj_set_style_bg_opa(s_toast, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(s_toast, 10, 0);
        lv_obj_set_style_pad_all(s_toast, 12, 0);
        lv_obj_remove_flag(s_toast, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_align(s_toast, LV_ALIGN_TOP_MID, 0, 56);
        lv_obj_add_flag(s_toast, LV_OBJ_FLAG_HIDDEN);
    }

    s_flow_timer = lv_timer_create(flow_timer_cb, k_flow_timer_ms, nullptr);
    if (s_flow_timer != nullptr) {
        lv_timer_pause(s_flow_timer);
    } else {
        ESP_LOGE(TAG, "flow-timer create faalde");
    }

    s_ov_build = OvBuild::Numpad;
    if (s_ov_timer == nullptr) {
        s_ov_timer = lv_timer_create(overlay_build_cb, k_ov_timer_ms, nullptr);
    }
    if (s_ov_timer != nullptr) {
        lv_timer_reset(s_ov_timer);
        lv_timer_resume(s_ov_timer);
    } else {
        ESP_LOGE(TAG, "overlay-timer create faalde");
        s_ov_build = OvBuild::Done;
    }

    ESP_LOGI(TAG, "invoerscherm-shell klaar; overlays via timer %u ms (niet in tab-click)",
             static_cast<unsigned>(k_ov_timer_ms));
    return s_scr;
}

void screen_entry_start(int param_idx)
{
    const ParamDef* p = param_catalog_get(param_idx);
    if (p == nullptr) {
        return;
    }
    if (s_scr == nullptr || s_ov_build != OvBuild::Done ||
        !obj_alive(s_pad.overlay)) {
        s_start_when_ready = param_idx;
        ESP_LOGI(TAG, "invoer %s wacht op overlay-opbouw", p->key);
        return;
    }
    s_param = param_idx;
    s_unit = measurement_queue_unit_pref(param_idx);
    s_when = 0;
    s_value = 0;
    s_value_ui[0] = '\0';
    ESP_LOGI(TAG, "invoer starten: %s", p->key);
    request_step(FlowStep::Numpad);
}

void screen_entry_dismiss()
{
    hide_flow();
}

bool screen_entry_overlay_open()
{
    return s_flow_open;
}

void screen_entry_set_nav_badge(int open_tasks)
{
    ui_nav_set_badge(s_nav, open_tasks);
}

void screen_entry_update(const AppState& st, const StatusSnapshot& app)
{
    if (s_scr == nullptr) {
        return;
    }
    ui_status_bar_update(s_status, st, app);
    ui_nav_set_badge(s_nav, app.due_now_count);

    if (s_toast_until_us != 0 && esp_timer_get_time() >= s_toast_until_us) {
        s_toast_until_us = 0;
        if (obj_alive(s_toast)) {
            lv_obj_add_flag(s_toast, LV_OBJ_FLAG_HIDDEN);
        }
    }

    if (s_snap == nullptr) {
        return;
    }
    measurement_queue_snapshot(s_snap);
    const int64_t now = st.time_synced ? static_cast<int64_t>(time(nullptr)) : 0;
    for (int i = 0; i < k_param_count; i++) {
        const ParamDef* p = param_catalog_get(i);
        if (p == nullptr || !obj_alive(s_val[i])) {
            continue;
        }
        const MeasLast& last = s_snap->last[i];
        if (!last.present) {
            lv_label_set_text(s_val[i], "--");
            lv_obj_set_style_text_color(s_val[i], COL_MUTED, 0);
            if (obj_alive(s_meta[i])) {
                lv_label_set_text(s_meta[i], "geen meting");
                lv_obj_set_style_text_color(s_meta[i], COL_MUTED, 0);
            }
            continue;
        }
        const int u = (last.unit < p->unit_count) ? last.unit : 0;
        char num[24];
        ui_format_nl(num, sizeof(num), last.value, p->decimals[u]);
        const char* unit = (p->units[u] != nullptr) ? p->units[u] : "";
        lv_label_set_text_fmt(s_val[i], "%s %s", num, unit);
        lv_obj_set_style_text_color(s_val[i], COL_TEXT, 0);

        if (!obj_alive(s_meta[i])) {
            continue;
        }
        int32_t days = -1;
        const Freshness fr = param_freshness(i, last.measured_at, now, &days);
        const char* badge = "";
        lv_color_t bc = COL_MUTED;
        if (fr == Freshness::Fresh) {
            badge = "vers";
            bc = COL_GREEN;
        } else if (fr == Freshness::Soon) {
            badge = "bijna verlopen";
            bc = COL_ORANGE;
        } else if (fr == Freshness::Expired) {
            badge = "verouderd";
            bc = COL_ORANGE;
        }
        char age[40] = "";
        if (last.measured_at >= 1700000000 && now >= 1700000000) {
            const int age_s = static_cast<int>(now - last.measured_at);
            if (age_s < 3600) {
                snprintf(age, sizeof(age), "%d min", age_s / 60);
            } else if (age_s < 86400) {
                snprintf(age, sizeof(age), "%d u", age_s / 3600);
            } else {
                snprintf(age, sizeof(age), "%d d", age_s / 86400);
            }
        }
        if (badge[0] != '\0' && age[0] != '\0') {
            lv_label_set_text_fmt(s_meta[i], "%s, %s", age, badge);
        } else if (badge[0] != '\0') {
            lv_label_set_text(s_meta[i], badge);
        } else if (age[0] != '\0') {
            lv_label_set_text(s_meta[i], age);
        } else {
            lv_label_set_text(s_meta[i], last.from_app ? "app" : "paneel");
        }
        lv_obj_set_style_text_color(s_meta[i], bc, 0);
    }
}
