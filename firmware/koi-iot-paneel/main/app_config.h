// KOIoT Paneel - compile-time defaults (brief par. 10).
// Runtime-instellingen in NVS (settings_store) gaan voor op deze waarden.
#pragma once

// Firmware-identificatie
#define APP_FW_NAME              "koi-iot-paneel"
#define APP_FW_VERSION           "0.3.0-m3f"
#define APP_HW_VERSION           "CrowPanel Advanced 10.1 ESP32-P4 V1.2"

// panel_id: "KOIoT-P-XXXXXX" (laatste 3 bytes van de eFuse-basis-MAC van de P4, zie ARCHITECTUUR.md)
#define APP_PANEL_ID_PREFIX      "KOIoT-P-"

// Tijd (R5)
#define APP_SNTP_SERVER          "pool.ntp.org"
#define APP_TIMEZONE             "CET-1CEST,M3.5.0,M10.5.0/3"
// Na deze tijd zonder SNTP-sync (met netwerk) wordt een waarschuwing gelogd
#define APP_SNTP_WARN_AFTER_S    60

// Wifi runtime (M3c, §7.4). NVS gaat voor op secrets.h. Geen lv_keyboard.
#define APP_WIFI_NVS_NS                  "wifi"
#define APP_WIFI_NVS_SSID                "ssid"
#define APP_WIFI_NVS_PASS                "pass"
#define APP_WIFI_SSID_MAX                32
#define APP_WIFI_PASS_MAX                64
#define APP_WIFI_SCAN_MAX                12

// Wifi-reconnect (R1)
#define APP_WIFI_RECONNECT_INTERVAL_S    15      // elke 15 s opnieuw proberen
#define APP_WIFI_RESTART_AFTER_S         600     // 10 min onafgebroken zonder verbinding -> esp_restart()
// Hosted 2.7.0 mag de P4 herstarten bij C6/SDIO-fout. Na zo'n fail: wifi/MQTT
// overslaan tot POWERON (beide USB-C). Geen 8 s retry — dat triggert hosted-self-reset.
// Om de zoveel mislukte pogingen een volledige wifi-herstart (stop/start van de driver via de C6)
#define APP_WIFI_FULL_RESTART_EVERY_N    8
// Periode waarmee RSSI wordt bijgewerkt zolang verbonden
#define APP_WIFI_RSSI_POLL_S             5

// UI
#define APP_UI_REFRESH_MS        250     // LVGL-timer die de gedeelde status naar het scherm brengt
#define APP_UI_BACKLIGHT_PERCENT 80      // fallback als NVS ontbreekt (M1.7 default actief)

// Energiestand / rustscherm (M1.7, brief §7.6). Runtime in NVS (settings_store).
#define APP_SCREEN_NVS_NS        "scr"
#define APP_SCREEN_NVS_T1        "t1"
#define APP_SCREEN_NVS_T2        "t2"
#define APP_SCREEN_NVS_BR_ACT    "ba"
#define APP_SCREEN_NVS_BR_IDLE   "bi"
#define APP_SCREEN_NVS_IDLE_ON   "idle"
#define APP_SCREEN_IDLE_SHIFT_S  120     // rustscherm-blok max ±60 px, geen animatie

// Vijverinhoud (M3, §7.4; nodig voor M4). Runtime in NVS (settings_store).
#define APP_POND_NVS_NS          "pond"
#define APP_POND_NVS_VOL         "vol"
#define APP_POND_VOLUME_L        13500
#define APP_POND_VOL_MIN_L       1000
#define APP_POND_VOL_MAX_L       100000

// MQTT. Compile-time defaults; NVS (M3d, Instellingen) gaat voor op host/poort/user/wachtwoord.
#define MQTT_BROKER_HOST         "192.168.178.58"
#define MQTT_BROKER_PORT         1883
#define MQTT_DEVICE_ID           "KOIoT-57226C"
#define MQTT_TOPIC_PREFIX        "koiiot"
#define APP_MQTT_BUFFER_SIZE     2048
#define APP_MQTT_KEEPALIVE_S     60
#define APP_MQTT_RECONNECT_MS    10000
#define APP_MQTT_TASK_STACK      8192
#define APP_MQTT_NVS_NS          "mqtt"
#define APP_MQTT_NVS_HOST        "host"
#define APP_MQTT_NVS_PORT        "port"
#define APP_MQTT_NVS_USER        "user"
#define APP_MQTT_NVS_PASS        "pass"
#define APP_MQTT_HOST_MAX        64
#define APP_MQTT_USER_MAX        32
#define APP_MQTT_PASS_MAX        64

// Diagnoselog (M1a): recente ruwe berichten (mqtt_link blijft alles loggen)
#define APP_DIAG_STORE_CAPACITY  10
#define APP_DIAG_TOPIC_MAX       96
#define APP_DIAG_PAYLOAD_MAX     80

// Verouderd (brief §6.1): last_update per veld; drempels instelbaar
#define APP_STALE_TEMP_S         (30 * 60)   // watertemp, luchttemp, RV, pH
#define APP_STALE_FLOW_S         60          // flow_rate, flow_total, flow_leak

// NVS-namespace voor de middernachtstand van flow_total ("vandaag"-liter)
#define APP_LIVE_NVS_NS          "live"
#define APP_LIVE_NVS_MID_L       "mid_l"
#define APP_LIVE_NVS_MID_YMD     "mid_ymd"

// Backend ha-status / task-close (M1.5, brief §6.4)
#define APP_BACKEND_BASE_URL     "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/"
#define APP_HA_STATUS_PATH       "ha-status"
#define APP_TASK_CLOSE_PATH      "task-close"
// 24 u-reeks: zelfde function, query history=1. Geen /rest/v1/sensor_data (RLS/user-JWT).
#define APP_HA_HISTORY_QUERY     "ha-status?history=1&interval=300"
// Geen REST /rest/v1/water_changes: RLS eist user-JWT. Waterwissel via task-close.
#define APP_HA_STATUS_POLL_S     (15 * 60)
#define APP_MQTT_DB_FALLBACK_S   (5 * 60)    // MQTT >5 min weg: nieuwere DB-waarden overnemen
#define APP_STATUS_STALE_WARN_S  3600        // "bijgewerkt om" oranje na 1 uur
#define APP_HTTP_TIMEOUT_MS      10000
#define APP_HTTP_RESP_MAX        16384
#define APP_HTTP_HIST_MAX        49152       // compacte 24 u-reeks (max 5 x 288 punten)
#define APP_BACKEND_TASK_STACK   16384
#define APP_BACKEND_TASK_PRIO    4
// Device-token (X-HA-Token / KOISENSEI_HA_TOKEN). NVS gaat voor op secrets.h.
#define APP_TOKEN_NVS_NS         "back"
#define APP_TOKEN_NVS_KEY        "token"
#define APP_TOKEN_MAX            128

// Home Assistant REST (M1.6, brief §6.5). Lokaal netwerk: HTTP, geen HTTPS.
#define APP_HA_BASE_URL              "http://192.168.178.58:8123"
#define APP_HA_VENT_POLL_FAST_S      10     // Overzicht in beeld
#define APP_HA_VENT_POLL_SLOW_S      60     // ander scherm
#define APP_HA_VENT_CONFIRM_MS       10000  // tik: terug naar echte stand als geen bevestiging
#define APP_HA_HTTP_RESP_MAX         4096
#define APP_HA_TASK_STACK            8192
#define APP_HA_TASK_PRIO             4

// Koppeling interne stand 1/2/3 ↔ HA-percentage: alleen hier, niet verspreid (brief §6.5).
// UI-knoppen tonen 0 / 1 / 2 (0 = uit). Percentages ongewijzigd: 0 / 50 / 100.
// APP_HA_VENT_KIND: 0=auto uit GET, 1=fan preset, 2=fan %, 3=select, 4=input_select.
// B7 (30 sep 2026): fan.ventilatie, supported_features 49 = SET_SPEED+TURN_ON+TURN_OFF,
// geen PRESET_MODE. State off → 0%. 0% zetten via fan.turn_off, 50/100 via set_percentage.
#define APP_HA_VENT_ENTITY_ID        "fan.ventilatie"
#define APP_HA_VENT_KIND             2
#define APP_HA_VENT_VALUE_1          "0"     // knop 0, turn_off
#define APP_HA_VENT_VALUE_2          "50"    // knop 1, set_percentage
#define APP_HA_VENT_VALUE_3          "100"   // knop 2, set_percentage

// Automatische ventilatie: input_boolean.ventilatie_automatisch (Jorrit, 30 sep 2026).
// Niet preset_mode op fan.ventilatie. GET /api/states/… (on/off);
// POST /api/services/input_boolean/turn_on of turn_off. Domein uit entity-prefix.
#define APP_HA_VENT_AUTO_ENTITY_ID   "input_boolean.ventilatie_automatisch"
#define APP_HA_VENT_AUTO_ON_SERVICE  "turn_on"
#define APP_HA_VENT_AUTO_OFF_SERVICE "turn_off"
#define APP_HA_VENT_IDLE_TIMEOUT_S   15     // Idle na net-up: geen eeuwige "wacht op HA"

// UI-layout (1024x600). Tegels: 4 kolommen, 2 rijen, zelfde marge/gap.
#define APP_UI_SCREEN_W          1024
#define APP_UI_SCREEN_H          600
#define APP_UI_STATUS_H          48
#define APP_UI_BANNER_H          36
#define APP_UI_NAV_H             72
#define APP_UI_GRID_MARGIN       12
#define APP_UI_GRID_GAP          12
#define APP_UI_GRID_COLS         4
#define APP_UI_GRID_ROWS         2

// Meetgegevens-pop-up (M1.8, brief §7.7): lokale ringbuffer 24 u, 1 punt / 5 min.
#define APP_HIST_INTERVAL_S      (5 * 60)
#define APP_HIST_POINTS          (24 * 60 / 5)   // 288
#define APP_MEASURE_POPUP_PCT    70              // breedte t.o.v. scherm

// Handmatige metingen (M2, brief §6.3 / R3)
#define APP_MEAS_NVS_NS          "meas"
#define APP_MEAS_NVS_Q           "q"
#define APP_MEAS_NVS_MOCK        "mock"
// Geen REST /rest/v1/water_parameters (RLS eist user-JWT). Live-POST gebruikt
// X-HA-Token, zelfde als ha-status/task-close. MOCK blijft een Instellingen-toggle.
#define APP_MANUAL_PATH          "manual-measurement"
#define APP_UPLOAD_BACKOFF_MIN_S 10
#define APP_UPLOAD_BACKOFF_MAX_S (10 * 60)
#define APP_MEAS_TILE_H          110             // extra rijen op Overzicht (scroll)

// OTA + rollback (M3f, R8). HTTPS-URL in NVS; leeg = vorige houden.
// CMake project() = koi_iot_paneel: dat staat in de image-header, niet APP_FW_NAME.
#define APP_OTA_NVS_NS           "ota"
#define APP_OTA_NVS_URL          "url"
#define APP_OTA_URL_MAX          256
#define APP_OTA_URL_DEFAULT      ""
#define APP_OTA_PROJECT_NAME     "koi_iot_paneel"
#define APP_OTA_TASK_STACK       16384
#define APP_OTA_TASK_PRIO        4
#define APP_OTA_HTTP_TIMEOUT_MS  30000

// Netwerktaak
#define APP_NET_TASK_STACK       6144
#define APP_NET_TASK_PRIO        5
#define APP_NET_TASK_TICK_MS     1000
