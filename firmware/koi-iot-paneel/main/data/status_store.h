// KOIoT Paneel - status_store: laatste geldige ha-status (RAM, brief §6.4 / A6).
//
// HTTP-taak schrijft hier. LVGL leest een snapshot. Geen LVGL in deze module.
#pragma once

#include <cstdint>

static constexpr int k_status_tasks_max = 24;
static constexpr int k_status_task_fields_max = 4;

enum class StatusTaskFieldKind : uint8_t {
    Number = 1,
    Text = 2,
    Choice = 3,
};

// Vaste keuzelijsten uit de pal-app (water_changes); geen vrije tekst.
enum class StatusTaskChoiceSet : uint8_t {
    None = 0,
    WaterType = 1,  // tap_water, well_water, rain_water, ro_water, mixed
    Reason = 2,     // routine, maintenance, problem, emergency, seasonal, other
};

// Invoerveld: ha-status fields/form/extra/payload, of pal-app-schema bij waterwissel.
struct StatusTaskField {
    char key[20] = "";
    char label[40] = "";
    char unit[12] = "";
    StatusTaskFieldKind kind = StatusTaskFieldKind::Number;
    StatusTaskChoiceSet choice_set = StatusTaskChoiceSet::None;
    bool required = true;
    bool must_be_positive = false;  // liters_added: > 0
};

enum class StatusFetchState : uint8_t {
    Never = 0,      // nog geen geslaagde fetch
    Fetching,
    Ok,
    TokenInvalid,   // 401
    Error,          // overige HTTP-/parsefout
};

enum class StatusPopup : uint8_t {
    None = 0,
    NoNetwork,
    ServerError,
    AlreadyClosed,
    TokenInvalid,
};

// Eén open taak uit ha-status (A6). Live: id, title, type, due_date, overdue, actions.
// Waterwissel (type/kind water_change of titel): pal-app-velden als ha-status geen schema heeft.
// Watermeting (type/kind water_parameters of titel watermeting / water controleren): pal-app ph/kh/nitrite/nitrate
// (max 4) als ha-status geen schema heeft. Overige taken: alleen invoer bij ha-status-schema.
// Knoppen alleen uit `actions` (§6.4).
struct StatusTask {
    char id[40] = "";
    char title[96] = "";
    char description[192] = "";
    char type[32] = "";         // A6; later ook `kind`
    char kind[32] = "";
    char severity[16] = "";     // later takenmodel; kleuraccent als aanwezig
    char due_date[16] = "";     // "YYYY-MM-DD"
    bool overdue = false;
    bool due_now = false;       // snapshot: overdue of due_date <= lokale SNTP-dag
    bool has_id = false;
    bool has_description = false;
    bool action_done = false;
    bool action_seen = false;
    bool action_dismissed = false;
    int field_count = 0;
    StatusTaskField fields[k_status_task_fields_max];
};

struct StatusSnapshot {
    StatusFetchState fetch = StatusFetchState::Never;
    bool has_data = false;              // ooit een geldig antwoord geparsed
    bool fetching = false;
    char error_detail[80] = "";
    int64_t fetched_at_unix = 0;        // laatste succes; 0 = geen
    int32_t data_age_s = -1;            // -1 = onbekend
    bool data_stale_warn = false;       // succes ouder dan 1 uur

    char season[40] = "";
    char season_since[40] = "";
    bool season_present = false;
    bool data_ok = true;
    bool data_ok_present = false;

    char feed_label[96] = "";
    bool feed_present = false;

    // Optioneel later takenmodel (§6.4 / §7.7): alleen tonen als ha-status ze levert.
    bool water_temp_24h_present = false;
    float water_temp_24h = 0;
    bool water_temp_week_present = false;
    float water_temp_week = 0;
    bool trend_present = false;
    char trend[32] = "";

    int open_tasks = 0;         // uit JSON: totaal open (inclusief later)
    int due_now_count = 0;      // badge: vandaag due of overdue, geen toekomst
    int task_count = 0;
    StatusTask tasks[k_status_tasks_max];

    bool latest_readings_seen = false;  // veld zat in het JSON
    bool close_busy = false;
    char close_task_id[40] = "";

    StatusPopup popup = StatusPopup::None;
    uint32_t popup_seq = 0;
};

void status_store_init();

// Parseert het ha-status-lichaam (tolerant: onbekende velden negeren).
// http_status 200 + geldige JSON zet has_data. 401 zet TokenInvalid zonder de lijst te wissen.
void status_store_apply_http(int http_status, const char* body, int body_len);

void status_store_set_fetching();
void status_store_set_network_error(const char* reason);
void status_store_set_http_error(int http_status, const char* reason);

void status_store_begin_close(const char* task_id);
void status_store_close_ok(const char* task_id);           // 2xx: taak uit de lijst
void status_store_close_already_closed();                  // 404 task_not_found / 409
void status_store_close_endpoint_missing();                // 404 zonder die error: knoppen blijven, melding
void status_store_close_token();                           // 401
void status_store_close_server_error();                    // 5xx
void status_store_close_network_error();
void status_store_close_abort();                           // lokale afbreking

void status_store_popup_ack(uint32_t seq);

// Vult *out (caller-buffer, bij voorkeur PSRAM). Nooit by-value teruggeven:
// StatusSnapshot is ~18 KB (24 taken + fields) en past niet op de Elecrow-LVGL-stack (16 KB).
void status_store_snapshot(StatusSnapshot* out);
bool status_store_is_close_busy();

// overdue, of due_date <= lokale SNTP-kalenderdag. Zonder tijd-sync: alleen overdue (R5, nooit 1970).
bool status_task_is_due_now(const StatusTask& t);
