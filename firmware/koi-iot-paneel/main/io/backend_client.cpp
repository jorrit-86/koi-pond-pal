// KOIoT Paneel - backend_client: HTTPS ha-status + task-close + manual-measurement.
#include "io/backend_client.h"

#include <cstdlib>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <ctime>

#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

#include "app_config.h"
#include "core/net_manager.h"
#include "core/settings_store.h"
#include "data/live_store.h"
#include "data/measurement_queue.h"
#include "data/param_catalog.h"
#include "data/status_store.h"
#include "io/mqtt_link.h"

static const char* TAG = "backend";

enum class BackendCmdType : uint8_t {
    Fetch = 0,
    Close,
    History,
    Upload,
};

struct BackendCmd {
    BackendCmdType type;
    char task_id[40];
    char close_status[16];
    char note[160];
    char title[96];
    uint8_t field_n;
    BackendCloseField fields[k_backend_close_fields_max];
};

static QueueHandle_t s_queue = nullptr;
static volatile bool s_net_up = false;
static bool s_hist_done = false;
static int64_t s_hist_last_try_us = 0;
static int64_t s_upload_next_us = 0;
static int s_upload_backoff_s = APP_UPLOAD_BACKOFF_MIN_S;

static void do_history();
static void do_upload();

struct HttpBuf {
    char* data = nullptr;
    int used = 0;
    int cap = 0;
    bool overflow = false;
};

static bool token_ok()
{
    return settings_store_token_ok();
}

static void token_header(char* out, size_t out_len)
{
    settings_store_token_copy(out, out_len);
}

static esp_err_t http_event(esp_http_client_event_t* evt)
{
    auto* buf = static_cast<HttpBuf*>(evt->user_data);
    if (buf == nullptr || buf->data == nullptr) {
        return ESP_OK;
    }
    if (evt->event_id == HTTP_EVENT_ON_DATA && evt->data != nullptr && evt->data_len > 0) {
        const int room = buf->cap - 1 - buf->used;
        const int take = (evt->data_len < room) ? evt->data_len : room;
        if (take > 0) {
            memcpy(buf->data + buf->used, evt->data, static_cast<size_t>(take));
            buf->used += take;
            buf->data[buf->used] = '\0';
        }
        if (evt->data_len > room) {
            buf->overflow = true;
        }
    }
    return ESP_OK;
}

// Edge Functions (ha-status, task-close, manual-measurement, ha-status?history=1):
// alleen X-HA-Token. Dat is het paneel-device-token (device_tokens), geen Home
// Assistant en geen user-JWT. Geen Authorization Bearer: esp_http_client
// ondersteunt dat niet (alleen Basic/Digest) en REST-401 met WWW-Authenticate:
// Bearer gaf ESP_ERR_NOT_SUPPORTED 0x106. Geen REST /rest/v1/water_parameters (RLS).
static int http_perform(const char* url, esp_http_client_method_t method,
                        const char* body, HttpBuf* buf)
{
    if (buf != nullptr) {
        buf->used = 0;
        buf->overflow = false;
        if (buf->data != nullptr && buf->cap > 0) {
            buf->data[0] = '\0';
        }
    }

    esp_http_client_config_t cfg = {};
    cfg.url = url;
    cfg.method = method;
    cfg.timeout_ms = APP_HTTP_TIMEOUT_MS;
    cfg.crt_bundle_attach = esp_crt_bundle_attach;
    cfg.event_handler = &http_event;
    cfg.user_data = buf;
    cfg.buffer_size = 2048;
    cfg.buffer_size_tx = 1024;
    cfg.auth_type = HTTP_AUTH_TYPE_NONE;

    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (client == nullptr) {
        ESP_LOGE(TAG, "mislukt: esp_http_client_init gaf NULL (url %s)", url);
        return -1;
    }

    char token[APP_TOKEN_MAX + 1] = "";
    token_header(token, sizeof(token));
    esp_http_client_set_header(client, "X-HA-Token", token);
    if (body != nullptr) {
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, body, static_cast<int>(strlen(body)));
    }

    const esp_err_t err = esp_http_client_perform(client);
    int status = 0;
    if (err == ESP_OK) {
        status = esp_http_client_get_status_code(client);
    } else {
        ESP_LOGE(TAG, "mislukt: HTTP %s %s: %s (0x%x)",
                 (method == HTTP_METHOD_GET) ? "GET" : "POST", url,
                 esp_err_to_name(err), err);
        status = -1;
    }
    if (buf != nullptr && buf->overflow) {
        ESP_LOGW(TAG, "HTTP-antwoord afgekapt op %d B", buf->cap);
    }
    esp_http_client_cleanup(client);
    return status;
}

static void do_fetch()
{
    if (!token_ok()) {
        ESP_LOGW(TAG, "ha-status overgeslagen: device-token leeg of CHANGE_ME");
        status_store_set_http_error(401, "Token ongeldig - controleer Instellingen");
        return;
    }
    if (!s_net_up) {
        ESP_LOGW(TAG, "ha-status overgeslagen: geen wifi");
        status_store_set_network_error("geen wifi");
        return;
    }

    char url[160];
    snprintf(url, sizeof(url), "%s%s", APP_BACKEND_BASE_URL, APP_HA_STATUS_PATH);

    HttpBuf buf;
    buf.cap = APP_HTTP_RESP_MAX;
    buf.data = static_cast<char*>(heap_caps_malloc(static_cast<size_t>(buf.cap),
                                                   MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (buf.data == nullptr) {
        buf.data = static_cast<char*>(heap_caps_malloc(static_cast<size_t>(buf.cap), MALLOC_CAP_8BIT));
    }
    if (buf.data == nullptr) {
        ESP_LOGE(TAG, "mislukt: geen buffer voor ha-status (%d B)", buf.cap);
        status_store_set_network_error("geen geheugen");
        return;
    }

    status_store_set_fetching();
    ESP_LOGI(TAG, "poging: GET %s", url);
    const int64_t t0 = esp_timer_get_time();
    const int status = http_perform(url, HTTP_METHOD_GET, nullptr, &buf);
    const int ms = static_cast<int>((esp_timer_get_time() - t0) / 1000);

    if (status < 0) {
        ESP_LOGE(TAG, "mislukt: GET ha-status na %d ms (geen HTTP-status)", ms);
        status_store_set_network_error("netwerkfout of timeout");
        heap_caps_free(buf.data);
        return;
    }
    if (status == 401) {
        ESP_LOGE(TAG, "mislukt: GET ha-status HTTP 401 (token) na %d ms, body %d B",
                 ms, buf.used);
        status_store_apply_http(401, buf.data, buf.used);
        heap_caps_free(buf.data);
        return;
    }
    if (status < 200 || status > 299) {
        ESP_LOGE(TAG, "mislukt: GET ha-status HTTP %d na %d ms, body %d B",
                 status, ms, buf.used);
        status_store_apply_http(status, buf.data, buf.used);
        heap_caps_free(buf.data);
        return;
    }

    ESP_LOGI(TAG, "succes: GET ha-status HTTP %d na %d ms, body %d B", status, ms, buf.used);
    status_store_apply_http(status, buf.data, buf.used);
    measurement_queue_apply_latest_json(buf.data);
    heap_caps_free(buf.data);
    if (!s_hist_done) {
        do_history();
    }
}

static LiveField history_key_field(const char* key)
{
    if (key == nullptr) {
        return LiveField::Count;
    }
    if (strcmp(key, "water_temp") == 0) {
        return LiveField::WaterTemp;
    }
    if (strcmp(key, "air_temp") == 0) {
        return LiveField::AirTemp;
    }
    if (strcmp(key, "humidity") == 0) {
        return LiveField::Humidity;
    }
    if (strcmp(key, "ph") == 0) {
        return LiveField::Ph;
    }
    if (strcmp(key, "flow_rate") == 0) {
        return LiveField::FlowRate;
    }
    return LiveField::Count;
}

static bool json_num(const cJSON* item, double* out)
{
    if (out == nullptr || !cJSON_IsNumber(item)) {
        return false;
    }
    *out = item->valuedouble;
    return true;
}

static void apply_history_json(const char* body)
{
    if (body == nullptr || body[0] == '\0') {
        return;
    }
    cJSON* root = cJSON_Parse(body);
    if (root == nullptr) {
        ESP_LOGE(TAG, "historie: JSON parse mislukt");
        return;
    }
    const cJSON* hist = cJSON_GetObjectItemCaseSensitive(root, "history");
    if (!cJSON_IsObject(hist)) {
        ESP_LOGW(TAG, "historie: geen history-veld (ha-status her-deployen in pal-app; "
                      "npx supabase functions deploy ha-status --project-ref pbpuvumeshaeplbwbwzv)");
        cJSON_Delete(root);
        return;
    }
    const cJSON* series = cJSON_GetObjectItemCaseSensitive(hist, "series");
    if (!cJSON_IsArray(series)) {
        ESP_LOGW(TAG, "historie: series ontbreekt of is geen array");
        cJSON_Delete(root);
        return;
    }

    float* vals = static_cast<float*>(
        heap_caps_malloc(static_cast<size_t>(APP_HIST_POINTS) * sizeof(float),
                         MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (vals == nullptr) {
        vals = static_cast<float*>(
            heap_caps_malloc(static_cast<size_t>(APP_HIST_POINTS) * sizeof(float),
                             MALLOC_CAP_8BIT));
    }
    if (vals == nullptr) {
        ESP_LOGE(TAG, "historie: geen buffer voor punten");
        cJSON_Delete(root);
        return;
    }

    int loaded_n = 0;
    const int nser = cJSON_GetArraySize(series);
    for (int s = 0; s < nser; s++) {
        const cJSON* item = cJSON_GetArrayItem(series, s);
        if (!cJSON_IsObject(item)) {
            continue;
        }
        const cJSON* keyj = cJSON_GetObjectItemCaseSensitive(item, "key");
        const char* key = (cJSON_IsString(keyj) && keyj->valuestring != nullptr)
                              ? keyj->valuestring : "";
        const LiveField field = history_key_field(key);
        if (field == LiveField::Count) {
            continue;
        }
        const cJSON* varr = cJSON_GetObjectItemCaseSensitive(item, "v");
        const cJSON* tarr = cJSON_GetObjectItemCaseSensitive(item, "t");
        if (!cJSON_IsArray(varr)) {
            continue;
        }
        const int nv = cJSON_GetArraySize(varr);
        const int nt = cJSON_IsArray(tarr) ? cJSON_GetArraySize(tarr) : 0;
        int n = nv;
        if (n > APP_HIST_POINTS) {
            n = APP_HIST_POINTS;
        }
        if (n <= 0) {
            continue;
        }
        int64_t first = 0;
        int64_t last = 0;
        int filled = 0;
        for (int i = 0; i < n; i++) {
            double v = 0;
            if (!json_num(cJSON_GetArrayItem(varr, i), &v)) {
                continue;
            }
            vals[filled] = static_cast<float>(v);
            if (i < nt) {
                double ts = 0;
                if (json_num(cJSON_GetArrayItem(tarr, i), &ts) && ts > 1700000000.0) {
                    const int64_t u = static_cast<int64_t>(ts);
                    if (first == 0) {
                        first = u;
                    }
                    last = u;
                }
            }
            filled++;
        }
        if (filled <= 0) {
            continue;
        }
        live_store_load_history(field, vals, filled, first, last);
        loaded_n++;
    }
    heap_caps_free(vals);
    cJSON_Delete(root);
    if (loaded_n > 0) {
        s_hist_done = true;
        ESP_LOGI(TAG, "historie toegepast: %d reeksen", loaded_n);
    } else {
        ESP_LOGI(TAG, "historie: 0 reeksen (lege DB of geen punten); grafiek blijft 1 punt");
        s_hist_done = true;
    }
}

static void do_history()
{
    if (s_hist_done) {
        return;
    }
    if (!token_ok() || !s_net_up) {
        return;
    }
    const int64_t now = esp_timer_get_time();
    if (s_hist_last_try_us > 0 &&
        (now - s_hist_last_try_us) < 30LL * 1000000LL) {
        return;
    }
    s_hist_last_try_us = now;

    char url[192];
    snprintf(url, sizeof(url), "%s%s", APP_BACKEND_BASE_URL, APP_HA_HISTORY_QUERY);

    HttpBuf buf;
    buf.cap = APP_HTTP_HIST_MAX;
    buf.data = static_cast<char*>(heap_caps_malloc(static_cast<size_t>(buf.cap),
                                                   MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (buf.data == nullptr) {
        buf.data = static_cast<char*>(heap_caps_malloc(static_cast<size_t>(buf.cap),
                                                       MALLOC_CAP_8BIT));
    }
    if (buf.data == nullptr) {
        ESP_LOGE(TAG, "mislukt: geen buffer voor historie (%d B)", buf.cap);
        return;
    }

    ESP_LOGI(TAG, "poging: GET %s", url);
    const int64_t t0 = esp_timer_get_time();
    const int status = http_perform(url, HTTP_METHOD_GET, nullptr, &buf);
    const int ms = static_cast<int>((esp_timer_get_time() - t0) / 1000);

    if (status < 0) {
        ESP_LOGE(TAG, "mislukt: GET historie na %d ms (geen HTTP-status)", ms);
        heap_caps_free(buf.data);
        return;
    }
    if (status == 401) {
        ESP_LOGE(TAG, "mislukt: GET historie HTTP 401 (token) na %d ms", ms);
        heap_caps_free(buf.data);
        return;
    }
    if (status < 200 || status > 299) {
        ESP_LOGE(TAG, "mislukt: GET historie HTTP %d na %d ms, body %d B",
                 status, ms, buf.used);
        heap_caps_free(buf.data);
        return;
    }

    ESP_LOGI(TAG, "succes: GET historie HTTP %d na %d ms, body %d B", status, ms, buf.used);
    apply_history_json(buf.data);
    heap_caps_free(buf.data);
}

static bool body_error_is(const char* body, const char* want)
{
    if (body == nullptr || body[0] == '\0') {
        return false;
    }
    cJSON* root = cJSON_Parse(body);
    if (root == nullptr) {
        return false;
    }
    const cJSON* err = cJSON_GetObjectItemCaseSensitive(root, "error");
    const bool ok = cJSON_IsString(err) && err->valuestring != nullptr &&
                    strcmp(err->valuestring, want) == 0;
    cJSON_Delete(root);
    return ok;
}

static const BackendCloseField* find_field(const BackendCmd& cmd, const char* key)
{
    if (key == nullptr) {
        return nullptr;
    }
    for (int i = 0; i < cmd.field_n && i < k_backend_close_fields_max; i++) {
        if (strcmp(cmd.fields[i].key, key) == 0 && cmd.fields[i].value[0] != '\0') {
            return &cmd.fields[i];
        }
    }
    return nullptr;
}

static bool water_type_ok(const char* v)
{
    return v != nullptr && (strcmp(v, "tap_water") == 0 || strcmp(v, "well_water") == 0 ||
                            strcmp(v, "rain_water") == 0 || strcmp(v, "ro_water") == 0 ||
                            strcmp(v, "mixed") == 0);
}

static bool reason_ok(const char* v)
{
    return v != nullptr && (strcmp(v, "routine") == 0 || strcmp(v, "maintenance") == 0 ||
                            strcmp(v, "problem") == 0 || strcmp(v, "emergency") == 0 ||
                            strcmp(v, "seasonal") == 0 || strcmp(v, "other") == 0);
}

static bool is_wc_key(const char* key)
{
    return key != nullptr && (strcmp(key, "liters_added") == 0 ||
                              strcmp(key, "water_type") == 0 ||
                              strcmp(key, "reason") == 0);
}

static void add_changed_at(cJSON* root)
{
    const time_t now = time(nullptr);
    if (now <= 1000000000 || root == nullptr) {
        return;
    }
    struct tm tm_u = {};
    gmtime_r(&now, &tm_u);
    char iso[40];
    snprintf(iso, sizeof(iso), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             tm_u.tm_year + 1900, tm_u.tm_mon + 1, tm_u.tm_mday,
             tm_u.tm_hour, tm_u.tm_min, tm_u.tm_sec);
    cJSON_AddStringToObject(root, "changed_at", iso);
}

static void do_close(const BackendCmd& cmd)
{
    if (!token_ok()) {
        ESP_LOGW(TAG, "task-close overgeslagen: token ontbreekt");
        status_store_close_token();
        return;
    }
    if (!s_net_up) {
        ESP_LOGW(TAG, "task-close overgeslagen: geen wifi");
        status_store_close_network_error();
        return;
    }

    char url[160];
    snprintf(url, sizeof(url), "%s%s", APP_BACKEND_BASE_URL, APP_TASK_CLOSE_PATH);

    cJSON* root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "task_id", cmd.task_id);
    cJSON_AddStringToObject(root, "status", cmd.close_status);

    const BackendCloseField* liters = find_field(cmd, "liters_added");
    const bool water_change = (liters != nullptr);

    if (water_change) {
        // Pal-app WaterChangePopup: REST + user-JWT. Paneel heeft geen user-sessie;
        // RLS op water_changes (auth.uid() = user_id) weigert anon/apikey → 401.
        // Eén POST task-close: function (service role) insert water_changes met
        // user_id uit device_tokens, daarna complete_maintenance_task.
        ESP_LOGI(TAG, "waterwissel: geen REST (RLS eist user-JWT); "
                      "insert via task-close (paneel-token, geen Home Assistant)");
        cJSON_AddStringToObject(root, "note", "via paneel");
        if (cmd.note[0] != '\0') {
            cJSON_AddStringToObject(root, "notes", cmd.note);
        } else if (cmd.title[0] != '\0') {
            char n[128];
            snprintf(n, sizeof(n), "Waterwissel taak: %s", cmd.title);
            cJSON_AddStringToObject(root, "notes", n);
        }
        char* end = nullptr;
        const double v = strtod(liters->value, &end);
        if (end != liters->value) {
            cJSON_AddNumberToObject(root, "liters_added", v);
        } else {
            cJSON_AddStringToObject(root, "liters_added", liters->value);
        }
        const BackendCloseField* type = find_field(cmd, "water_type");
        cJSON_AddStringToObject(root, "water_type",
            (type != nullptr && water_type_ok(type->value)) ? type->value : "tap_water");
        const BackendCloseField* reason = find_field(cmd, "reason");
        cJSON_AddStringToObject(root, "reason",
            (reason != nullptr && reason_ok(reason->value)) ? reason->value : "maintenance");
        add_changed_at(root);
    } else {
        cJSON_AddStringToObject(root, "note",
                                (cmd.note[0] != '\0') ? cmd.note : "via paneel");
    }

    cJSON* params = cJSON_CreateObject();
    int params_n = 0;
    for (int i = 0; i < cmd.field_n && i < k_backend_close_fields_max; i++) {
        const BackendCloseField& f = cmd.fields[i];
        if (f.key[0] == '\0' || f.value[0] == '\0') {
            continue;
        }
        if (strcmp(f.key, "note") == 0 || strcmp(f.key, "notes") == 0) {
            continue;
        }
        if (is_wc_key(f.key)) {
            continue;
        }
        if (f.is_number) {
            char* end = nullptr;
            const double v = strtod(f.value, &end);
            if (end != f.value) {
                cJSON_AddNumberToObject(root, f.key, v);
                if (params != nullptr) {
                    cJSON_AddNumberToObject(params, f.key, v);
                    params_n++;
                }
            } else {
                cJSON_AddStringToObject(root, f.key, f.value);
                if (params != nullptr) {
                    cJSON_AddStringToObject(params, f.key, f.value);
                    params_n++;
                }
            }
        } else {
            cJSON_AddStringToObject(root, f.key, f.value);
            if (params != nullptr) {
                cJSON_AddStringToObject(params, f.key, f.value);
                params_n++;
            }
        }
    }
    if (params != nullptr) {
        if (params_n > 0) {
            cJSON_AddItemToObject(root, "parameters", params);
        } else {
            cJSON_Delete(params);
        }
    }
    char* payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (payload == nullptr) {
        ESP_LOGE(TAG, "mislukt: task-close JSON bouwen");
        status_store_close_abort();
        return;
    }

    HttpBuf buf;
    buf.cap = 1024;
    buf.data = static_cast<char*>(heap_caps_malloc(static_cast<size_t>(buf.cap), MALLOC_CAP_8BIT));
    if (buf.data == nullptr) {
        ESP_LOGE(TAG, "mislukt: geen buffer voor task-close");
        free(payload);
        status_store_close_abort();
        return;
    }

    ESP_LOGI(TAG, "poging: POST %s body='%s'", url, payload);
    const int64_t t0 = esp_timer_get_time();
    const int status = http_perform(url, HTTP_METHOD_POST, payload, &buf);
    const int ms = static_cast<int>((esp_timer_get_time() - t0) / 1000);
    free(payload);

    if (status < 0) {
        ESP_LOGE(TAG, "mislukt: POST task-close na %d ms (geen HTTP-status)", ms);
        status_store_close_network_error();
        heap_caps_free(buf.data);
        return;
    }
    if (status == 401) {
        ESP_LOGE(TAG, "mislukt: POST task-close HTTP 401 (token) na %d ms", ms);
        status_store_close_token();
        heap_caps_free(buf.data);
        return;
    }
    if (status == 409 || (status == 404 && body_error_is(buf.data, "task_not_found"))) {
        ESP_LOGW(TAG, "task-close HTTP %d: taak al afgesloten of niet gevonden (na %d ms)",
                 status, ms);
        status_store_close_already_closed();
        heap_caps_free(buf.data);
        backend_client_request_fetch();
        return;
    }
    if (status == 404) {
        ESP_LOGW(TAG, "mislukt: POST task-close HTTP 404 zonder task_not_found (na %d ms); "
                      "endpoint bestaat waarschijnlijk nog niet",
                 ms);
        status_store_close_endpoint_missing();
        heap_caps_free(buf.data);
        return;
    }
    if (status >= 500) {
        ESP_LOGE(TAG, "mislukt: POST task-close HTTP %d na %d ms, body %d B: %s",
                 status, ms, buf.used, (buf.data != nullptr) ? buf.data : "");
        status_store_close_server_error();
        heap_caps_free(buf.data);
        return;
    }
    if (status < 200 || status > 299) {
        ESP_LOGE(TAG, "mislukt: POST task-close HTTP %d na %d ms, body %d B",
                 status, ms, buf.used);
        status_store_close_server_error();
        heap_caps_free(buf.data);
        return;
    }

    ESP_LOGI(TAG, "succes: POST task-close HTTP %d na %d ms (task_id='%s')",
             status, ms, cmd.task_id);
    status_store_close_ok(cmd.task_id);
    heap_caps_free(buf.data);
    backend_client_request_fetch();
}

static void bump_upload_backoff()
{
    s_upload_backoff_s *= 2;
    if (s_upload_backoff_s > APP_UPLOAD_BACKOFF_MAX_S) {
        s_upload_backoff_s = APP_UPLOAD_BACKOFF_MAX_S;
    }
    s_upload_next_us = esp_timer_get_time() +
                       static_cast<int64_t>(s_upload_backoff_s) * 1000000LL;
    ESP_LOGI(TAG, "upload backoff %d s", s_upload_backoff_s);
}

static void reset_upload_backoff()
{
    s_upload_backoff_s = APP_UPLOAD_BACKOFF_MIN_S;
    s_upload_next_us = 0;
}

static void do_upload()
{
    const MeasItem* item = measurement_queue_next_pending();
    if (item == nullptr) {
        reset_upload_backoff();
        return;
    }
    const ParamDef* def = param_catalog_get(item->param);
    if (def == nullptr) {
        measurement_queue_mark_rejected(item->client_id, "onbekende parameter");
        return;
    }
    const int u = (item->unit < def->unit_count) ? item->unit : 0;
    const char* unit = (def->units[u] != nullptr) ? def->units[u] : "";

    cJSON* root = cJSON_CreateObject();
    if (root == nullptr) {
        return;
    }
    cJSON_AddStringToObject(root, "device_id", MQTT_DEVICE_ID);
    cJSON_AddStringToObject(root, "parameter", def->key);
    cJSON_AddNumberToObject(root, "value", item->value);
    cJSON_AddStringToObject(root, "unit", unit);
    cJSON_AddStringToObject(root, "client_id", item->client_id);
    cJSON_AddStringToObject(root, "source", "panel");
    if (item->measured_at >= 1700000000) {
        const time_t t = static_cast<time_t>(item->measured_at);
        struct tm tm_u = {};
        gmtime_r(&t, &tm_u);
        char iso[40];
        snprintf(iso, sizeof(iso), "%04d-%02d-%02dT%02d:%02d:%02dZ",
                 tm_u.tm_year + 1900, tm_u.tm_mon + 1, tm_u.tm_mday,
                 tm_u.tm_hour, tm_u.tm_min, tm_u.tm_sec);
        cJSON_AddStringToObject(root, "measured_at", iso);
    }
    char* payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (payload == nullptr) {
        ESP_LOGE(TAG, "mislukt: manual-measurement JSON bouwen");
        return;
    }

    if (measurement_queue_mock()) {
        ESP_LOGI(TAG, "MOCK: POST %s%s body='%s' (geen HTTP)",
                 APP_BACKEND_BASE_URL, APP_MANUAL_PATH, payload);
        measurement_queue_mark_uploaded(item->client_id);
        mqtt_link_publish_manual_state(def->key, item->value, unit,
                                       item->measured_at, "geupload");
        mqtt_link_publish_diagnostics();
        free(payload);
        reset_upload_backoff();
        return;
    }

    if (!s_net_up) {
        ESP_LOGW(TAG, "upload overgeslagen: geen wifi; blijft in wachtrij");
        free(payload);
        bump_upload_backoff();
        return;
    }
    if (!token_ok()) {
        ESP_LOGW(TAG, "upload overgeslagen: device-token leeg; MOCK aan of token vullen");
        free(payload);
        bump_upload_backoff();
        return;
    }

    char url[192];
    snprintf(url, sizeof(url), "%s%s", APP_BACKEND_BASE_URL, APP_MANUAL_PATH);

    HttpBuf buf;
    buf.cap = 1024;
    buf.data = static_cast<char*>(heap_caps_malloc(static_cast<size_t>(buf.cap),
                                                   MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (buf.data == nullptr) {
        buf.data = static_cast<char*>(heap_caps_malloc(static_cast<size_t>(buf.cap),
                                                       MALLOC_CAP_8BIT));
    }

    ESP_LOGI(TAG, "poging: POST %s (X-HA-Token) body='%s'", url, payload);
    const int64_t t0 = esp_timer_get_time();
    const int status = http_perform(url, HTTP_METHOD_POST, payload,
                                    buf.data != nullptr ? &buf : nullptr);
    const int ms = static_cast<int>((esp_timer_get_time() - t0) / 1000);
    free(payload);

    if (status < 0) {
        ESP_LOGE(TAG, "mislukt: POST manual-measurement na %d ms (geen HTTP-status)", ms);
        bump_upload_backoff();
        if (buf.data != nullptr) {
            heap_caps_free(buf.data);
        }
        return;
    }
    if (status >= 200 && status <= 299) {
        ESP_LOGI(TAG, "succes: POST manual-measurement HTTP %d na %d ms", status, ms);
        measurement_queue_mark_uploaded(item->client_id);
        mqtt_link_publish_manual_state(def->key, item->value, unit,
                                       item->measured_at, "geupload");
        mqtt_link_publish_diagnostics();
        reset_upload_backoff();
        if (buf.data != nullptr) {
            heap_caps_free(buf.data);
        }
        return;
    }
    if (status == 401) {
        ESP_LOGE(TAG, "mislukt: POST manual-measurement HTTP 401 (token) na %d ms; blijft in wachtrij",
                 ms);
        bump_upload_backoff();
        if (buf.data != nullptr) {
            heap_caps_free(buf.data);
        }
        return;
    }
    if (status >= 400 && status < 500) {
        ESP_LOGE(TAG, "mislukt: POST manual-measurement HTTP %d na %d ms (definitief), body %d B",
                 status, ms, buf.used);
        char reason[40];
        snprintf(reason, sizeof(reason), "HTTP %d", status);
        measurement_queue_mark_rejected(item->client_id, reason);
        mqtt_link_publish_manual_state(def->key, item->value, unit,
                                       item->measured_at, "afgewezen");
        mqtt_link_publish_diagnostics();
        reset_upload_backoff();
        if (buf.data != nullptr) {
            heap_caps_free(buf.data);
        }
        return;
    }
    ESP_LOGE(TAG, "mislukt: POST manual-measurement HTTP %d na %d ms (retry), body %d B",
             status, ms, buf.used);
    bump_upload_backoff();
    if (buf.data != nullptr) {
        heap_caps_free(buf.data);
    }
}

static void backend_task(void*)
{
    int64_t last_ok_poll_us = 0;

    while (true) {
        BackendCmd cmd = {};
        const TickType_t wait = pdMS_TO_TICKS(1000);
        if (xQueueReceive(s_queue, &cmd, wait) == pdTRUE) {
            if (cmd.type == BackendCmdType::Fetch) {
                do_fetch();
                last_ok_poll_us = esp_timer_get_time();
            } else if (cmd.type == BackendCmdType::Close) {
                do_close(cmd);
            } else if (cmd.type == BackendCmdType::History) {
                do_history();
            } else if (cmd.type == BackendCmdType::Upload) {
                do_upload();
            }
            continue;
        }

        const int64_t now = esp_timer_get_time();
        if (measurement_queue_pending_count() > 0 &&
            (s_upload_next_us == 0 || now >= s_upload_next_us)) {
            do_upload();
        }

        if (!s_net_up || !token_ok()) {
            continue;
        }
        if (last_ok_poll_us == 0) {
            continue;
        }
        if (now - last_ok_poll_us >= static_cast<int64_t>(APP_HA_STATUS_POLL_S) * 1000000) {
            ESP_LOGI(TAG, "periodieke ha-status (elke %d s)", APP_HA_STATUS_POLL_S);
            do_fetch();
            last_ok_poll_us = esp_timer_get_time();
        }
    }
}

void backend_client_init()
{
    if (s_queue == nullptr) {
        s_queue = xQueueCreate(8, sizeof(BackendCmd));
    }
    if (!token_ok()) {
        ESP_LOGW(TAG, "LET OP: device-token leeg of CHANGE_ME; "
                      "ha-status zal 401 tonen tot Instellingen een token heeft");
    } else {
        char mask[24] = "";
        settings_store_token_mask(mask, sizeof(mask));
        ESP_LOGI(TAG, "device-token klaar (%s, %s)",
                 mask, settings_store_token_from_nvs() ? "NVS" : "secrets.h");
    }
    ESP_LOGI(TAG, "backend_client klaar (nog niet gestart); base %s timeout %d ms",
             APP_BACKEND_BASE_URL, APP_HTTP_TIMEOUT_MS);
}

void backend_client_start()
{
    BaseType_t ok = xTaskCreate(backend_task, "backend", APP_BACKEND_TASK_STACK,
                                nullptr, APP_BACKEND_TASK_PRIO, nullptr);
    if (ok != pdPASS) {
        ESP_LOGE(TAG, "backend-taak aanmaken mislukt");
    }
}

void backend_client_on_network_up()
{
    s_net_up = true;
    ESP_LOGI(TAG, "wifi-IP: ha-status ophalen");
    backend_client_request_fetch();
}

void backend_client_on_network_down()
{
    s_net_up = false;
    ESP_LOGW(TAG, "wifi weg; ha-status-fetches pauzeren (laatste lijst blijft)");
}

void backend_client_request_fetch()
{
    if (s_queue == nullptr) {
        return;
    }
    BackendCmd cmd = {};
    cmd.type = BackendCmdType::Fetch;
    if (xQueueSend(s_queue, &cmd, 0) != pdTRUE) {
        ESP_LOGW(TAG, "ha-status-opdracht niet geplaatst (queue vol)");
    }
}

void backend_client_request_history()
{
    if (s_queue == nullptr || s_hist_done) {
        return;
    }
    BackendCmd cmd = {};
    cmd.type = BackendCmdType::History;
    if (xQueueSend(s_queue, &cmd, 0) != pdTRUE) {
        ESP_LOGW(TAG, "historie-opdracht niet geplaatst (queue vol)");
    }
}

void backend_client_request_upload()
{
    if (s_queue == nullptr) {
        return;
    }
    BackendCmd cmd = {};
    cmd.type = BackendCmdType::Upload;
    if (xQueueSend(s_queue, &cmd, 0) != pdTRUE) {
        ESP_LOGW(TAG, "upload-opdracht niet geplaatst (queue vol)");
    }
}

void backend_client_request_close(const char* task_id, const char* status,
                                  const char* note,
                                  const BackendCloseField* fields, int field_n,
                                  const char* task_title)
{
    if (s_queue == nullptr || task_id == nullptr || status == nullptr) {
        return;
    }
    BackendCmd cmd = {};
    cmd.type = BackendCmdType::Close;
    strncpy(cmd.task_id, task_id, sizeof(cmd.task_id) - 1);
    strncpy(cmd.close_status, status, sizeof(cmd.close_status) - 1);
    if (note != nullptr) {
        strncpy(cmd.note, note, sizeof(cmd.note) - 1);
    }
    if (task_title != nullptr) {
        strncpy(cmd.title, task_title, sizeof(cmd.title) - 1);
    }
    if (fields != nullptr && field_n > 0) {
        const int n = (field_n > k_backend_close_fields_max) ? k_backend_close_fields_max : field_n;
        cmd.field_n = static_cast<uint8_t>(n);
        for (int i = 0; i < n; i++) {
            cmd.fields[i] = fields[i];
        }
    }
    if (xQueueSend(s_queue, &cmd, 0) != pdTRUE) {
        ESP_LOGW(TAG, "task-close-opdracht niet geplaatst (queue vol)");
        status_store_close_abort();
    }
}
