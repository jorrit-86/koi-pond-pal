// KOIoT Paneel - wifi-verbinding, reconnect-beleid (R1) en status.
//
// Gebruikt de Elecrow-component bsp_wifi voor de driver-init (esp_hosted -> C6) en
// legt daar het KOIoT-beleid overheen:
//   - bij verlies elke APP_WIFI_RECONNECT_INTERVAL_S (15 s) opnieuw proberen;
//   - na APP_WIFI_RESTART_AFTER_S (10 min) onafgebroken offline: esp_restart();
//   - elke poging, elk succes en elk falen wordt met reden gelogd (W7);
//   - status naar de gedeelde AppState (de UI leest die via een LVGL-timer).
#pragma once

#include <cstddef>
#include <cstdint>

#include "app_config.h"

enum class WifiScanState : uint8_t {
    Idle = 0,
    Busy,
    Done,
    Fail,
};

struct WifiScanAp {
    char ssid[APP_WIFI_SSID_MAX + 1] = "";
    int8_t rssi = 0;
    bool open = false;
};

struct WifiScanSnapshot {
    WifiScanState state = WifiScanState::Idle;
    int count = 0;
    char message[48] = "";
    WifiScanAp aps[APP_WIFI_SCAN_MAX];
};

// Fase 1: initialiseert NVS/esp_netif/event loop en de wifi-driver (STA) via bsp_wifi en registreert
// de eventhandlers. Verbindt nog NIET. ssid/pass: NVS (M3c) of secrets.h-fallback.
// Na deze aanroep is de TCP/IP-stack beschikbaar (nodig voor time_sync_init()).
void net_manager_init(const char* ssid, const char* pass);

// Fase 2: start de netwerktaak die verbindt en het reconnect-beleid uitvoert.
void net_manager_start();

// true zodra er een IP-adres is.
bool net_manager_is_connected();

// Scan en netwerkwissel: alleen een vlag zetten. Uitvoering in net_task / event loop
// (geen esp_wifi_* vanuit LVGL). Geen-op als wifi is overgeslagen (C6-skip).
void net_manager_request_scan();
void net_manager_scan_snapshot(WifiScanSnapshot* out);
// Leeg wachtwoord: huidig wachtwoord houden als de SSID gelijk blijft, anders open netwerk.
void net_manager_request_apply(const char* ssid, const char* pass);
void net_manager_current_ssid(char* out, size_t out_len);
bool net_manager_apply_pending();
