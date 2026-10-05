// KOIoT Paneel - MQTT-client (lezen + loggen + live_store).
//
// Abonneert op koiiot/<MQTT_DEVICE_ID>/# zodra de brokerverbinding staat.
// Callbacks raken LVGL nooit aan: status -> AppState, ruwe log -> diag_store,
// gemapte payloads -> live_store.
#pragma once

#include <cstddef>
#include <cstdint>

// Maakt de esp-mqtt-client (nog geen verbinding). Vereist: event-loop uit net_manager_init,
// panel_id al gezet. Start pas via mqtt_link_on_network_up().
void mqtt_link_init();

// Wifi heeft een IP: client starten of na een stop opnieuw starten.
void mqtt_link_on_network_up();

// Wifi weg: client stoppen zodat we niet zonder netwerk op de broker hameren.
void mqtt_link_on_network_down();

bool mqtt_link_is_connected();

// Runtime MQTT (M3d): alleen een vlag zetten. Uitvoering in net_task (nooit vanuit LVGL).
// Leeg wachtwoord = huidig houden. Toepassen zonder wijziging reconnect alsnog.
void mqtt_link_request_apply(const char* host, uint16_t port, const char* user, const char* pass);
bool mqtt_link_apply_pending();
// true als er iets is toegepast (net_task start daarna opnieuw als wifi-IP er is).
bool mqtt_link_process_apply();
void mqtt_link_current(char* host, size_t host_len, uint16_t* port, char* user, size_t user_len);

// true als er geen brokerverbinding is (of nooit was) gedurende minstens `seconds`.
bool mqtt_link_disconnected_over_s(int32_t seconds);

// HA-switch "Paneelscherm" (M1.7). ON als Actief of Rust, OFF als Uit. No-op zonder broker.
void mqtt_link_publish_screen_state(bool on);

// M2: discovery + retained state/attr per catalogus-parameter, plus diagnostiek.
void mqtt_link_publish_manual_state(const char* key, float value, const char* unit,
                                    int64_t measured_at, const char* uploadstatus);
void mqtt_link_publish_diagnostics();
void mqtt_link_republish_manual();  // discovery + laatste waarden (na MQTT-connect)
