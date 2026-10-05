// KOIoT Paneel - gedeelde statusstruct tussen netwerk-/tijdtaken en de UI.
//
// Regel: de netwerktaak en eventhandlers SCHRIJVEN via app_state_lock()/unlock(),
// de LVGL-timer LEEST een kopie via app_state_snapshot(). Zo raken netwerk en
// LVGL elkaar nooit direct (brief par. 5, threading).
#pragma once

#include <cstdint>

enum class WifiStatus : uint8_t {
    Idle = 0,        // nog niet gestart
    Connecting,      // verbindingspoging loopt
    Connected,       // geassocieerd EN IP-adres ontvangen
    Disconnected,    // verbinding verloren / poging mislukt, wacht op volgende poging
    WaitPowerCycle,  // hosted-fail; wifi/MQTT uit tot POWERON (beide USB-C)
};

enum class MqttStatus : uint8_t {
    Idle = 0,        // wacht op wifi
    Connecting,      // start, reconnect of BEFORE_CONNECT
    Connected,       // brokerverbinding staat
    Disconnected,    // ontkoppeld (wifi weg of broker weg)
    Error,           // fout; mqtt_error bevat de reden
};

struct AppState {
    // Identiteit
    char panel_id[16] = "KOIoT-P-??????";

    // Wifi
    WifiStatus wifi = WifiStatus::Idle;
    char ssid[33] = "";
    char ip[16] = "";
    int8_t rssi = 0;
    uint32_t connect_attempts = 0;      // totaal aantal verbindingspogingen sinds boot
    int last_disconnect_reason = 0;     // wifi_err_reason_t van de laatste disconnect (0 = geen)
    int32_t next_retry_in_s = -1;       // seconden tot volgende poging (-1 = n.v.t.)
    int32_t offline_for_s = 0;          // seconden onafgebroken zonder verbinding (0 = verbonden)

    // Tijd
    bool time_synced = false;

    // MQTT-status voor de statusbalk; live waarden staan in live_store
    MqttStatus mqtt = MqttStatus::Idle;
    char mqtt_error[48] = "";
};

void app_state_init();

// Schrijftoegang (kort houden!)
AppState& app_state_lock();
void app_state_unlock();

// Leest een consistente kopie
AppState app_state_snapshot();
