// KOIoT Paneel - Overzicht (M1.6): live tegels, ventilatie 0/1/2 + auto, seizoen/voer, open taken.
#pragma once

#include "lvgl.h"

struct AppState;
struct LiveSnapshot;
struct StatusSnapshot;

lv_obj_t* screen_dashboard_create();
void screen_dashboard_update(const AppState& st, const LiveSnapshot& live,
                             const StatusSnapshot& app);
void screen_dashboard_set_nav_badge(int open_tasks);
void screen_dashboard_touch_feedback();
void screen_dashboard_dismiss_popup();  // T1 / rustscherm (§7.6)
