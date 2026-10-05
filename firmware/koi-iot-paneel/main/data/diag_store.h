// KOIoT Paneel - ringbuffer van recente MQTT-berichten (M1a-diagnose).
//
// MQTT-callbacks schrijven hier (eigen mutex). De LVGL-timer leest een snapshot.
// Geen topic-mapping: dat volgt in M1b nadat de seriële log de echte topics toont.
#pragma once

#include <cstddef>
#include <cstdint>

#include "app_config.h"

struct DiagEntry {
    char topic[APP_DIAG_TOPIC_MAX] = "";
    char payload[APP_DIAG_PAYLOAD_MAX] = "";
    uint16_t payload_len = 0;       // originele payloadlengte (kan groter zijn dan de kopie)
    bool payload_truncated = false;
    int64_t recv_us = 0;            // esp_timer_get_time() bij ontvangst
};

struct DiagSnapshot {
    uint32_t total_count = 0;       // totaal ontvangen sinds boot
    bool got_data = false;          // false tot de eerste publish (B5: niet van retained uitgaan)
    size_t entry_count = 0;
    DiagEntry entries[APP_DIAG_STORE_CAPACITY];  // index 0 = nieuwste
};

void diag_store_init();

// topic/payload hoeven niet '\0'-terminated te zijn; lengtes zijn leidend.
void diag_store_push(const char* topic, size_t topic_len,
                     const char* payload, size_t payload_len);

DiagSnapshot diag_store_snapshot();
