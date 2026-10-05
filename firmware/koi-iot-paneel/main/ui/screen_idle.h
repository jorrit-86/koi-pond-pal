// KOIoT Paneel - rustscherm (M1.7, brief §7.6).
#pragma once

#include "lvgl.h"

struct AppState;
struct LiveSnapshot;
struct StatusSnapshot;

lv_obj_t* screen_idle_create();
void screen_idle_update(const AppState& st, const LiveSnapshot& live,
                        const StatusSnapshot& app);
void screen_idle_on_enter();
