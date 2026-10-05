// KOIoT Paneel - Taken (M1.5): seizoen, voeradvies, open taken, afronden.
#pragma once

#include "lvgl.h"

struct AppState;
struct LiveSnapshot;
struct StatusSnapshot;

lv_obj_t* screen_tasks_create();
void screen_tasks_update(const AppState& st, const LiveSnapshot& live,
                         const StatusSnapshot& app);
void screen_tasks_set_nav_badge(int open_tasks);
// Kaarten alleen op tab Taken. Bij verlaten: incrementeel opruimen (geen 15 deletes/tick).
void screen_tasks_set_visible(bool visible);
void screen_tasks_pump_unload();
// Open wizard/bevestiging/info-pop-up sluiten als Annuleren (T1 naar Rust, §7.6).
void screen_tasks_dismiss_popups();
