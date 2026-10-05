// KOIoT Paneel - ventilatiestand voor de UI (M1.6, brief §6.5 / §7.1).
//
// ha_client schrijft; LVGL leest een snapshot. Geen HTTP en geen LVGL hier.
#pragma once

#include <cstdint>

enum class VentKind : uint8_t {
    Unknown = 0,
    FanPreset,
    FanPercent,
    Select,
    InputSelect,
};

enum class VentUiState : uint8_t {
    Idle = 0,          // nog geen geldige HA-stand
    Ok,
    Pending,           // tik; wacht op bevestiging
    Unreachable,       // HA/wifi weg
    TokenInvalid,      // HTTP 401
    NoConfig,          // entity_id of HA_TOKEN ontbreekt (B7)
};

struct VentSnapshot {
    VentUiState ui = VentUiState::Idle;
    VentKind kind = VentKind::Unknown;
    int marked_stand = 0;     // interne 1/2/3 (= knop 0/1/2), of 0 = geen knop markeren
    int pending_stand = 0;    // interne 1/2/3 tijdens bezig
    char raw_label[40] = "";  // standtekst als die niet 0/1/2 is
    char message[72] = "";    // korte melding (fout / bezig)
    bool buttons_enabled = false;
    bool auto_configured = false;  // APP_HA_VENT_AUTO_ENTITY_ID gezet
    bool auto_known = false;       // minstens één geldige GET
    bool auto_on = false;
    bool auto_pending = false;
};

void vent_store_init();
void vent_store_set(const VentSnapshot& snap);
VentSnapshot vent_store_snapshot();
