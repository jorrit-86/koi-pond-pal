// KOIoT Paneel - tab Meting invoeren (M2, brief §7.2).
#pragma once

#include "lvgl.h"

struct AppState;
struct StatusSnapshot;

lv_obj_t* screen_entry_create();
void screen_entry_update(const AppState& st, const StatusSnapshot& app);
void screen_entry_set_nav_badge(int open_tasks);
void screen_entry_start(int param_idx);  // vanaf pop-up of tegel
void screen_entry_dismiss();             // T1 als Annuleren
bool screen_entry_overlay_open();
