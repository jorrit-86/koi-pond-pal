// KOIoT Paneel - live_store: MQTT-suffix -> veld (enige mappingtabel, brief §6.1).
//
// MQTT-callbacks schrijven hier (eigen mutex). De LVGL-timer leest een snapshot.
// Geen LVGL in deze module.
#pragma once

#include <cstddef>
#include <cstdint>

// Eén rij in de mappingtabel. Nieuwe topics alleen hier toevoegen (niet verspreid).
enum class LiveField : uint8_t {
    Status = 0,     // bevestigd: "online" (retained)
    FlowRate,       // bevestigd: L/min
    FlowTotal,      // bevestigd: L cumulatief sinds ingebruikname
    FlowLeak,       // bevestigd: ON/OFF
    Humidity,       // bevestigd: RV % (humidity)
    WaterTemp,      // bevestigd: water_temp, 1 decimaal
    AirTemp,        // bevestigd: air_temp, 1 decimaal
    Ph,             // geen bevestigde suffix (nog niet gezien)
    Count
};

struct LiveFieldSnap {
    bool present = false;       // ooit een geldige waarde ontvangen
    bool stale = false;         // present en ouder dan de drempel
    int32_t age_s = -1;         // seconden sinds meettijdstip; -1 = nooit/onbekend
    int64_t measured_at_unix = 0; // 0 = onbekend; lokale weergave in de pop-up
    double value = 0;           // numeriek (temp, RV, pH, debiet)
    bool on = false;            // alleen flow_leak
    char text[24] = "";         // alleen status
    bool from_database = false; // true zolang de tegel een ha-status-waarde toont
    char sensor_id[24] = "";    // uit latest_readings, leeg als onbekend
};

struct LiveSnapshot {
    LiveFieldSnap status;
    LiveFieldSnap water_temp;
    LiveFieldSnap air_temp;
    LiveFieldSnap humidity;
    LiveFieldSnap ph;
    LiveFieldSnap flow_rate;
    LiveFieldSnap flow_total;
    LiveFieldSnap flow_leak;
    bool today_ok = false;      // baseline + tijd synchroon + flow_total aanwezig
    float today_l = 0;          // flow_total minus middernachtstand
    bool leak_alarm = false;    // laatste flow_leak == ON (ook als verouderd)
};

void live_store_init();

// topic/payload hoeven niet '\0'-terminated te zijn; lengtes zijn leidend.
// Onbekende suffix: eenmalige logregel "ongemapped topic" (geen harde fout).
void live_store_apply(const char* topic, size_t topic_len,
                      const char* payload, size_t payload_len,
                      bool retain);

// Startwaarde/terugval uit ha-status latest_readings (brief §6.4).
// Age vanaf measured_at (unix UTC). mqtt_down_over_5min: nieuwere DB mag MQTT vervangen.
void live_store_apply_db(LiveField field, double value, int64_t measured_at_unix,
                         const char* sensor_id, bool mqtt_down_over_5min);

LiveSnapshot live_store_snapshot();

// 24 u-reeks uit ha-status?history=1 (sensor_data, gebucket per 5 min).
// n==0: bestaande buffer laten (MQTT sinds opstart). Geen LVGL.
void live_store_load_history(LiveField field, const float* vals, int n,
                             int64_t first_unix, int64_t last_unix);

// Ringbuffer 24 u / 5 min (M1.8). dst mag nullptr zijn (alleen statistiek).
// Terug: aantal punten (oudste eerst). Geen LVGL. dst in PSRAM of static, niet op de LVGL-stack.
int live_store_history_copy(LiveField field, float* dst, int dst_max,
                            float* min_v, float* max_v, float* avg_v,
                            int64_t* first_unix, bool* from_db = nullptr);
