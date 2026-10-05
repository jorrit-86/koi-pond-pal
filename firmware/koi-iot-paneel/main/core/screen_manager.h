// KOIoT Paneel - energiestand: Actief / Rust / Uit (M1.7, brief §7.6).
//
// LVGL-aanroepen alleen vanuit de LVGL-taak (tick + touch-hook).
// MQTT-commando's zetten alleen een vlag; de tick voert de overgang uit.
#pragma once

#include <cstdint>

enum class ScreenMode : uint8_t {
    Active = 0,
    Idle,
    Off,
};

void screen_manager_init();

// Aanroepen vanuit de LVGL-refresh-timer (niet vanuit MQTT/HTTP).
void screen_manager_tick();

// Pointer-PRESSED: in Actief T1 opnieuw; in Rust/Uit wekken (aanraker bedient niets).
void screen_manager_on_pointer_pressed();

ScreenMode screen_manager_mode();
bool screen_manager_ha_switch_on();  // Actief of Rust = ON; Uit = OFF

// Vanuit mqtt_link (niet-LVGL): wekken of uit. Genegeerd tijdens een lopend verzoek.
void screen_manager_request_ha_on();
void screen_manager_request_ha_off();

// Helderheid opnieuw toepassen na een instellingenwijziging (LVGL-taak).
void screen_manager_apply_brightness();
