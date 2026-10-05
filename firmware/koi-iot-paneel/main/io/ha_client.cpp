// KOIoT Paneel - ha_client: HA REST (status + service), ventilatie M1.6.
#include "io/ha_client.h"

#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <cstring>

#include "cJSON.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

#include "app_config.h"
#include "data/vent_store.h"
#include "secrets.h"
#include "ui/ascii_text.h"

static const char* TAG = "ha_client";

enum class HaCmdType : uint8_t {
    Poll = 0,
    SetStand,
    SetAuto,
};

struct HaCmd {
    HaCmdType type;
    int stand;
    uint8_t auto_on;
};

static QueueHandle_t s_queue = nullptr;
static volatile bool s_net_up = false;
static volatile bool s_fast_poll = true;

static VentKind s_kind = VentKind::Unknown;
static char s_value[3][32] = {};
static bool s_mapping_ready = false;
static int s_marked = 0;
static int s_pending = 0;
static int64_t s_pending_us = 0;
static char s_raw[40] = "";
static char s_message[72] = "";
static VentUiState s_ui = VentUiState::Idle;
static bool s_logged_no_token = false;
static bool s_logged_no_entity = false;
static bool s_logged_mapping = false;
static bool s_auto_on = false;
static bool s_auto_known = false;
static int s_auto_pending = 0;  // 0 = geen, 1 = naar aan, 2 = naar uit
static int64_t s_auto_pending_us = 0;
static int64_t s_idle_since_us = 0;

struct HttpBuf {
    char* data = nullptr;
    int used = 0;
    int cap = 0;
    bool overflow = false;
};

static bool token_ok()
{
#ifdef HA_TOKEN
    const char* t = HA_TOKEN;
    return t[0] != '\0' && strcmp(t, "CHANGE_ME") != 0;
#else
    return false;
#endif
}

static const char* token_value()
{
#ifdef HA_TOKEN
    return HA_TOKEN;
#else
    return "";
#endif
}

static bool entity_ok()
{
    const char* e = APP_HA_VENT_ENTITY_ID;
    return e[0] != '\0' && strcmp(e, "CHANGE_ME") != 0;
}

static const char* entity_id()
{
    return APP_HA_VENT_ENTITY_ID;
}

static bool auto_entity_ok()
{
    const char* e = APP_HA_VENT_AUTO_ENTITY_ID;
    return e[0] != '\0' && strcmp(e, "CHANGE_ME") != 0;
}

static const char* auto_entity_id()
{
    return APP_HA_VENT_AUTO_ENTITY_ID;
}

static bool domain_from_entity(const char* entity, char* domain, size_t domain_len)
{
    if (entity == nullptr || domain == nullptr || domain_len == 0) {
        return false;
    }
    const char* dot = strchr(entity, '.');
    if (dot == nullptr || dot == entity) {
        return false;
    }
    const size_t n = static_cast<size_t>(dot - entity);
    if (n + 1 > domain_len) {
        return false;
    }
    memcpy(domain, entity, n);
    domain[n] = '\0';
    return true;
}

static void publish()
{
    VentSnapshot snap;
    snap.ui = s_ui;
    snap.kind = s_kind;
    snap.marked_stand = (s_ui == VentUiState::Pending) ? 0 : s_marked;
    snap.pending_stand = s_pending;
    snprintf(snap.raw_label, sizeof(snap.raw_label), "%s", s_raw);
    snprintf(snap.message, sizeof(snap.message), "%s", s_message);
    snap.buttons_enabled = s_net_up && token_ok() && entity_ok() && s_pending == 0 &&
                           (s_ui == VentUiState::Ok || s_ui == VentUiState::Idle);
    snap.auto_configured = auto_entity_ok();
    snap.auto_known = s_auto_known;
    snap.auto_on = s_auto_on;
    snap.auto_pending = (s_auto_pending != 0);
    vent_store_set(snap);
}

static void set_no_config(const char* msg)
{
    s_ui = VentUiState::NoConfig;
    s_pending = 0;
    s_marked = 0;
    s_raw[0] = '\0';
    snprintf(s_message, sizeof(s_message), "%s", msg);
    publish();
}

static void set_unreachable()
{
    s_ui = VentUiState::Unreachable;
    s_pending = 0;
    snprintf(s_message, sizeof(s_message), "Home Assistant niet bereikbaar");
    publish();
}

static void set_token_invalid()
{
    s_ui = VentUiState::TokenInvalid;
    s_pending = 0;
    snprintf(s_message, sizeof(s_message), "HA-token ongeldig - controleer HA_TOKEN");
    publish();
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
    cfg.event_handler = &http_event;
    cfg.user_data = buf;
    cfg.buffer_size = 2048;
    cfg.buffer_size_tx = 1024;
    cfg.auth_type = HTTP_AUTH_TYPE_NONE;
    // 401 + WWW-Authenticate: Bearer mag niet intern retried worden (0x106).
    cfg.max_authorization_retries = -1;

    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (client == nullptr) {
        ESP_LOGE(TAG, "mislukt: esp_http_client_init gaf NULL (url %s)", url);
        return -1;
    }

    char auth[320];
    snprintf(auth, sizeof(auth), "Bearer %s", token_value());
    const esp_err_t hdr = esp_http_client_set_header(client, "Authorization", auth);
    if (hdr != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: Authorization-header zetten: %s (0x%x)",
                 esp_err_to_name(hdr), hdr);
        esp_http_client_cleanup(client);
        return -1;
    }
    if (body != nullptr) {
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, body, static_cast<int>(strlen(body)));
    }

    const esp_err_t err = esp_http_client_perform(client);
    int status = 0;
    if (err == ESP_OK) {
        status = esp_http_client_get_status_code(client);
    } else {
        // 401 Bearer: soms ESP_ERR_NOT_SUPPORTED i.p.v. HTTP-status.
        const int maybe = esp_http_client_get_status_code(client);
        if (maybe == 401 || err == ESP_ERR_NOT_SUPPORTED) {
            status = (maybe > 0) ? maybe : 401;
            ESP_LOGE(TAG, "mislukt: HTTP %s %s: %s (0x%x), status %d",
                     (method == HTTP_METHOD_GET) ? "GET" : "POST", url,
                     esp_err_to_name(err), err, status);
        } else {
            ESP_LOGE(TAG, "mislukt: HTTP %s %s: %s (0x%x)",
                     (method == HTTP_METHOD_GET) ? "GET" : "POST", url,
                     esp_err_to_name(err), err);
            status = -1;
        }
    }
    if (buf != nullptr && buf->overflow) {
        ESP_LOGW(TAG, "HTTP-antwoord afgekapt op %d B", buf->cap);
    }
    esp_http_client_cleanup(client);
    return status;
}

static char* alloc_body(int cap)
{
    char* p = static_cast<char*>(heap_caps_malloc(static_cast<size_t>(cap),
                                                  MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (p == nullptr) {
        ESP_LOGE(TAG, "mislukt: geen PSRAM voor HA-antwoord (%d B); geen interne fallback",
                 cap);
    }
    return p;
}

int ha_client_http_get_state(const char* entity, char* body, int cap, int* http_status)
{
    if (http_status != nullptr) {
        *http_status = 0;
    }
    if (entity == nullptr || entity[0] == '\0') {
        return -1;
    }
    char url[192];
    snprintf(url, sizeof(url), "%s/api/states/%s", APP_HA_BASE_URL, entity);

    HttpBuf buf;
    buf.cap = (cap > 0) ? cap : APP_HA_HTTP_RESP_MAX;
    buf.data = body;
    if (buf.data == nullptr) {
        return -1;
    }

    ESP_LOGI(TAG, "poging: GET %s", url);
    const int64_t t0 = esp_timer_get_time();
    const int status = http_perform(url, HTTP_METHOD_GET, nullptr, &buf);
    const int ms = static_cast<int>((esp_timer_get_time() - t0) / 1000);
    if (http_status != nullptr) {
        *http_status = status;
    }
    if (status < 0) {
        ESP_LOGE(TAG, "mislukt: GET states na %d ms (geen HTTP-status)", ms);
        return -1;
    }
    if (status >= 200 && status <= 299) {
        ESP_LOGI(TAG, "succes: GET states HTTP %d na %d ms, body %d B", status, ms, buf.used);
    } else {
        ESP_LOGE(TAG, "mislukt: GET states HTTP %d na %d ms, body %d B", status, ms, buf.used);
    }
    return status;
}

int ha_client_http_call_service(const char* domain, const char* service, const char* json_body,
                                char* body, int cap, int* http_status)
{
    if (http_status != nullptr) {
        *http_status = 0;
    }
    if (domain == nullptr || service == nullptr || json_body == nullptr) {
        return -1;
    }
    char url[192];
    snprintf(url, sizeof(url), "%s/api/services/%s/%s", APP_HA_BASE_URL, domain, service);

    HttpBuf buf;
    buf.cap = (cap > 0) ? cap : APP_HA_HTTP_RESP_MAX;
    buf.data = body;
    const bool own = (buf.data == nullptr);
    if (own) {
        buf.cap = 512;
        buf.data = alloc_body(buf.cap);
        if (buf.data == nullptr) {
            return -1;
        }
    }

    ESP_LOGI(TAG, "poging: POST %s body=%s", url, json_body);
    const int64_t t0 = esp_timer_get_time();
    const int status = http_perform(url, HTTP_METHOD_POST, json_body, &buf);
    const int ms = static_cast<int>((esp_timer_get_time() - t0) / 1000);
    if (http_status != nullptr) {
        *http_status = status;
    }
    if (status < 0) {
        ESP_LOGE(TAG, "mislukt: POST %s/%s na %d ms (geen HTTP-status)", domain, service, ms);
    } else if (status >= 200 && status <= 299) {
        ESP_LOGI(TAG, "succes: POST %s/%s HTTP %d na %d ms", domain, service, status, ms);
    } else {
        ESP_LOGE(TAG, "mislukt: POST %s/%s HTTP %d na %d ms, body %d B",
                 domain, service, status, ms, buf.used);
    }
    if (own) {
        heap_caps_free(buf.data);
    }
    return status;
}

static VentKind kind_from_config()
{
    switch (APP_HA_VENT_KIND) {
        case 1: return VentKind::FanPreset;
        case 2: return VentKind::FanPercent;
        case 3: return VentKind::Select;
        case 4: return VentKind::InputSelect;
        default: break;
    }
    const char* e = entity_id();
    if (strncmp(e, "fan.", 4) == 0) {
        return VentKind::Unknown;  // preset vs percent na GET
    }
    if (strncmp(e, "select.", 7) == 0) {
        return VentKind::Select;
    }
    if (strncmp(e, "input_select.", 13) == 0) {
        return VentKind::InputSelect;
    }
    return VentKind::Unknown;
}

static void apply_percent_mapping()
{
    snprintf(s_value[0], sizeof(s_value[0]), "%s",
             (APP_HA_VENT_VALUE_1[0] != '\0') ? APP_HA_VENT_VALUE_1 : "0");
    snprintf(s_value[1], sizeof(s_value[1]), "%s",
             (APP_HA_VENT_VALUE_2[0] != '\0') ? APP_HA_VENT_VALUE_2 : "50");
    snprintf(s_value[2], sizeof(s_value[2]), "%s",
             (APP_HA_VENT_VALUE_3[0] != '\0') ? APP_HA_VENT_VALUE_3 : "100");
    s_mapping_ready = true;
    if (!s_logged_mapping) {
        s_logged_mapping = true;
        ESP_LOGI(TAG, "ventilatie-mapping knop 0/1/2 = %s / %s / %s %% (turn_off / set_percentage)",
                 s_value[0], s_value[1], s_value[2]);
    }
}

static void apply_config_or_options(const char* opts[], int n)
{
    const char* cfg[3] = {APP_HA_VENT_VALUE_1, APP_HA_VENT_VALUE_2, APP_HA_VENT_VALUE_3};
    const bool have_cfg = cfg[0][0] != '\0' && cfg[1][0] != '\0' && cfg[2][0] != '\0';
    if (have_cfg) {
        for (int i = 0; i < 3; i++) {
            snprintf(s_value[i], sizeof(s_value[i]), "%s", cfg[i]);
        }
        s_mapping_ready = true;
        return;
    }
    if (n == 3 && opts != nullptr) {
        for (int i = 0; i < 3; i++) {
            snprintf(s_value[i], sizeof(s_value[i]), "%s",
                     (opts[i] != nullptr) ? opts[i] : "");
        }
        s_mapping_ready = s_value[0][0] != '\0' && s_value[1][0] != '\0' && s_value[2][0] != '\0';
        if (s_mapping_ready && !s_logged_mapping) {
            s_logged_mapping = true;
            ESP_LOGI(TAG,
                     "ventilatie-mapping uit HA-opties (volgorde 1/2/3): '%s' / '%s' / '%s' "
                     "(B7: bevestigen of vastleggen in app_config.h)",
                     s_value[0], s_value[1], s_value[2]);
        }
        return;
    }
    s_mapping_ready = false;
    if (!s_logged_mapping) {
        s_logged_mapping = true;
        ESP_LOGW(TAG,
                 "ventilatie: geen mapping 1/2/3. Vul APP_HA_VENT_VALUE_1/2/3 in app_config.h "
                 "(B7). Opties in HA: %d",
                 n);
    }
}

static int stand_from_raw(const char* raw)
{
    if (raw == nullptr || raw[0] == '\0' || !s_mapping_ready) {
        return 0;
    }
    if (s_kind == VentKind::FanPercent) {
        char* end = nullptr;
        const double v = strtod(raw, &end);
        if (end == raw) {
            return 0;
        }
        const int iv = static_cast<int>(lround(v));
        for (int i = 0; i < 3; i++) {
            const int want = atoi(s_value[i]);
            if (iv == want) {
                return i + 1;
            }
        }
        return 0;
    }
    for (int i = 0; i < 3; i++) {
        if (strcmp(raw, s_value[i]) == 0) {
            return i + 1;
        }
    }
    return 0;
}

static void extract_string(char* dst, size_t dst_len, const cJSON* item)
{
    dst[0] = '\0';
    if (item == nullptr) {
        return;
    }
    if (cJSON_IsString(item) && item->valuestring != nullptr) {
        ascii_from_utf8(dst, dst_len, item->valuestring);
        return;
    }
    if (cJSON_IsNumber(item)) {
        snprintf(dst, dst_len, "%g", item->valuedouble);
    }
}

static void parse_and_apply(const char* json)
{
    cJSON* root = cJSON_Parse(json);
    if (root == nullptr) {
        ESP_LOGE(TAG, "mislukt: HA-state JSON ongeldig");
        snprintf(s_message, sizeof(s_message), "ongeldig antwoord");
        if (s_ui != VentUiState::Pending) {
            s_ui = VentUiState::Unreachable;
        }
        publish();
        return;
    }

    const cJSON* state = cJSON_GetObjectItemCaseSensitive(root, "state");
    const cJSON* attrs = cJSON_GetObjectItemCaseSensitive(root, "attributes");
    char state_txt[24] = "";
    extract_string(state_txt, sizeof(state_txt), state);
    char pct_txt[24] = "";
    if (cJSON_IsObject(attrs)) {
        extract_string(pct_txt, sizeof(pct_txt),
                       cJSON_GetObjectItemCaseSensitive(attrs, "percentage"));
    }
    ESP_LOGI(TAG, "GET %s body: state='%s' percentage='%s'", entity_id(), state_txt, pct_txt);

    VentKind detected = kind_from_config();
    if (detected == VentKind::Unknown && cJSON_IsObject(attrs)) {
        const cJSON* presets = cJSON_GetObjectItemCaseSensitive(attrs, "preset_modes");
        // Lege of null preset_modes telt niet: fan.ventilatie heeft SET_SPEED, geen PRESET_MODE.
        if (cJSON_IsArray(presets) && cJSON_GetArraySize(presets) > 0) {
            detected = VentKind::FanPreset;
        } else if (cJSON_GetObjectItemCaseSensitive(attrs, "percentage") != nullptr ||
                   cJSON_GetObjectItemCaseSensitive(attrs, "percentage_step") != nullptr) {
            detected = VentKind::FanPercent;
        }
    }
    if (detected == VentKind::Unknown && strncmp(entity_id(), "fan.", 4) == 0) {
        detected = VentKind::FanPercent;
    }
    if (detected != VentKind::Unknown) {
        s_kind = detected;
    }

    const char* opt_ptrs[8] = {};
    char opt_buf[8][32] = {};
    int n_opts = 0;
    if (cJSON_IsObject(attrs)) {
        const cJSON* arr = nullptr;
        if (s_kind == VentKind::FanPreset) {
            arr = cJSON_GetObjectItemCaseSensitive(attrs, "preset_modes");
        } else if (s_kind == VentKind::Select || s_kind == VentKind::InputSelect) {
            arr = cJSON_GetObjectItemCaseSensitive(attrs, "options");
        }
        if (cJSON_IsArray(arr)) {
            const int lim = cJSON_GetArraySize(arr);
            for (int i = 0; i < lim && n_opts < 8; i++) {
                const cJSON* it = cJSON_GetArrayItem(arr, i);
                extract_string(opt_buf[n_opts], sizeof(opt_buf[n_opts]), it);
                if (opt_buf[n_opts][0] != '\0') {
                    opt_ptrs[n_opts] = opt_buf[n_opts];
                    n_opts++;
                }
            }
        }
    }

    if (s_kind == VentKind::FanPercent) {
        apply_percent_mapping();
    } else {
        apply_config_or_options(opt_ptrs, n_opts);
    }

    char raw[40] = "";
    if (s_kind == VentKind::FanPreset && cJSON_IsObject(attrs)) {
        extract_string(raw, sizeof(raw),
                       cJSON_GetObjectItemCaseSensitive(attrs, "preset_mode"));
    } else if (s_kind == VentKind::FanPercent) {
        char st[24] = "";
        extract_string(st, sizeof(st), state);
        // HA houdt percentage vaak op de laatste snelheid als de fan uit staat.
        // State off → 0% = knop 1. Anders attributes.percentage (exact 0/50/100).
        if (strcmp(st, "off") == 0) {
            snprintf(raw, sizeof(raw), "0");
        } else if (cJSON_IsObject(attrs)) {
            extract_string(raw, sizeof(raw),
                           cJSON_GetObjectItemCaseSensitive(attrs, "percentage"));
            if (raw[0] == '\0') {
                snprintf(raw, sizeof(raw), "%s", st);
            }
        } else {
            snprintf(raw, sizeof(raw), "%s", st);
        }
    } else {
        extract_string(raw, sizeof(raw), state);
    }

    snprintf(s_raw, sizeof(s_raw), "%s", raw);
    const int stand = stand_from_raw(raw);
    if (stand > 0) {
        s_marked = stand;
        s_raw[0] = '\0';
    } else {
        s_marked = 0;
        if (s_kind == VentKind::FanPercent && raw[0] != '\0') {
            char* end = nullptr;
            strtod(raw, &end);
            if (end != raw && end != nullptr && *end == '\0') {
                // "25%" als tekst; strncpy i.p.v. snprintf (format-truncation = error).
                s_raw[0] = '\0';
                strncat(s_raw, raw, sizeof(s_raw) - 2);
                strncat(s_raw, "%", sizeof(s_raw) - strlen(s_raw) - 1);
            }
        }
    }

    if (s_pending > 0) {
        if (stand == s_pending) {
            ESP_LOGI(TAG, "ventilatie knop %d bevestigd (waarde '%s')", s_pending - 1, raw);
            s_pending = 0;
            s_pending_us = 0;
            s_message[0] = '\0';
            s_ui = VentUiState::Ok;
            s_idle_since_us = 0;
        } else {
            const int64_t age_ms = (esp_timer_get_time() - s_pending_us) / 1000;
            if (age_ms >= APP_HA_VENT_CONFIRM_MS) {
                ESP_LOGW(TAG, "ventilatie: bevestiging knop %d bleef uit na %d ms; terug naar '%s'",
                         s_pending - 1, APP_HA_VENT_CONFIRM_MS, raw);
                s_pending = 0;
                s_pending_us = 0;
                snprintf(s_message, sizeof(s_message), "niet bevestigd");
                s_ui = VentUiState::Ok;
                s_idle_since_us = 0;
            } else {
                s_ui = VentUiState::Pending;
            }
        }
    } else {
        s_ui = VentUiState::Ok;
        s_idle_since_us = 0;
        // "wacht op HA" mag niet blijven hangen na HTTP 200 (m16b-bug).
        s_message[0] = '\0';
    }

    ESP_LOGI(TAG, "ventilatie: kind=%d stand=%d (knop %d) raw='%s' mapping=%d pending=%d",
             static_cast<int>(s_kind), s_marked, s_marked > 0 ? s_marked - 1 : -1, s_raw,
             s_mapping_ready ? 1 : 0, s_pending);
    cJSON_Delete(root);
    publish();
}

static void parse_auto_state(const char* json)
{
    cJSON* root = cJSON_Parse(json);
    if (root == nullptr) {
        ESP_LOGE(TAG, "mislukt: auto-state JSON ongeldig");
        return;
    }
    char st[24] = "";
    extract_string(st, sizeof(st), cJSON_GetObjectItemCaseSensitive(root, "state"));
    const bool on = (strcmp(st, "on") == 0);
    const bool off = (strcmp(st, "off") == 0);
    ESP_LOGI(TAG, "GET auto %s body: state='%s'", auto_entity_id(), st);
    if (!on && !off) {
        ESP_LOGW(TAG, "auto entity state='%s' (geen on/off); knop volgt niet", st);
        s_auto_known = false;
        cJSON_Delete(root);
        publish();
        return;
    }
    s_auto_on = on;
    s_auto_known = true;
    if (s_auto_pending > 0) {
        const bool want_on = (s_auto_pending == 1);
        if (s_auto_on == want_on) {
            ESP_LOGI(TAG, "ventilatie auto %s bevestigd", want_on ? "aan" : "uit");
            s_auto_pending = 0;
            s_auto_pending_us = 0;
        } else {
            const int64_t age_ms = (esp_timer_get_time() - s_auto_pending_us) / 1000;
            if (age_ms >= APP_HA_VENT_CONFIRM_MS) {
                ESP_LOGW(TAG, "ventilatie auto: bevestiging bleef uit na %d ms; state='%s'",
                         APP_HA_VENT_CONFIRM_MS, st);
                s_auto_pending = 0;
                s_auto_pending_us = 0;
            }
        }
    }
    ESP_LOGI(TAG, "ventilatie auto: on=%d pending=%d", s_auto_on ? 1 : 0, s_auto_pending);
    cJSON_Delete(root);
    publish();
}

static void poll_auto(char* body)
{
    if (!auto_entity_ok() || body == nullptr) {
        return;
    }
    int auto_http = 0;
    const int auto_st = ha_client_http_get_state(auto_entity_id(), body, APP_HA_HTTP_RESP_MAX,
                                                 &auto_http);
    ESP_LOGI(TAG, "GET auto-status %s HTTP %d", auto_entity_id(), auto_http);
    if (auto_st >= 200 && auto_st <= 299) {
        parse_auto_state(body);
        return;
    }
    if (auto_http == 401) {
        set_token_invalid();
        return;
    }
    ESP_LOGW(TAG, "auto GET mislukt HTTP %d; fan-stand blijft", auto_http);
}

static bool do_poll()
{
    if (!s_net_up) {
        set_unreachable();
        return false;
    }
    if (!token_ok()) {
        if (!s_logged_no_token) {
            s_logged_no_token = true;
            ESP_LOGW(TAG, "HA REST overgeslagen: HA_TOKEN leeg of CHANGE_ME (secrets.h, B7)");
        }
        set_token_invalid();
        return false;
    }
    if (!entity_ok()) {
        if (!s_logged_no_entity) {
            s_logged_no_entity = true;
            ESP_LOGW(TAG,
                     "ventilatie: APP_HA_VENT_ENTITY_ID leeg. Plak entity_id + attributen uit HA "
                     "(Ontwikkelhulpmiddelen -> Toestanden) in de chat (B7).");
        }
        set_no_config("wacht op entiteit (B7)");
        return false;
    }

    char* body = alloc_body(APP_HA_HTTP_RESP_MAX);
    if (body == nullptr) {
        set_unreachable();
        return false;
    }
    int http = 0;
    const int status = ha_client_http_get_state(entity_id(), body, APP_HA_HTTP_RESP_MAX, &http);
    ESP_LOGI(TAG, "GET status %s HTTP %d", entity_id(), http);
    if (status < 0) {
        heap_caps_free(body);
        snprintf(s_message, sizeof(s_message), "HA niet bereikbaar");
        s_ui = VentUiState::Unreachable;
        s_pending = 0;
        publish();
        return false;
    }
    if (http == 401) {
        heap_caps_free(body);
        set_token_invalid();
        return false;
    }
    if (http < 200 || http > 299) {
        heap_caps_free(body);
        ESP_LOGE(TAG, "GET %s HTTP %d (geen 2xx); geen eeuwige wacht", entity_id(), http);
        snprintf(s_message, sizeof(s_message), "HA fout HTTP %d", http);
        s_ui = VentUiState::Unreachable;
        s_pending = 0;
        publish();
        return false;
    }
    parse_and_apply(body);
    poll_auto(body);
    heap_caps_free(body);
    return true;
}

static bool build_set_body(int stand, char* domain, size_t domain_len,
                           char* service, size_t service_len, char* json, size_t json_len)
{
    if (stand < 1 || stand > 3 || !s_mapping_ready) {
        return false;
    }
    const char* val = s_value[stand - 1];
    domain[0] = '\0';
    service[0] = '\0';
    json[0] = '\0';

    switch (s_kind) {
        case VentKind::FanPreset:
            snprintf(domain, domain_len, "fan");
            snprintf(service, service_len, "set_preset_mode");
            snprintf(json, json_len,
                     "{\"entity_id\":\"%s\",\"preset_mode\":\"%s\"}", entity_id(), val);
            return true;
        case VentKind::FanPercent: {
            const int pct = atoi(val);
            snprintf(domain, domain_len, "fan");
            if (pct <= 0) {
                // 0% = uit. set_percentage 0 laat bij sommige fans het % op 50/100 staan.
                snprintf(service, service_len, "turn_off");
                snprintf(json, json_len, "{\"entity_id\":\"%s\"}", entity_id());
            } else {
                snprintf(service, service_len, "set_percentage");
                snprintf(json, json_len,
                         "{\"entity_id\":\"%s\",\"percentage\":%d}", entity_id(), pct);
            }
            return true;
        }
        case VentKind::Select:
            snprintf(domain, domain_len, "select");
            snprintf(service, service_len, "select_option");
            snprintf(json, json_len,
                     "{\"entity_id\":\"%s\",\"option\":\"%s\"}", entity_id(), val);
            return true;
        case VentKind::InputSelect:
            snprintf(domain, domain_len, "input_select");
            snprintf(service, service_len, "select_option");
            snprintf(json, json_len,
                     "{\"entity_id\":\"%s\",\"option\":\"%s\"}", entity_id(), val);
            return true;
        default:
            return false;
    }
}

static void do_set(int stand)
{
    if (!s_net_up) {
        set_unreachable();
        return;
    }
    if (!token_ok()) {
        set_token_invalid();
        return;
    }
    if (!entity_ok()) {
        set_no_config("wacht op entiteit (B7)");
        return;
    }
    if (stand < 1 || stand > 3) {
        return;
    }

    if (!s_mapping_ready || s_kind == VentKind::Unknown) {
        ESP_LOGI(TAG, "ventilatie: eerst status ophalen voor mapping, daarna stand %d", stand);
        if (!do_poll()) {
            return;
        }
    }
    if (!s_mapping_ready || s_kind == VentKind::Unknown) {
        ESP_LOGW(TAG, "ventilatie: kan stand %d niet zetten (geen mapping/soort)", stand);
        snprintf(s_message, sizeof(s_message), "mapping ontbreekt (B7)");
        publish();
        return;
    }

    s_pending = stand;
    s_pending_us = esp_timer_get_time();
    s_ui = VentUiState::Pending;
    snprintf(s_message, sizeof(s_message), "bezig...");
    publish();

    char domain[24];
    char service[32];
    char json[192];
    if (!build_set_body(stand, domain, sizeof(domain), service, sizeof(service),
                        json, sizeof(json))) {
        s_pending = 0;
        snprintf(s_message, sizeof(s_message), "mapping ontbreekt (B7)");
        s_ui = VentUiState::Ok;
        publish();
        return;
    }

    int http = 0;
    const int status = ha_client_http_call_service(domain, service, json, nullptr, 0, &http);
    if (status < 0) {
        s_pending = 0;
        s_pending_us = 0;
        set_unreachable();
        return;
    }
    if (http == 401) {
        s_pending = 0;
        s_pending_us = 0;
        set_token_invalid();
        return;
    }
    if (http < 200 || http > 299) {
        ESP_LOGE(TAG, "ventilatie zetten mislukt HTTP %d; terug naar werkelijke stand", http);
        s_pending = 0;
        s_pending_us = 0;
        snprintf(s_message, sizeof(s_message), "zetten mislukt");
        do_poll();
        return;
    }
    do_poll();
}

static void do_set_auto(bool on)
{
    if (!auto_entity_ok()) {
        ESP_LOGW(TAG, "auto zetten overgeslagen: APP_HA_VENT_AUTO_ENTITY_ID leeg");
        return;
    }
    if (!s_net_up) {
        set_unreachable();
        return;
    }
    if (!token_ok()) {
        set_token_invalid();
        return;
    }
    char domain[24];
    if (!domain_from_entity(auto_entity_id(), domain, sizeof(domain))) {
        ESP_LOGW(TAG, "auto entity_id zonder domein: '%s'", auto_entity_id());
        return;
    }

    s_auto_pending = on ? 1 : 2;
    s_auto_pending_us = esp_timer_get_time();
    publish();

    char json[192];
    snprintf(json, sizeof(json), "{\"entity_id\":\"%s\"}", auto_entity_id());
    const char* service = on ? APP_HA_VENT_AUTO_ON_SERVICE : APP_HA_VENT_AUTO_OFF_SERVICE;
    int http = 0;
    const int status = ha_client_http_call_service(domain, service, json, nullptr, 0, &http);
    if (http == 401) {
        s_auto_pending = 0;
        s_auto_pending_us = 0;
        set_token_invalid();
        return;
    }
    if (status < 0 || http < 200 || http > 299) {
        ESP_LOGE(TAG, "auto zetten mislukt HTTP %d", http);
        s_auto_pending = 0;
        s_auto_pending_us = 0;
        do_poll();
        return;
    }
    do_poll();
}

static void check_pending_timeout()
{
    bool need_poll = false;
    if (s_pending > 0 && s_pending_us != 0) {
        const int64_t age_ms = (esp_timer_get_time() - s_pending_us) / 1000;
        if (age_ms >= APP_HA_VENT_CONFIRM_MS) {
            ESP_LOGW(TAG, "ventilatie: timeout %d ms, status opnieuw ophalen",
                     APP_HA_VENT_CONFIRM_MS);
            need_poll = true;
        }
    }
    if (s_auto_pending > 0 && s_auto_pending_us != 0) {
        const int64_t age_ms = (esp_timer_get_time() - s_auto_pending_us) / 1000;
        if (age_ms >= APP_HA_VENT_CONFIRM_MS) {
            ESP_LOGW(TAG, "ventilatie auto: timeout %d ms, status opnieuw ophalen",
                     APP_HA_VENT_CONFIRM_MS);
            need_poll = true;
        }
    }
    if (need_poll) {
        do_poll();
    }
}

static void check_idle_timeout()
{
    if (s_ui != VentUiState::Idle || !s_net_up || s_idle_since_us == 0) {
        return;
    }
    const int64_t idle_s = (esp_timer_get_time() - s_idle_since_us) / 1000000;
    if (idle_s >= APP_HA_VENT_IDLE_TIMEOUT_S) {
        ESP_LOGW(TAG, "geen geldige HA-stand na %d s; stop eeuwige wacht",
                 APP_HA_VENT_IDLE_TIMEOUT_S);
        snprintf(s_message, sizeof(s_message), "geen antwoord van HA");
        s_ui = VentUiState::Unreachable;
        publish();
    }
}

static void ha_task(void*)
{
    int64_t last_poll_us = 0;
    if (s_net_up && token_ok() && entity_ok()) {
        ESP_LOGI(TAG, "eerste HA-status bij start ha-taak");
        do_poll();
        last_poll_us = esp_timer_get_time();
    }

    while (true) {
        HaCmd cmd = {};
        const TickType_t wait = pdMS_TO_TICKS(1000);
        if (xQueueReceive(s_queue, &cmd, wait) == pdTRUE) {
            if (cmd.type == HaCmdType::Poll) {
                do_poll();
                last_poll_us = esp_timer_get_time();
            } else if (cmd.type == HaCmdType::SetStand) {
                do_set(cmd.stand);
                last_poll_us = esp_timer_get_time();
            } else if (cmd.type == HaCmdType::SetAuto) {
                do_set_auto(cmd.auto_on != 0);
                last_poll_us = esp_timer_get_time();
            }
            continue;
        }

        check_pending_timeout();
        check_idle_timeout();
        if (!s_net_up || !token_ok() || !entity_ok()) {
            continue;
        }
        int interval_s = s_fast_poll ? APP_HA_VENT_POLL_FAST_S : APP_HA_VENT_POLL_SLOW_S;
        if (s_pending > 0 || s_auto_pending > 0) {
            interval_s = 1;
        }
        const int64_t now = esp_timer_get_time();
        if (last_poll_us == 0 ||
            now - last_poll_us >= static_cast<int64_t>(interval_s) * 1000000) {
            ESP_LOGI(TAG, "periodieke HA-status (elke %d s)", interval_s);
            do_poll();
            last_poll_us = esp_timer_get_time();
        }
    }
}

void ha_client_init()
{
    if (s_queue == nullptr) {
        s_queue = xQueueCreate(8, sizeof(HaCmd));
    }
    s_kind = kind_from_config();
    if (s_kind == VentKind::FanPercent || APP_HA_VENT_KIND == 2) {
        s_kind = VentKind::FanPercent;
        apply_percent_mapping();
    }
    if (!token_ok()) {
        ESP_LOGW(TAG, "LET OP: HA_TOKEN in secrets.h is leeg of CHANGE_ME");
        set_token_invalid();
    } else if (!entity_ok()) {
        ESP_LOGW(TAG, "LET OP: APP_HA_VENT_ENTITY_ID leeg (B7)");
        set_no_config("wacht op entiteit (B7)");
    } else {
        s_ui = VentUiState::Idle;
        s_idle_since_us = 0;  // start pas bij wifi-IP
        snprintf(s_message, sizeof(s_message), "wacht op HA");
        publish();
    }
    ESP_LOGI(TAG, "ha_client klaar (nog niet gestart); base %s entity='%s' auto='%s' kind_cfg=%d",
             APP_HA_BASE_URL, entity_ok() ? entity_id() : "(leeg)",
             auto_entity_ok() ? auto_entity_id() : "(leeg)", APP_HA_VENT_KIND);
}

void ha_client_start()
{
    BaseType_t ok = xTaskCreate(ha_task, "ha", APP_HA_TASK_STACK, nullptr,
                                APP_HA_TASK_PRIO, nullptr);
    if (ok != pdPASS) {
        ESP_LOGE(TAG, "ha-taak aanmaken mislukt");
    }
}

void ha_client_on_network_up()
{
    s_net_up = true;
    if (s_ui == VentUiState::Idle && s_idle_since_us == 0) {
        s_idle_since_us = esp_timer_get_time();
    }
    ESP_LOGI(TAG, "wifi-IP: HA-ventilatie ophalen");
    ha_client_request_poll();
}

void ha_client_on_network_down()
{
    s_net_up = false;
    ESP_LOGW(TAG, "wifi weg; HA-calls pauzeren");
    set_unreachable();
}

void ha_client_set_fast_poll(bool overview_visible)
{
    s_fast_poll = overview_visible;
}

void ha_client_request_poll()
{
    if (s_queue == nullptr) {
        return;
    }
    HaCmd cmd = {};
    cmd.type = HaCmdType::Poll;
    if (xQueueSend(s_queue, &cmd, 0) != pdTRUE) {
        ESP_LOGW(TAG, "HA-poll niet geplaatst (queue vol)");
    }
}

void ha_client_request_set_stand(int stand)
{
    if (s_queue == nullptr) {
        return;
    }
    if (stand < 1 || stand > 3) {
        return;
    }
    HaCmd cmd = {};
    cmd.type = HaCmdType::SetStand;
    cmd.stand = stand;
    if (xQueueSend(s_queue, &cmd, 0) != pdTRUE) {
        ESP_LOGW(TAG, "HA-set niet geplaatst (queue vol)");
    }
}

void ha_client_request_set_auto(bool on)
{
    if (s_queue == nullptr) {
        return;
    }
    if (!auto_entity_ok()) {
        return;
    }
    HaCmd cmd = {};
    cmd.type = HaCmdType::SetAuto;
    cmd.auto_on = on ? 1 : 0;
    if (xQueueSend(s_queue, &cmd, 0) != pdTRUE) {
        ESP_LOGW(TAG, "HA-auto-set niet geplaatst (queue vol)");
    }
}
