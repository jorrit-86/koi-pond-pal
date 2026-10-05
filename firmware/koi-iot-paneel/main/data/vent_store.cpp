// KOIoT Paneel - vent_store (RAM-snapshot ventilatie).
#include "data/vent_store.h"

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static VentSnapshot s_snap;
static SemaphoreHandle_t s_mutex = nullptr;

void vent_store_init()
{
    if (s_mutex == nullptr) {
        s_mutex = xSemaphoreCreateMutex();
    }
    VentSnapshot empty;
    s_snap = empty;
}

void vent_store_set(const VentSnapshot& snap)
{
    if (s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_snap = snap;
    xSemaphoreGive(s_mutex);
}

VentSnapshot vent_store_snapshot()
{
    VentSnapshot copy;
    if (s_mutex == nullptr) {
        return copy;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    copy = s_snap;
    xSemaphoreGive(s_mutex);
    return copy;
}
