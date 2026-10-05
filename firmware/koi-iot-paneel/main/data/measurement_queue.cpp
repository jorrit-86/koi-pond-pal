// KOIoT Paneel - measurement_queue (NVS, R3/R4). Compacte blob, geen DMA.
#include "data/measurement_queue.h"

#include <cstdio>
#include <cstring>

#include <ctime>

#include "cJSON.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_random.h"
#include "nvs.h"

#include "app_config.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static const char* TAG = "meas_q";

static constexpr uint8_t k_blob_ver = 1;

struct PackedRec {
    uint8_t uuid[16];
    uint8_t param;
    uint8_t unit;
    uint8_t status;
    uint8_t reject;
    float value;
    uint32_t measured_at;
    uint32_t queued_at;
} __attribute__((packed));

static PackedRec s_rec[k_meas_queue_max];
static int s_n = 0;
static uint8_t s_unit_pref[k_param_count] = {};
static bool s_mock = true;
static MeasLast s_last[k_param_count];
static SemaphoreHandle_t s_mutex = nullptr;
static bool s_inited = false;

static const char* reject_text(uint8_t code)
{
    switch (code) {
        case 1: return "afgewezen (4xx)";
        case 2: return "afgewezen (ongeldig)";
        default: return "afgewezen";
    }
}

static void uuid_to_str(const uint8_t u[16], char* out, size_t out_len)
{
    if (out == nullptr || out_len < 37) {
        return;
    }
    snprintf(out, out_len,
             "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
             u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7],
             u[8], u[9], u[10], u[11], u[12], u[13], u[14], u[15]);
}

static bool uuid_from_str(const char* s, uint8_t u[16])
{
    if (s == nullptr) {
        return false;
    }
    unsigned int b[16];
    const int n = sscanf(s,
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        &b[0], &b[1], &b[2], &b[3], &b[4], &b[5], &b[6], &b[7],
        &b[8], &b[9], &b[10], &b[11], &b[12], &b[13], &b[14], &b[15]);
    if (n != 16) {
        return false;
    }
    for (int i = 0; i < 16; i++) {
        u[i] = static_cast<uint8_t>(b[i]);
    }
    return true;
}

static void unpack(const PackedRec& r, MeasItem* out)
{
    if (out == nullptr) {
        return;
    }
    *out = MeasItem{};
    uuid_to_str(r.uuid, out->client_id, sizeof(out->client_id));
    out->param = r.param;
    out->unit = r.unit;
    out->status = static_cast<MeasStatus>(r.status);
    out->value = r.value;
    out->measured_at = r.measured_at;
    out->queued_at = r.queued_at;
    if (out->status == MeasStatus::Rejected) {
        snprintf(out->reject, sizeof(out->reject), "%s", reject_text(r.reject));
    }
}

static void refresh_last_locked()
{
    for (int i = 0; i < k_param_count; i++) {
        if (s_last[i].from_app) {
            continue;
        }
        s_last[i] = MeasLast{};
    }
    for (int i = s_n - 1; i >= 0; i--) {
        const int p = s_rec[i].param;
        if (p >= k_param_count) {
            continue;
        }
        if (s_last[p].from_app) {
            continue;
        }
        if (s_last[p].present) {
            continue;
        }
        s_last[p].present = true;
        s_last[p].from_app = false;
        s_last[p].unit = s_rec[i].unit;
        s_last[p].value = s_rec[i].value;
        s_last[p].measured_at = s_rec[i].measured_at;
        s_last[p].status = static_cast<MeasStatus>(s_rec[i].status);
    }
}

static void save_nvs_locked()
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_MEAS_NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS '%s' openen: %s (0x%x)", APP_MEAS_NVS_NS,
                 esp_err_to_name(err), err);
        return;
    }
    uint8_t hdr[2] = {k_blob_ver, static_cast<uint8_t>(s_n > 255 ? 255 : s_n)};
    const size_t n = static_cast<size_t>(s_n);
    const size_t blob_len = 2 + n * sizeof(PackedRec);
    uint8_t* blob = static_cast<uint8_t*>(
        heap_caps_malloc(blob_len, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (blob == nullptr) {
        blob = static_cast<uint8_t*>(heap_caps_malloc(blob_len, MALLOC_CAP_8BIT));
    }
    if (blob == nullptr) {
        nvs_close(h);
        ESP_LOGE(TAG, "mislukt: geen RAM voor NVS-blob (%u B)",
                 static_cast<unsigned>(blob_len));
        return;
    }
    blob[0] = hdr[0];
    blob[1] = hdr[1];
    if (n > 0) {
        memcpy(blob + 2, s_rec, n * sizeof(PackedRec));
    }
    err = nvs_set_blob(h, APP_MEAS_NVS_Q, blob, blob_len);
    heap_caps_free(blob);
    nvs_set_u8(h, APP_MEAS_NVS_MOCK, s_mock ? 1 : 0);
    for (int i = 0; i < k_param_count; i++) {
        char key[4];
        snprintf(key, sizeof(key), "u%d", i);
        nvs_set_u8(h, key, s_unit_pref[i]);
    }
    err = nvs_commit(h);
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS metingen opslaan: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    ESP_LOGI(TAG, "wachtrij bewaard: %d items, mock=%d", s_n, s_mock ? 1 : 0);
}

static void load_nvs_locked()
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_MEAS_NVS_NS, NVS_READONLY, &h);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "geen bewaarde metingen; lege wachtrij, mock aan");
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS metingen lezen mislukt: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    uint8_t mock = 1;
    if (nvs_get_u8(h, APP_MEAS_NVS_MOCK, &mock) == ESP_OK) {
        s_mock = (mock != 0);
    }
    for (int i = 0; i < k_param_count; i++) {
        char key[4];
        snprintf(key, sizeof(key), "u%d", i);
        uint8_t u = 0;
        if (nvs_get_u8(h, key, &u) == ESP_OK) {
            s_unit_pref[i] = u;
        }
    }
    size_t len = 0;
    err = nvs_get_blob(h, APP_MEAS_NVS_Q, nullptr, &len);
    if (err != ESP_OK || len < 2) {
        nvs_close(h);
        ESP_LOGI(TAG, "geen metingen-blob; lege wachtrij");
        return;
    }
    uint8_t* blob = static_cast<uint8_t*>(
        heap_caps_malloc(len, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (blob == nullptr) {
        blob = static_cast<uint8_t*>(heap_caps_malloc(len, MALLOC_CAP_8BIT));
    }
    if (blob == nullptr) {
        nvs_close(h);
        ESP_LOGE(TAG, "mislukt: geen RAM om blob te lezen");
        return;
    }
    err = nvs_get_blob(h, APP_MEAS_NVS_Q, blob, &len);
    nvs_close(h);
    if (err != ESP_OK) {
        heap_caps_free(blob);
        ESP_LOGE(TAG, "mislukt: blob lezen: %s (0x%x)", esp_err_to_name(err), err);
        return;
    }
    if (blob[0] != k_blob_ver) {
        ESP_LOGW(TAG, "onbekende blob-versie %u; wachtrij leeg", blob[0]);
        heap_caps_free(blob);
        return;
    }
    int n = blob[1];
    const size_t need = 2 + static_cast<size_t>(n) * sizeof(PackedRec);
    if (need > len) {
        n = static_cast<int>((len - 2) / sizeof(PackedRec));
    }
    if (n > k_meas_queue_max) {
        n = k_meas_queue_max;
    }
    if (n > 0) {
        memcpy(s_rec, blob + 2, static_cast<size_t>(n) * sizeof(PackedRec));
    }
    s_n = n;
    heap_caps_free(blob);
    int pending = 0;
    for (int i = 0; i < s_n; i++) {
        if (s_rec[i].status == static_cast<uint8_t>(MeasStatus::Queued)) {
            pending++;
        }
    }
    ESP_LOGI(TAG, "wachtrij uit NVS: %d items, %d in wachtrij, mock=%d",
             s_n, pending, s_mock ? 1 : 0);
}

static void make_uuid_v4(uint8_t u[16])
{
    esp_fill_random(u, 16);
    u[6] = static_cast<uint8_t>((u[6] & 0x0F) | 0x40);
    u[8] = static_cast<uint8_t>((u[8] & 0x3F) | 0x80);
}

static int find_client_locked(const uint8_t uuid[16])
{
    for (int i = 0; i < s_n; i++) {
        if (memcmp(s_rec[i].uuid, uuid, 16) == 0) {
            return i;
        }
    }
    return -1;
}

static bool evict_uploaded_locked()
{
    for (int i = 0; i < s_n; i++) {
        if (s_rec[i].status == static_cast<uint8_t>(MeasStatus::Uploaded)) {
            if (i + 1 < s_n) {
                memmove(&s_rec[i], &s_rec[i + 1],
                        static_cast<size_t>(s_n - i - 1) * sizeof(PackedRec));
            }
            s_n--;
            return true;
        }
    }
    return false;
}

void measurement_queue_init()
{
    if (s_mutex == nullptr) {
        s_mutex = xSemaphoreCreateMutex();
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (!s_inited) {
        memset(s_rec, 0, sizeof(s_rec));
        for (int i = 0; i < k_param_count; i++) {
            s_last[i] = MeasLast{};
        }
        s_n = 0;
        s_mock = true;
        load_nvs_locked();
        refresh_last_locked();
        s_inited = true;
    }
    xSemaphoreGive(s_mutex);
}

bool measurement_queue_enqueue(int param, int unit, float value, int64_t measured_at,
                               char* client_id_out, size_t client_id_len)
{
    const ParamDef* def = param_catalog_get(param);
    if (def == nullptr) {
        return false;
    }
    if (unit < 0 || unit >= def->unit_count) {
        unit = 0;
    }
    if (s_mutex == nullptr) {
        return false;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    while (s_n >= k_meas_queue_max) {
        if (!evict_uploaded_locked()) {
            ESP_LOGE(TAG, "mislukt: wachtrij vol en geen geuploade om te wissen");
            xSemaphoreGive(s_mutex);
            return false;
        }
    }
    PackedRec r = {};
    make_uuid_v4(r.uuid);
    r.param = static_cast<uint8_t>(param);
    r.unit = static_cast<uint8_t>(unit);
    r.status = static_cast<uint8_t>(MeasStatus::Queued);
    r.value = value;
    r.measured_at = (measured_at > 0 && measured_at < 0xFFFFFFFFLL)
                        ? static_cast<uint32_t>(measured_at) : 0;
    const int64_t now = measured_at > 1700000000 ? measured_at : 0;
    r.queued_at = (now > 0 && now < 0xFFFFFFFFLL) ? static_cast<uint32_t>(now) : r.measured_at;
    s_rec[s_n++] = r;
    s_unit_pref[param] = static_cast<uint8_t>(unit);
    s_last[param].present = true;
    s_last[param].from_app = false;
    s_last[param].unit = r.unit;
    s_last[param].value = value;
    s_last[param].measured_at = r.measured_at;
    s_last[param].status = MeasStatus::Queued;
    if (client_id_out != nullptr && client_id_len > 0) {
        uuid_to_str(r.uuid, client_id_out, client_id_len);
    }
    save_nvs_locked();
    char id[37];
    uuid_to_str(r.uuid, id, sizeof(id));
    ESP_LOGI(TAG, "meting in wachtrij: %s %s=%.4f %s client_id=%s",
             def->label, def->key, static_cast<double>(value),
             def->units[unit] != nullptr ? def->units[unit] : "", id);
    xSemaphoreGive(s_mutex);
    return true;
}

static PackedRec s_next_copy;
static MeasItem s_next_item;
static bool s_next_valid = false;

const MeasItem* measurement_queue_next_pending()
{
    if (s_mutex == nullptr) {
        return nullptr;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_next_valid = false;
    for (int i = 0; i < s_n; i++) {
        if (s_rec[i].status == static_cast<uint8_t>(MeasStatus::Queued)) {
            s_next_copy = s_rec[i];
            unpack(s_next_copy, &s_next_item);
            s_next_valid = true;
            break;
        }
    }
    xSemaphoreGive(s_mutex);
    return s_next_valid ? &s_next_item : nullptr;
}

void measurement_queue_mark_uploaded(const char* client_id)
{
    uint8_t u[16];
    if (!uuid_from_str(client_id, u) || s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const int i = find_client_locked(u);
    if (i >= 0) {
        s_rec[i].status = static_cast<uint8_t>(MeasStatus::Uploaded);
        s_rec[i].reject = 0;
        if (s_rec[i].param < k_param_count && !s_last[s_rec[i].param].from_app) {
            s_last[s_rec[i].param].status = MeasStatus::Uploaded;
        }
        save_nvs_locked();
        ESP_LOGI(TAG, "meting geupload: client_id=%s", client_id);
    }
    xSemaphoreGive(s_mutex);
}

void measurement_queue_mark_rejected(const char* client_id, const char* reason)
{
    uint8_t u[16];
    if (!uuid_from_str(client_id, u) || s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const int i = find_client_locked(u);
    if (i >= 0) {
        s_rec[i].status = static_cast<uint8_t>(MeasStatus::Rejected);
        s_rec[i].reject = 1;
        if (s_rec[i].param < k_param_count && !s_last[s_rec[i].param].from_app) {
            s_last[s_rec[i].param].status = MeasStatus::Rejected;
        }
        save_nvs_locked();
        ESP_LOGW(TAG, "meting afgewezen: client_id=%s reden='%s'",
                 client_id, reason != nullptr ? reason : "");
    }
    xSemaphoreGive(s_mutex);
}

void measurement_queue_set_mock(bool on)
{
    if (s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (s_mock != on) {
        s_mock = on;
        save_nvs_locked();
        ESP_LOGI(TAG, "backend MOCK -> %s", on ? "aan" : "uit");
    }
    xSemaphoreGive(s_mutex);
}

bool measurement_queue_mock()
{
    if (s_mutex == nullptr) {
        return true;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const bool m = s_mock;
    xSemaphoreGive(s_mutex);
    return m;
}

void measurement_queue_set_unit_pref(int param, int unit)
{
    if (param < 0 || param >= k_param_count || s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_unit_pref[param] = static_cast<uint8_t>(unit);
    save_nvs_locked();
    xSemaphoreGive(s_mutex);
}

int measurement_queue_unit_pref(int param)
{
    if (param < 0 || param >= k_param_count || s_mutex == nullptr) {
        return 0;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    int u = s_unit_pref[param];
    xSemaphoreGive(s_mutex);
    const ParamDef* d = param_catalog_get(param);
    if (d != nullptr && u >= d->unit_count) {
        u = 0;
    }
    return u;
}

void measurement_queue_apply_latest_json(const char* body)
{
    if (body == nullptr || body[0] == '\0' || s_mutex == nullptr) {
        return;
    }
    cJSON* root = cJSON_Parse(body);
    if (root == nullptr) {
        return;
    }
    const cJSON* arr = cJSON_GetObjectItemCaseSensitive(root, "latest_measurements");
    if (!cJSON_IsArray(arr)) {
        cJSON_Delete(root);
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const int n = cJSON_GetArraySize(arr);
    int applied = 0;
    for (int i = 0; i < n; i++) {
        const cJSON* it = cJSON_GetArrayItem(arr, i);
        if (!cJSON_IsObject(it)) {
            continue;
        }
        const cJSON* keyj = cJSON_GetObjectItemCaseSensitive(it, "parameter");
        const char* key = nullptr;
        if (cJSON_IsString(keyj) && keyj->valuestring != nullptr) {
            key = keyj->valuestring;
        } else {
            const cJSON* key2 = cJSON_GetObjectItemCaseSensitive(it, "key");
            if (cJSON_IsString(key2)) {
                key = key2->valuestring;
            }
        }
        const int idx = param_catalog_index_of(key);
        if (idx < 0) {
            continue;
        }
        const cJSON* valj = cJSON_GetObjectItemCaseSensitive(it, "value");
        if (!cJSON_IsNumber(valj)) {
            continue;
        }
        s_last[idx].present = true;
        s_last[idx].from_app = true;
        s_last[idx].value = static_cast<float>(valj->valuedouble);
        s_last[idx].status = MeasStatus::Uploaded;
        const cJSON* at = cJSON_GetObjectItemCaseSensitive(it, "measured_at");
        s_last[idx].measured_at = 0;
        if (cJSON_IsString(at) && at->valuestring != nullptr) {
            int y = 0, mo = 0, d = 0, h = 0, mi = 0, se = 0;
            if (sscanf(at->valuestring, " %d-%d-%dT%d:%d:%d", &y, &mo, &d, &h, &mi, &se) >= 3) {
                struct tm t = {};
                t.tm_year = y - 1900;
                t.tm_mon = mo - 1;
                t.tm_mday = d;
                t.tm_hour = h;
                t.tm_min = mi;
                t.tm_sec = se;
                const time_t u = mktime(&t);
                if (u > 1700000000) {
                    s_last[idx].measured_at = static_cast<int64_t>(u);
                }
            }
        }
        applied++;
    }
    xSemaphoreGive(s_mutex);
    cJSON_Delete(root);
    if (applied > 0) {
        ESP_LOGI(TAG, "latest_measurements toegepast: %d velden (bron app)", applied);
    }
}

void measurement_queue_snapshot(MeasSnapshot* out)
{
    if (out == nullptr) {
        return;
    }
    *out = MeasSnapshot{};
    if (s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    out->count = s_n;
    out->mock = s_mock;
    memcpy(out->last, s_last, sizeof(s_last));
    int pending = 0;
    for (int i = 0; i < s_n; i++) {
        if (s_rec[i].status == static_cast<uint8_t>(MeasStatus::Queued)) {
            pending++;
        }
    }
    out->pending = pending;
    int h = 0;
    for (int i = s_n - 1; i >= 0 && h < k_meas_history_n; i--) {
        unpack(s_rec[i], &out->history[h]);
        h++;
    }
    out->history_n = h;
    xSemaphoreGive(s_mutex);
}

int measurement_queue_pending_count()
{
    if (s_mutex == nullptr) {
        return 0;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    int pending = 0;
    for (int i = 0; i < s_n; i++) {
        if (s_rec[i].status == static_cast<uint8_t>(MeasStatus::Queued)) {
            pending++;
        }
    }
    xSemaphoreGive(s_mutex);
    return pending;
}

bool measurement_queue_get(const char* client_id, MeasItem* out)
{
    uint8_t u[16];
    if (!uuid_from_str(client_id, u) || out == nullptr || s_mutex == nullptr) {
        return false;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const int i = find_client_locked(u);
    const bool ok = (i >= 0);
    if (ok) {
        unpack(s_rec[i], out);
    }
    xSemaphoreGive(s_mutex);
    return ok;
}

bool measurement_queue_get_last(int param, MeasItem* out)
{
    if (out == nullptr || param < 0 || param >= k_param_count || s_mutex == nullptr) {
        return false;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    bool ok = false;
    for (int i = s_n - 1; i >= 0; i--) {
        if (s_rec[i].param == static_cast<uint8_t>(param)) {
            unpack(s_rec[i], out);
            ok = true;
            break;
        }
    }
    xSemaphoreGive(s_mutex);
    return ok;
}
