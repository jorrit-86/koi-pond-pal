// KOIoT Paneel - runtime-instellingen in NVS.
// M1.7: sectie Scherm. M3a: vijverinhoud. M3c: wifi SSID/wachtwoord.
// M3d: MQTT host/poort/user/wachtwoord. M3e: device-token (X-HA-Token).
// M3f: OTA-URL. NVS gaat voor op app_config.h / secrets.h.
#pragma once

#include <cstddef>
#include <cstdint>

#include "app_config.h"

struct ScreenSettings {
    uint32_t t1_s = 300;             // Actief -> Rust; default 5 min
    uint32_t t2_s = 1800;            // Rust -> Uit; 0 = nooit; default 30 min
    uint8_t brightness_active = 80;  // 1-100, default 80%
    uint8_t brightness_idle = 15;    // 1-100, default 15%
    bool idle_screen_enabled = true; // uit: Actief na T1 direct naar Uit
};

void settings_store_init();
ScreenSettings settings_store_screen();
void settings_store_set_screen(const ScreenSettings& in);

uint32_t settings_store_pond_volume_l();
void settings_store_set_pond_volume_l(uint32_t liters);

// true = NVS heeft een SSID (runtime gaat voor secrets.h). Wachtwoord nooit loggen.
bool settings_store_wifi_get(char* ssid, size_t ssid_len, char* pass, size_t pass_len);
void settings_store_set_wifi(const char* ssid, const char* pass);

// Effectieve MQTT-instellingen: NVS als die er is, anders app_config.h / secrets.h.
struct MqttRuntimeSettings {
    char host[APP_MQTT_HOST_MAX + 1] = "";
    uint16_t port = MQTT_BROKER_PORT;
    char user[APP_MQTT_USER_MAX + 1] = "";
    char pass[APP_MQTT_PASS_MAX + 1] = "";
    bool from_nvs = false;
};

MqttRuntimeSettings settings_store_mqtt();
// Leeg wachtwoord houdt het huidige (NVS of secrets-fallback). Host verplicht.
void settings_store_set_mqtt(const char* host, uint16_t port, const char* user, const char* pass);

// Effectief device-token: NVS als die er is, anders secrets.h. Nooit het hele token loggen.
bool settings_store_token_ok();
bool settings_store_token_from_nvs();
void settings_store_token_copy(char* out, size_t out_len);
// Masker voor de UI: **** + laatste 4, of "(leeg)" / "(niet gezet)".
void settings_store_token_mask(char* out, size_t out_len);
// Leeg token houdt het huidige (NVS of secrets-fallback).
void settings_store_set_token(const char* token);

// OTA HTTPS-URL. Leeg bij set = huidige URL houden. Default leeg (compile-time).
void settings_store_ota_url_copy(char* out, size_t out_len);
void settings_store_set_ota_url(const char* url);
