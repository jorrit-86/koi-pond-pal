// KOIoT Paneel - gedeelde statusstruct (implementatie).
#include "core/app_state.h"

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static AppState s_state;
static SemaphoreHandle_t s_mutex = nullptr;

void app_state_init()
{
    if (s_mutex == nullptr) {
        s_mutex = xSemaphoreCreateMutex();
    }
}

AppState& app_state_lock()
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    return s_state;
}

void app_state_unlock()
{
    xSemaphoreGive(s_mutex);
}

AppState app_state_snapshot()
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    AppState copy = s_state;
    xSemaphoreGive(s_mutex);
    return copy;
}
