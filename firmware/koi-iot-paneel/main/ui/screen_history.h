// KOIoT Paneel - tab Historie (M2, brief §7.3). Laatste 50 invoeren van dit paneel.
#pragma once

#include "lvgl.h"

struct AppState;
struct StatusSnapshot;

lv_obj_t* screen_history_create();
void screen_history_update(const AppState& st, const StatusSnapshot& app);
void screen_history_set_nav_badge(int open_tasks);
void screen_history_set_visible(bool visible);
void screen_history_dismiss();
bool screen_history_popup_open();
