// KOIoT Paneel - NVS-wachtrij handmatige metingen (M2, R3/R4).
// Compacte blob (max 200). LVGL leest snapshots; netwerktaak schrijft.
#pragma once

#include <cstdint>
#include <cstddef>

#include "data/param_catalog.h"

enum class MeasStatus : uint8_t {
    Queued = 0,
    Uploaded = 1,
    Rejected = 2,
};

struct MeasItem {
    char client_id[37] = "";
    uint8_t param = 0;
    uint8_t unit = 0;
    MeasStatus status = MeasStatus::Queued;
    float value = 0;
    int64_t measured_at = 0;   // 0 = weglaten in JSON (geen SNTP)
    int64_t queued_at = 0;
    char reject[40] = "";
};

static constexpr int k_meas_queue_max = 200;
static constexpr int k_meas_history_n = 50;

struct MeasLast {
    bool present = false;
    bool from_app = false;     // latest_measurements i.p.v. dit paneel
    uint8_t unit = 0;
    float value = 0;
    int64_t measured_at = 0;
    MeasStatus status = MeasStatus::Queued;
};

struct MeasSnapshot {
    int count = 0;
    int pending = 0;           // nog niet geüpload (Queued)
    int history_n = 0;
    MeasItem history[k_meas_history_n];  // nieuwste eerst
    MeasLast last[k_param_count];
    bool mock = true;
};

void measurement_queue_init();  // NVS; klein, geen DMA. Voor wifi.

bool measurement_queue_enqueue(int param, int unit, float value, int64_t measured_at,
                               char* client_id_out, size_t client_id_len);

// Uploader (backend-taak): volgende Queued, of nullptr.
const MeasItem* measurement_queue_next_pending();
void measurement_queue_mark_uploaded(const char* client_id);
void measurement_queue_mark_rejected(const char* client_id, const char* reason);

void measurement_queue_set_mock(bool on);
bool measurement_queue_mock();

void measurement_queue_set_unit_pref(int param, int unit);
int measurement_queue_unit_pref(int param);

// Optioneel latest_measurements uit ha-status (A6 later). Ontbreekt = eigen invoer.
void measurement_queue_apply_latest_json(const char* body);

void measurement_queue_snapshot(MeasSnapshot* out);

int measurement_queue_pending_count();
bool measurement_queue_get(const char* client_id, MeasItem* out);
bool measurement_queue_get_last(int param, MeasItem* out);
