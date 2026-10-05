// KOIoT Paneel - HTTPS naar Supabase (ha-status, task-close, manual-measurement).
//
// Eigen FreeRTOS-taak. LVGL zet alleen een opdracht op de queue (brief §5).
#pragma once

void backend_client_init();
void backend_client_start();

// Wifi heeft een IP: ha-status ophalen. Wifi weg: geen fetches, RAM-lijst blijft.
void backend_client_on_network_up();
void backend_client_on_network_down();

// Extra POST-velden (pal-app waterwissel/watermeting of ha-status-schema). A7: task_id,
// status, optioneel note. Waterwissel: één POST task-close (X-HA-Token = paneel-device-
// token, geen Home Assistant, geen user-JWT). Geen REST /rest/v1/water_changes (RLS).
// Function insert water_changes (user_id uit device_tokens) en sluit de taak.
// Numbers als JSON-getal (punt).
static constexpr int k_backend_close_fields_max = 4;

struct BackendCloseField {
    char key[20];
    char value[24];
    bool is_number;
};

// Opdrachten vanaf de UI (niet-blokkerend; nooit HTTP in de LVGL-callback).
void backend_client_request_fetch();
void backend_client_request_history();
void backend_client_request_upload();  // M2: volgende meting uit de wachtrij
void backend_client_request_close(const char* task_id, const char* status,
                                  const char* note,
                                  const BackendCloseField* fields, int field_n,
                                  const char* task_title = nullptr);
