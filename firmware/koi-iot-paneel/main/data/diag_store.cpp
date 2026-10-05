// KOIoT Paneel - diagnosestore (implementatie).
#include "data/diag_store.h"

#include <cstring>

#include "esp_heap_caps.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static DiagEntry* s_entries = nullptr;
static size_t s_head = 0;           // volgende schrijfpositie
static size_t s_filled = 0;
static uint32_t s_total = 0;
static SemaphoreHandle_t s_mutex = nullptr;

static void copy_field(char* dst, size_t dst_size, const char* src, size_t src_len, bool* truncated)
{
    if (dst_size == 0) {
        return;
    }
    size_t n = src_len;
    if (n >= dst_size) {
        n = dst_size - 1;
        if (truncated) {
            *truncated = true;
        }
    }
    if (src != nullptr && n > 0) {
        memcpy(dst, src, n);
    }
    dst[n] = '\0';
    // Nieuwe regels maken de UI-lijst onleesbaar
    for (size_t i = 0; i < n; i++) {
        const unsigned char c = static_cast<unsigned char>(dst[i]);
        if (c < 32 || c == 127) {
            dst[i] = '?';
        }
    }
}

void diag_store_init()
{
    if (s_mutex == nullptr) {
        s_mutex = xSemaphoreCreateMutex();
    }
    if (s_entries == nullptr) {
        s_entries = static_cast<DiagEntry*>(
            heap_caps_calloc(APP_DIAG_STORE_CAPACITY, sizeof(DiagEntry),
                             MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    }
}

void diag_store_push(const char* topic, size_t topic_len,
                     const char* payload, size_t payload_len)
{
    if (s_mutex == nullptr || s_entries == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);

    DiagEntry& e = s_entries[s_head];
    e = DiagEntry{};
    bool topic_trunc = false;
    copy_field(e.topic, sizeof(e.topic), topic, topic_len, &topic_trunc);
    e.payload_truncated = false;
    copy_field(e.payload, sizeof(e.payload), payload, payload_len, &e.payload_truncated);
    e.payload_len = (payload_len > 0xFFFF) ? 0xFFFF : static_cast<uint16_t>(payload_len);
    e.recv_us = esp_timer_get_time();
    if (topic_trunc) {
        e.payload_truncated = true;
    }

    s_head = (s_head + 1) % APP_DIAG_STORE_CAPACITY;
    if (s_filled < APP_DIAG_STORE_CAPACITY) {
        s_filled++;
    }
    s_total++;

    xSemaphoreGive(s_mutex);
}

DiagSnapshot diag_store_snapshot()
{
    DiagSnapshot snap;
    if (s_mutex == nullptr || s_entries == nullptr) {
        return snap;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    snap.total_count = s_total;
    snap.got_data = (s_total > 0);
    snap.entry_count = s_filled;

    // Nieuwste eerst: s_head - 1, s_head - 2, ...
    for (size_t i = 0; i < s_filled; i++) {
        const size_t idx = (s_head + APP_DIAG_STORE_CAPACITY - 1 - i) % APP_DIAG_STORE_CAPACITY;
        snap.entries[i] = s_entries[idx];
    }
    xSemaphoreGive(s_mutex);
    return snap;
}
