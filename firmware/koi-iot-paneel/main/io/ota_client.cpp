// KOIoT Paneel - HTTPS OTA (esp_https_ota) + rollback-bevestiging.
#include "io/ota_client.h"

#include <cstdio>
#include <cstring>

#include "esp_app_desc.h"
#include "esp_crt_bundle.h"
#include "esp_heap_caps.h"
#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_http_client.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include "app_config.h"
#include "core/app_state.h"
#include "core/settings_store.h"

static const char* TAG = "ota";

static SemaphoreHandle_t s_mutex = nullptr;
static TaskHandle_t s_task = nullptr;
static volatile bool s_request = false;
static OtaSnapshot s_snap{};

static void copy_str(char* dst, size_t dst_len, const char* src)
{
    if (dst == nullptr || dst_len == 0) {
        return;
    }
    if (src == nullptr) {
        dst[0] = '\0';
        return;
    }
    strncpy(dst, src, dst_len - 1);
    dst[dst_len - 1] = '\0';
}

static void set_snap(OtaState state, const char* msg, int pct, int64_t bytes, int64_t total)
{
    if (s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_snap.state = state;
    s_snap.progress_pct = pct;
    s_snap.bytes = bytes;
    s_snap.total = total;
    copy_str(s_snap.message, sizeof(s_snap.message), msg);
    xSemaphoreGive(s_mutex);
}

static void set_new_version(const char* ver)
{
    if (s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    copy_str(s_snap.new_version, sizeof(s_snap.new_version), ver);
    xSemaphoreGive(s_mutex);
}

static void fill_running_name(char* out, size_t out_len)
{
    const esp_partition_t* running = esp_ota_get_running_partition();
    if (running != nullptr && running->label != nullptr) {
        copy_str(out, out_len, running->label);
        return;
    }
    copy_str(out, out_len, "?");
}

static const char* ota_state_text(esp_ota_img_states_t st)
{
    switch (st) {
        case ESP_OTA_IMG_NEW:             return "NEW";
        case ESP_OTA_IMG_PENDING_VERIFY:  return "PENDING_VERIFY";
        case ESP_OTA_IMG_VALID:           return "VALID";
        case ESP_OTA_IMG_INVALID:         return "INVALID";
        case ESP_OTA_IMG_ABORTED:         return "ABORTED";
        case ESP_OTA_IMG_UNDEFINED:
        default:                          return "UNDEFINED";
    }
}

static bool wifi_ready()
{
    const AppState st = app_state_snapshot();
    return st.wifi == WifiStatus::Connected && st.ip[0] != '\0';
}

static bool url_is_https(const char* url)
{
    return url != nullptr && strncmp(url, "https://", 8) == 0 && url[8] != '\0';
}

static void do_install()
{
    char url[APP_OTA_URL_MAX + 1] = "";
    settings_store_ota_url_copy(url, sizeof(url));
    if (url[0] == '\0') {
        ESP_LOGW(TAG, "mislukt: geen OTA-URL (NVS leeg)");
        set_snap(OtaState::Error, "Geen OTA-URL ingesteld.", -1, 0, 0);
        return;
    }
    if (!url_is_https(url)) {
        ESP_LOGW(TAG, "mislukt: URL is geen HTTPS (%s)", url);
        set_snap(OtaState::Error, "Alleen HTTPS-URL (https://...).", -1, 0, 0);
        return;
    }
    if (!wifi_ready()) {
        ESP_LOGW(TAG, "mislukt: geen wifi-IP; OTA niet gestart");
        set_snap(OtaState::Error, "Geen wifi; OTA niet gestart.", -1, 0, 0);
        return;
    }

    const esp_partition_t* running = esp_ota_get_running_partition();
    const esp_partition_t* update = esp_ota_get_next_update_partition(nullptr);
    if (update == nullptr) {
        ESP_LOGE(TAG, "mislukt: geen vrije OTA-partitie");
        set_snap(OtaState::Error, "Geen vrije OTA-partitie.", -1, 0, 0);
        return;
    }
    ESP_LOGI(TAG, "poging: OTA van %s naar %s (%u KB) url=%s",
             (running != nullptr && running->label) ? running->label : "?",
             update->label ? update->label : "?",
             (unsigned)(update->size / 1024), url);
    set_snap(OtaState::Starting, "Verbinden...", 0, 0, 0);

    esp_http_client_config_t http = {};
    http.url = url;
    http.timeout_ms = APP_OTA_HTTP_TIMEOUT_MS;
    http.keep_alive_enable = true;
    http.crt_bundle_attach = esp_crt_bundle_attach;
    http.buffer_size = 2048;
    http.buffer_size_tx = 1024;
    http.user_agent = "koi-iot-paneel/" APP_FW_VERSION;

    esp_https_ota_config_t ota_cfg = {};
    ota_cfg.http_config = &http;
    // OTA-buffer in PSRAM: intern+DMA blijft voor hosted (~300 KB).
    ota_cfg.buffer_caps = MALLOC_CAP_SPIRAM;

    esp_https_ota_handle_t handle = nullptr;
    esp_err_t err = esp_https_ota_begin(&ota_cfg, &handle);
    if (err != ESP_OK || handle == nullptr) {
        ESP_LOGE(TAG, "mislukt: OTA begin: %s (0x%x)", esp_err_to_name(err), err);
        set_snap(OtaState::Error, "Download starten mislukt.", -1, 0, 0);
        return;
    }
    const int http_status = esp_https_ota_get_status_code(handle);
    if (http_status > 0 && http_status != 200) {
        ESP_LOGE(TAG, "mislukt: OTA HTTP %d (geen firmware-bin)", http_status);
        esp_https_ota_abort(handle);
        char msg[96];
        snprintf(msg, sizeof(msg), "HTTP %d; geen firmware. Oude image blijft.", http_status);
        set_snap(OtaState::Error, msg, -1, 0, 0);
        return;
    }

    esp_app_desc_t desc{};
    err = esp_https_ota_get_img_desc(handle, &desc);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: geen firmware-header: %s (0x%x)",
                 esp_err_to_name(err), err);
        esp_https_ota_abort(handle);
        set_snap(OtaState::Error, "Geen geldige firmware-header.", -1, 0, 0);
        return;
    }
    ESP_LOGI(TAG, "image: project='%s' versie='%s' idf='%s'",
             desc.project_name, desc.version, desc.idf_ver);
    if (strcmp(desc.project_name, APP_OTA_PROJECT_NAME) != 0) {
        ESP_LOGE(TAG, "mislukt: image is niet %s (project='%s'); afgebroken",
                 APP_OTA_PROJECT_NAME, desc.project_name);
        esp_https_ota_abort(handle);
        set_snap(OtaState::Error, "Image is niet voor dit paneel.", -1, 0, 0);
        return;
    }
    set_new_version(desc.version);
    set_snap(OtaState::Downloading, "Downloaden...", 0, 0, 0);

    while (true) {
        err = esp_https_ota_perform(handle);
        const int read = esp_https_ota_get_image_len_read(handle);
        const int size = esp_https_ota_get_image_size(handle);
        int pct = -1;
        if (size > 0 && read >= 0) {
            pct = (int)((100LL * read) / size);
            if (pct > 99) {
                pct = 99;
            }
        }
        char msg[96];
        if (size > 0) {
            snprintf(msg, sizeof(msg), "Downloaden %d%% (%d / %d KB)",
                     pct, read / 1024, size / 1024);
        } else {
            snprintf(msg, sizeof(msg), "Downloaden (%d KB)", read / 1024);
        }
        set_snap(OtaState::Downloading, msg, pct, read, size);
        if (err != ESP_ERR_HTTPS_OTA_IN_PROGRESS) {
            break;
        }
    }

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: OTA download: %s (0x%x)", esp_err_to_name(err), err);
        esp_https_ota_abort(handle);
        set_snap(OtaState::Error, "Download mislukt; oude firmware blijft.", -1, 0, 0);
        return;
    }
    if (!esp_https_ota_is_complete_data_received(handle)) {
        ESP_LOGE(TAG, "mislukt: image incompleet");
        esp_https_ota_abort(handle);
        set_snap(OtaState::Error, "Image incompleet; oude firmware blijft.", -1, 0, 0);
        return;
    }

    set_snap(OtaState::Verifying, "Controleren...", 99, 0, 0);
    err = esp_https_ota_finish(handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: OTA afronden/valideren: %s (0x%x) (chip of image ongeldig)",
                 esp_err_to_name(err), err);
        set_snap(OtaState::Error, "Image ongeldig (geen esp32p4/dit project).", -1, 0, 0);
        return;
    }

    ESP_LOGI(TAG, "succes: OTA klaar; bootpartitie %s versie %s; wacht op herstart",
             update->label ? update->label : "?", desc.version);
    char ok[96];
    snprintf(ok, sizeof(ok), "Klaar (%s). Herstarten?",
             desc.version[0] ? desc.version : "nieuwe image");
    set_snap(OtaState::Success, ok, 100, 0, 0);
}

static void ota_task(void*)
{
    ESP_LOGI(TAG, "ota-taak gestart (geen LVGL, geen hosted-upgrade)");
    while (true) {
        if (!s_request) {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }
        s_request = false;
        do_install();
    }
}

void ota_client_init()
{
    if (s_mutex == nullptr) {
        s_mutex = xSemaphoreCreateMutex();
    }
    char part[12] = "";
    fill_running_name(part, sizeof(part));
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
        copy_str(s_snap.running_part, sizeof(s_snap.running_part), part);
        xSemaphoreGive(s_mutex);
    }

    const esp_partition_t* running = esp_ota_get_running_partition();
    esp_ota_img_states_t st = ESP_OTA_IMG_UNDEFINED;
    const char* label = (running != nullptr && running->label) ? running->label : "?";
    if (running != nullptr && esp_ota_get_state_partition(running, &st) == ESP_OK) {
        ESP_LOGI(TAG, "draait op %s (%s)", label, ota_state_text(st));
    } else {
        ESP_LOGI(TAG, "draait op %s (geen otadata-state)", label);
    }
    const esp_app_desc_t* app = esp_app_get_description();
    if (app != nullptr) {
        ESP_LOGI(TAG, "app-desc project='%s' versie='%s'", app->project_name, app->version);
    }
}

void ota_client_start()
{
    if (s_task != nullptr) {
        return;
    }
    const BaseType_t ok = xTaskCreate(ota_task, "ota", APP_OTA_TASK_STACK, nullptr,
                                      APP_OTA_TASK_PRIO, &s_task);
    if (ok != pdPASS) {
        s_task = nullptr;
        ESP_LOGE(TAG, "mislukt: ota-taak aanmaken");
    }
}

void ota_client_confirm_running()
{
    const esp_partition_t* running = esp_ota_get_running_partition();
    const char* label = (running != nullptr && running->label) ? running->label : "?";
    esp_ota_img_states_t st = ESP_OTA_IMG_UNDEFINED;
    if (running != nullptr) {
        (void)esp_ota_get_state_partition(running, &st);
    }
    if (st == ESP_OTA_IMG_PENDING_VERIFY) {
        ESP_LOGW(TAG, "PENDING_VERIFY op %s; bevestigen na UI", label);
    }
    const esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "image bevestigd op %s; rollback geannuleerd", label);
        return;
    }
    ESP_LOGW(TAG, "OTA bevestigen: %s (0x%x) op %s (factory/geen pending is normaal)",
             esp_err_to_name(err), err, label);
}

void ota_client_request_install()
{
    if (s_task == nullptr) {
        ESP_LOGW(TAG, "OTA geweigerd: taak niet gestart (geen wifi-stack?)");
        set_snap(OtaState::Error, "OTA niet beschikbaar (geen wifi-stack).", -1, 0, 0);
        return;
    }
    if (ota_client_is_busy()) {
        ESP_LOGW(TAG, "OTA geweigerd: al bezig");
        return;
    }
    ESP_LOGI(TAG, "OTA gevraagd via Instellingen (uitvoering in ota-taak)");
    set_snap(OtaState::Starting, "Starten...", 0, 0, 0);
    s_request = true;
}

void ota_client_snapshot(OtaSnapshot* out)
{
    if (out == nullptr) {
        return;
    }
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    *out = s_snap;
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
}

bool ota_client_is_busy()
{
    OtaState st = OtaState::Idle;
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
        st = s_snap.state;
        xSemaphoreGive(s_mutex);
    }
    return st == OtaState::Starting || st == OtaState::Downloading ||
           st == OtaState::Verifying || st == OtaState::Success;
}

void ota_client_running_partition_name(char* out, size_t out_len)
{
    fill_running_name(out, out_len);
}
