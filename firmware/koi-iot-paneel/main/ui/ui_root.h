// KOIoT Paneel - UI-wortel: schermen, lekbanner, refresh-timer.
//
// Threading: LVGL alleen binnen lvgl_port_lock of vanuit de LVGL-timer.
// De lekbanner is een overlay op het Overzicht (niet op lv_layer_top).
#pragma once

#include <cstdint>

enum class UiPage : uint8_t {
    Overview = 0,
    Tasks,
    Entry,
    History,
    Settings,
};

void ui_root_init();
void ui_root_show(UiPage page);
UiPage ui_root_current();

// Energiestand (M1.7): rustscherm laden, of wekken naar Overzicht.
void ui_root_enter_idle();
void ui_root_enter_active();
