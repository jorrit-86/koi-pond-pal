// KOIoT Paneel - live_store (implementatie).
//
// Mappingtabel (M1-log 27 sep 2026 + brief §6.1):
//   Bevestigd: status, flow_*, water_temp, air_temp, humidity (kale string / ON/OFF).
//   pH: geen suffix verzonnen (W3). Zie TODO onder k_map.
#include "data/live_store.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "nvs.h"
#include "nvs_flash.h"

#include "app_config.h"
#include "core/time_sync.h"

static const char* TAG = "live_store";

enum class PayloadKind : uint8_t {
    Text = 0,
    Number,
    OnOff,
};

struct TopicMapEntry {
    const char* suffix;
    LiveField field;
    PayloadKind kind;
    bool confirmed;     // gezien in de hardwarelog
};

// Enige mappingtabel. Suffix = deel na "koiiot/<device_id>/".
static const TopicMapEntry k_map[] = {
    {"status",     LiveField::Status,    PayloadKind::Text,   true},
    {"flow_rate",  LiveField::FlowRate,  PayloadKind::Number, true},
    {"flow_total", LiveField::FlowTotal, PayloadKind::Number, true},
    {"flow_leak",  LiveField::FlowLeak,  PayloadKind::OnOff,  true},
    {"water_temp", LiveField::WaterTemp, PayloadKind::Number, true},  // 1 decimaal, stale 30 min
    {"air_temp",   LiveField::AirTemp,   PayloadKind::Number, true},  // 1 decimaal, stale 30 min
    {"humidity",   LiveField::Humidity,  PayloadKind::Number, true},  // RV %, stale 30 min
};

// TODO (W3): pH-suffix niet verzonnen. Verwachte kandidaten alleen als commentaar,
// zodat een ongemapped-logregel de echte naam vangt: ph, pH, water_ph.
// Bij ontvangst: "ongemapped topic" in de log, daarna hier één rij toevoegen.

enum class ValueSource : uint8_t {
    None = 0,
    Mqtt,
    Database,
};

struct FieldState {
    bool present = false;
    int64_t last_update_us = 0;
    int64_t measured_at_unix = 0;   // 0 = onbekend; leeftijd vanaf dit tijdstip als gezet
    ValueSource source = ValueSource::None;
    double value = 0;
    bool on = false;
    char text[24] = "";
    char sensor_id[24] = "";
};

static FieldState* s_fields = nullptr;
static SemaphoreHandle_t s_mutex = nullptr;

static constexpr int k_hist_series = 5;

struct HistSeries {
    float* pts = nullptr;
    int n = 0;
    int head = 0;
    int64_t last_us = 0;
    int64_t first_unix = 0;
    int64_t last_unix = 0;
    bool from_db = false;
};

static HistSeries s_hist[k_hist_series];

static int hist_index(LiveField field)
{
    switch (field) {
        case LiveField::WaterTemp: return 0;
        case LiveField::AirTemp:   return 1;
        case LiveField::Humidity:  return 2;
        case LiveField::Ph:        return 3;
        case LiveField::FlowRate:  return 4;
        default:                   return -1;
    }
}

static LiveField hist_field(int idx)
{
    switch (idx) {
        case 0: return LiveField::WaterTemp;
        case 1: return LiveField::AirTemp;
        case 2: return LiveField::Humidity;
        case 3: return LiveField::Ph;
        case 4: return LiveField::FlowRate;
        default: return LiveField::Count;
    }
}

static void hist_push(HistSeries& h, float v, int64_t now_us)
{
    if (h.pts == nullptr) {
        return;
    }
    if (h.n > 0 && (now_us - h.last_us) < (static_cast<int64_t>(APP_HIST_INTERVAL_S) * 1000000LL)) {
        return;
    }
    h.pts[h.head] = v;
    h.head++;
    if (h.head >= APP_HIST_POINTS) {
        h.head = 0;
    }
    if (h.n < APP_HIST_POINTS) {
        h.n++;
    }
    h.last_us = now_us;
    if (h.n == 1 && time_sync_is_synced()) {
        const time_t now = time(nullptr);
        if (now > 1700000000) {
            h.first_unix = static_cast<int64_t>(now);
        }
    }
}

static void hist_sample_all(int64_t now_us)
{
    for (int i = 0; i < k_hist_series; i++) {
        const LiveField f = hist_field(i);
        if (f == LiveField::Count || s_fields == nullptr) {
            continue;
        }
        const FieldState& src = s_fields[static_cast<size_t>(f)];
        if (!src.present) {
            continue;
        }
        hist_push(s_hist[i], static_cast<float>(src.value), now_us);
    }
}

static float s_midnight_l = 0;
static uint32_t s_midnight_ymd = 0;
static bool s_midnight_loaded = false;

static const int k_unmapped_max = 16;
static char (*s_unmapped)[32] = nullptr;
static int s_unmapped_n = 0;
static bool s_unmapped_full_logged = false;

static bool ieq(const char* a, const char* b)
{
    if (a == nullptr || b == nullptr) {
        return a == b;
    }
    while (*a != '\0' && *b != '\0') {
        char ca = *a;
        char cb = *b;
        if (ca >= 'A' && ca <= 'Z') {
            ca = static_cast<char>(ca + 32);
        }
        if (cb >= 'A' && cb <= 'Z') {
            cb = static_cast<char>(cb + 32);
        }
        if (ca != cb) {
            return false;
        }
        a++;
        b++;
    }
    return *a == *b;
}

static void copy_term(char* dst, size_t dst_size, const char* src, size_t src_len)
{
    if (dst_size == 0) {
        return;
    }
    size_t n = src_len;
    if (n >= dst_size) {
        n = dst_size - 1;
    }
    if (src != nullptr && n > 0) {
        memcpy(dst, src, n);
    }
    dst[n] = '\0';
    for (size_t i = 0; i < n; i++) {
        const unsigned char c = static_cast<unsigned char>(dst[i]);
        if (c < 32 || c == 127) {
            dst[i] = ' ';
        }
    }
}

static bool parse_number(const char* s, double* out)
{
    if (s == nullptr || s[0] == '\0' || out == nullptr) {
        return false;
    }
    char* end = nullptr;
    const double v = strtod(s, &end);
    if (end == s) {
        return false;
    }
    while (*end == ' ' || *end == '\t' || *end == '\r' || *end == '\n') {
        end++;
    }
    if (*end != '\0') {
        return false;
    }
    if (!std::isfinite(v)) {
        return false;
    }
    *out = v;
    return true;
}

static bool parse_onoff(const char* s, bool* on)
{
    if (s == nullptr || on == nullptr) {
        return false;
    }
    while (*s == ' ' || *s == '\t') {
        s++;
    }
    if (ieq(s, "ON")) {
        *on = true;
        return true;
    }
    if (ieq(s, "OFF")) {
        *on = false;
        return true;
    }
    return false;
}

static const TopicMapEntry* find_map(const char* suffix)
{
    for (const TopicMapEntry& e : k_map) {
        if (strcmp(e.suffix, suffix) == 0) {
            return &e;
        }
    }
    return nullptr;
}

static int32_t stale_limit_s(LiveField field)
{
    switch (field) {
        case LiveField::FlowRate:
        case LiveField::FlowTotal:
        case LiveField::FlowLeak:
            return APP_STALE_FLOW_S;
        case LiveField::WaterTemp:
        case LiveField::AirTemp:
        case LiveField::Humidity:
        case LiveField::Ph:
            return APP_STALE_TEMP_S;
        case LiveField::Status:
        default:
            return APP_STALE_TEMP_S;
    }
}

static int64_t mqtt_measured_unix()
{
    if (!time_sync_is_synced()) {
        return 0;
    }
    const time_t now = time(nullptr);
    if (now < 1700000000) {
        return 0;
    }
    return static_cast<int64_t>(now);
}

static int32_t age_from_state(const FieldState& src, int64_t now_us)
{
    if (src.measured_at_unix > 1700000000 && time_sync_is_synced()) {
        const int64_t now = static_cast<int64_t>(time(nullptr));
        const int64_t age = (now > src.measured_at_unix) ? (now - src.measured_at_unix) : 0;
        return (age > 0x7FFFFFFF) ? 0x7FFFFFFF : static_cast<int32_t>(age);
    }
    if (src.last_update_us > 0) {
        const int64_t age = (now_us > src.last_update_us) ? ((now_us - src.last_update_us) / 1000000) : 0;
        return (age > 0x7FFFFFFF) ? 0x7FFFFFFF : static_cast<int32_t>(age);
    }
    return -1;
}

static LiveFieldSnap make_snap(const FieldState& src, LiveField field, int64_t now_us)
{
    LiveFieldSnap out;
    out.present = src.present;
    out.value = src.value;
    out.on = src.on;
    out.measured_at_unix = src.measured_at_unix;
    out.from_database = src.present && src.source == ValueSource::Database;
    strncpy(out.text, src.text, sizeof(out.text) - 1);
    out.text[sizeof(out.text) - 1] = '\0';
    strncpy(out.sensor_id, src.sensor_id, sizeof(out.sensor_id) - 1);
    out.sensor_id[sizeof(out.sensor_id) - 1] = '\0';
    if (!src.present) {
        out.age_s = -1;
        out.stale = false;
        return out;
    }
    out.age_s = age_from_state(src, now_us);
    if (out.age_s < 0) {
        out.stale = false;
        return out;
    }
    out.stale = out.age_s > stale_limit_s(field);
    return out;
}

static uint32_t local_ymd()
{
    const time_t now = time(nullptr);
    struct tm tm_local = {};
    localtime_r(&now, &tm_local);
    return static_cast<uint32_t>((tm_local.tm_year + 1900) * 10000 +
                                 (tm_local.tm_mon + 1) * 100 +
                                 tm_local.tm_mday);
}

static void persist_midnight()
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_LIVE_NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS '%s' openen: %s (0x%x)", APP_LIVE_NVS_NS, esp_err_to_name(err), err);
        return;
    }
    err = nvs_set_blob(h, APP_LIVE_NVS_MID_L, &s_midnight_l, sizeof(s_midnight_l));
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS %s schrijven: %s (0x%x)", APP_LIVE_NVS_MID_L, esp_err_to_name(err), err);
        nvs_close(h);
        return;
    }
    err = nvs_set_u32(h, APP_LIVE_NVS_MID_YMD, s_midnight_ymd);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS %s schrijven: %s (0x%x)", APP_LIVE_NVS_MID_YMD, esp_err_to_name(err), err);
        nvs_close(h);
        return;
    }
    err = nvs_commit(h);
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS commit middernachtstand: %s (0x%x)", esp_err_to_name(err), err);
        return;
    }
    ESP_LOGI(TAG, "middernachtstand bewaard: %.2f L op lokale dag %lu",
             static_cast<double>(s_midnight_l), static_cast<unsigned long>(s_midnight_ymd));
}

static void load_midnight()
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_LIVE_NVS_NS, NVS_READONLY, &h);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "geen middernachtstand in NVS (eerste keer of gewist)");
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS '%s' openen: %s (0x%x); start zonder baseline",
                 APP_LIVE_NVS_NS, esp_err_to_name(err), err);
        return;
    }

    size_t sz = sizeof(s_midnight_l);
    err = nvs_get_blob(h, APP_LIVE_NVS_MID_L, &s_midnight_l, &sz);
    uint32_t ymd = 0;
    const esp_err_t err_ymd = nvs_get_u32(h, APP_LIVE_NVS_MID_YMD, &ymd);
    nvs_close(h);

    if (err == ESP_OK && err_ymd == ESP_OK && sz == sizeof(s_midnight_l)) {
        s_midnight_ymd = ymd;
        s_midnight_loaded = true;
        ESP_LOGI(TAG, "middernachtstand geladen: %.2f L (dag %lu)",
                 static_cast<double>(s_midnight_l), static_cast<unsigned long>(s_midnight_ymd));
        return;
    }
    ESP_LOGI(TAG, "geen geldige middernachtstand in NVS");
}

// Regel: zie ARCHITECTUUR.md. Alleen met synchrone SNTP-tijd (R5: nooit 1970).
// Geen stand, of opgeslagen dag != lokale dag: eerste geldige flow_total wordt baseline
// zodat "vandaag" niet de lifetime-total toont. Zelfde dag: hergebruik NVS-stand.
// flow_total < baseline (teller-reset): nieuwe baseline.
static void maybe_set_baseline(double flow_total)
{
    if (!time_sync_is_synced()) {
        return;
    }
    const uint32_t today = local_ymd();
    if (today < 20260101u) {
        return;
    }

    const bool have = s_midnight_loaded && (s_midnight_ymd == today);
    if (!have) {
        s_midnight_l = static_cast<float>(flow_total);
        s_midnight_ymd = today;
        s_midnight_loaded = true;
        persist_midnight();
        ESP_LOGI(TAG, "vandaag-baseline gezet op %.2f L (eerste geldige flow_total van lokale dag %lu)",
                 static_cast<double>(s_midnight_l), static_cast<unsigned long>(today));
        return;
    }
    if (flow_total + 0.05 < static_cast<double>(s_midnight_l)) {
        ESP_LOGW(TAG, "flow_total (%.2f) lager dan baseline (%.2f); teller-reset, nieuwe baseline",
                 flow_total, static_cast<double>(s_midnight_l));
        s_midnight_l = static_cast<float>(flow_total);
        persist_midnight();
    }
}

static bool suffix_seen_unmapped(const char* suffix)
{
    if (s_unmapped == nullptr) {
        return false;
    }
    for (int i = 0; i < s_unmapped_n; i++) {
        if (strcmp(s_unmapped[i], suffix) == 0) {
            return true;
        }
    }
    return false;
}

static void remember_unmapped(const char* suffix)
{
    if (s_unmapped == nullptr) {
        return;
    }
    if (s_unmapped_n >= k_unmapped_max) {
        if (!s_unmapped_full_logged) {
            ESP_LOGW(TAG, "meer dan %d ongemapte suffixes; verdere nieuwe namen worden nog gelogd maar niet onthouden",
                     k_unmapped_max);
            s_unmapped_full_logged = true;
        }
        return;
    }
    copy_term(s_unmapped[s_unmapped_n], sizeof(s_unmapped[0]), suffix, strlen(suffix));
    s_unmapped_n++;
}

static void log_unmapped(const char* suffix, const char* payload)
{
    if (suffix_seen_unmapped(suffix)) {
        return;
    }
    remember_unmapped(suffix);
    ESP_LOGI(TAG, "ongemapped topic: suffix='%s' payload='%s' (geen veld in de mappingtabel)",
             suffix, (payload != nullptr && payload[0] != '\0') ? payload : "(leeg)");
}

void live_store_init()
{
    if (s_mutex == nullptr) {
        s_mutex = xSemaphoreCreateMutex();
    }
    if (s_fields == nullptr) {
        s_fields = static_cast<FieldState*>(
            heap_caps_calloc(static_cast<size_t>(LiveField::Count), sizeof(FieldState),
                             MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
        if (s_fields == nullptr) {
            ESP_LOGE(TAG, "geen PSRAM voor live-velden; geen interne fallback (hosted-DMA)");
        }
    }
    if (s_unmapped == nullptr) {
        s_unmapped = static_cast<char(*)[32]>(
            heap_caps_calloc(static_cast<size_t>(k_unmapped_max), 32,
                             MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    }
    for (int i = 0; i < k_hist_series; i++) {
        if (s_hist[i].pts != nullptr) {
            continue;
        }
        s_hist[i].pts = static_cast<float*>(
            heap_caps_calloc(static_cast<size_t>(APP_HIST_POINTS), sizeof(float),
                             MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
        if (s_hist[i].pts == nullptr) {
            ESP_LOGE(TAG, "geen PSRAM voor historie-reeks %d; grafiek blijft leeg", i);
        }
    }
    load_midnight();
    ESP_LOGI(TAG, "live_store klaar; %u gemapte suffixes, stale temp/RV/pH %d s, debiet %d s, "
                  "historie %d punten / %d s (PSRAM)",
             static_cast<unsigned>(sizeof(k_map) / sizeof(k_map[0])),
             APP_STALE_TEMP_S, APP_STALE_FLOW_S, APP_HIST_POINTS, APP_HIST_INTERVAL_S);
}

void live_store_apply(const char* topic, size_t topic_len,
                      const char* payload, size_t payload_len,
                      bool retain)
{
    if (s_mutex == nullptr || s_fields == nullptr) {
        return;
    }

    char topic_z[APP_DIAG_TOPIC_MAX];
    copy_term(topic_z, sizeof(topic_z), topic, topic_len);

    char payload_z[APP_DIAG_PAYLOAD_MAX];
    copy_term(payload_z, sizeof(payload_z), payload, payload_len);

    char prefix[80];
    snprintf(prefix, sizeof(prefix), "%s/%s/", MQTT_TOPIC_PREFIX, MQTT_DEVICE_ID);
    const size_t pre_len = strlen(prefix);
    const char* suffix = topic_z;
    if (strncmp(topic_z, prefix, pre_len) == 0) {
        suffix = topic_z + pre_len;
    }

    if (suffix[0] == '\0') {
        ESP_LOGW(TAG, "leeg topic-suffix, genegeerd (topic='%s')", topic_z);
        return;
    }

    const TopicMapEntry* map = find_map(suffix);
    if (map == nullptr) {
        log_unmapped(suffix, payload_z);
        return;
    }

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    FieldState& dst = s_fields[static_cast<size_t>(map->field)];
    bool leak_changed = false;
    bool leak_on = false;

    switch (map->kind) {
        case PayloadKind::Number: {
            double v = 0;
            if (!parse_number(payload_z, &v)) {
                ESP_LOGW(TAG, "ongeldige getalpayload op '%s': '%s'", suffix, payload_z);
                xSemaphoreGive(s_mutex);
                return;
            }
            const bool first = !dst.present;
            const int64_t mqtt_at = mqtt_measured_unix();
            if (dst.present && dst.source == ValueSource::Database &&
                dst.measured_at_unix > 0 && mqtt_at > 0 && dst.measured_at_unix > mqtt_at) {
                ESP_LOGI(TAG, "MQTT %s genegeerd: databasewaarde is nieuwer", suffix);
                xSemaphoreGive(s_mutex);
                return;
            }
            dst.present = true;
            dst.value = v;
            dst.last_update_us = esp_timer_get_time();
            dst.measured_at_unix = mqtt_at;
            dst.source = ValueSource::Mqtt;
            if (map->field == LiveField::FlowTotal) {
                maybe_set_baseline(v);
            }
            if (first && !map->confirmed) {
                ESP_LOGI(TAG, "kandidaat-topic bevestigd: '%s' = %g (retain=%d)", suffix, v, retain ? 1 : 0);
            }
            break;
        }
        case PayloadKind::OnOff: {
            bool on = false;
            if (!parse_onoff(payload_z, &on)) {
                ESP_LOGW(TAG, "ongeldige ON/OFF-payload op '%s': '%s'", suffix, payload_z);
                xSemaphoreGive(s_mutex);
                return;
            }
            leak_changed = !dst.present || (dst.on != on);
            leak_on = on;
            dst.present = true;
            dst.on = on;
            dst.value = on ? 1.0 : 0.0;
            dst.last_update_us = esp_timer_get_time();
            dst.measured_at_unix = mqtt_measured_unix();
            dst.source = ValueSource::Mqtt;
            break;
        }
        case PayloadKind::Text:
            dst.present = true;
            copy_term(dst.text, sizeof(dst.text), payload_z, strlen(payload_z));
            dst.last_update_us = esp_timer_get_time();
            dst.measured_at_unix = mqtt_measured_unix();
            dst.source = ValueSource::Mqtt;
            break;
    }

    xSemaphoreGive(s_mutex);

    if (map->field == LiveField::FlowLeak && leak_changed) {
        if (leak_on) {
            ESP_LOGW(TAG, "lekalarm AAN (flow_leak=ON)");
        } else {
            ESP_LOGI(TAG, "lekalarm UIT (flow_leak=OFF)");
        }
    }
    (void)retain;
}

static const char* field_name(LiveField field)
{
    switch (field) {
        case LiveField::WaterTemp: return "water_temp";
        case LiveField::AirTemp:   return "air_temp";
        case LiveField::Humidity:  return "humidity";
        case LiveField::Ph:        return "ph";
        case LiveField::FlowRate:  return "flow_rate";
        case LiveField::FlowTotal: return "flow_total";
        default:                   return "?";
    }
}

void live_store_apply_db(LiveField field, double value, int64_t measured_at_unix,
                         const char* sensor_id, bool mqtt_down_over_5min)
{
    if (s_mutex == nullptr || s_fields == nullptr) {
        return;
    }
    if (measured_at_unix < 1700000000) {
        ESP_LOGW(TAG, "databasewaarde %s genegeerd: measured_at ongeldig (R5)", field_name(field));
        return;
    }

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    FieldState& dst = s_fields[static_cast<size_t>(field)];

    if (dst.present) {
        int64_t have_at = dst.measured_at_unix;
        if (have_at == 0 && dst.source == ValueSource::Mqtt && dst.last_update_us > 0 &&
            time_sync_is_synced()) {
            // MQTT zonder wall-clock: ontvangstmoment = nu minus esp_timer-leeftijd.
            const int64_t age_s = (esp_timer_get_time() - dst.last_update_us) / 1000000;
            have_at = static_cast<int64_t>(time(nullptr)) - age_s;
        }
        if (dst.source == ValueSource::Mqtt && !mqtt_down_over_5min) {
            if (have_at >= measured_at_unix) {
                xSemaphoreGive(s_mutex);
                return;
            }
            // MQTT verbonden en DB nieuwer: toch overnemen (rangorde meettijdstip).
        } else if (have_at >= measured_at_unix) {
            xSemaphoreGive(s_mutex);
            return;
        }
    }

    dst.present = true;
    dst.value = value;
    dst.measured_at_unix = measured_at_unix;
    dst.last_update_us = esp_timer_get_time();
    dst.source = ValueSource::Database;
    if (sensor_id != nullptr && sensor_id[0] != '\0') {
        copy_term(dst.sensor_id, sizeof(dst.sensor_id), sensor_id, strlen(sensor_id));
    } else {
        dst.sensor_id[0] = '\0';
    }
    if (field == LiveField::FlowTotal) {
        maybe_set_baseline(value);
    }
    xSemaphoreGive(s_mutex);
    ESP_LOGI(TAG, "databasewaarde gezet: %s=%g measured_at=%lld sensor='%s'",
             field_name(field), value, (long long)measured_at_unix,
             (sensor_id != nullptr && sensor_id[0] != '\0') ? sensor_id : "-");
}

LiveSnapshot live_store_snapshot()
{
    LiveSnapshot snap;
    if (s_mutex == nullptr || s_fields == nullptr) {
        return snap;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);

    const FieldState& total = s_fields[static_cast<size_t>(LiveField::FlowTotal)];
    if (total.present) {
        maybe_set_baseline(total.value);
    }

    const int64_t now_us = esp_timer_get_time();
    snap.status     = make_snap(s_fields[static_cast<size_t>(LiveField::Status)],    LiveField::Status,    now_us);
    snap.water_temp = make_snap(s_fields[static_cast<size_t>(LiveField::WaterTemp)], LiveField::WaterTemp, now_us);
    snap.air_temp   = make_snap(s_fields[static_cast<size_t>(LiveField::AirTemp)],   LiveField::AirTemp,   now_us);
    snap.humidity   = make_snap(s_fields[static_cast<size_t>(LiveField::Humidity)],  LiveField::Humidity,  now_us);
    snap.ph         = make_snap(s_fields[static_cast<size_t>(LiveField::Ph)],        LiveField::Ph,        now_us);
    snap.flow_rate  = make_snap(s_fields[static_cast<size_t>(LiveField::FlowRate)],  LiveField::FlowRate,  now_us);
    snap.flow_total = make_snap(s_fields[static_cast<size_t>(LiveField::FlowTotal)], LiveField::FlowTotal, now_us);
    snap.flow_leak  = make_snap(s_fields[static_cast<size_t>(LiveField::FlowLeak)],  LiveField::FlowLeak,  now_us);

    snap.leak_alarm = snap.flow_leak.present && snap.flow_leak.on;

    if (snap.flow_total.present && time_sync_is_synced() && s_midnight_loaded &&
        s_midnight_ymd == local_ymd()) {
        const double today = snap.flow_total.value - static_cast<double>(s_midnight_l);
        snap.today_ok = true;
        snap.today_l = (today > 0.0) ? static_cast<float>(today) : 0.0f;
    }

    hist_sample_all(now_us);

    xSemaphoreGive(s_mutex);
    return snap;
}

void live_store_load_history(LiveField field, const float* vals, int n,
                             int64_t first_unix, int64_t last_unix)
{
    const int idx = hist_index(field);
    if (idx < 0 || vals == nullptr || n <= 0 || s_mutex == nullptr) {
        return;
    }

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    HistSeries& h = s_hist[idx];
    if (h.pts == nullptr) {
        xSemaphoreGive(s_mutex);
        return;
    }

    int take = n;
    int src0 = 0;
    if (take > APP_HIST_POINTS) {
        src0 = take - APP_HIST_POINTS;
        take = APP_HIST_POINTS;
    }
    for (int i = 0; i < take; i++) {
        h.pts[i] = vals[src0 + i];
    }
    h.n = take;
    h.head = (take < APP_HIST_POINTS) ? take : 0;
    h.first_unix = first_unix;
    h.last_unix = last_unix;
    h.from_db = true;

    if (s_fields != nullptr) {
        const FieldState& src = s_fields[static_cast<size_t>(field)];
        if (src.present && src.measured_at_unix > 1700000000 &&
            last_unix > 0 &&
            src.measured_at_unix > last_unix + (APP_HIST_INTERVAL_S / 2)) {
            if (h.n < APP_HIST_POINTS) {
                h.pts[h.n] = static_cast<float>(src.value);
                h.n++;
                h.head = h.n;
            } else {
                h.pts[h.head] = static_cast<float>(src.value);
                h.head++;
                if (h.head >= APP_HIST_POINTS) {
                    h.head = 0;
                }
            }
            h.last_unix = src.measured_at_unix;
        }
    }
    h.last_us = esp_timer_get_time();
    const int loaded = h.n;
    xSemaphoreGive(s_mutex);
    ESP_LOGI(TAG, "historie uit database: %s n=%d first=%lld last=%lld",
             field_name(field), loaded, (long long)first_unix, (long long)last_unix);
}

int live_store_history_copy(LiveField field, float* dst, int dst_max,
                            float* min_v, float* max_v, float* avg_v,
                            int64_t* first_unix, bool* from_db)
{
    const int idx = hist_index(field);
    if (idx < 0) {
        if (min_v != nullptr) {
            *min_v = 0;
        }
        if (max_v != nullptr) {
            *max_v = 0;
        }
        if (avg_v != nullptr) {
            *avg_v = 0;
        }
        if (first_unix != nullptr) {
            *first_unix = 0;
        }
        if (from_db != nullptr) {
            *from_db = false;
        }
        return 0;
    }
    if (s_mutex == nullptr) {
        return 0;
    }

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const HistSeries& h = s_hist[idx];
    const int n = h.n;
    const int take = (dst != nullptr && dst_max < n) ? dst_max : n;
    const int start = (h.n < APP_HIST_POINTS) ? 0 : h.head;
    float mn = 0;
    float mx = 0;
    double sum = 0;
    for (int i = 0; i < n; i++) {
        const float v = (h.pts != nullptr) ? h.pts[(start + i) % APP_HIST_POINTS] : 0;
        if (i == 0) {
            mn = mx = v;
        } else {
            if (v < mn) {
                mn = v;
            }
            if (v > mx) {
                mx = v;
            }
        }
        sum += static_cast<double>(v);
        if (dst != nullptr && i < take) {
            dst[i] = v;
        }
    }
    const int64_t first = h.first_unix;
    const bool db = h.from_db;
    xSemaphoreGive(s_mutex);

    if (min_v != nullptr) {
        *min_v = mn;
    }
    if (max_v != nullptr) {
        *max_v = mx;
    }
    if (avg_v != nullptr) {
        *avg_v = (n > 0) ? static_cast<float>(sum / static_cast<double>(n)) : 0;
    }
    if (first_unix != nullptr) {
        *first_unix = first;
    }
    if (from_db != nullptr) {
        *from_db = db;
    }
    return (dst != nullptr) ? take : n;
}
