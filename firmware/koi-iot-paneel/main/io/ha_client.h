// KOIoT Paneel - generieke Home Assistant REST-client (M1.6, brief §6.5).
//
// Eigen FreeRTOS-taak. LVGL zet alleen een opdracht op de queue (geen HTTP in
// LVGL). Dezelfde client is later de backend voor HaSwitchActuator (M4).
#pragma once

void ha_client_init();
void ha_client_start();

void ha_client_on_network_up();
void ha_client_on_network_down();

// Overzicht in beeld: poll elke 10 s, anders 60 s (brief §6.5).
void ha_client_set_fast_poll(bool overview_visible);

// UI: niet-blokkerend; nooit HTTP in de LVGL-callback.
void ha_client_request_poll();
void ha_client_request_set_stand(int stand);  // interne 1/2/3 (= UI-knop 0/1/2)
void ha_client_request_set_auto(bool on);     // automatische stand; no-op zonder entity

// Generiek (ook M4). Alleen aanroepen vanuit de ha-taak / automation_runner.
// body mag NULL zijn als het antwoord niet nodig is. http_status: 0 bij netwerkfout.
int ha_client_http_get_state(const char* entity_id, char* body, int cap, int* http_status);
int ha_client_http_call_service(const char* domain, const char* service, const char* json_body,
                                char* body, int cap, int* http_status);
