// KOIoT Paneel - catalogus handmatige metingen (brief §8). Eén tabel.
// Sleutels en eenheden zoals in de brief (startwaarden; B6 nog open).
#pragma once

#include <cstdint>
#include <cstddef>

static constexpr int k_param_count = 8;
static constexpr int k_param_units_max = 2;

struct ParamDef {
    const char* key;          // API: kh, gh, tan, nitriet, ...
    const char* label;        // UI, ASCII (Montserrat)
    const char* units[k_param_units_max];
    int unit_count;
    float range_min[k_param_units_max];
    float range_max[k_param_units_max];
    float step[k_param_units_max];
    float warn_min[k_param_units_max];
    float warn_max[k_param_units_max];
    bool has_warn[k_param_units_max];
    int decimals[k_param_units_max];
    int shelf_days;           // 0 = geen houdbaarheid (zout)
    int warn_days_left;       // oranje als resterend <= dit (0 = n.v.t.)
};

const ParamDef* param_catalog_get(int idx);
int param_catalog_count();
int param_catalog_index_of(const char* key);

enum class Freshness : uint8_t {
    None = 0,     // geen houdbaarheid
    Fresh,
    Soon,
    Expired,
    Unknown,      // geen meettijd
};

Freshness param_freshness(int idx, int64_t measured_at_unix, int64_t now_unix,
                          int32_t* days_left_out);
