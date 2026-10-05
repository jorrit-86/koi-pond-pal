// KOIoT Paneel - Taken-scherm (M1.5).
#include "ui/screen_tasks.h"

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "lvgl.h"

#include "app_config.h"
#include "core/app_state.h"
#include "core/net_manager.h"
#include "data/live_store.h"
#include "data/status_store.h"
#include "io/backend_client.h"
#include "ui/ui_chrome.h"
#include "ui/ui_numpad.h"
#include "ui/ui_root.h"

static const char* TAG = "screen_tasks";

static const lv_color_t COL_BG     = lv_color_hex(0x0E1216);
static const lv_color_t COL_CARD   = lv_color_hex(0x1B2229);
static const lv_color_t COL_BORDER = lv_color_hex(0x2E3A45);
static const lv_color_t COL_TEXT   = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED  = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_ORANGE = lv_color_hex(0xF39C12);
static const lv_color_t COL_BTN    = lv_color_hex(0x2A3540);
static const lv_color_t COL_MODAL  = lv_color_hex(0x000000);

static const char* MONTHS_NL[12] = {"jan", "feb", "mrt", "apr", "mei", "jun",
                                    "jul", "aug", "sep", "okt", "nov", "dec"};

struct TaskRow {
    char id[40];
    char title[96];
    bool has_id;
    bool has_desc;
    bool expanded;
    bool action_done;
    bool action_seen;
    bool action_dismissed;
    int field_n;
    StatusTaskField fields[k_status_task_fields_max];
    lv_obj_t* card;
    lv_obj_t* title_lbl;
    lv_obj_t* meta_lbl;
    lv_obj_t* desc;
    lv_obj_t* btn_done;
    lv_obj_t* btn_seen;
    lv_obj_t* btn_dismissed;
    lv_obj_t* busy;
};

static lv_obj_t* s_scr = nullptr;
static UiStatusBar s_status;
static UiNav s_nav;
static lv_obj_t* s_head = nullptr;
static lv_obj_t* s_season = nullptr;
static lv_obj_t* s_feed = nullptr;
static lv_obj_t* s_warn = nullptr;
static lv_obj_t* s_list = nullptr;
static lv_obj_t* s_empty = nullptr;
static lv_obj_t* s_updated = nullptr;
static lv_obj_t* s_refresh = nullptr;

static TaskRow* s_rows = nullptr;
static int s_row_n = 0;
static constexpr size_t k_sig_len = 1536;
static char* s_sig = nullptr;
static char* s_sig_buf = nullptr;

// Lijstopbouw over meerdere LVGL-ticks: nooit 15 kaarten+knoppen in één callback
// (IDLE0 moet de TWDT kunnen voeden; crash was taskLVGL in lv_obj_allocate_spec_attr /
// daarna draw_letter van alle labels).
enum class TasksBuildPhase : uint8_t {
    Idle = 0,
    Clearing,
    Building,
    OverlayOff,  // overlay/host eerst weg; lijst blijft HIDDEN (geen teken deze tick)
    Revealing,   // daarna 1 kind/tick; nooit 14 kaarten in één invalidate
};
static constexpr int k_max_cards_per_tick = 1;
static constexpr int k_max_delete_per_tick = 1;
static constexpr int k_max_reveal_per_tick = 1;
static TasksBuildPhase s_build_phase = TasksBuildPhase::Idle;
static int s_build_order[k_status_tasks_max];
static int s_build_n = 0;
static int s_build_idx = 0;
static int s_reveal_idx = 0;
static bool s_build_time_ok = false;
static bool s_have_now = false;
static bool s_have_later = false;
static bool s_now_hdr_done = false;
static bool s_later_hdr_done = false;
static bool s_drawn_time_ok = false;
static bool s_tab_visible = false;
static bool s_rebuild_pending = false;
static int s_due_refresh_i = -1;
static bool s_logged_due_refresh = false;
static bool s_have_task_layout = false;
static bool s_laid_out_head = false;
static bool s_waiting_after_close = false;

static void create_modal(lv_obj_t* parent);

static lv_obj_t* s_modal = nullptr;
static lv_obj_t* s_modal_box = nullptr;
static lv_obj_t* s_modal_text = nullptr;
static lv_obj_t* s_modal_extra = nullptr;
static lv_obj_t* s_btn_yes = nullptr;
static lv_obj_t* s_btn_no = nullptr;
static lv_obj_t* s_btn_ok = nullptr;

static UiNumpad s_numpad;

// Keuze-overlay: één cyclus-knop + OK (geen 8 flex-knoppen). pal-app-waarden blijven.
// Opbouw via lv_timer periode >0 (niet lv_async_call periode 0): max 1 lv_obj_create
// per timer-expire, en die timer vuurt niet meerdere keren in één lv_timer_handler.
struct CloseChoice {
    const char* value;
    const char* label;
};
enum class ChoiceBuildStep : uint8_t {
    Idle = 0,
    Overlay,
    Box,
    Title,
    CycleBtn,
    CycleLbl,
    Hint,
    OkBtn,
    OkLbl,
    NoBtn,
    NoLbl,
    Done,
};
static constexpr int k_choice_obj_total = 10;
static constexpr uint32_t k_choice_timer_ms = 50;
static lv_obj_t* s_choice_overlay = nullptr;
static lv_obj_t* s_choice_box = nullptr;
static lv_obj_t* s_choice_title = nullptr;
static lv_obj_t* s_choice_cycle = nullptr;
static lv_obj_t* s_choice_cycle_lbl = nullptr;
static lv_obj_t* s_choice_hint = nullptr;
static lv_obj_t* s_choice_ok_lbl = nullptr;
static lv_obj_t* s_choice_btn_ok = nullptr;
static lv_obj_t* s_choice_btn_no = nullptr;
static lv_obj_t* s_choice_no_lbl = nullptr;
static lv_timer_t* s_choice_timer = nullptr;
static ChoiceBuildStep s_choice_step = ChoiceBuildStep::Idle;
static int s_choice_obj_i = 0;
static const CloseChoice* s_choice_opts = nullptr;
static int s_choice_n = 0;
static int s_choice_sel = 0;
static bool s_choice_want_show = false;
static bool s_list_frozen = false;

static const CloseChoice k_water_type_opts[] = {
    {"tap_water", "Kraanwater"},
    {"well_water", "Bronwater"},
    {"rain_water", "Regenwater"},
    {"ro_water", "RO"},
    {"mixed", "Gemengd"},
};
static const CloseChoice k_reason_opts[] = {
    {"routine", "Routine"},
    {"maintenance", "Onderhoud"},
    {"problem", "Probleem"},
    {"emergency", "Noodgeval"},
    {"seasonal", "Seizoensgebonden"},
    {"other", "Anders"},
};
// Tekstvelden (notes e.d.): geen lv_keyboard/buttonmatrix. Cyclus + leeg = overslaan.
static const CloseChoice k_note_opts[] = {
    {"", "(geen)"},
    {"Geen bijzonderheden", "Geen bijzonderheden"},
    {"Algen", "Algen"},
};

static char s_pending_id[40] = "";
static char s_pending_status[16] = "";
static char s_pending_verb[32] = "";
static char s_pending_title[96] = "";
static char s_pending_note[160] = "";
static int s_pending_field_n = 0;
static StatusTaskField s_pending_fields[k_status_task_fields_max];
static char s_pending_vals[k_status_task_fields_max][24];
static char s_pending_vals_ui[k_status_task_fields_max][24];
static int s_collect_i = 0;
static uint32_t s_popup_seen = 0;
static bool s_modal_confirm = false;

// Eén owner voor wizard-overlays (numpad/keuze/modal). Nooit create op s_scr
// tijdens een nested click: s_scr heeft al ~7 chrome-kinderen; 8e child schrijft naar
// spec_attr->children[7] (offset 0x1c) — crash als parent dood is of realloc faalt.
static lv_obj_t* s_overlay_host = nullptr;
static constexpr int k_wiz_none = -2;
static constexpr int k_wiz_confirm = -1;
static int s_wizard_show = k_wiz_none;
static bool s_wizard_async_pending = false;

static lv_obj_t* make_btn(lv_obj_t* parent, const char* title, int h, int radius = 10)
{
    if (parent == nullptr || !lv_obj_is_valid(parent)) {
        ESP_LOGE(TAG, "geen geldige parent (knop); create overgeslagen");
        return nullptr;
    }
    lv_obj_t* btn = lv_obj_create(parent);
    if (btn == nullptr) {
        ESP_LOGE(TAG, "knop create faalde");
        return nullptr;
    }
    lv_obj_set_height(btn, h);
    lv_obj_set_style_bg_color(btn, COL_BTN, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(btn, COL_BORDER, 0);
    lv_obj_set_style_border_width(btn, radius > 0 ? 2 : 1, 0);
    lv_obj_set_style_radius(btn, radius, 0);
    lv_obj_set_style_shadow_width(btn, 0, 0);
    lv_obj_set_style_outline_width(btn, 0, 0);
    lv_obj_set_style_pad_all(btn, 0, 0);
    lv_obj_remove_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_t* lbl = lv_label_create(btn);
    lv_label_set_text(lbl, title);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(lbl);
    return btn;
}

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

static void forget_dead_overlays()
{
    const bool host_dead = (s_overlay_host != nullptr && !lv_obj_is_valid(s_overlay_host));
    if (host_dead) {
        s_overlay_host = nullptr;
        s_numpad = UiNumpad{};
        s_choice_overlay = nullptr;
        s_choice_box = nullptr;
        s_choice_title = nullptr;
        s_choice_cycle = nullptr;
        s_choice_cycle_lbl = nullptr;
        s_choice_hint = nullptr;
        s_choice_ok_lbl = nullptr;
        s_choice_btn_ok = nullptr;
        s_choice_btn_no = nullptr;
        s_choice_no_lbl = nullptr;
        s_choice_obj_i = 0;
        s_choice_step = ChoiceBuildStep::Idle;
        s_modal = nullptr;
        s_modal_box = nullptr;
        s_modal_text = nullptr;
        s_modal_extra = nullptr;
        s_btn_yes = nullptr;
        s_btn_no = nullptr;
        s_btn_ok = nullptr;
        return;
    }
    if (s_numpad.overlay != nullptr && !lv_obj_is_valid(s_numpad.overlay)) {
        s_numpad = UiNumpad{};
    }
    if (s_choice_overlay != nullptr && !lv_obj_is_valid(s_choice_overlay)) {
        s_choice_overlay = nullptr;
        s_choice_box = nullptr;
        s_choice_title = nullptr;
        s_choice_cycle = nullptr;
        s_choice_cycle_lbl = nullptr;
        s_choice_hint = nullptr;
        s_choice_ok_lbl = nullptr;
        s_choice_btn_ok = nullptr;
        s_choice_btn_no = nullptr;
        s_choice_no_lbl = nullptr;
        s_choice_obj_i = 0;
        s_choice_step = ChoiceBuildStep::Idle;
    }
    if (s_modal != nullptr && !lv_obj_is_valid(s_modal)) {
        s_modal = nullptr;
        s_modal_box = nullptr;
        s_modal_text = nullptr;
        s_modal_extra = nullptr;
        s_btn_yes = nullptr;
        s_btn_no = nullptr;
        s_btn_ok = nullptr;
    }
}

static lv_obj_t* overlay_parent()
{
    forget_dead_overlays();
    if (obj_alive(s_overlay_host)) {
        return s_overlay_host;
    }
    s_overlay_host = nullptr;
    if (!parent_ok(s_scr, "overlay-host")) {
        return nullptr;
    }
    s_overlay_host = lv_obj_create(s_scr);
    if (s_overlay_host == nullptr) {
        ESP_LOGE(TAG, "overlay-host create faalde");
        return nullptr;
    }
    lv_obj_set_size(s_overlay_host, 1024, 600);
    lv_obj_set_pos(s_overlay_host, 0, 0);
    lv_obj_set_style_bg_opa(s_overlay_host, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(s_overlay_host, 0, 0);
    lv_obj_set_style_pad_all(s_overlay_host, 0, 0);
    lv_obj_set_style_radius(s_overlay_host, 0, 0);
    lv_obj_remove_flag(s_overlay_host, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_overlay_host, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_overlay_host, LV_OBJ_FLAG_IGNORE_LAYOUT);
    lv_obj_add_flag(s_overlay_host, LV_OBJ_FLAG_HIDDEN);
    return s_overlay_host;
}

static void show_overlay_host()
{
    lv_obj_t* host = overlay_parent();
    if (!obj_alive(host)) {
        return;
    }
    lv_obj_remove_flag(host, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(host);
}

static void hide_overlay_host()
{
    if (obj_alive(s_overlay_host)) {
        lv_obj_add_flag(s_overlay_host, LV_OBJ_FLAG_HIDDEN);
    }
}

static bool draw_buf_ok(const char* where)
{
    lv_display_t* d = lv_display_get_default();
    if (d == nullptr) {
        ESP_LOGW(TAG, "draw-buf NULL (%s): geen display; teken overgeslagen",
                 (where != nullptr) ? where : "?");
        return false;
    }
    const lv_draw_buf_t* buf = lv_display_get_buf_active(d);
    if (buf == nullptr || buf->data == nullptr) {
        ESP_LOGW(TAG, "draw-buf NULL (%s); teken overgeslagen",
                 (where != nullptr) ? where : "?");
        return false;
    }
    return true;
}

static void show_field_input(int i);
static void show_confirm_close();
static void wizard_async(void*);
static void choice_build_cancel();
static void choice_build_timer_cb(lv_timer_t*);
static void reset_row_state();
static void abort_list_build(const char* why);
static void hide_task_list();
static void log_tasks_heap(const char* when);

static bool wizard_open()
{
    return s_pending_id[0] != '\0';
}

static void hide_task_list()
{
    if (obj_alive(s_list)) {
        lv_obj_add_flag(s_list, LV_OBJ_FLAG_HIDDEN);
    }
}

static void log_tasks_heap(const char* when)
{
    const size_t intern = heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
    const size_t largest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
    const size_t psram = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
    ESP_LOGI(TAG, "heap %s: intern=%u KB grootste=%u KB PSRAM=%u KB",
             (when != nullptr) ? when : "?",
             static_cast<unsigned>(intern / 1024),
             static_cast<unsigned>(largest / 1024),
             static_cast<unsigned>(psram / 1024));
}

static void abort_list_build(const char* why)
{
    if (s_build_phase != TasksBuildPhase::Idle) {
        ESP_LOGI(TAG, "takenlijst: opbouw geannuleerd (%s)",
                 (why != nullptr && why[0] != '\0') ? why : "-");
    }
    s_build_phase = TasksBuildPhase::Idle;
    s_build_idx = 0;
    s_build_n = 0;
    s_reveal_idx = 0;
    s_rebuild_pending = false;
    s_due_refresh_i = -1;
    reset_row_state();
    if (s_sig != nullptr) {
        s_sig[0] = '\0';
    }
}

static void freeze_task_list(bool freeze)
{
    // Hervat ≠ show-all: unhide van 15 kaarten forceert één draw_letter-pass (TWDT).
    if (freeze) {
        if (!s_list_frozen) {
            ESP_LOGI(TAG, "takenlijst: pauze tijdens wizard");
        }
        s_list_frozen = true;
        abort_list_build("wizard pauze");
        hide_task_list();
        return;
    }
    if (s_list_frozen) {
        ESP_LOGI(TAG, "takenlijst: wizard klaar; lijst blijft verborgen tot staggered opbouw");
    }
    s_list_frozen = false;
    hide_task_list();
}

static void wizard_request(int step)
{
    s_wizard_show = step;
    if (s_wizard_async_pending) {
        return;
    }
    s_wizard_async_pending = true;
    if (lv_async_call(wizard_async, nullptr) != LV_RESULT_OK) {
        s_wizard_async_pending = false;
        wizard_async(nullptr);
    }
}

static void wizard_cancel()
{
    if (s_wizard_async_pending) {
        lv_async_call_cancel(wizard_async, nullptr);
        s_wizard_async_pending = false;
    }
    choice_build_cancel();
    s_wizard_show = k_wiz_none;
}

static void hide_inputs()
{
    ui_numpad_hide(&s_numpad);
    if (obj_alive(s_choice_overlay)) {
        lv_obj_add_flag(s_choice_overlay, LV_OBJ_FLAG_HIDDEN);
    }
    choice_build_cancel();
}

static void ensure_modal()
{
    forget_dead_overlays();
    if (obj_alive(s_modal)) {
        return;
    }
    s_modal = nullptr;
    lv_obj_t* parent = overlay_parent();
    if (parent == nullptr) {
        return;
    }
    create_modal(parent);
}

static void hide_modal()
{
    const bool was_confirm = s_modal_confirm;
    const bool close_busy = status_store_is_close_busy();
    wizard_cancel();
    if (obj_alive(s_modal)) {
        lv_obj_add_flag(s_modal, LV_OBJ_FLAG_HIDDEN);
    }
    hide_inputs();
    hide_overlay_host();
    s_modal_confirm = false;
    s_pending_id[0] = '\0';
    s_pending_field_n = 0;
    s_collect_i = 0;

    if (!was_confirm && !close_busy) {
        return;
    }

    hide_task_list();
    if (close_busy) {
        abort_list_build("POST loopt");
        s_list_frozen = true;
        s_waiting_after_close = true;
        ESP_LOGI(TAG, "takenlijst: wizard klaar; verborgen tot POST klaar (geen unhide)");
    } else {
        abort_list_build("wizard dicht");
        s_list_frozen = false;
        s_waiting_after_close = false;
        ESP_LOGI(TAG, "takenlijst: wizard dicht; lijst blijft verborgen tot staggered opbouw");
    }
}

static void show_info_modal(const char* text)
{
    ensure_modal();
    if (s_modal == nullptr || s_modal_text == nullptr) {
        return;
    }
    hide_inputs();
    s_modal_confirm = false;
    lv_label_set_text(s_modal_text, text);
    if (s_modal_extra != nullptr && obj_alive(s_modal_extra)) {
        lv_label_set_text(s_modal_extra, "");
    }
    if (obj_alive(s_btn_yes)) {
        lv_obj_add_flag(s_btn_yes, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_btn_no)) {
        lv_obj_add_flag(s_btn_no, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_btn_ok)) {
        lv_obj_remove_flag(s_btn_ok, LV_OBJ_FLAG_HIDDEN);
    }
    show_overlay_host();
    lv_obj_remove_flag(s_modal, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(s_overlay_host != nullptr ? s_overlay_host : s_modal);
    lv_obj_move_foreground(s_modal);
}

static void fill_confirm_extra(char* out, size_t out_len)
{
    out[0] = '\0';
    if (out_len == 0) {
        return;
    }
    size_t n = 0;
    for (int i = 0; i < s_pending_field_n; i++) {
        if (s_pending_vals_ui[i][0] == '\0') {
            continue;
        }
        const char* lab = s_pending_fields[i].label[0] ? s_pending_fields[i].label
                                                      : s_pending_fields[i].key;
        if (s_pending_fields[i].unit[0] != '\0') {
            n += static_cast<size_t>(snprintf(out + n, (n < out_len) ? out_len - n : 0,
                                              "%s%s: %s %s", (n > 0) ? "\n" : "", lab,
                                              s_pending_vals_ui[i], s_pending_fields[i].unit));
        } else {
            n += static_cast<size_t>(snprintf(out + n, (n < out_len) ? out_len - n : 0,
                                              "%s%s: %s", (n > 0) ? "\n" : "", lab,
                                              s_pending_vals_ui[i]));
        }
        if (n >= out_len) {
            out[out_len - 1] = '\0';
            return;
        }
    }
}

static void show_confirm_close()
{
    ensure_modal();
    if (s_modal == nullptr || s_modal_text == nullptr) {
        return;
    }
    hide_inputs();
    char msg[192];
    snprintf(msg, sizeof(msg), "'%s' afronden als %s?",
             s_pending_title[0] ? s_pending_title : "",
             s_pending_verb[0] ? s_pending_verb : "Gedaan");
    char extra[192];
    fill_confirm_extra(extra, sizeof(extra));
    s_modal_confirm = true;
    lv_label_set_text(s_modal_text, msg);
    if (s_modal_extra != nullptr && obj_alive(s_modal_extra)) {
        lv_label_set_text(s_modal_extra, extra);
    }
    if (obj_alive(s_btn_yes)) {
        lv_obj_remove_flag(s_btn_yes, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_btn_no)) {
        lv_obj_remove_flag(s_btn_no, LV_OBJ_FLAG_HIDDEN);
    }
    if (obj_alive(s_btn_ok)) {
        lv_obj_add_flag(s_btn_ok, LV_OBJ_FLAG_HIDDEN);
    }
    show_overlay_host();
    lv_obj_remove_flag(s_modal, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(s_modal);
}

static void on_numpad_ok(lv_event_t* e);
static void on_numpad_cancel(lv_event_t* e);

static void ensure_numpad()
{
    forget_dead_overlays();
    if (obj_alive(s_numpad.overlay)) {
        return;
    }
    s_numpad = UiNumpad{};
    lv_obj_t* parent = overlay_parent();
    if (parent == nullptr) {
        return;
    }
    ui_numpad_create(&s_numpad, parent, on_numpad_ok, on_numpad_cancel);
}

static void store_field_and_advance(const char* json_val, const char* ui_val)
{
    if (s_collect_i >= 0 && s_collect_i < s_pending_field_n) {
        strncpy(s_pending_vals[s_collect_i], json_val != nullptr ? json_val : "",
                sizeof(s_pending_vals[0]) - 1);
        s_pending_vals[s_collect_i][sizeof(s_pending_vals[0]) - 1] = '\0';
        strncpy(s_pending_vals_ui[s_collect_i], ui_val != nullptr ? ui_val : "",
                sizeof(s_pending_vals_ui[0]) - 1);
        s_pending_vals_ui[s_collect_i][sizeof(s_pending_vals_ui[0]) - 1] = '\0';
        const StatusTaskField& f = s_pending_fields[s_collect_i];
        if (f.kind == StatusTaskFieldKind::Text && json_val != nullptr && json_val[0] != '\0' &&
            (strcmp(f.key, "note") == 0 || strcmp(f.key, "notes") == 0)) {
            strncpy(s_pending_note, json_val, sizeof(s_pending_note) - 1);
            s_pending_note[sizeof(s_pending_note) - 1] = '\0';
        }
    }
    s_collect_i++;
    if (s_collect_i >= s_pending_field_n) {
        wizard_request(k_wiz_confirm);
    } else {
        wizard_request(s_collect_i);
    }
}

static void on_numpad_ok(lv_event_t*)
{
    if (s_collect_i < 0 || s_collect_i >= s_pending_field_n) {
        hide_modal();
        return;
    }
    const StatusTaskField& f = s_pending_fields[s_collect_i];
    if (ui_numpad_empty(&s_numpad)) {
        if (f.required) {
            ui_numpad_set_error(&s_numpad, "Vul een waarde in");
            return;
        }
        store_field_and_advance("", "");
        return;
    }
    char json[24];
    if (!ui_numpad_value_json(&s_numpad, json, sizeof(json))) {
        ui_numpad_set_error(&s_numpad, "Ongeldig getal");
        return;
    }
    if (f.must_be_positive) {
        char* end = nullptr;
        const double v = strtod(json, &end);
        if (end == json || v <= 0.0) {
            ui_numpad_set_error(&s_numpad, "Vul meer dan 0 liter in");
            return;
        }
    }
    store_field_and_advance(json, ui_numpad_value_ui(&s_numpad));
}

static void on_numpad_cancel(lv_event_t*)
{
    hide_modal();
}

static const char* selected_choice_value()
{
    if (s_choice_opts == nullptr || s_choice_n <= 0) {
        return "";
    }
    if (s_choice_sel < 0 || s_choice_sel >= s_choice_n) {
        return "";
    }
    const char* v = s_choice_opts[s_choice_sel].value;
    return (v != nullptr) ? v : "";
}

static const char* choice_ok_caption()
{
    if (s_collect_i < 0 || s_collect_i >= s_pending_field_n) {
        return "OK";
    }
    const StatusTaskField& f = s_pending_fields[s_collect_i];
    const bool last = (s_collect_i + 1 >= s_pending_field_n);
    const bool empty_sel = (selected_choice_value()[0] == '\0');
    if (f.kind == StatusTaskFieldKind::Text && empty_sel && !f.required) {
        return "Overslaan";
    }
    return last ? "OK" : "Volgende";
}

static void refresh_choice_ok_caption()
{
    if (obj_alive(s_choice_ok_lbl)) {
        lv_label_set_text(s_choice_ok_lbl, choice_ok_caption());
    }
}

static void store_selected_choice()
{
    if (s_choice_opts == nullptr || s_choice_n <= 0) {
        store_field_and_advance("", "");
        return;
    }
    if (s_choice_sel < 0 || s_choice_sel >= s_choice_n) {
        s_choice_sel = 0;
    }
    const CloseChoice& o = s_choice_opts[s_choice_sel];
    const char* val = (o.value != nullptr) ? o.value : "";
    if (s_collect_i >= 0 && s_collect_i < s_pending_field_n) {
        const StatusTaskField& f = s_pending_fields[s_collect_i];
        if (f.required && val[0] == '\0') {
            ESP_LOGW(TAG, "verplicht veld '%s' is leeg; kies een optie", f.key);
            return;
        }
    }
    const char* ui = (val[0] == '\0') ? "" : ((o.label != nullptr) ? o.label : val);
    store_field_and_advance(val, ui);
}

static void on_choice_ok(lv_event_t*)
{
    store_selected_choice();
}

static void on_choice_cancel(lv_event_t*)
{
    hide_modal();
}

static void refresh_cycle_label()
{
    if (!obj_alive(s_choice_cycle_lbl) || s_choice_opts == nullptr || s_choice_n <= 0) {
        return;
    }
    if (s_choice_sel < 0 || s_choice_sel >= s_choice_n) {
        s_choice_sel = 0;
    }
    lv_label_set_text(s_choice_cycle_lbl, s_choice_opts[s_choice_sel].label);
}

static void on_choice_cycle(lv_event_t*)
{
    if (s_choice_n <= 0) {
        return;
    }
    s_choice_sel = (s_choice_sel + 1) % s_choice_n;
    refresh_cycle_label();
    refresh_choice_ok_caption();
}

static bool choice_ready()
{
    return obj_alive(s_choice_overlay) && obj_alive(s_choice_box)
           && obj_alive(s_choice_title) && obj_alive(s_choice_cycle)
           && obj_alive(s_choice_cycle_lbl) && obj_alive(s_choice_hint)
           && obj_alive(s_choice_btn_ok) && obj_alive(s_choice_ok_lbl)
           && obj_alive(s_choice_btn_no) && obj_alive(s_choice_no_lbl)
           && s_choice_step == ChoiceBuildStep::Done;
}

static void apply_choice_surface()
{
    if (!choice_ready() || !s_choice_want_show) {
        return;
    }
    if (s_collect_i < 0 || s_collect_i >= s_pending_field_n) {
        return;
    }
    const StatusTaskField& f = s_pending_fields[s_collect_i];
    if (f.kind != StatusTaskFieldKind::Choice && f.kind != StatusTaskFieldKind::Text) {
        return;
    }
    const char* lab = f.label[0] ? f.label : f.key;
    if (obj_alive(s_choice_title)) {
        lv_label_set_text(s_choice_title, lab);
    }
    if (obj_alive(s_choice_hint)) {
        if (f.kind == StatusTaskFieldKind::Text) {
            lv_label_set_text(s_choice_hint, "Leeg is OK. Tik om te wisselen.");
        } else {
            lv_label_set_text(s_choice_hint, "Tik om te wisselen, daarna Volgende");
        }
    }
    refresh_choice_ok_caption();
    refresh_cycle_label();
    show_overlay_host();
    if (obj_alive(s_choice_overlay)) {
        lv_obj_remove_flag(s_choice_overlay, LV_OBJ_FLAG_HIDDEN);
        lv_obj_move_foreground(s_choice_overlay);
    }
}

static void choice_timer_pause()
{
    if (s_choice_timer != nullptr) {
        lv_timer_pause(s_choice_timer);
    }
}

static void choice_build_cancel()
{
    s_choice_want_show = false;
    choice_timer_pause();
}

static void log_choice_object(const char* name)
{
    s_choice_obj_i++;
    const size_t intern = heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
    const size_t largest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
    ESP_LOGI(TAG, "keuze-overlay: object %d/%d %s intern=%u KB grootste=%u KB",
             s_choice_obj_i, k_choice_obj_total, (name != nullptr) ? name : "?",
             static_cast<unsigned>(intern / 1024),
             static_cast<unsigned>(largest / 1024));
}

static void style_choice_btn(lv_obj_t* btn)
{
    lv_obj_set_style_bg_color(btn, COL_BTN, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(btn, COL_BORDER, 0);
    lv_obj_set_style_border_width(btn, 2, 0);
    lv_obj_set_style_radius(btn, 10, 0);
    lv_obj_set_style_pad_all(btn, 0, 0);
    lv_obj_remove_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
}

static void style_choice_lbl(lv_obj_t* lbl)
{
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(lbl);
}

static void choice_forget_widgets()
{
    s_choice_overlay = nullptr;
    s_choice_box = nullptr;
    s_choice_title = nullptr;
    s_choice_cycle = nullptr;
    s_choice_cycle_lbl = nullptr;
    s_choice_hint = nullptr;
    s_choice_ok_lbl = nullptr;
    s_choice_btn_ok = nullptr;
    s_choice_btn_no = nullptr;
    s_choice_no_lbl = nullptr;
    s_choice_obj_i = 0;
    s_choice_step = ChoiceBuildStep::Idle;
}

static bool create_choice_one_object()
{
    forget_dead_overlays();
    if (s_choice_step == ChoiceBuildStep::Overlay && obj_alive(s_choice_overlay)) {
        s_choice_step = ChoiceBuildStep::Box;
    }
    if (s_choice_step == ChoiceBuildStep::Box && obj_alive(s_choice_box)) {
        s_choice_step = ChoiceBuildStep::Title;
    }
    if (s_choice_step == ChoiceBuildStep::Title && obj_alive(s_choice_title)) {
        s_choice_step = ChoiceBuildStep::CycleBtn;
    }
    if (s_choice_step == ChoiceBuildStep::CycleBtn && obj_alive(s_choice_cycle)) {
        s_choice_step = ChoiceBuildStep::CycleLbl;
    }
    if (s_choice_step == ChoiceBuildStep::CycleLbl && obj_alive(s_choice_cycle_lbl)) {
        s_choice_step = ChoiceBuildStep::Hint;
    }
    if (s_choice_step == ChoiceBuildStep::Hint && obj_alive(s_choice_hint)) {
        s_choice_step = ChoiceBuildStep::OkBtn;
    }
    if (s_choice_step == ChoiceBuildStep::OkBtn && obj_alive(s_choice_btn_ok)) {
        s_choice_step = ChoiceBuildStep::OkLbl;
    }
    if (s_choice_step == ChoiceBuildStep::OkLbl && obj_alive(s_choice_ok_lbl)) {
        s_choice_step = ChoiceBuildStep::NoBtn;
    }
    if (s_choice_step == ChoiceBuildStep::NoBtn && obj_alive(s_choice_btn_no)) {
        s_choice_step = ChoiceBuildStep::NoLbl;
    }
    if (s_choice_step == ChoiceBuildStep::NoLbl && obj_alive(s_choice_no_lbl)) {
        s_choice_step = ChoiceBuildStep::Done;
        return true;
    }
    switch (s_choice_step) {
        case ChoiceBuildStep::Overlay: {
            lv_obj_t* parent = overlay_parent();
            if (!parent_ok(parent, "keuze-overlay")) {
                return false;
            }
            s_choice_overlay = lv_obj_create(parent);
            if (s_choice_overlay == nullptr) {
                ESP_LOGE(TAG, "keuze-overlay create faalde");
                return false;
            }
            lv_obj_set_size(s_choice_overlay, 1024, 600);
            lv_obj_set_pos(s_choice_overlay, 0, 0);
            lv_obj_set_style_bg_color(s_choice_overlay, COL_MODAL, 0);
            lv_obj_set_style_bg_opa(s_choice_overlay, LV_OPA_70, 0);
            lv_obj_set_style_border_width(s_choice_overlay, 0, 0);
            lv_obj_set_style_radius(s_choice_overlay, 0, 0);
            lv_obj_set_style_pad_all(s_choice_overlay, 0, 0);
            lv_obj_remove_flag(s_choice_overlay, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_add_flag(s_choice_overlay, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_add_flag(s_choice_overlay, LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(s_choice_overlay, LV_OBJ_FLAG_IGNORE_LAYOUT);
            log_choice_object("overlay");
            s_choice_step = ChoiceBuildStep::Box;
            return true;
        }
        case ChoiceBuildStep::Box: {
            if (!parent_ok(s_choice_overlay, "keuze-box")) {
                return false;
            }
            s_choice_box = lv_obj_create(s_choice_overlay);
            if (s_choice_box == nullptr) {
                ESP_LOGE(TAG, "keuze-box create faalde");
                return false;
            }
            lv_obj_set_size(s_choice_box, 720, 360);
            lv_obj_set_pos(s_choice_box, 152, 120);
            lv_obj_set_style_bg_color(s_choice_box, COL_CARD, 0);
            lv_obj_set_style_border_color(s_choice_box, COL_BORDER, 0);
            lv_obj_set_style_border_width(s_choice_box, 2, 0);
            lv_obj_set_style_radius(s_choice_box, 12, 0);
            lv_obj_set_style_pad_all(s_choice_box, 16, 0);
            lv_obj_remove_flag(s_choice_box, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_remove_flag(s_choice_box, LV_OBJ_FLAG_CLICKABLE);
            log_choice_object("box");
            s_choice_step = ChoiceBuildStep::Title;
            return true;
        }
        case ChoiceBuildStep::Title: {
            if (!parent_ok(s_choice_box, "keuze-titel")) {
                return false;
            }
            s_choice_title = lv_label_create(s_choice_box);
            if (s_choice_title == nullptr) {
                ESP_LOGE(TAG, "keuze-titel create faalde");
                return false;
            }
            lv_obj_set_width(s_choice_title, 680);
            lv_label_set_long_mode(s_choice_title, LV_LABEL_LONG_DOT);
            lv_obj_set_style_text_font(s_choice_title, &lv_font_montserrat_20, 0);
            lv_obj_set_style_text_color(s_choice_title, COL_TEXT, 0);
            lv_obj_remove_flag(s_choice_title, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_align(s_choice_title, LV_ALIGN_TOP_MID, 0, 0);
            log_choice_object("titel");
            s_choice_step = ChoiceBuildStep::CycleBtn;
            return true;
        }
        case ChoiceBuildStep::CycleBtn: {
            if (!parent_ok(s_choice_box, "keuze-cyclus")) {
                return false;
            }
            s_choice_cycle = lv_button_create(s_choice_box);
            if (s_choice_cycle == nullptr) {
                ESP_LOGE(TAG, "keuze-cyclus create faalde");
                return false;
            }
            lv_obj_set_size(s_choice_cycle, 640, 88);
            lv_obj_align(s_choice_cycle, LV_ALIGN_TOP_MID, 0, 48);
            style_choice_btn(s_choice_cycle);
            lv_obj_set_style_border_color(s_choice_cycle, COL_ORANGE, 0);
            lv_obj_set_style_border_width(s_choice_cycle, 3, 0);
            lv_obj_add_event_cb(s_choice_cycle, on_choice_cycle, LV_EVENT_CLICKED, nullptr);
            log_choice_object("cyclus-knop");
            s_choice_step = ChoiceBuildStep::CycleLbl;
            return true;
        }
        case ChoiceBuildStep::CycleLbl: {
            if (!parent_ok(s_choice_cycle, "keuze-cyclus-label")) {
                return false;
            }
            s_choice_cycle_lbl = lv_label_create(s_choice_cycle);
            if (s_choice_cycle_lbl == nullptr) {
                ESP_LOGE(TAG, "keuze-cyclus-label create faalde");
                return false;
            }
            style_choice_lbl(s_choice_cycle_lbl);
            lv_label_set_text(s_choice_cycle_lbl, "");
            log_choice_object("cyclus-label");
            s_choice_step = ChoiceBuildStep::Hint;
            return true;
        }
        case ChoiceBuildStep::Hint: {
            if (!parent_ok(s_choice_box, "keuze-hint")) {
                return false;
            }
            s_choice_hint = lv_label_create(s_choice_box);
            if (s_choice_hint == nullptr) {
                ESP_LOGE(TAG, "keuze-hint create faalde");
                return false;
            }
            lv_obj_set_width(s_choice_hint, 680);
            lv_label_set_long_mode(s_choice_hint, LV_LABEL_LONG_DOT);
            lv_obj_set_style_text_font(s_choice_hint, &lv_font_montserrat_14, 0);
            lv_obj_set_style_text_color(s_choice_hint, COL_MUTED, 0);
            lv_obj_remove_flag(s_choice_hint, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_align(s_choice_hint, LV_ALIGN_TOP_MID, 0, 148);
            lv_label_set_text(s_choice_hint, "Tik om te wisselen, daarna Volgende");
            log_choice_object("hint");
            s_choice_step = ChoiceBuildStep::OkBtn;
            return true;
        }
        case ChoiceBuildStep::OkBtn: {
            if (!parent_ok(s_choice_box, "keuze-ok")) {
                return false;
            }
            s_choice_btn_ok = lv_button_create(s_choice_box);
            if (s_choice_btn_ok == nullptr) {
                ESP_LOGE(TAG, "keuze-ok create faalde");
                return false;
            }
            lv_obj_set_size(s_choice_btn_ok, 280, 80);
            lv_obj_align(s_choice_btn_ok, LV_ALIGN_BOTTOM_LEFT, 20, -8);
            style_choice_btn(s_choice_btn_ok);
            lv_obj_add_event_cb(s_choice_btn_ok, on_choice_ok, LV_EVENT_CLICKED, nullptr);
            log_choice_object("ok-knop");
            s_choice_step = ChoiceBuildStep::OkLbl;
            return true;
        }
        case ChoiceBuildStep::OkLbl: {
            if (!parent_ok(s_choice_btn_ok, "keuze-ok-label")) {
                return false;
            }
            s_choice_ok_lbl = lv_label_create(s_choice_btn_ok);
            if (s_choice_ok_lbl == nullptr) {
                ESP_LOGE(TAG, "keuze-ok-label create faalde");
                return false;
            }
            style_choice_lbl(s_choice_ok_lbl);
            lv_label_set_text(s_choice_ok_lbl, "Volgende");
            log_choice_object("ok-label");
            s_choice_step = ChoiceBuildStep::NoBtn;
            return true;
        }
        case ChoiceBuildStep::NoBtn: {
            if (!parent_ok(s_choice_box, "keuze-annuleren")) {
                return false;
            }
            s_choice_btn_no = lv_button_create(s_choice_box);
            if (s_choice_btn_no == nullptr) {
                ESP_LOGE(TAG, "keuze-annuleren create faalde");
                return false;
            }
            lv_obj_set_size(s_choice_btn_no, 280, 80);
            lv_obj_align(s_choice_btn_no, LV_ALIGN_BOTTOM_RIGHT, -20, -8);
            style_choice_btn(s_choice_btn_no);
            lv_obj_add_event_cb(s_choice_btn_no, on_choice_cancel, LV_EVENT_CLICKED, nullptr);
            log_choice_object("annuleren-knop");
            s_choice_step = ChoiceBuildStep::NoLbl;
            return true;
        }
        case ChoiceBuildStep::NoLbl: {
            if (!parent_ok(s_choice_btn_no, "keuze-annuleren-label")) {
                return false;
            }
            s_choice_no_lbl = lv_label_create(s_choice_btn_no);
            if (s_choice_no_lbl == nullptr) {
                ESP_LOGE(TAG, "keuze-annuleren-label create faalde");
                return false;
            }
            style_choice_lbl(s_choice_no_lbl);
            lv_label_set_text(s_choice_no_lbl, "Annuleren");
            log_choice_object("annuleren-label");
            s_choice_step = ChoiceBuildStep::Done;
            return true;
        }
        default:
        case ChoiceBuildStep::Idle:
        case ChoiceBuildStep::Done:
            return true;
    }
}

static void choice_build_fail()
{
    ESP_LOGE(TAG, "keuze-overlay opbouw faalde; wizard afgebroken");
    choice_timer_pause();
    if (obj_alive(s_choice_overlay)) {
        lv_obj_delete(s_choice_overlay);
    }
    choice_forget_widgets();
    hide_modal();
}

static void choice_build_timer_cb(lv_timer_t*)
{
    if (!obj_alive(s_scr) || !s_choice_want_show) {
        choice_timer_pause();
        return;
    }
    if (s_choice_step == ChoiceBuildStep::Done || choice_ready()) {
        choice_timer_pause();
        ESP_LOGI(TAG, "keuze-overlay: opbouw klaar");
        apply_choice_surface();
        return;
    }
    if (!create_choice_one_object()) {
        choice_build_fail();
        return;
    }
    if (s_choice_step == ChoiceBuildStep::Done) {
        choice_timer_pause();
        ESP_LOGI(TAG, "keuze-overlay: opbouw klaar");
        apply_choice_surface();
    }
}

static void choice_build_request()
{
    if (choice_ready()) {
        apply_choice_surface();
        return;
    }
    if (s_choice_timer == nullptr) {
        s_choice_timer = lv_timer_create(choice_build_timer_cb, k_choice_timer_ms, nullptr);
        if (s_choice_timer == nullptr) {
            ESP_LOGE(TAG, "keuze-overlay timer faalde");
            hide_modal();
            return;
        }
        lv_timer_pause(s_choice_timer);
    }
    if (!obj_alive(s_choice_overlay)) {
        s_choice_step = ChoiceBuildStep::Overlay;
        s_choice_obj_i = 0;
        ESP_LOGI(TAG, "keuze-overlay: opbouw starten (1 object / %u ms, geen flex-grid)",
                 static_cast<unsigned>(k_choice_timer_ms));
    } else if (s_choice_step == ChoiceBuildStep::Idle) {
        s_choice_step = ChoiceBuildStep::Overlay;
    }
    lv_timer_set_period(s_choice_timer, k_choice_timer_ms);
    lv_timer_reset(s_choice_timer);
    lv_timer_resume(s_choice_timer);
}

static void show_choice_input()
{
    if (s_collect_i < 0 || s_collect_i >= s_pending_field_n) {
        show_confirm_close();
        return;
    }
    const StatusTaskField& f = s_pending_fields[s_collect_i];
    s_choice_opts = nullptr;
    s_choice_n = 0;
    s_choice_sel = 0;
    if (f.kind == StatusTaskFieldKind::Text) {
        s_choice_opts = k_note_opts;
        s_choice_n = static_cast<int>(sizeof(k_note_opts) / sizeof(k_note_opts[0]));
        s_choice_sel = 0;
        ESP_LOGI(TAG, "tekst-stap key='%s': cyclus-presets, geen keyboard", f.key);
    } else if (f.choice_set == StatusTaskChoiceSet::WaterType) {
        s_choice_opts = k_water_type_opts;
        s_choice_n = static_cast<int>(sizeof(k_water_type_opts) / sizeof(k_water_type_opts[0]));
        s_choice_sel = 0;
    } else if (f.choice_set == StatusTaskChoiceSet::Reason) {
        s_choice_opts = k_reason_opts;
        s_choice_n = static_cast<int>(sizeof(k_reason_opts) / sizeof(k_reason_opts[0]));
        s_choice_sel = 1;
    }
    if (s_choice_opts == nullptr || s_choice_n <= 0) {
        ESP_LOGW(TAG, "keuzeveld '%s' zonder lijst; overslaan", f.key);
        store_field_and_advance("", "");
        return;
    }

    ui_numpad_hide(&s_numpad);
    if (obj_alive(s_modal)) {
        lv_obj_add_flag(s_modal, LV_OBJ_FLAG_HIDDEN);
    }
    s_modal_confirm = false;
    s_choice_want_show = true;
    if (choice_ready()) {
        ESP_LOGI(TAG, "keuze-overlay: bestaande overlay hergebruikt (geen extra create)");
        apply_choice_surface();
        return;
    }
    if (obj_alive(s_choice_overlay)) {
        lv_obj_add_flag(s_choice_overlay, LV_OBJ_FLAG_HIDDEN);
    }
    choice_build_request();
}

static void show_field_input(int i)
{
    if (i < 0 || i >= s_pending_field_n) {
        show_confirm_close();
        return;
    }
    const StatusTaskField& f = s_pending_fields[i];
    const char* lab = f.label[0] ? f.label : f.key;
    char title[80];
    if (f.unit[0] != '\0') {
        snprintf(title, sizeof(title), "%s (%s)", lab, f.unit);
    } else {
        snprintf(title, sizeof(title), "%s", lab);
    }
    const char* ok = (i + 1 < s_pending_field_n) ? "Volgende" : "OK";
    ESP_LOGI(TAG, "wizard stap %d/%d key='%s'", i + 1, s_pending_field_n, f.key);
    if (obj_alive(s_modal)) {
        lv_obj_add_flag(s_modal, LV_OBJ_FLAG_HIDDEN);
    }
    s_modal_confirm = false;
    if (f.kind == StatusTaskFieldKind::Text || f.kind == StatusTaskFieldKind::Choice) {
        show_choice_input();
    } else {
        choice_build_cancel();
        ensure_numpad();
        if (obj_alive(s_choice_overlay)) {
            lv_obj_add_flag(s_choice_overlay, LV_OBJ_FLAG_HIDDEN);
        }
        if (!obj_alive(s_numpad.overlay)) {
            ESP_LOGE(TAG, "numpad ontbreekt; wizard afgebroken");
            hide_modal();
            return;
        }
        const char* hint = f.must_be_positive ? "Verplicht, meer dan 0"
                           : (f.required ? "Verplicht" : "Optioneel, leeg = overslaan");
        show_overlay_host();
        ui_numpad_show(&s_numpad, title, hint, ok);
    }
}

static void wizard_async(void*)
{
    s_wizard_async_pending = false;
    if (!obj_alive(s_scr)) {
        s_wizard_show = k_wiz_none;
        return;
    }
    const int step = s_wizard_show;
    if (step == k_wiz_none) {
        return;
    }
    if (step == k_wiz_confirm) {
        show_confirm_close();
        return;
    }
    show_field_input(step);
}

static void start_close(const TaskRow* row, const char* status, const char* verb)
{
    if (row == nullptr) {
        return;
    }
    if (!net_manager_is_connected()) {
        show_info_modal("Deze taak kan niet worden afgerond, omdat er geen verbinding is. "
                        "Probeer het opnieuw zodra de verbinding hersteld is.");
        return;
    }
    if (status_store_is_close_busy()) {
        return;
    }
    wizard_cancel();
    strncpy(s_pending_id, row->id, sizeof(s_pending_id) - 1);
    s_pending_id[sizeof(s_pending_id) - 1] = '\0';
    strncpy(s_pending_status, status, sizeof(s_pending_status) - 1);
    s_pending_status[sizeof(s_pending_status) - 1] = '\0';
    strncpy(s_pending_verb, verb != nullptr ? verb : "", sizeof(s_pending_verb) - 1);
    s_pending_verb[sizeof(s_pending_verb) - 1] = '\0';
    strncpy(s_pending_title, row->title, sizeof(s_pending_title) - 1);
    s_pending_title[sizeof(s_pending_title) - 1] = '\0';
    s_pending_note[0] = '\0';
    s_pending_field_n = row->field_n;
    if (s_pending_field_n > k_status_task_fields_max) {
        s_pending_field_n = k_status_task_fields_max;
    }
    for (int i = 0; i < s_pending_field_n; i++) {
        s_pending_fields[i] = row->fields[i];
        s_pending_vals[i][0] = '\0';
        s_pending_vals_ui[i][0] = '\0';
    }
    s_collect_i = 0;
    ESP_LOGI(TAG, "afronden '%s' status='%s' invoervelden=%d eerste='%s'",
             s_pending_title, s_pending_status, s_pending_field_n,
             (s_pending_field_n > 0) ? s_pending_fields[0].key : "-");
    freeze_task_list(true);
    if (s_pending_field_n > 0) {
        wizard_request(0);
    } else {
        wizard_request(k_wiz_confirm);
    }
}

static const TaskRow* row_from_event(lv_event_t* e)
{
    if (s_rows == nullptr) {
        return nullptr;
    }
    const int i = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    if (i < 0 || i >= s_row_n) {
        return nullptr;
    }
    return &s_rows[i];
}

static void on_done(lv_event_t* e)
{
    const TaskRow* row = row_from_event(e);
    if (row == nullptr || !row->has_id || !row->action_done) {
        return;
    }
    start_close(row, "done", "Gedaan");
}

static void on_seen(lv_event_t* e)
{
    const TaskRow* row = row_from_event(e);
    if (row == nullptr || !row->has_id || !row->action_seen) {
        return;
    }
    start_close(row, "seen", "Gezien");
}

static void on_dismissed(lv_event_t* e)
{
    const TaskRow* row = row_from_event(e);
    if (row == nullptr || !row->has_id || !row->action_dismissed) {
        return;
    }
    start_close(row, "dismissed", "Niet van toepassing");
}

static void on_yes(lv_event_t*)
{
    if (!s_modal_confirm || s_pending_id[0] == '\0') {
        hide_modal();
        return;
    }
    if (!net_manager_is_connected()) {
        show_info_modal("Deze taak kan niet worden afgerond, omdat er geen verbinding is. "
                        "Probeer het opnieuw zodra de verbinding hersteld is.");
        return;
    }
    char id[40];
    char status[16];
    char note[160];
    strncpy(id, s_pending_id, sizeof(id) - 1);
    id[sizeof(id) - 1] = '\0';
    strncpy(status, s_pending_status, sizeof(status) - 1);
    status[sizeof(status) - 1] = '\0';
    strncpy(note, s_pending_note, sizeof(note) - 1);
    note[sizeof(note) - 1] = '\0';

    BackendCloseField extra[k_backend_close_fields_max] = {};
    int n = 0;
    const char* liters_ui = nullptr;
    const char* type_ui = nullptr;
    const char* reason_ui = nullptr;
    for (int i = 0; i < s_pending_field_n && n < k_backend_close_fields_max; i++) {
        if (s_pending_vals[i][0] == '\0') {
            continue;
        }
        const char* key = s_pending_fields[i].key;
        if (strcmp(key, "liters_added") == 0) {
            liters_ui = s_pending_vals_ui[i];
        } else if (strcmp(key, "water_type") == 0) {
            type_ui = s_pending_vals_ui[i];
        } else if (strcmp(key, "reason") == 0) {
            reason_ui = s_pending_vals_ui[i];
        }
        if (strcmp(key, "note") == 0 || strcmp(key, "notes") == 0) {
            if (note[0] == '\0') {
                strncpy(note, s_pending_vals[i], sizeof(note) - 1);
                note[sizeof(note) - 1] = '\0';
            }
            continue;
        }
        strncpy(extra[n].key, key, sizeof(extra[n].key) - 1);
        extra[n].key[sizeof(extra[n].key) - 1] = '\0';
        strncpy(extra[n].value, s_pending_vals[i], sizeof(extra[n].value) - 1);
        extra[n].value[sizeof(extra[n].value) - 1] = '\0';
        extra[n].is_number = (s_pending_fields[i].kind == StatusTaskFieldKind::Number);
        n++;
    }

    // Pal-app: liters/type/reden → water_changes via task-close (geen REST; RLS).
    // note = "via paneel". Watermeting blijft in note/parameters.
    if (liters_ui != nullptr && liters_ui[0] != '\0') {
        ESP_LOGI(TAG, "waterwissel: liters=%s type=%s reden=%s; note niet vol liters",
                 liters_ui,
                 (type_ui != nullptr && type_ui[0]) ? type_ui : "-",
                 (reason_ui != nullptr && reason_ui[0]) ? reason_ui : "-");
    } else {
        char measure[128];
        measure[0] = '\0';
        size_t mn = 0;
        for (int i = 0; i < s_pending_field_n; i++) {
            if (s_pending_vals_ui[i][0] == '\0') {
                continue;
            }
            const char* key = s_pending_fields[i].key;
            const bool wp = (strcmp(key, "ph") == 0 || strcmp(key, "kh") == 0 ||
                             strcmp(key, "gh") == 0 || strcmp(key, "nitrite") == 0 ||
                             strcmp(key, "nitriet") == 0 || strcmp(key, "nitrate") == 0 ||
                             strcmp(key, "nitraat") == 0 || strcmp(key, "phosphate") == 0 ||
                             strcmp(key, "ammonia") == 0);
            if (!wp) {
                continue;
            }
            const char* lab = s_pending_fields[i].label[0] ? s_pending_fields[i].label : key;
            mn += static_cast<size_t>(snprintf(measure + mn, (mn < sizeof(measure)) ? sizeof(measure) - mn : 0,
                                               "%s%s %s", (mn > 0) ? ", " : "", lab, s_pending_vals_ui[i]));
            if (mn >= sizeof(measure)) {
                measure[sizeof(measure) - 1] = '\0';
                break;
            }
        }
        if (measure[0] != '\0') {
            char summary[160];
            snprintf(summary, sizeof(summary), "Watermeting: %s", measure);
            if (note[0] != '\0') {
                char extra_n[80];
                strncpy(extra_n, note, sizeof(extra_n) - 1);
                extra_n[sizeof(extra_n) - 1] = '\0';
                strncpy(note, summary, sizeof(note) - 1);
                note[sizeof(note) - 1] = '\0';
                const size_t used = strlen(note);
                if (used + 3 < sizeof(note)) {
                    note[used] = '.';
                    note[used + 1] = ' ';
                    strncpy(note + used + 2, extra_n, sizeof(note) - used - 3);
                    note[sizeof(note) - 1] = '\0';
                }
            } else {
                strncpy(note, summary, sizeof(note) - 1);
                note[sizeof(note) - 1] = '\0';
            }
        }
    }

    status_store_begin_close(id);
    backend_client_request_close(id, status, note[0] ? note : nullptr, extra, n,
                                 s_pending_title);
    hide_modal();
}

static void on_no(lv_event_t*)
{
    hide_modal();
}

static void on_ok(lv_event_t*)
{
    hide_modal();
    status_store_popup_ack(s_popup_seen);
}

static void on_refresh(lv_event_t*)
{
    ESP_LOGI(TAG, "Vernieuwen getikt");
    backend_client_request_fetch();
}

static void on_toggle_desc(lv_event_t* e)
{
    if (s_rows == nullptr) {
        return;
    }
    const int i = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    if (i < 0 || i >= s_row_n) {
        return;
    }
    if (!s_rows[i].has_desc || s_rows[i].desc == nullptr) {
        return;
    }
    s_rows[i].expanded = !s_rows[i].expanded;
    if (s_rows[i].expanded) {
        lv_obj_remove_flag(s_rows[i].desc, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_add_flag(s_rows[i].desc, LV_OBJ_FLAG_HIDDEN);
    }
}

static lv_color_t task_accent(const StatusTask& t)
{
    if (t.overdue || t.severity[0] != '\0') {
        return COL_ORANGE;
    }
    return COL_MUTED;
}

static void format_due(const char* due, bool time_ok, char* out, size_t out_len)
{
    out[0] = '\0';
    if (due == nullptr || due[0] == '\0') {
        return;
    }
    int y = 0, mo = 0, d = 0;
    if (sscanf(due, "%d-%d-%d", &y, &mo, &d) < 3 || mo < 1 || mo > 12) {
        return;
    }
    if (!time_ok) {
        snprintf(out, out_len, "%d %s", d, MONTHS_NL[mo - 1]);
        return;
    }
    time_t now = time(nullptr);
    struct tm tm_now = {};
    localtime_r(&now, &tm_now);
    tm_now.tm_hour = 12;
    tm_now.tm_min = 0;
    tm_now.tm_sec = 0;
    tm_now.tm_isdst = -1;
    struct tm tm_due = {};
    tm_due.tm_year = y - 1900;
    tm_due.tm_mon = mo - 1;
    tm_due.tm_mday = d;
    tm_due.tm_hour = 12;
    tm_due.tm_min = 0;
    tm_due.tm_sec = 0;
    tm_due.tm_isdst = -1;
    const time_t t_now = mktime(&tm_now);
    const time_t t_due = mktime(&tm_due);
    if (t_now == static_cast<time_t>(-1) || t_due == static_cast<time_t>(-1)) {
        snprintf(out, out_len, "%d %s", d, MONTHS_NL[mo - 1]);
        return;
    }
    const int days = static_cast<int>((t_due - t_now) / 86400);
    if (days == 0) {
        snprintf(out, out_len, "vandaag");
    } else if (days == 1) {
        snprintf(out, out_len, "morgen");
    } else if (days == -1) {
        snprintf(out, out_len, "1 dag te laat");
    } else if (days < 0) {
        snprintf(out, out_len, "%d dagen te laat", -days);
    } else {
        snprintf(out, out_len, "%d %s", d, MONTHS_NL[mo - 1]);
    }
}

static void add_section_label(const char* text);
static void append_task_row(const StatusTask& t, bool time_ok);
static void pump_reveal();

static void reset_row_state()
{
    s_row_n = 0;
    if (s_rows == nullptr) {
        return;
    }
    for (int i = 0; i < k_status_tasks_max; i++) {
        s_rows[i] = TaskRow{};
    }
}

static uint32_t fnv1a(const char* s)
{
    uint32_t h = 2166136261u;
    if (s == nullptr) {
        return h;
    }
    for (const unsigned char* p = reinterpret_cast<const unsigned char*>(s); *p != '\0'; ++p) {
        h ^= *p;
        h *= 16777619u;
    }
    return h;
}

static void collect_build_order(const StatusSnapshot& app)
{
    s_build_n = 0;
    s_have_now = false;
    s_have_later = false;
    for (int i = 0; i < app.task_count; i++) {
        if (app.tasks[i].due_now) {
            s_have_now = true;
        } else {
            s_have_later = true;
        }
    }
    for (int i = 0; i < app.task_count && s_build_n < k_status_tasks_max; i++) {
        if (app.tasks[i].due_now) {
            s_build_order[s_build_n++] = i;
        }
    }
    for (int i = 0; i < app.task_count && s_build_n < k_status_tasks_max; i++) {
        if (!app.tasks[i].due_now) {
            s_build_order[s_build_n++] = i;
        }
    }
}

static void start_rebuild(const StatusSnapshot& app, bool time_ok)
{
    if (!s_tab_visible) {
        return;
    }
    if (wizard_open() || s_list_frozen) {
        s_rebuild_pending = true;
        return;
    }
    if (s_build_phase != TasksBuildPhase::Idle) {
        ESP_LOGI(TAG, "takenlijst: lopende opbouw geannuleerd; opnieuw starten");
        s_build_phase = TasksBuildPhase::Idle;
    }
    s_rebuild_pending = false;
    collect_build_order(app);
    s_build_time_ok = time_ok;
    s_build_idx = 0;
    s_reveal_idx = 0;
    s_now_hdr_done = false;
    s_later_hdr_done = false;
    s_due_refresh_i = -1;
    reset_row_state();
    hide_task_list();
    hide_inputs();
    hide_overlay_host();
    const uint32_t child_n = (s_list != nullptr) ? lv_obj_get_child_count(s_list) : 0;
    if (child_n > 0) {
        s_build_phase = TasksBuildPhase::Clearing;
    } else {
        s_build_phase = TasksBuildPhase::Building;
    }
    ESP_LOGI(TAG, "takenlijst: opbouw starten (%d taken, max %d kaart/tick, kaarten HIDDEN tot reveal)",
             s_build_n, k_max_cards_per_tick);
}

static void pump_clear()
{
    if (s_list == nullptr) {
        s_build_phase = s_tab_visible ? TasksBuildPhase::Building : TasksBuildPhase::Idle;
        return;
    }
    hide_task_list();
    int deleted = 0;
    while (lv_obj_get_child_count(s_list) > 0 && deleted < k_max_delete_per_tick) {
        const uint32_t n = lv_obj_get_child_count(s_list);
        lv_obj_t* child = lv_obj_get_child(s_list, n - 1);
        if (child == nullptr) {
            break;
        }
        lv_obj_delete(child);
        deleted++;
    }
    if (lv_obj_get_child_count(s_list) == 0) {
        s_build_phase = s_tab_visible ? TasksBuildPhase::Building : TasksBuildPhase::Idle;
    }
}

static void pump_build(const StatusSnapshot& app)
{
    hide_task_list();
    int work = 0;
    if (s_have_now && !s_now_hdr_done) {
        add_section_label("Vandaag / te laat");
        s_now_hdr_done = true;
        work++;
    }
    while (s_build_idx < s_build_n && work < k_max_cards_per_tick) {
        const int src = s_build_order[s_build_idx];
        if (src < 0 || src >= app.task_count) {
            s_build_idx++;
            continue;
        }
        const StatusTask& t = app.tasks[src];
        if (!t.due_now && s_have_later && !s_later_hdr_done) {
            add_section_label("Later");
            s_later_hdr_done = true;
            work++;
            if (work >= k_max_cards_per_tick) {
                break;
            }
        }
        append_task_row(t, s_build_time_ok);
        s_build_idx++;
        work++;
    }
    if (s_build_idx >= s_build_n) {
        s_drawn_time_ok = s_build_time_ok;
        s_reveal_idx = 0;
        s_build_phase = TasksBuildPhase::OverlayOff;
        hide_task_list();
        ESP_LOGI(TAG, "takenlijst: opbouw klaar (%d kaarten, nog HIDDEN; overlay eerst weg)",
                 s_row_n);
        log_tasks_heap("opbouw klaar");
    }
}

// Eigen tick: overlay/host HIDDEN, lijst blijft HIDDEN. Geen kaart-unhide
// (m15m: na opbouw klaar tekende LVGL 14 kaarten → lv_draw_sw_fill memset dst=0).
static void pump_overlay_off()
{
    hide_inputs();
    hide_overlay_host();
    hide_task_list();
    if (!draw_buf_ok("overlay-off")) {
        return;
    }
    s_build_phase = TasksBuildPhase::Revealing;
    ESP_LOGI(TAG, "takenlijst: overlay weg; reveal 1/tick (geen unhide-all)");
}

static void pump_reveal()
{
    if (!obj_alive(s_list) || s_list_frozen) {
        s_build_phase = TasksBuildPhase::Idle;
        return;
    }
    if (!draw_buf_ok("reveal")) {
        return;
    }
    if (lv_obj_has_flag(s_list, LV_OBJ_FLAG_HIDDEN)) {
        lv_obj_remove_flag(s_list, LV_OBJ_FLAG_HIDDEN);
        return;
    }
    const uint32_t n = lv_obj_get_child_count(s_list);
    int shown = 0;
    while (s_reveal_idx < static_cast<int>(n) && shown < k_max_reveal_per_tick) {
        lv_obj_t* child = lv_obj_get_child(s_list, static_cast<int32_t>(s_reveal_idx));
        if (obj_alive(child)) {
            if (!draw_buf_ok("reveal-kaart")) {
                return;
            }
            lv_obj_remove_flag(child, LV_OBJ_FLAG_HIDDEN);
        }
        s_reveal_idx++;
        shown++;
    }
    if (s_reveal_idx >= static_cast<int>(n)) {
        s_build_phase = TasksBuildPhase::Idle;
        ESP_LOGI(TAG, "takenlijst: kaarten zichtbaar (%d, 1/tick, geen unhide-all)", s_row_n);
    }
}

static void pump_rebuild(const StatusSnapshot& app)
{
    if (s_build_phase == TasksBuildPhase::Clearing) {
        pump_clear();
        return;
    }
    if (s_build_phase == TasksBuildPhase::Building) {
        pump_build(app);
        return;
    }
    if (s_build_phase == TasksBuildPhase::OverlayOff) {
        pump_overlay_off();
        return;
    }
    if (s_build_phase == TasksBuildPhase::Revealing) {
        pump_reveal();
    }
}

static void refresh_row_labels(TaskRow& row, const StatusTask& t, bool time_ok)
{
    strncpy(row.title, t.title, sizeof(row.title) - 1);
    row.title[sizeof(row.title) - 1] = '\0';
    row.has_id = t.has_id;
    row.has_desc = t.has_description;
    row.action_done = t.action_done;
    row.action_seen = t.action_seen;
    row.action_dismissed = t.action_dismissed;
    row.field_n = t.field_count;
    if (row.field_n > k_status_task_fields_max) {
        row.field_n = k_status_task_fields_max;
    }
    for (int fi = 0; fi < row.field_n; fi++) {
        row.fields[fi] = t.fields[fi];
    }
    if (row.title_lbl != nullptr) {
        lv_label_set_text(row.title_lbl, t.title[0] ? t.title : "(geen titel)");
    }
    char due[40];
    format_due(t.due_date, time_ok, due, sizeof(due));
    const char* soort = t.type[0] ? t.type : (t.kind[0] ? t.kind : "");
    char meta[96];
    if (soort[0] && due[0]) {
        snprintf(meta, sizeof(meta), "%s  %s", soort, due);
    } else if (soort[0]) {
        snprintf(meta, sizeof(meta), "%s", soort);
    } else {
        snprintf(meta, sizeof(meta), "%s", due);
    }
    if (row.meta_lbl != nullptr) {
        lv_label_set_text(row.meta_lbl, meta);
        lv_obj_set_style_text_color(row.meta_lbl, task_accent(t), 0);
    }
    if (row.card != nullptr) {
        lv_obj_set_style_border_color(row.card, t.overdue ? COL_ORANGE : COL_BORDER, 0);
    }
    if (row.desc != nullptr && t.has_description) {
        lv_label_set_text(row.desc, t.description);
    }
}

static void refresh_due_labels(const StatusSnapshot& app, bool time_ok)
{
    if (s_rows == nullptr || s_due_refresh_i < 0) {
        return;
    }
    int order[k_status_tasks_max];
    int n = 0;
    for (int i = 0; i < app.task_count && n < k_status_tasks_max; i++) {
        if (app.tasks[i].due_now) {
            order[n++] = i;
        }
    }
    for (int i = 0; i < app.task_count && n < k_status_tasks_max; i++) {
        if (!app.tasks[i].due_now) {
            order[n++] = i;
        }
    }
    if (n != s_row_n) {
        s_due_refresh_i = -1;
        return;
    }
    if (s_due_refresh_i >= n) {
        s_due_refresh_i = -1;
        s_drawn_time_ok = time_ok;
        return;
    }
    refresh_row_labels(s_rows[s_due_refresh_i], app.tasks[order[s_due_refresh_i]], time_ok);
    s_due_refresh_i++;
}

static void add_section_label(const char* text)
{
    if (s_list == nullptr || text == nullptr) {
        return;
    }
    lv_obj_t* lbl = lv_label_create(s_list);
    lv_label_set_text(lbl, text);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(lbl, COL_MUTED, 0);
    lv_obj_set_width(lbl, 992);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(lbl, LV_OBJ_FLAG_HIDDEN);
}

static void append_task_row(const StatusTask& t, bool time_ok)
{
    if (s_rows == nullptr || s_row_n >= k_status_tasks_max) {
        return;
    }
    TaskRow& row = s_rows[s_row_n];
    row = TaskRow{};
    strncpy(row.id, t.id, sizeof(row.id) - 1);
    strncpy(row.title, t.title, sizeof(row.title) - 1);
    row.has_id = t.has_id;
    row.has_desc = t.has_description;
    row.action_done = t.action_done;
    row.action_seen = t.action_seen;
    row.action_dismissed = t.action_dismissed;
    row.field_n = t.field_count;
    if (row.field_n > k_status_task_fields_max) {
        row.field_n = k_status_task_fields_max;
    }
    for (int fi = 0; fi < row.field_n; fi++) {
        row.fields[fi] = t.fields[fi];
    }

    lv_obj_t* card = lv_obj_create(s_list);
    lv_obj_set_width(card, 992);
    lv_obj_set_style_bg_color(card, COL_CARD, 0);
    lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(card, COL_BORDER, 0);
    lv_obj_set_style_border_width(card, 1, 0);
    lv_obj_set_style_radius(card, 0, 0);
    lv_obj_set_style_shadow_width(card, 0, 0);
    lv_obj_set_style_outline_width(card, 0, 0);
    lv_obj_set_style_pad_all(card, 6, 0);
    lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(card, 2, 0);
    lv_obj_remove_flag(card, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(card, LV_OBJ_FLAG_HIDDEN);
    if (row.has_desc) {
        lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(card, on_toggle_desc, LV_EVENT_CLICKED,
                            reinterpret_cast<void*>(static_cast<intptr_t>(s_row_n)));
    } else {
        lv_obj_remove_flag(card, LV_OBJ_FLAG_CLICKABLE);
    }
    row.card = card;

    lv_obj_t* title = lv_label_create(card);
    lv_label_set_text(title, t.title[0] ? t.title : "(geen titel)");
    lv_obj_set_style_text_font(title, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(title, COL_TEXT, 0);
    lv_obj_set_width(title, 960);
    lv_label_set_long_mode(title, LV_LABEL_LONG_DOT);
    lv_obj_remove_flag(title, LV_OBJ_FLAG_CLICKABLE);
    row.title_lbl = title;

    char due[40];
    format_due(t.due_date, time_ok, due, sizeof(due));
    const char* soort = t.type[0] ? t.type : (t.kind[0] ? t.kind : "");
    char meta[96];
    if (soort[0] && due[0]) {
        snprintf(meta, sizeof(meta), "%s  %s", soort, due);
    } else if (soort[0]) {
        snprintf(meta, sizeof(meta), "%s", soort);
    } else {
        snprintf(meta, sizeof(meta), "%s", due);
    }
    lv_obj_t* ml = lv_label_create(card);
    lv_label_set_text(ml, meta);
    lv_obj_set_style_text_font(ml, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(ml, task_accent(t), 0);
    lv_obj_remove_flag(ml, LV_OBJ_FLAG_CLICKABLE);
    row.meta_lbl = ml;

    if (t.overdue) {
        lv_obj_set_style_border_color(card, COL_ORANGE, 0);
    }

    if (row.has_desc) {
        row.desc = lv_label_create(card);
        lv_label_set_text(row.desc, t.description);
        lv_obj_set_style_text_font(row.desc, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(row.desc, COL_MUTED, 0);
        lv_obj_set_width(row.desc, 960);
        lv_label_set_long_mode(row.desc, LV_LABEL_LONG_DOT);
        lv_obj_remove_flag(row.desc, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_flag(row.desc, LV_OBJ_FLAG_HIDDEN);
    }

    row.busy = lv_label_create(card);
    lv_label_set_text(row.busy, "bezig...");
    lv_obj_set_style_text_font(row.busy, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(row.busy, COL_ORANGE, 0);
    lv_obj_remove_flag(row.busy, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(row.busy, LV_OBJ_FLAG_HIDDEN);

    const bool any_action = t.action_done || t.action_seen || t.action_dismissed;
    if (row.has_id && any_action) {
        if (t.action_done) {
            row.btn_done = make_btn(card, "Gedaan", 48, 0);
            if (row.btn_done != nullptr) {
                lv_obj_set_width(row.btn_done, 240);
                lv_obj_add_event_cb(row.btn_done, on_done, LV_EVENT_CLICKED,
                                    reinterpret_cast<void*>(static_cast<intptr_t>(s_row_n)));
            }
        }
        if (t.action_seen) {
            row.btn_seen = make_btn(card, "Gezien", 48, 0);
            if (row.btn_seen != nullptr) {
                lv_obj_set_width(row.btn_seen, 240);
                lv_obj_add_event_cb(row.btn_seen, on_seen, LV_EVENT_CLICKED,
                                    reinterpret_cast<void*>(static_cast<intptr_t>(s_row_n)));
            }
        }
        if (t.action_dismissed) {
            row.btn_dismissed = make_btn(card, "Niet van toepassing", 48, 0);
            if (row.btn_dismissed != nullptr) {
                lv_obj_set_width(row.btn_dismissed, 360);
                lv_obj_add_event_cb(row.btn_dismissed, on_dismissed, LV_EVENT_CLICKED,
                                    reinterpret_cast<void*>(static_cast<intptr_t>(s_row_n)));
            }
        }
    }

    s_row_n++;
}

static void make_sig(const StatusSnapshot& app, char* out, size_t out_len)
{
    size_t n = 0;
    // Geen due_now / due_now_count: SNTP mag bestaande kaarten bijwerken, geen hash-herbouw.
    n += static_cast<size_t>(snprintf(out + n, out_len - n, "%d|", app.task_count));
    for (int i = 0; i < app.task_count && n + 1 < out_len; i++) {
        const StatusTask& t = app.tasks[i];
        uint32_t th = fnv1a(t.id) ^ fnv1a(t.title) ^ fnv1a(t.type) ^ fnv1a(t.due_date)
                      ^ fnv1a(t.description);
        for (int fi = 0; fi < t.field_count; fi++) {
            th ^= fnv1a(t.fields[fi].key);
        }
        n += static_cast<size_t>(snprintf(out + n, out_len - n, "%08x:%d%d%d%d%d,",
                                          static_cast<unsigned>(th),
                                          t.overdue ? 1 : 0,
                                          t.action_done ? 1 : 0, t.action_seen ? 1 : 0,
                                          t.action_dismissed ? 1 : 0, t.field_count));
    }
}

static void create_modal(lv_obj_t* parent)
{
    if (!parent_ok(parent, "modal")) {
        return;
    }
    s_modal = lv_obj_create(parent);
    if (s_modal == nullptr) {
        ESP_LOGE(TAG, "modal create faalde");
        return;
    }
    lv_obj_set_size(s_modal, 1024, 600);
    lv_obj_set_pos(s_modal, 0, 0);
    lv_obj_set_style_bg_color(s_modal, COL_MODAL, 0);
    lv_obj_set_style_bg_opa(s_modal, LV_OPA_70, 0);
    lv_obj_set_style_border_width(s_modal, 0, 0);
    lv_obj_set_style_radius(s_modal, 0, 0);
    lv_obj_set_style_pad_all(s_modal, 0, 0);
    lv_obj_remove_flag(s_modal, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_modal, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_modal, LV_OBJ_FLAG_HIDDEN);

    s_modal_box = lv_obj_create(s_modal);
    if (s_modal_box == nullptr) {
        ESP_LOGE(TAG, "modal-box create faalde");
        return;
    }
    lv_obj_set_size(s_modal_box, 720, 340);
    lv_obj_center(s_modal_box);
    lv_obj_set_style_bg_color(s_modal_box, COL_CARD, 0);
    lv_obj_set_style_border_color(s_modal_box, COL_BORDER, 0);
    lv_obj_set_style_border_width(s_modal_box, 2, 0);
    lv_obj_set_style_radius(s_modal_box, 12, 0);
    lv_obj_set_style_pad_all(s_modal_box, 20, 0);
    lv_obj_remove_flag(s_modal_box, LV_OBJ_FLAG_SCROLLABLE);

    s_modal_text = lv_label_create(s_modal_box);
    lv_obj_set_width(s_modal_text, 680);
    lv_label_set_long_mode(s_modal_text, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_font(s_modal_text, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(s_modal_text, COL_TEXT, 0);
    lv_obj_remove_flag(s_modal_text, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_align(s_modal_text, LV_ALIGN_TOP_MID, 0, 8);

    s_modal_extra = lv_label_create(s_modal_box);
    lv_obj_set_width(s_modal_extra, 680);
    lv_label_set_long_mode(s_modal_extra, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_font(s_modal_extra, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_modal_extra, COL_MUTED, 0);
    lv_obj_remove_flag(s_modal_extra, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_align(s_modal_extra, LV_ALIGN_TOP_MID, 0, 88);
    lv_label_set_text(s_modal_extra, "");

    s_btn_yes = make_btn(s_modal_box, "Ja", 80);
    if (s_btn_yes != nullptr) {
        lv_obj_set_size(s_btn_yes, 280, 80);
        lv_obj_align(s_btn_yes, LV_ALIGN_BOTTOM_LEFT, 20, -8);
        lv_obj_add_event_cb(s_btn_yes, on_yes, LV_EVENT_CLICKED, nullptr);
    }

    s_btn_no = make_btn(s_modal_box, "Annuleren", 80);
    if (s_btn_no != nullptr) {
        lv_obj_set_size(s_btn_no, 280, 80);
        lv_obj_align(s_btn_no, LV_ALIGN_BOTTOM_RIGHT, -20, -8);
        lv_obj_add_event_cb(s_btn_no, on_no, LV_EVENT_CLICKED, nullptr);
    }

    s_btn_ok = make_btn(s_modal_box, "OK", 80);
    if (s_btn_ok != nullptr) {
        lv_obj_set_size(s_btn_ok, 280, 80);
        lv_obj_align(s_btn_ok, LV_ALIGN_BOTTOM_MID, 0, -8);
        lv_obj_add_event_cb(s_btn_ok, on_ok, LV_EVENT_CLICKED, nullptr);
    }
}

lv_obj_t* screen_tasks_create()
{
    if (s_rows == nullptr) {
        s_rows = static_cast<TaskRow*>(
            heap_caps_calloc(static_cast<size_t>(k_status_tasks_max), sizeof(TaskRow),
                             MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
        if (s_rows == nullptr) {
            s_rows = static_cast<TaskRow*>(
                heap_caps_calloc(static_cast<size_t>(k_status_tasks_max), sizeof(TaskRow),
                                 MALLOC_CAP_8BIT));
            ESP_LOGW(TAG, "TaskRow[%d] intern (%u B); PSRAM-alloc faalde (na wifi, geen hosted-DMA)",
                     k_status_tasks_max,
                     static_cast<unsigned>(sizeof(TaskRow) * k_status_tasks_max));
        } else {
            ESP_LOGI(TAG, "TaskRow[%d] in PSRAM (%u B)", k_status_tasks_max,
                     static_cast<unsigned>(sizeof(TaskRow) * k_status_tasks_max));
        }
    }
    if (s_sig == nullptr) {
        s_sig = static_cast<char*>(
            heap_caps_calloc(k_sig_len, 1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
        s_sig_buf = static_cast<char*>(
            heap_caps_calloc(k_sig_len, 1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
        if (s_sig == nullptr || s_sig_buf == nullptr) {
            ESP_LOGW(TAG, "taken-hashbuffers niet in PSRAM; hash uitgeschakeld tot geheugen vrij is");
        }
    }

    s_scr = lv_obj_create(nullptr);
    lv_obj_set_style_bg_color(s_scr, COL_BG, 0);
    lv_obj_set_style_bg_opa(s_scr, LV_OPA_COVER, 0);
    lv_obj_remove_flag(s_scr, LV_OBJ_FLAG_SCROLLABLE);

    s_status = ui_status_bar_create(s_scr);

    s_head = lv_obj_create(s_scr);
    lv_obj_set_pos(s_head, 12, APP_UI_STATUS_H + 8);
    lv_obj_set_size(s_head, 1000, 88);
    lv_obj_set_style_bg_color(s_head, COL_CARD, 0);
    lv_obj_set_style_border_color(s_head, COL_BORDER, 0);
    lv_obj_set_style_border_width(s_head, 2, 0);
    lv_obj_set_style_radius(s_head, 12, 0);
    lv_obj_set_style_pad_all(s_head, 12, 0);
    lv_obj_remove_flag(s_head, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_head, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_head, LV_OBJ_FLAG_HIDDEN);

    s_season = ui_make_label(s_head, 0, 0, &lv_font_montserrat_20, COL_TEXT, "");
    lv_obj_set_width(s_season, 976);
    lv_label_set_long_mode(s_season, LV_LABEL_LONG_DOT);
    s_feed = ui_make_label(s_head, 0, 32, &lv_font_montserrat_14, COL_MUTED, "");
    lv_obj_set_width(s_feed, 976);
    lv_label_set_long_mode(s_feed, LV_LABEL_LONG_DOT);

    s_warn = ui_make_label(s_scr, 16, APP_UI_STATUS_H + 8, &lv_font_montserrat_14, COL_ORANGE, "");
    lv_obj_set_width(s_warn, 990);
    lv_label_set_long_mode(s_warn, LV_LABEL_LONG_DOT);
    lv_obj_add_flag(s_warn, LV_OBJ_FLAG_HIDDEN);

    const int list_y = APP_UI_STATUS_H + 36;
    const int foot_h = 100;
    const int list_h = 600 - list_y - APP_UI_NAV_H - foot_h;
    s_list = lv_obj_create(s_scr);
    lv_obj_set_pos(s_list, 12, list_y);
    lv_obj_set_size(s_list, 1000, list_h);
    lv_obj_set_style_bg_opa(s_list, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(s_list, 0, 0);
    lv_obj_set_style_radius(s_list, 0, 0);
    lv_obj_set_style_shadow_width(s_list, 0, 0);
    lv_obj_set_style_outline_width(s_list, 0, 0);
    lv_obj_set_style_pad_all(s_list, 0, 0);
    lv_obj_set_flex_flow(s_list, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(s_list, 8, 0);
    lv_obj_set_scroll_dir(s_list, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(s_list, LV_SCROLLBAR_MODE_OFF);
    lv_obj_add_flag(s_list, LV_OBJ_FLAG_HIDDEN);

    s_empty = ui_make_label(s_scr, 24, list_y + 16, &lv_font_montserrat_20, COL_MUTED, "Geen open taken");
    lv_obj_set_width(s_empty, 976);

    lv_obj_t* foot = lv_obj_create(s_scr);
    lv_obj_set_pos(foot, 12, 600 - APP_UI_NAV_H - foot_h);
    lv_obj_set_size(foot, 1000, foot_h - 8);
    lv_obj_set_style_bg_opa(foot, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(foot, 0, 0);
    lv_obj_set_style_pad_all(foot, 0, 0);
    lv_obj_remove_flag(foot, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(foot, LV_OBJ_FLAG_CLICKABLE);

    s_updated = ui_make_label(foot, 0, 0, &lv_font_montserrat_14, COL_MUTED, "bijgewerkt om --:--");
    s_refresh = make_btn(foot, "Vernieuwen", 80);
    if (s_refresh != nullptr) {
        lv_obj_set_size(s_refresh, 360, 80);
        lv_obj_align(s_refresh, LV_ALIGN_BOTTOM_MID, 0, 0);
        lv_obj_add_event_cb(s_refresh, on_refresh, LV_EVENT_CLICKED, nullptr);
    }

    s_nav = ui_nav_create(s_scr, 1);
    // Modal/numpad/keuze pas bij Gedaan (niet bij boot of tab-open). Geen keyboard.
    return s_scr;
}

static bool show_season_ui(const StatusSnapshot& app)
{
    return app.season_present || app.feed_present || (app.data_ok_present && !app.data_ok);
}

static void layout_tasks(bool show_head)
{
    const int foot_h = 100;
    const int list_y = show_head ? (APP_UI_STATUS_H + 124) : (APP_UI_STATUS_H + 36);
    const int warn_y = show_head ? (APP_UI_STATUS_H + 100) : (APP_UI_STATUS_H + 8);
    const int list_h = 600 - list_y - APP_UI_NAV_H - foot_h;
    if (s_warn != nullptr) {
        lv_obj_set_y(s_warn, warn_y);
    }
    if (s_list != nullptr) {
        lv_obj_set_pos(s_list, 12, list_y);
        lv_obj_set_size(s_list, 1000, list_h);
    }
    if (s_empty != nullptr) {
        lv_obj_set_y(s_empty, list_y + 16);
    }
}

static void set_hidden(lv_obj_t* obj, bool hidden)
{
    if (obj == nullptr) {
        return;
    }
    const bool now = lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN);
    if (hidden == now) {
        return;
    }
    if (hidden) {
        lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_remove_flag(obj, LV_OBJ_FLAG_HIDDEN);
    }
}

void screen_tasks_set_nav_badge(int open_tasks)
{
    ui_nav_set_badge(s_nav, open_tasks);
}

void screen_tasks_set_visible(bool visible)
{
    if (s_tab_visible == visible) {
        return;
    }
    s_tab_visible = visible;
    if (visible) {
        if (s_sig != nullptr) {
            s_sig[0] = '\0';
        }
        s_rebuild_pending = false;
        s_due_refresh_i = -1;
        s_logged_due_refresh = false;
        return;
    }
    hide_modal();
    s_list_frozen = false;
    s_waiting_after_close = false;
    s_rebuild_pending = false;
    s_due_refresh_i = -1;
    if (s_list != nullptr && lv_obj_get_child_count(s_list) > 0) {
        s_build_phase = TasksBuildPhase::Clearing;
        reset_row_state();
        ESP_LOGI(TAG, "takenlijst: tab weg, kaarten opruimen");
    } else {
        s_build_phase = TasksBuildPhase::Idle;
        reset_row_state();
    }
    if (s_sig != nullptr) {
        s_sig[0] = '\0';
    }
}

void screen_tasks_pump_unload()
{
    if (s_tab_visible) {
        return;
    }
    if (s_build_phase == TasksBuildPhase::Clearing) {
        pump_clear();
        if (s_list != nullptr && lv_obj_get_child_count(s_list) == 0) {
            s_build_phase = TasksBuildPhase::Idle;
        }
        return;
    }
    if (s_list != nullptr && lv_obj_get_child_count(s_list) > 0) {
        s_build_phase = TasksBuildPhase::Clearing;
        reset_row_state();
        pump_clear();
    }
}

void screen_tasks_update(const AppState& st, const LiveSnapshot&, const StatusSnapshot& app)
{
    if (!s_tab_visible || s_scr == nullptr) {
        return;
    }

    ui_status_bar_update(s_status, st, app);
    ui_nav_set_badge(s_nav, app.due_now_count);

    if (wizard_open()) {
        return;
    }

    if (app.popup != StatusPopup::None && app.popup_seq != s_popup_seen && !s_modal_confirm) {
        s_popup_seen = app.popup_seq;
        hide_inputs();
        switch (app.popup) {
            case StatusPopup::NoNetwork:
                show_info_modal("Deze taak kan niet worden afgerond, omdat er geen verbinding is. "
                                "Probeer het opnieuw zodra de verbinding hersteld is.");
                break;
            case StatusPopup::ServerError:
                show_info_modal("De taak kon niet worden afgerond door een fout op de server. "
                                "Probeer het later opnieuw.");
                break;
            case StatusPopup::AlreadyClosed:
                show_info_modal("Taak was al afgesloten");
                break;
            case StatusPopup::TokenInvalid:
                show_info_modal("Token ongeldig - controleer KOISENSEI_HA_TOKEN");
                break;
            default:
                break;
        }
    }

    if (s_list_frozen || s_waiting_after_close) {
        if (app.close_busy || (s_waiting_after_close && app.fetching)) {
            return;
        }
        s_list_frozen = false;
        s_waiting_after_close = false;
        abort_list_build("POST klaar");
        hide_task_list();
        ESP_LOGI(TAG, "takenlijst: POST klaar; staggered opbouw (geen unhide van oude kaarten)");
    }

    const bool season_ui = show_season_ui(app);
    set_hidden(s_head, !season_ui);
    const uint32_t list_children = (s_list != nullptr) ? lv_obj_get_child_count(s_list) : 0;
    const bool layout_safe = (s_build_phase == TasksBuildPhase::Idle && list_children <= 1) ||
                             s_build_phase == TasksBuildPhase::Building ||
                             list_children == 0;
    if (layout_safe && (!s_have_task_layout || s_laid_out_head != season_ui)) {
        s_laid_out_head = season_ui;
        s_have_task_layout = true;
        layout_tasks(season_ui);
    }

    if (app.season_present) {
        int y = 0, mo = 0, d = 0;
        char line[80];
        if (app.season_since[0] && sscanf(app.season_since, "%d-%d-%d", &y, &mo, &d) >= 3 &&
            mo >= 1 && mo <= 12) {
            snprintf(line, sizeof(line), "%s sinds %d %s", app.season, d, MONTHS_NL[mo - 1]);
        } else {
            snprintf(line, sizeof(line), "%s", app.season);
        }
        lv_label_set_text(s_season, line);
        lv_obj_set_style_text_color(s_season, COL_TEXT, 0);
    } else {
        lv_label_set_text(s_season, "");
    }

    if (app.data_ok_present && !app.data_ok) {
        lv_label_set_text(s_feed, "Te weinig recente temperatuurdata; adviezen staan even stil.");
        lv_obj_set_style_text_color(s_feed, COL_ORANGE, 0);
    } else if (app.feed_present) {
        lv_label_set_text(s_feed, app.feed_label);
        lv_obj_set_style_text_color(s_feed, COL_TEXT, 0);
    } else {
        lv_label_set_text(s_feed, "");
    }

    if (app.fetch == StatusFetchState::TokenInvalid) {
        lv_label_set_text(s_warn, "Token ongeldig - controleer KOISENSEI_HA_TOKEN");
        lv_obj_remove_flag(s_warn, LV_OBJ_FLAG_HIDDEN);
    } else if (app.error_detail[0] && app.fetch == StatusFetchState::Error) {
        lv_label_set_text(s_warn, app.error_detail);
        lv_obj_remove_flag(s_warn, LV_OBJ_FLAG_HIDDEN);
    } else if (st.wifi == WifiStatus::WaitPowerCycle) {
        lv_label_set_text(s_warn, "Wifi wacht op stroom-eraf (C6)");
        lv_obj_remove_flag(s_warn, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_label_set_text(s_warn, "");
        lv_obj_add_flag(s_warn, LV_OBJ_FLAG_HIDDEN);
    }

    if (s_sig == nullptr || s_sig_buf == nullptr) {
        return;
    }
    make_sig(app, s_sig_buf, k_sig_len);
    if (strcmp(s_sig_buf, s_sig) != 0) {
        strncpy(s_sig, s_sig_buf, k_sig_len - 1);
        s_sig[k_sig_len - 1] = '\0';
        start_rebuild(app, st.time_synced);
    }
    if (s_build_phase != TasksBuildPhase::Idle) {
        pump_rebuild(app);
    } else if (s_rebuild_pending) {
        s_rebuild_pending = false;
        start_rebuild(app, st.time_synced);
        if (s_build_phase != TasksBuildPhase::Idle) {
            pump_rebuild(app);
        }
    } else if (s_row_n > 0 && s_drawn_time_ok != st.time_synced &&
               s_build_phase == TasksBuildPhase::Idle) {
        if (s_due_refresh_i < 0) {
            s_due_refresh_i = 0;
            if (!s_logged_due_refresh) {
                ESP_LOGI(TAG, "takenlijst: due-labels bijwerken (geen herbouw)");
                s_logged_due_refresh = true;
            }
        }
        refresh_due_labels(app, st.time_synced);
    }

    if (app.task_count == 0) {
        lv_obj_remove_flag(s_empty, LV_OBJ_FLAG_HIDDEN);
        lv_label_set_text(s_empty, app.has_data ? "Geen open taken" : "wacht op app");
    } else if (s_empty != nullptr) {
        lv_obj_add_flag(s_empty, LV_OBJ_FLAG_HIDDEN);
    }

    for (int i = 0; i < s_row_n && s_build_phase == TasksBuildPhase::Idle; i++) {
        const bool busy = app.close_busy && s_rows[i].id[0] &&
                          strcmp(s_rows[i].id, app.close_task_id) == 0;
        set_hidden(s_rows[i].busy, !busy);
        set_hidden(s_rows[i].btn_done, busy);
        set_hidden(s_rows[i].btn_seen, busy);
        set_hidden(s_rows[i].btn_dismissed, busy);
    }

    if (app.fetched_at_unix > 0 && st.time_synced) {
        time_t t = static_cast<time_t>(app.fetched_at_unix);
        struct tm tm_l = {};
        localtime_r(&t, &tm_l);
        lv_label_set_text_fmt(s_updated, "bijgewerkt om %02d:%02d", tm_l.tm_hour, tm_l.tm_min);
        lv_obj_set_style_text_color(s_updated, app.data_stale_warn ? COL_ORANGE : COL_MUTED, 0);
    } else {
        lv_label_set_text(s_updated, "bijgewerkt om --:--");
        lv_obj_set_style_text_color(s_updated, COL_MUTED, 0);
    }
}

void screen_tasks_dismiss_popups()
{
    if (s_scr == nullptr) {
        return;
    }
    const bool modal_open = obj_alive(s_modal) && !lv_obj_has_flag(s_modal, LV_OBJ_FLAG_HIDDEN);
    if (!modal_open && !wizard_open()) {
        return;
    }
    ESP_LOGI(TAG, "pop-up automatisch gesloten (naar rust; bevestiging = Annuleren)");
    hide_modal();
    status_store_popup_ack(s_popup_seen);
}
