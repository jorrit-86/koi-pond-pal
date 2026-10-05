// KOIoT Paneel - secrets (VOORBEELD).
//
// Kopieer dit bestand naar main/secrets.h en vul de echte waarden in.
// main/secrets.h staat in .gitignore en wordt nooit gecommit (W6).
//
// Wifi: ontwikkel-fallback. Vanaf M3c gaat een gekozen netwerk in NVS voor.
// MQTT: eigen niet-admin HA-account voor het paneel (beslissing B2).
// Vanaf M3d overschrijven Instellingen (NVS) host/poort/user/wachtwoord deze defaults.
#pragma once

#define WIFI_SSID   "JOUW_WIFI_SSID"
#define WIFI_PASS   "JOUW_WIFI_WACHTWOORD"

#define MQTT_USER   "koiiot_paneel"
#define MQTT_PASS   "CHANGE_ME"

// Apparaat-token van het paneel (app: label "KoiIoT touchpaneel", brief §6.4 / A9).
// Header: X-HA-Token (historische naam). Dit is GEEN Home Assistant-token: het is
// paneel-auth voor Supabase Edge Functions (device_tokens). Niet HA_TOKEN (M1.6).
// Vanaf M3e overschrijven Instellingen (NVS) dit token. Leeg Toepassen = huidig houden.
#define KOISENSEI_HA_TOKEN  "CHANGE_ME"

// Publieke anon-key (zelfde als pal-app / sensormodule). Niet gebruiken voor
// water_changes of water_parameters: REST eist user-JWT (RLS). Edge functions
// (ha-status, task-close, manual-measurement): alleen X-HA-Token. Geen service-role.
// Niet committen (secrets.h).
#define SUPABASE_ANON_KEY  "CHANGE_ME"

// Long-lived access token van HA-gebruiker koiiot_paneel (brief §6.5 / M1.6).
// Header: Authorization: Bearer <HA_TOKEN>. Niet KOISENSEI_HA_TOKEN (dat is
// het paneel-device-token voor Supabase). Jorrit vult dit in secrets.h; niet committen.
#define HA_TOKEN  "CHANGE_ME"
