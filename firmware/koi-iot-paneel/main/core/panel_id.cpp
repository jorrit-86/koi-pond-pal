// KOIoT Paneel - panel_id uit de eFuse-basis-MAC van de P4.
#include "core/panel_id.h"

#include <cstdio>
#include <cstring>

#include "esp_log.h"
#include "esp_mac.h"

#include "app_config.h"
#include "core/app_state.h"

static const char* TAG = "panel_id";
static char s_panel_id[16] = APP_PANEL_ID_PREFIX "??????";

void panel_id_init()
{
    uint8_t mac[6] = {0};
    // Basis-MAC uit eFuse BLK1 van de P4 zelf: beschikbaar zonder wifi/C6, fabrieksmatig en stabiel.
    esp_err_t err = esp_efuse_mac_get_default(mac);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "eFuse-basis-MAC lezen mislukt: %s (0x%x); panel_id blijft %s",
                 esp_err_to_name(err), err, s_panel_id);
        return;
    }
    snprintf(s_panel_id, sizeof(s_panel_id), APP_PANEL_ID_PREFIX "%02X%02X%02X", mac[3], mac[4], mac[5]);
    ESP_LOGI(TAG, "eFuse-basis-MAC P4 = %02X:%02X:%02X:%02X:%02X:%02X -> panel_id = %s",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5], s_panel_id);

    AppState& st = app_state_lock();
    strncpy(st.panel_id, s_panel_id, sizeof(st.panel_id) - 1);
    st.panel_id[sizeof(st.panel_id) - 1] = '\0';
    app_state_unlock();
}

const char* panel_id_get()
{
    return s_panel_id;
}
