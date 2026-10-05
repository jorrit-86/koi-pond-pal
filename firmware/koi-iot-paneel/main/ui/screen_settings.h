// KOIoT Paneel - Instellingen (M1.7 Scherm, M3b Info/vijver/herstart,
// M3c wifi-scan + wachtwoord, M3d MQTT runtime, M3e device-token, M3f OTA, scroll).
#pragma once

#include "lvgl.h"

struct AppState;
struct StatusSnapshot;

lv_obj_t* screen_settings_create();
void screen_settings_update(const AppState& st, const StatusSnapshot& app);
void screen_settings_set_nav_badge(int open_tasks);
void screen_settings_dismiss();  // T1 / tabwissel: overlays als Annuleren
