// KOIoT Paneel - numeriek toetsenblok (implementatie).
#include "ui/ui_numpad.h"

#include <cstdint>
#include <cstdio>
#include <cstring>

#include "app_config.h"
#include "lvgl.h"

extern "C" {
extern const lv_obj_class_t lv_label_class;
}

static const lv_color_t COL_BG     = lv_color_hex(0x000000);
static const lv_color_t COL_CARD   = lv_color_hex(0x1B2229);
static const lv_color_t COL_BORDER = lv_color_hex(0x2E3A45);
static const lv_color_t COL_TEXT   = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED  = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_BTN    = lv_color_hex(0x2A3540);

static UiNumpad* s_self = nullptr;

static lv_obj_t* pad_obj(lv_obj_t* parent)
{
    if (parent != nullptr && !lv_obj_is_valid(parent)) {
        return nullptr;
    }
    lv_obj_t* o = lv_obj_class_create_obj(&lv_obj_class, parent);
    if (o == nullptr) {
        return nullptr;
    }
    lv_obj_class_init_obj(o);
    return o;
}

static lv_obj_t* pad_label(lv_obj_t* parent)
{
    if (parent == nullptr || !lv_obj_is_valid(parent)) {
        return nullptr;
    }
    lv_obj_t* lbl = lv_obj_class_create_obj(&lv_label_class, parent);
    if (lbl == nullptr) {
        return nullptr;
    }
    lv_obj_class_init_obj(lbl);
    return lbl;
}

static lv_obj_t* make_key(lv_obj_t* parent, const char* title, int w, int h)
{
    if (parent == nullptr || !lv_obj_is_valid(parent)) {
        return nullptr;
    }
    lv_obj_t* btn = pad_obj(parent);
    if (btn == nullptr) {
        return nullptr;
    }
    lv_obj_set_size(btn, w, h);
    lv_obj_set_style_bg_color(btn, COL_BTN, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(btn, COL_BORDER, 0);
    lv_obj_set_style_border_width(btn, 2, 0);
    lv_obj_set_style_radius(btn, 10, 0);
    lv_obj_set_style_pad_all(btn, 0, 0);
    lv_obj_remove_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_t* lbl = pad_label(btn);
    if (lbl == nullptr) {
        return btn;
    }
    lv_label_set_text(lbl, title);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_30, 0);
    lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(lbl);
    return btn;
}

static constexpr int k_box_w = 1000;
static constexpr int k_pad_x = 12;
static constexpr int k_inner_w = k_box_w - 2 * k_pad_x;
static constexpr int k_title_h = 28;
static constexpr int k_value_h = 72;
static constexpr int k_footer_h = 64;
static constexpr int k_unit_w = 284;
static constexpr int k_unit_gap = 12;
static constexpr int k_value_w_units = k_inner_w - k_unit_w - k_unit_gap;

static void set_hidden(lv_obj_t* o, bool hidden)
{
    if (o == nullptr || !lv_obj_is_valid(o)) {
        return;
    }
    if (hidden) {
        lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_remove_flag(o, LV_OBJ_FLAG_HIDDEN);
    }
}

static void refresh_value(UiNumpad* pad)
{
    if (pad == nullptr || pad->value == nullptr) {
        return;
    }
    if (pad->buf[0] == '\0') {
        lv_label_set_text(pad->value, "_");
        lv_obj_set_style_text_color(pad->value, COL_MUTED, 0);
    } else {
        lv_label_set_text(pad->value, pad->buf);
        lv_obj_set_style_text_color(pad->value, COL_TEXT, 0);
    }
}

static UiNumpad* pad_of(lv_event_t* e)
{
    lv_obj_t* o = lv_event_get_target_obj(e);
    while (o != nullptr) {
        void* u = lv_obj_get_user_data(o);
        if (u != nullptr) {
            return static_cast<UiNumpad*>(u);
        }
        o = lv_obj_get_parent(o);
    }
    return s_self;
}

static void on_key(lv_event_t* e)
{
    UiNumpad* pad = pad_of(e);
    if (pad == nullptr) {
        pad = s_self;
    }
    if (pad == nullptr) {
        return;
    }
    s_self = pad;
    const int code = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    if (code == 8) {
        const size_t n = strlen(pad->buf);
        if (n == 0) {
            return;
        }
        pad->buf[n - 1] = '\0';
        refresh_value(pad);
        return;
    }
    const char ch = static_cast<char>(code);
    const size_t n = strlen(pad->buf);
    if (n + 1 >= sizeof(pad->buf)) {
        return;
    }
    if (ch == ',') {
        if (strchr(pad->buf, ',') != nullptr) {
            return;
        }
        if (n == 0) {
            pad->buf[0] = '0';
            pad->buf[1] = ',';
            pad->buf[2] = '\0';
            refresh_value(pad);
            return;
        }
    }
    pad->buf[n] = ch;
    pad->buf[n + 1] = '\0';
    refresh_value(pad);
}

void ui_numpad_create(UiNumpad* pad, lv_obj_t* parent,
                      lv_event_cb_t on_ok, lv_event_cb_t on_cancel)
{
    if (pad == nullptr || parent == nullptr || !lv_obj_is_valid(parent)) {
        return;
    }
    s_self = pad;
    pad->overlay = pad_obj(parent);
    if (pad->overlay == nullptr) {
        return;
    }
    // Content-gebied: status- en nav-balk blijven zichtbaar. Overlay vult
    // de ruimte ertussen. Stap 1: titel+bereik | waarde+eenheid | numpad |
    // Volgende/Annuleren. Stap 2 hergebruikt time_slot over hetzelfde vlak
    // (geen tijdrij onder de toetsen).
    const int ov_h = APP_UI_SCREEN_H - APP_UI_STATUS_H - APP_UI_NAV_H;
    const int value_y = k_title_h;
    const int grid_y = k_title_h + k_value_h;
    const int footer_y = ov_h - k_footer_h;
    const int grid_h = footer_y - grid_y;
    const int time_y = 12;
    const int time_h = footer_y - 16;
    const int key_gap = 12;
    const int key_w = (k_inner_w - 2 * key_gap) / 3;
    const int btn_gap = 12;
    const int btn_w = (k_inner_w - btn_gap) / 2;
    const int title_w = 240;

    lv_obj_set_size(pad->overlay, APP_UI_SCREEN_W, ov_h);
    lv_obj_set_pos(pad->overlay, 0, APP_UI_STATUS_H);
    lv_obj_set_style_bg_color(pad->overlay, COL_BG, 0);
    lv_obj_set_style_bg_opa(pad->overlay, LV_OPA_70, 0);
    lv_obj_set_style_border_width(pad->overlay, 0, 0);
    lv_obj_set_style_radius(pad->overlay, 0, 0);
    lv_obj_set_style_pad_all(pad->overlay, 0, 0);
    lv_obj_remove_flag(pad->overlay, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(pad->overlay, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(pad->overlay, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_user_data(pad->overlay, pad);

    pad->box = pad_obj(pad->overlay);
    if (pad->box == nullptr) {
        return;
    }
    lv_obj_t* box = pad->box;
    lv_obj_set_size(box, k_box_w, ov_h);
    lv_obj_set_pos(box, 12, 0);
    lv_obj_set_style_bg_color(box, COL_CARD, 0);
    lv_obj_set_style_border_color(box, COL_BORDER, 0);
    lv_obj_set_style_border_width(box, 2, 0);
    lv_obj_set_style_radius(box, 12, 0);
    lv_obj_set_style_pad_all(box, 0, 0);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_CLICKABLE);

    pad->title = pad_label(box);
    if (pad->title != nullptr) {
        lv_obj_set_pos(pad->title, k_pad_x, 6);
        lv_obj_set_width(pad->title, title_w);
        lv_label_set_long_mode(pad->title, LV_LABEL_LONG_DOT);
        lv_obj_set_style_text_font(pad->title, &lv_font_montserrat_20, 0);
        lv_obj_set_style_text_color(pad->title, COL_TEXT, 0);
        lv_obj_remove_flag(pad->title, LV_OBJ_FLAG_CLICKABLE);
    }

    pad->hint = pad_label(box);
    if (pad->hint != nullptr) {
        lv_obj_set_pos(pad->hint, k_pad_x + title_w + 12, 8);
        lv_obj_set_width(pad->hint, k_inner_w - title_w - 12);
        lv_label_set_long_mode(pad->hint, LV_LABEL_LONG_DOT);
        lv_obj_set_style_text_font(pad->hint, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(pad->hint, COL_MUTED, 0);
        lv_obj_remove_flag(pad->hint, LV_OBJ_FLAG_CLICKABLE);
    }

    pad->value = pad_label(box);
    if (pad->value != nullptr) {
        lv_obj_set_pos(pad->value, k_pad_x, value_y);
        lv_obj_set_width(pad->value, k_inner_w);
        lv_obj_set_style_text_font(pad->value, &lv_font_montserrat_42, 0);
        lv_obj_set_style_text_color(pad->value, COL_MUTED, 0);
        lv_obj_remove_flag(pad->value, LV_OBJ_FLAG_CLICKABLE);
        lv_label_set_text(pad->value, "_");
    }

    pad->unit_slot = pad_obj(box);
    if (pad->unit_slot != nullptr) {
        lv_obj_set_pos(pad->unit_slot, k_box_w - k_pad_x - k_unit_w, value_y + 4);
        lv_obj_set_size(pad->unit_slot, k_unit_w, 64);
        lv_obj_set_style_bg_opa(pad->unit_slot, LV_OPA_TRANSP, 0);
        lv_obj_set_style_border_width(pad->unit_slot, 0, 0);
        lv_obj_set_style_pad_all(pad->unit_slot, 0, 0);
        lv_obj_remove_flag(pad->unit_slot, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_remove_flag(pad->unit_slot, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_flag(pad->unit_slot, LV_OBJ_FLAG_HIDDEN);
    }

    pad->grid = pad_obj(box);
    if (pad->grid == nullptr) {
        return;
    }
    lv_obj_t* grid = pad->grid;
    lv_obj_set_pos(grid, k_pad_x, grid_y);
    lv_obj_set_size(grid, k_inner_w, grid_h);
    lv_obj_set_style_bg_opa(grid, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(grid, 0, 0);
    lv_obj_set_style_pad_all(grid, 0, 0);
    lv_obj_set_flex_flow(grid, LV_FLEX_FLOW_ROW_WRAP);
    lv_obj_set_flex_align(grid, LV_FLEX_ALIGN_SPACE_EVENLY, LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(grid, 12, 0);
    lv_obj_set_style_pad_column(grid, key_gap, 0);
    lv_obj_remove_flag(grid, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(grid, LV_OBJ_FLAG_CLICKABLE);

    pad->time_slot = pad_obj(box);
    if (pad->time_slot != nullptr) {
        lv_obj_set_pos(pad->time_slot, k_pad_x, time_y);
        lv_obj_set_size(pad->time_slot, k_inner_w, time_h);
        lv_obj_set_style_bg_opa(pad->time_slot, LV_OPA_TRANSP, 0);
        lv_obj_set_style_border_width(pad->time_slot, 0, 0);
        lv_obj_set_style_pad_all(pad->time_slot, 0, 0);
        lv_obj_remove_flag(pad->time_slot, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_remove_flag(pad->time_slot, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_flag(pad->time_slot, LV_OBJ_FLAG_HIDDEN);
    }

    static const char* k_keys[12] = {
        "1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "<"
    };
    static const int k_codes[12] = {
        '1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 8
    };
    for (int i = 0; i < 12; i++) {
        lv_obj_t* key = make_key(grid, k_keys[i], key_w, 64);
        if (key == nullptr) {
            continue;
        }
        lv_obj_add_event_cb(key, on_key, LV_EVENT_CLICKED,
                            reinterpret_cast<void*>(static_cast<intptr_t>(k_codes[i])));
    }

    pad->btn_ok = pad_obj(box);
    if (pad->btn_ok == nullptr) {
        return;
    }
    lv_obj_set_pos(pad->btn_ok, k_pad_x, footer_y);
    lv_obj_set_size(pad->btn_ok, btn_w, k_footer_h);
    lv_obj_set_style_bg_color(pad->btn_ok, COL_BTN, 0);
    lv_obj_set_style_bg_opa(pad->btn_ok, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(pad->btn_ok, COL_BORDER, 0);
    lv_obj_set_style_border_width(pad->btn_ok, 2, 0);
    lv_obj_set_style_radius(pad->btn_ok, 10, 0);
    lv_obj_set_style_pad_all(pad->btn_ok, 0, 0);
    lv_obj_remove_flag(pad->btn_ok, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(pad->btn_ok, LV_OBJ_FLAG_CLICKABLE);
    pad->btn_ok_lbl = pad_label(pad->btn_ok);
    if (pad->btn_ok_lbl != nullptr) {
        lv_label_set_text(pad->btn_ok_lbl, "OK");
        lv_obj_set_style_text_font(pad->btn_ok_lbl, &lv_font_montserrat_20, 0);
        lv_obj_set_style_text_color(pad->btn_ok_lbl, COL_TEXT, 0);
        lv_obj_remove_flag(pad->btn_ok_lbl, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_center(pad->btn_ok_lbl);
    }
    if (on_ok != nullptr) {
        lv_obj_add_event_cb(pad->btn_ok, on_ok, LV_EVENT_CLICKED, nullptr);
    }

    pad->btn_cancel = pad_obj(box);
    if (pad->btn_cancel != nullptr) {
        lv_obj_set_pos(pad->btn_cancel, k_pad_x + btn_w + btn_gap, footer_y);
        lv_obj_set_size(pad->btn_cancel, btn_w, k_footer_h);
        lv_obj_set_style_bg_color(pad->btn_cancel, COL_BTN, 0);
        lv_obj_set_style_bg_opa(pad->btn_cancel, LV_OPA_COVER, 0);
        lv_obj_set_style_border_color(pad->btn_cancel, COL_BORDER, 0);
        lv_obj_set_style_border_width(pad->btn_cancel, 2, 0);
        lv_obj_set_style_radius(pad->btn_cancel, 10, 0);
        lv_obj_set_style_pad_all(pad->btn_cancel, 0, 0);
        lv_obj_remove_flag(pad->btn_cancel, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(pad->btn_cancel, LV_OBJ_FLAG_CLICKABLE);
        pad->btn_cancel_lbl = pad_label(pad->btn_cancel);
        if (pad->btn_cancel_lbl != nullptr) {
            lv_label_set_text(pad->btn_cancel_lbl, "Annuleren");
            lv_obj_set_style_text_font(pad->btn_cancel_lbl, &lv_font_montserrat_20, 0);
            lv_obj_set_style_text_color(pad->btn_cancel_lbl, COL_TEXT, 0);
            lv_obj_remove_flag(pad->btn_cancel_lbl, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_center(pad->btn_cancel_lbl);
        }
        if (on_cancel != nullptr) {
            lv_obj_add_event_cb(pad->btn_cancel, on_cancel, LV_EVENT_CLICKED, nullptr);
        }
        lv_obj_move_foreground(pad->btn_cancel);
    }
    if (pad->btn_ok != nullptr) {
        lv_obj_move_foreground(pad->btn_ok);
    }
}

void ui_numpad_set_step_value(UiNumpad* pad)
{
    if (pad == nullptr) {
        return;
    }
    set_hidden(pad->title, false);
    set_hidden(pad->hint, false);
    set_hidden(pad->value, false);
    set_hidden(pad->grid, false);
    set_hidden(pad->time_slot, true);
}

void ui_numpad_set_step_time(UiNumpad* pad)
{
    if (pad == nullptr) {
        return;
    }
    set_hidden(pad->title, true);
    set_hidden(pad->hint, true);
    set_hidden(pad->value, true);
    set_hidden(pad->unit_slot, true);
    set_hidden(pad->grid, true);
    set_hidden(pad->time_slot, false);
}

void ui_numpad_set_units_visible(UiNumpad* pad, bool visible)
{
    if (pad == nullptr) {
        return;
    }
    set_hidden(pad->unit_slot, !visible);
    if (pad->value != nullptr && lv_obj_is_valid(pad->value)) {
        lv_obj_set_width(pad->value, visible ? k_value_w_units : k_inner_w);
    }
}

void ui_numpad_set_cancel_label(UiNumpad* pad, const char* label)
{
    if (pad == nullptr || pad->btn_cancel_lbl == nullptr ||
        !lv_obj_is_valid(pad->btn_cancel_lbl)) {
        return;
    }
    lv_label_set_text(pad->btn_cancel_lbl, (label != nullptr) ? label : "Annuleren");
    lv_obj_center(pad->btn_cancel_lbl);
}

void ui_numpad_refresh_value(UiNumpad* pad)
{
    refresh_value(pad);
}

void ui_numpad_show(UiNumpad* pad, const char* title, const char* hint,
                    const char* ok_label)
{
    if (pad == nullptr || pad->overlay == nullptr || !lv_obj_is_valid(pad->overlay)) {
        return;
    }
    pad->buf[0] = '\0';
    if (pad->title != nullptr && lv_obj_is_valid(pad->title)) {
        lv_label_set_text(pad->title, (title != nullptr) ? title : "");
    }
    if (pad->hint != nullptr && lv_obj_is_valid(pad->hint)) {
        lv_label_set_text(pad->hint, (hint != nullptr) ? hint : "");
        lv_obj_set_style_text_color(pad->hint, COL_MUTED, 0);
    }
    if (pad->btn_ok_lbl != nullptr && lv_obj_is_valid(pad->btn_ok_lbl)) {
        lv_label_set_text(pad->btn_ok_lbl, (ok_label != nullptr) ? ok_label : "OK");
    }
    ui_numpad_set_cancel_label(pad, "Annuleren");
    ui_numpad_set_units_visible(pad, false);
    ui_numpad_set_step_value(pad);
    refresh_value(pad);
    lv_obj_remove_flag(pad->overlay, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(pad->overlay);
}

void ui_numpad_hide(UiNumpad* pad)
{
    if (pad == nullptr || pad->overlay == nullptr || !lv_obj_is_valid(pad->overlay)) {
        return;
    }
    lv_obj_add_flag(pad->overlay, LV_OBJ_FLAG_HIDDEN);
}

void ui_numpad_set_error(UiNumpad* pad, const char* hint)
{
    if (pad == nullptr || pad->hint == nullptr) {
        return;
    }
    lv_label_set_text(pad->hint, (hint != nullptr) ? hint : "");
    lv_obj_set_style_text_color(pad->hint, lv_color_hex(0xF39C12), 0);
}

bool ui_numpad_empty(const UiNumpad* pad)
{
    if (pad == nullptr || pad->buf[0] == '\0') {
        return true;
    }
    return strcmp(pad->buf, ",") == 0;
}

bool ui_numpad_value_json(const UiNumpad* pad, char* out, size_t out_len)
{
    if (out == nullptr || out_len == 0) {
        return false;
    }
    out[0] = '\0';
    if (pad == nullptr || pad->buf[0] == '\0') {
        return false;
    }
    char tmp[16];
    size_t o = 0;
    bool saw_digit = false;
    for (const char* p = pad->buf; *p != '\0' && o + 1 < sizeof(tmp); p++) {
        if (*p == ',') {
            tmp[o++] = '.';
        } else {
            tmp[o++] = *p;
            if (*p >= '0' && *p <= '9') {
                saw_digit = true;
            }
        }
    }
    tmp[o] = '\0';
    if (!saw_digit) {
        return false;
    }
    // Trailing punt weg (bv. "12.").
    const size_t n = strlen(tmp);
    if (n > 0 && tmp[n - 1] == '.') {
        tmp[n - 1] = '\0';
    }
    if (tmp[0] == '\0') {
        return false;
    }
    snprintf(out, out_len, "%s", tmp);
    return true;
}

const char* ui_numpad_value_ui(const UiNumpad* pad)
{
    if (pad == nullptr || pad->buf[0] == '\0') {
        return "";
    }
    return pad->buf;
}
