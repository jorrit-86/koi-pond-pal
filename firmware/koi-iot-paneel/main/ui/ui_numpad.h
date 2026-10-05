// KOIoT Paneel - numeriek toetsenblok (M1.5 afronden; zelfde patroon als M2 §7.2).
// Komma in de UI, punt in JSON. Geen HTTP. Touch-targets >= 64 px.
#pragma once

#include "lvgl.h"

#include <cstddef>

struct UiNumpad {
    lv_obj_t* overlay = nullptr;
    lv_obj_t* box = nullptr;
    lv_obj_t* unit_slot = nullptr;
    lv_obj_t* time_slot = nullptr;
    lv_obj_t* grid = nullptr;
    lv_obj_t* title = nullptr;
    lv_obj_t* value = nullptr;
    lv_obj_t* hint = nullptr;
    lv_obj_t* btn_ok = nullptr;
    lv_obj_t* btn_ok_lbl = nullptr;
    lv_obj_t* btn_cancel = nullptr;
    lv_obj_t* btn_cancel_lbl = nullptr;
    char buf[16] = "";
};

void ui_numpad_create(UiNumpad* pad, lv_obj_t* parent,
                      lv_event_cb_t on_ok, lv_event_cb_t on_cancel);
void ui_numpad_show(UiNumpad* pad, const char* title, const char* hint,
                    const char* ok_label);
void ui_numpad_hide(UiNumpad* pad);
void ui_numpad_set_error(UiNumpad* pad, const char* hint);
void ui_numpad_set_step_value(UiNumpad* pad);
void ui_numpad_set_step_time(UiNumpad* pad);
void ui_numpad_set_units_visible(UiNumpad* pad, bool visible);
void ui_numpad_set_cancel_label(UiNumpad* pad, const char* label);
void ui_numpad_refresh_value(UiNumpad* pad);
bool ui_numpad_empty(const UiNumpad* pad);
// Schrijft JSON-getal met punt. false = leeg of geen geldig getal.
bool ui_numpad_value_json(const UiNumpad* pad, char* out, size_t out_len);
const char* ui_numpad_value_ui(const UiNumpad* pad);
