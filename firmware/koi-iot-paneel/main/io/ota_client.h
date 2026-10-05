// KOIoT Paneel - HTTPS OTA met rollback (M3f, R8).
//
// Eigen FreeRTOS-taak. LVGL zet alleen een vlag; geen HTTP/OTA in LVGL.
// UI leest voortgang via ota_client_snapshot(). Hosted/C6 wordt niet geüpdatet.
#pragma once

#include <cstddef>
#include <cstdint>

enum class OtaState : uint8_t {
    Idle = 0,
    Starting,
    Downloading,
    Verifying,
    Success,
    Error,
};

struct OtaSnapshot {
    OtaState state = OtaState::Idle;
    int progress_pct = -1;   // -1 = onbekend
    int64_t bytes = 0;
    int64_t total = 0;
    char message[96] = "";
    char running_part[12] = "";
    char new_version[32] = "";
};

void ota_client_init();
void ota_client_start();

// Na geslaagde boot (UI klaar): PENDING_VERIFY → geldig, anders rollback bij crash.
void ota_client_confirm_running();

// UI: start download/install (niet-blokkerend).
void ota_client_request_install();

void ota_client_snapshot(OtaSnapshot* out);
bool ota_client_is_busy();
void ota_client_running_partition_name(char* out, size_t out_len);
