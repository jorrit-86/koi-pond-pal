// KOIoT Paneel - herbruikbare meetgegevens-pop-up (M1.8, brief §7.7).
#pragma once

#include <cstdint>

#include "lvgl.h"

struct LiveSnapshot;
struct StatusSnapshot;

enum class MeasureKind : uint8_t {
    None = 0,
    WaterTemp,
    AirTemp,
    Humidity,
    Ph,
    Flow,
    Manual,
};

void screen_measure_create(lv_obj_t* parent);
void screen_measure_open(MeasureKind kind);
void screen_measure_open_manual(int param_idx);          // laatste waarde
void screen_measure_open_record(const struct MeasItem* item);  // historie-regel
void screen_measure_close();  // Sluiten, tik ernaast, of T1 (§7.6)
void screen_measure_update(const LiveSnapshot& live, const StatusSnapshot& app);
bool screen_measure_is_open();
