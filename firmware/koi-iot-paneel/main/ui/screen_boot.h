// KOIoT Paneel - M1a-diagnosescherm: wifi/klok/panel_id + MQTT-status + ruwe topiclog.
#pragma once

#include "lvgl.h"

struct AppState;

// Bouwt het scherm (aanroepen binnen lvgl_port_lock). Geeft het schermobject terug (nog niet geladen).
lv_obj_t* screen_boot_create();

// Ververst labels uit een status-snapshot + diagnosestore (aanroepen vanuit de LVGL-timer).
void screen_boot_update(const AppState& st);
