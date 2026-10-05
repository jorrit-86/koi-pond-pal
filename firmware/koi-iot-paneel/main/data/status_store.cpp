// KOIoT Paneel - status_store (implementatie).
#include "data/status_store.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>

#include "cJSON.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "app_config.h"
#include "core/time_sync.h"
#include "data/live_store.h"
#include "io/mqtt_link.h"
#include "ui/ascii_text.h"

static const char* TAG = "status_store";

// ~18 KB (24 taken + fields). Intern BSS at dat, plus een tweede kopie in ui_root.
// PSRAM: Elecrow zet alleen LVGL-framebuffers in SPIRAM; objecten blijven intern.
static StatusSnapshot* s_store_ptr = nullptr;
#define s_store (*s_store_ptr)
static SemaphoreHandle_t s_mutex = nullptr;
static uint32_t s_popup_seq = 0;
static bool s_logged_json_shape = false;

static void copy_z(char* dst, size_t dst_len, const char* src)
{
    if (dst_len == 0) {
        return;
    }
    if (src == nullptr) {
        dst[0] = '\0';
        return;
    }
    strncpy(dst, src, dst_len - 1);
    dst[dst_len - 1] = '\0';
}

static bool is_leap(int y)
{
    return (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
}

// UTC-kalender naar unix, zonder timegm/TZ (R5: nooit 1970 door lokale mktime).
static int64_t unix_from_utc(int y, int mo, int d, int h, int mi, int s)
{
    if (y < 2024 || mo < 1 || mo > 12 || d < 1 || d > 31) {
        return 0;
    }
    static const int k_mdays[12] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    int64_t days = 0;
    for (int yy = 1970; yy < y; yy++) {
        days += is_leap(yy) ? 366 : 365;
    }
    for (int m = 1; m < mo; m++) {
        days += k_mdays[m - 1];
        if (m == 2 && is_leap(y)) {
            days += 1;
        }
    }
    days += d - 1;
    return days * 86400 + static_cast<int64_t>(h) * 3600 + mi * 60 + s;
}

static int64_t parse_iso8601(const char* s)
{
    if (s == nullptr || s[0] == '\0') {
        return 0;
    }
    int y = 0, mo = 0, d = 0, h = 0, mi = 0, sec = 0;
    int n = sscanf(s, "%d-%d-%dT%d:%d:%d", &y, &mo, &d, &h, &mi, &sec);
    if (n < 6) {
        n = sscanf(s, "%d-%d-%d %d:%d:%d", &y, &mo, &d, &h, &mi, &sec);
    }
    if (n < 6) {
        return 0;
    }
    int64_t utc = unix_from_utc(y, mo, d, h, mi, sec);
    if (utc == 0) {
        return 0;
    }
    const char* z = strchr(s, 'Z');
    const char* z2 = strchr(s, 'z');
    if (z != nullptr || z2 != nullptr) {
        return utc;
    }
    // Offset +HH:MM of -HH:MM na de tijd (niet de datum).
    const char* t = strchr(s, 'T');
    if (t == nullptr) {
        t = s;
    }
    const char* plus = strrchr(t, '+');
    const char* minus = strrchr(t, '-');
    // minus in date is before T; take minus after T only
    if (minus != nullptr && minus < t) {
        minus = nullptr;
        const char* p = strchr(t, '-');
        minus = p;
    }
    const char* off = (plus != nullptr) ? plus : minus;
    if (off != nullptr && (off[0] == '+' || off[0] == '-')) {
        int oh = 0, om = 0;
        if (sscanf(off + 1, "%d:%d", &oh, &om) >= 1) {
            const int64_t adj = static_cast<int64_t>(oh) * 3600 + om * 60;
            utc += (off[0] == '+') ? -adj : adj;
        }
    }
    return utc;
}

static const char* json_str(const cJSON* obj, const char* key)
{
    if (obj == nullptr) {
        return nullptr;
    }
    const cJSON* n = cJSON_GetObjectItemCaseSensitive(obj, key);
    if (!cJSON_IsString(n) || n->valuestring == nullptr) {
        return nullptr;
    }
    return n->valuestring;
}

static bool json_num(const cJSON* obj, const char* key, double* out)
{
    if (obj == nullptr || out == nullptr) {
        return false;
    }
    const cJSON* n = cJSON_GetObjectItemCaseSensitive(obj, key);
    if (cJSON_IsNumber(n)) {
        *out = n->valuedouble;
        return true;
    }
    if (cJSON_IsString(n) && n->valuestring != nullptr) {
        char* end = nullptr;
        const double v = strtod(n->valuestring, &end);
        if (end != n->valuestring) {
            *out = v;
            return true;
        }
    }
    return false;
}

static bool json_bool(const cJSON* obj, const char* key, bool* out)
{
    if (obj == nullptr || out == nullptr) {
        return false;
    }
    const cJSON* n = cJSON_GetObjectItemCaseSensitive(obj, key);
    if (cJSON_IsBool(n)) {
        *out = cJSON_IsTrue(n);
        return true;
    }
    return false;
}

static LiveField reading_key_to_field(const char* key)
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
    if (strcmp(key, "flow_total") == 0) {
        return LiveField::FlowTotal;
    }
    return LiveField::Count;
}

static void collect_keys(const cJSON* obj, char* buf, size_t cap)
{
    if (buf == nullptr || cap == 0) {
        return;
    }
    buf[0] = '\0';
    if (obj == nullptr || !cJSON_IsObject(obj)) {
        return;
    }
    size_t n = 0;
    for (const cJSON* c = obj->child; c != nullptr; c = c->next) {
        if (c->string == nullptr) {
            continue;
        }
        n += static_cast<size_t>(snprintf(buf + n, (n < cap) ? cap - n : 0, "%s%s",
                                          (n > 0) ? "," : "", c->string));
        if (n >= cap) {
            buf[cap - 1] = '\0';
            return;
        }
    }
}

static const char* json_type_name(const cJSON* n)
{
    if (n == nullptr) {
        return "ontbreekt";
    }
    if (cJSON_IsObject(n)) {
        return "object";
    }
    if (cJSON_IsArray(n)) {
        return "array";
    }
    if (cJSON_IsString(n)) {
        return "string";
    }
    if (cJSON_IsNumber(n)) {
        return "number";
    }
    if (cJSON_IsBool(n)) {
        return "bool";
    }
    if (cJSON_IsNull(n)) {
        return "null";
    }
    return "overig";
}

// Eenmalig: ruwe vorm loggen zodat een mismatch met A6/A8 in de seriële log zichtbaar is (W3).
static void log_json_shape_once(const cJSON* root)
{
    if (s_logged_json_shape) {
        return;
    }
    s_logged_json_shape = true;

    if (root == nullptr) {
        ESP_LOGI(TAG, "ha-status ruwe vorm: leeg");
        return;
    }
    if (cJSON_IsArray(root)) {
        ESP_LOGI(TAG, "ha-status ruwe vorm: array (%d items); verwacht object (A6)",
                 cJSON_GetArraySize(root));
        return;
    }
    if (!cJSON_IsObject(root)) {
        ESP_LOGI(TAG, "ha-status ruwe vorm: %s; verwacht object (A6)", json_type_name(root));
        return;
    }

    char keys[256];
    collect_keys(root, keys, sizeof(keys));
    ESP_LOGI(TAG, "ha-status ruwe vorm: object, keys=[%s]", keys);

    const cJSON* lr = cJSON_GetObjectItemCaseSensitive(root, "latest_readings");
    if (lr == nullptr) {
        ESP_LOGI(TAG, "latest_readings: ontbreekt (tegels wachten op MQTT, zoals M1)");
    } else if (cJSON_IsArray(lr)) {
        const int n = cJSON_GetArraySize(lr);
        ESP_LOGI(TAG, "latest_readings: array (%d items, A8)", n);
        if (n > 0) {
            const cJSON* first = cJSON_GetArrayItem(lr, 0);
            if (cJSON_IsObject(first)) {
                collect_keys(first, keys, sizeof(keys));
                ESP_LOGI(TAG, "latest_readings[0] keys=[%s]", keys);
            } else {
                ESP_LOGI(TAG, "latest_readings[0]: %s (verwacht object met key/value/measured_at)",
                         json_type_name(first));
            }
        }
    } else if (cJSON_IsObject(lr)) {
        collect_keys(lr, keys, sizeof(keys));
        ESP_LOGI(TAG, "latest_readings: object keys=[%s]; verwacht array van objecten (A8), niet toegepast",
                 keys);
    } else {
        ESP_LOGI(TAG, "latest_readings: %s; verwacht array (A8), niet toegepast", json_type_name(lr));
    }

    const cJSON* tasks = cJSON_GetObjectItemCaseSensitive(root, "tasks");
    if (tasks == nullptr) {
        ESP_LOGI(TAG, "tasks: ontbreekt");
    } else if (cJSON_IsArray(tasks)) {
        const int n = cJSON_GetArraySize(tasks);
        ESP_LOGI(TAG, "tasks: array (%d items)", n);
        if (n > 0) {
            const cJSON* first = cJSON_GetArrayItem(tasks, 0);
            if (cJSON_IsObject(first)) {
                collect_keys(first, keys, sizeof(keys));
                ESP_LOGI(TAG, "tasks[0] keys=[%s]", keys);
                const cJSON* acts = cJSON_GetObjectItemCaseSensitive(first, "actions");
                if (acts == nullptr) {
                    ESP_LOGI(TAG, "tasks[0].actions: ontbreekt (geen knoppen, alleen weergave)");
                } else if (cJSON_IsArray(acts)) {
                    char actbuf[80] = "";
                    size_t an = 0;
                    const cJSON* a = nullptr;
                    cJSON_ArrayForEach(a, acts) {
                        if (!cJSON_IsString(a) || a->valuestring == nullptr) {
                            continue;
                        }
                        an += static_cast<size_t>(snprintf(actbuf + an, (an < sizeof(actbuf)) ? sizeof(actbuf) - an : 0,
                                                           "%s%s", (an > 0) ? "," : "", a->valuestring));
                    }
                    ESP_LOGI(TAG, "tasks[0].actions=[%s]", actbuf);
                } else {
                    ESP_LOGI(TAG, "tasks[0].actions: %s; verwacht array", json_type_name(acts));
                }
            } else {
                ESP_LOGI(TAG, "tasks[0]: %s (verwacht object)", json_type_name(first));
            }
        }
    } else {
        ESP_LOGI(TAG, "tasks: %s; verwacht array", json_type_name(tasks));
    }
}

static void apply_one_reading(const cJSON* item)
{
    if (item == nullptr || !cJSON_IsObject(item)) {
        return;
    }
    const char* key = json_str(item, "key");
    if (key == nullptr || key[0] == '\0') {
        ESP_LOGW(TAG, "latest_readings: item zonder key (A8), overgeslagen");
        return;
    }
    const LiveField field = reading_key_to_field(key);
    if (field == LiveField::Count) {
        ESP_LOGI(TAG, "latest_readings: onbekende sleutel '%s' genegeerd (niet verzonnen)", key);
        return;
    }
    double value = 0;
    if (!json_num(item, "value", &value)) {
        ESP_LOGW(TAG, "latest_readings[%s]: geen value, overgeslagen", key);
        return;
    }
    const char* measured = json_str(item, "measured_at");
    const int64_t unix_at = parse_iso8601(measured);
    if (unix_at == 0) {
        ESP_LOGW(TAG, "latest_readings[%s]: geen geldige measured_at, overgeslagen (R5)", key);
        return;
    }
    const char* sensor_id = json_str(item, "sensor_id");
    const bool mqtt_down = mqtt_link_disconnected_over_s(APP_MQTT_DB_FALLBACK_S);
    live_store_apply_db(field, value, unix_at, sensor_id, mqtt_down);
}

static void apply_latest_readings(const cJSON* root)
{
    s_store.latest_readings_seen = false;
    const cJSON* lr = cJSON_GetObjectItemCaseSensitive(root, "latest_readings");
    if (lr == nullptr) {
        return;
    }
    s_store.latest_readings_seen = true;
    if (!cJSON_IsArray(lr)) {
        return;
    }
    const cJSON* el = nullptr;
    cJSON_ArrayForEach(el, lr) {
        apply_one_reading(el);
    }
}

static void parse_actions(const cJSON* obj, StatusTask* out)
{
    out->action_done = false;
    out->action_seen = false;
    out->action_dismissed = false;
    if (obj == nullptr) {
        return;
    }
    const cJSON* acts = cJSON_GetObjectItemCaseSensitive(obj, "actions");
    if (!cJSON_IsArray(acts)) {
        return;
    }
    const cJSON* el = nullptr;
    cJSON_ArrayForEach(el, acts) {
        if (!cJSON_IsString(el) || el->valuestring == nullptr) {
            continue;
        }
        if (strcmp(el->valuestring, "done") == 0) {
            out->action_done = true;
        } else if (strcmp(el->valuestring, "seen") == 0) {
            out->action_seen = true;
        } else if (strcmp(el->valuestring, "dismissed") == 0) {
            out->action_dismissed = true;
        } else {
            ESP_LOGI(TAG, "actions: onbekende waarde '%s' genegeerd", el->valuestring);
        }
    }
}

static const char* json_str_any(const cJSON* obj, const char* a, const char* b, const char* c)
{
    const char* s = json_str(obj, a);
    if (s != nullptr && s[0] != '\0') {
        return s;
    }
    s = json_str(obj, b);
    if (s != nullptr && s[0] != '\0') {
        return s;
    }
    return json_str(obj, c);
}

static StatusTaskFieldKind parse_field_kind(const char* t)
{
    if (t == nullptr || t[0] == '\0') {
        return static_cast<StatusTaskFieldKind>(0);
    }
    if (strcmp(t, "number") == 0 || strcmp(t, "numeric") == 0 ||
        strcmp(t, "int") == 0 || strcmp(t, "integer") == 0 ||
        strcmp(t, "float") == 0 || strcmp(t, "double") == 0 ||
        strcmp(t, "percent") == 0 || strcmp(t, "percentage") == 0) {
        return StatusTaskFieldKind::Number;
    }
    if (strcmp(t, "text") == 0 || strcmp(t, "string") == 0 ||
        strcmp(t, "note") == 0 || strcmp(t, "notes") == 0 ||
        strcmp(t, "textarea") == 0) {
        return StatusTaskFieldKind::Text;
    }
    if (strcmp(t, "select") == 0 || strcmp(t, "choice") == 0 ||
        strcmp(t, "enum") == 0 || strcmp(t, "dropdown") == 0) {
        return StatusTaskFieldKind::Choice;
    }
    return static_cast<StatusTaskFieldKind>(0);
}

static bool parse_one_field(const cJSON* obj, StatusTaskField* out)
{
    if (obj == nullptr || !cJSON_IsObject(obj) || out == nullptr) {
        return false;
    }
    const char* key = json_str_any(obj, "key", "name", "id");
    if (key == nullptr || key[0] == '\0') {
        return false;
    }
    const char* type = json_str_any(obj, "type", "kind", "input");
    StatusTaskFieldKind kind = parse_field_kind(type);
    if (kind == static_cast<StatusTaskFieldKind>(0)) {
        // A7: `note` is het enige extra POST-veld in de brief.
        if (strcmp(key, "note") == 0 || strcmp(key, "notes") == 0) {
            kind = StatusTaskFieldKind::Text;
        } else {
            ESP_LOGI(TAG, "taakveld '%s' type='%s' overgeslagen (geen number/text/choice)",
                     key, (type != nullptr) ? type : "(ontbreekt)");
            return false;
        }
    }
    StatusTaskChoiceSet choice_set = StatusTaskChoiceSet::None;
    if (kind == StatusTaskFieldKind::Choice) {
        if (strcmp(key, "water_type") == 0) {
            choice_set = StatusTaskChoiceSet::WaterType;
        } else if (strcmp(key, "reason") == 0) {
            choice_set = StatusTaskChoiceSet::Reason;
        } else {
            ESP_LOGI(TAG, "taakveld '%s' type=choice zonder bekende pal-app-lijst, overgeslagen",
                     key);
            return false;
        }
    }
    *out = StatusTaskField{};
    copy_z(out->key, sizeof(out->key), key);
    const char* label = json_str_any(obj, "label", "title", "prompt");
    ascii_from_utf8(out->label, sizeof(out->label), (label != nullptr) ? label : key);
    const char* unit = json_str(obj, "unit");
    if (unit == nullptr) {
        unit = json_str(obj, "suffix");
    }
    ascii_from_utf8(out->unit, sizeof(out->unit), unit);
    out->kind = kind;
    out->choice_set = choice_set;
    out->must_be_positive = (strcmp(key, "liters_added") == 0);
    // pal-app: notes is optioneel (required=0). Zelfde default voor ha-status note/notes.
    const bool note_key = (strcmp(key, "note") == 0 || strcmp(key, "notes") == 0);
    out->required = !note_key;
    bool req = true;
    if (json_bool(obj, "required", &req)) {
        out->required = req;
    } else {
        bool opt = false;
        if (json_bool(obj, "optional", &opt)) {
            out->required = !opt;
        }
    }
    return true;
}

static void parse_field_array(const cJSON* arr, StatusTask* out)
{
    if (!cJSON_IsArray(arr) || out == nullptr) {
        return;
    }
    const cJSON* el = nullptr;
    cJSON_ArrayForEach(el, arr) {
        if (out->field_count >= k_status_task_fields_max) {
            ESP_LOGW(TAG, "taak heeft meer dan %d velden; rest genegeerd", k_status_task_fields_max);
            break;
        }
        StatusTaskField f{};
        if (parse_one_field(el, &f)) {
            out->fields[out->field_count++] = f;
        }
    }
}

static void parse_field_container(const cJSON* node, StatusTask* out)
{
    if (node == nullptr || out == nullptr) {
        return;
    }
    if (cJSON_IsArray(node)) {
        parse_field_array(node, out);
        return;
    }
    if (!cJSON_IsObject(node)) {
        return;
    }
    const cJSON* inner = cJSON_GetObjectItemCaseSensitive(node, "fields");
    if (inner == nullptr) {
        inner = cJSON_GetObjectItemCaseSensitive(node, "form");
    }
    if (inner == nullptr) {
        inner = cJSON_GetObjectItemCaseSensitive(node, "items");
    }
    if (cJSON_IsArray(inner)) {
        parse_field_array(inner, out);
    }
}

static void ascii_lower_copy(char* dst, size_t dst_len, const char* src)
{
    if (dst == nullptr || dst_len == 0) {
        return;
    }
    dst[0] = '\0';
    if (src == nullptr) {
        return;
    }
    size_t i = 0;
    for (; src[i] != '\0' && i + 1 < dst_len; i++) {
        const char c = src[i];
        dst[i] = (c >= 'A' && c <= 'Z') ? static_cast<char>(c + 32) : c;
    }
    dst[i] = '\0';
}

static bool str_eq(const char* a, const char* b)
{
    return a != nullptr && b != nullptr && strcmp(a, b) == 0;
}

// Pal-app: task_type === 'water_change'. ha-status zet dat in `type`; later ook `kind`.
// Titel als vangnet. water_parameters is een andere taak (geen liters).
static bool is_water_change_task(const StatusTask& t)
{
    if (str_eq(t.type, "water_parameters") || str_eq(t.kind, "water_parameters")) {
        return false;
    }
    if (str_eq(t.type, "water_change") || str_eq(t.kind, "water_change")) {
        return true;
    }
    char low[96];
    ascii_lower_copy(low, sizeof(low), t.title);
    return strstr(low, "waterwissel") != nullptr ||
           strstr(low, "water change") != nullptr ||
           strstr(low, "water ververs") != nullptr;
}

static void fill_pal_field(StatusTaskField* f, const char* key, const char* label,
                           const char* unit, StatusTaskFieldKind kind,
                           StatusTaskChoiceSet choice, bool required, bool positive)
{
    if (f == nullptr) {
        return;
    }
    *f = StatusTaskField{};
    copy_z(f->key, sizeof(f->key), key);
    copy_z(f->label, sizeof(f->label), label);
    copy_z(f->unit, sizeof(f->unit), unit);
    f->kind = kind;
    f->choice_set = choice;
    f->required = required;
    f->must_be_positive = positive;
}

static void apply_pal_water_change_fields(StatusTask* out)
{
    if (out == nullptr || out->field_count > 0 || !is_water_change_task(*out)) {
        return;
    }
    if (k_status_task_fields_max < 4) {
        return;
    }
    fill_pal_field(&out->fields[0], "liters_added", "Aantal liters gewisseld", "L",
                   StatusTaskFieldKind::Number, StatusTaskChoiceSet::None, true, true);
    fill_pal_field(&out->fields[1], "water_type", "Type water", "",
                   StatusTaskFieldKind::Choice, StatusTaskChoiceSet::WaterType, true, false);
    fill_pal_field(&out->fields[2], "reason", "Reden", "",
                   StatusTaskFieldKind::Choice, StatusTaskChoiceSet::Reason, true, false);
    fill_pal_field(&out->fields[3], "notes", "Opmerkingen (optioneel)", "",
                   StatusTaskFieldKind::Text, StatusTaskChoiceSet::None, false, false);
    out->field_count = 4;
    ESP_LOGI(TAG, "taak '%s': waterwissel (pal-app); velden liters_added, water_type, reason, notes",
             out->title[0] ? out->title : out->id);
}

// Pal-app: task_type === 'water_parameters'. WaterParametersPopup vraagt alleen
// "al gemeten?"; de echte invoer is ParameterForm (ph verplicht; kh/nitrite/nitrate
// optioneel). Max 4 velden op het paneel (zelfde cap als ha-status).
static bool is_water_parameters_task(const StatusTask& t)
{
    if (str_eq(t.type, "water_parameters") || str_eq(t.kind, "water_parameters")) {
        return true;
    }
    if (is_water_change_task(t)) {
        return false;
    }
    char low[96];
    ascii_lower_copy(low, sizeof(low), t.title);
    return strstr(low, "watermeting") != nullptr ||
           strstr(low, "waterparameter") != nullptr ||
           strstr(low, "water parameters") != nullptr ||
           strstr(low, "water controleren") != nullptr;
}

static void apply_pal_water_parameters_fields(StatusTask* out)
{
    if (out == nullptr || out->field_count > 0 || !is_water_parameters_task(*out)) {
        return;
    }
    if (k_status_task_fields_max < 4) {
        return;
    }
    fill_pal_field(&out->fields[0], "ph", "pH", "",
                   StatusTaskFieldKind::Number, StatusTaskChoiceSet::None, true, false);
    fill_pal_field(&out->fields[1], "kh", "KH", "dH",
                   StatusTaskFieldKind::Number, StatusTaskChoiceSet::None, false, false);
    fill_pal_field(&out->fields[2], "nitrite", "Nitriet", "mg/l",
                   StatusTaskFieldKind::Number, StatusTaskChoiceSet::None, false, false);
    fill_pal_field(&out->fields[3], "nitrate", "Nitraat", "mg/l",
                   StatusTaskFieldKind::Number, StatusTaskChoiceSet::None, false, false);
    out->field_count = 4;
    ESP_LOGI(TAG, "taak '%s': watermeting (pal-app); velden ph, kh, nitrite, nitrate",
             out->title[0] ? out->title : out->id);
}

static void log_task_json_keys(int idx, const cJSON* obj, const StatusTask& parsed)
{
    if (obj == nullptr || !cJSON_IsObject(obj)) {
        return;
    }
    char keys[256];
    collect_keys(obj, keys, sizeof(keys));
    const char* type = json_str(obj, "type");
    const cJSON* extra = cJSON_GetObjectItemCaseSensitive(obj, "extra");
    const cJSON* payload = cJSON_GetObjectItemCaseSensitive(obj, "payload");
    const cJSON* fields = cJSON_GetObjectItemCaseSensitive(obj, "fields");
    const cJSON* form = cJSON_GetObjectItemCaseSensitive(obj, "form");
    ESP_LOGI(TAG, "taak[%d] id='%s' type='%s' keys=[%s] extra=%s payload=%s fields=%s form=%s invoervelden=%d",
             idx, parsed.id[0] ? parsed.id : "-",
             (type != nullptr) ? type : "",
             keys, json_type_name(extra), json_type_name(payload),
             json_type_name(fields), json_type_name(form), parsed.field_count);

    auto dump_nested = [idx](const char* name, const cJSON* n) {
        if (n == nullptr) {
            return;
        }
        if (cJSON_IsObject(n)) {
            char nk[192];
            collect_keys(n, nk, sizeof(nk));
            ESP_LOGI(TAG, "taak[%d].%s keys=[%s]", idx, name, nk);
        } else if (cJSON_IsArray(n)) {
            const int n_el = cJSON_GetArraySize(n);
            ESP_LOGI(TAG, "taak[%d].%s array (%d)", idx, name, n_el);
            if (n_el > 0) {
                const cJSON* first = cJSON_GetArrayItem(n, 0);
                if (cJSON_IsObject(first)) {
                    char nk[192];
                    collect_keys(first, nk, sizeof(nk));
                    ESP_LOGI(TAG, "taak[%d].%s[0] keys=[%s]", idx, name, nk);
                } else if (cJSON_IsString(first) && first->valuestring != nullptr) {
                    ESP_LOGI(TAG, "taak[%d].%s[0] string='%s' (geen object-schema, geen invoer W3)",
                             idx, name, first->valuestring);
                } else {
                    ESP_LOGI(TAG, "taak[%d].%s[0] %s (geen object-schema)", idx, name,
                             json_type_name(first));
                }
            }
        }
    };
    dump_nested("extra", extra);
    dump_nested("payload", payload);
    dump_nested("fields", fields);
    dump_nested("form", form);

    if (is_water_change_task(parsed) && parsed.field_count > 0) {
        ESP_LOGI(TAG, "taak[%d]: waterwissel, invoervelden=%d (pal-app of ha-status)",
                 idx, parsed.field_count);
    } else if (is_water_parameters_task(parsed) && parsed.field_count > 0) {
        ESP_LOGI(TAG, "taak[%d]: watermeting, invoervelden=%d (pal-app of ha-status)",
                 idx, parsed.field_count);
    } else if (parsed.field_count == 0 &&
               (extra != nullptr || payload != nullptr || fields != nullptr || form != nullptr)) {
        ESP_LOGI(TAG, "taak[%d]: extra/payload/fields/form aanwezig maar geen bruikbaar "
                      "veldschema (key+type number/text/choice); geen invoerstap",
                 idx);
    }
    for (int i = 0; i < parsed.field_count; i++) {
        const char* kname = "number";
        if (parsed.fields[i].kind == StatusTaskFieldKind::Text) {
            kname = "text";
        } else if (parsed.fields[i].kind == StatusTaskFieldKind::Choice) {
            kname = "choice";
        }
        ESP_LOGI(TAG, "taak[%d] invoer[%d] key='%s' kind=%s required=%d unit='%s'",
                 idx, i, parsed.fields[i].key, kname,
                 parsed.fields[i].required ? 1 : 0, parsed.fields[i].unit);
    }
}

static void parse_task_id(const cJSON* obj, StatusTask* out)
{
    out->has_id = false;
    out->id[0] = '\0';
    if (obj == nullptr) {
        return;
    }
    const cJSON* n = cJSON_GetObjectItemCaseSensitive(obj, "id");
    if (cJSON_IsString(n) && n->valuestring != nullptr && n->valuestring[0] != '\0') {
        copy_z(out->id, sizeof(out->id), n->valuestring);
        out->has_id = true;
        return;
    }
    if (cJSON_IsNumber(n)) {
        snprintf(out->id, sizeof(out->id), "%.0f", n->valuedouble);
        out->has_id = out->id[0] != '\0';
    }
}

static void parse_task(const cJSON* obj, StatusTask* out)
{
    *out = StatusTask{};
    if (obj == nullptr || !cJSON_IsObject(obj)) {
        return;
    }
    ascii_from_utf8(out->title, sizeof(out->title), json_str(obj, "title"));
    ascii_from_utf8(out->description, sizeof(out->description), json_str(obj, "description"));
    out->has_description = out->description[0] != '\0';
    parse_task_id(obj, out);
    ascii_from_utf8(out->type, sizeof(out->type), json_str(obj, "type"));
    ascii_from_utf8(out->kind, sizeof(out->kind), json_str(obj, "kind"));
    ascii_from_utf8(out->severity, sizeof(out->severity), json_str(obj, "severity"));
    copy_z(out->due_date, sizeof(out->due_date), json_str(obj, "due_date"));
    bool ov = false;
    if (json_bool(obj, "overdue", &ov)) {
        out->overdue = ov;
    }
    parse_actions(obj, out);

    // Invoerschema alleen uit de JSON (W3). Volgorde: fields, form, extra, payload.
    parse_field_container(cJSON_GetObjectItemCaseSensitive(obj, "fields"), out);
    if (out->field_count == 0) {
        parse_field_container(cJSON_GetObjectItemCaseSensitive(obj, "form"), out);
    }
    if (out->field_count == 0) {
        parse_field_container(cJSON_GetObjectItemCaseSensitive(obj, "extra"), out);
    }
    if (out->field_count == 0) {
        parse_field_container(cJSON_GetObjectItemCaseSensitive(obj, "payload"), out);
    }
    apply_pal_water_change_fields(out);
    apply_pal_water_parameters_fields(out);
}

static bool parse_due_ymd(const char* s, int* y, int* mo, int* d)
{
    if (s == nullptr || s[0] == '\0' || y == nullptr || mo == nullptr || d == nullptr) {
        return false;
    }
    int yy = 0, mm = 0, dd = 0;
    if (sscanf(s, "%d-%d-%d", &yy, &mm, &dd) < 3) {
        return false;
    }
    if (yy < 2024 || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
        return false;
    }
    *y = yy;
    *mo = mm;
    *d = dd;
    return true;
}

// Lokale kalenderdag via SNTP (CET/CEST). Geen time() vóór sync: dat zou 1970 zijn (R5).
static bool local_today_ymd(int* y, int* mo, int* d)
{
    if (y == nullptr || mo == nullptr || d == nullptr || !time_sync_is_synced()) {
        return false;
    }
    const time_t now = time(nullptr);
    if (now <= 0) {
        return false;
    }
    struct tm tm_l = {};
    if (localtime_r(&now, &tm_l) == nullptr) {
        return false;
    }
    const int yy = tm_l.tm_year + 1900;
    if (yy < 2024) {
        return false;
    }
    *y = yy;
    *mo = tm_l.tm_mon + 1;
    *d = tm_l.tm_mday;
    return true;
}

static int ymd_cmp(int y1, int m1, int d1, int y2, int m2, int d2)
{
    if (y1 != y2) {
        return (y1 < y2) ? -1 : 1;
    }
    if (m1 != m2) {
        return (m1 < m2) ? -1 : 1;
    }
    if (d1 != d2) {
        return (d1 < d2) ? -1 : 1;
    }
    return 0;
}

bool status_task_is_due_now(const StatusTask& t)
{
    if (t.overdue) {
        return true;
    }
    int dy = 0, dm = 0, dd = 0;
    if (!parse_due_ymd(t.due_date, &dy, &dm, &dd)) {
        return false;
    }
    int ty = 0, tm = 0, td = 0;
    if (!local_today_ymd(&ty, &tm, &td)) {
        return false;
    }
    return ymd_cmp(dy, dm, dd, ty, tm, td) <= 0;
}

static void fill_due_now(StatusSnapshot* snap)
{
    if (snap == nullptr) {
        return;
    }
    snap->due_now_count = 0;
    for (int i = 0; i < snap->task_count; i++) {
        snap->tasks[i].due_now = status_task_is_due_now(snap->tasks[i]);
        if (snap->tasks[i].due_now) {
            snap->due_now_count++;
        }
    }
}

static void raise_popup(StatusPopup kind)
{
    s_popup_seq++;
    s_store.popup = kind;
    s_store.popup_seq = s_popup_seq;
}

static void end_close()
{
    s_store.close_busy = false;
    s_store.close_task_id[0] = '\0';
}

void status_store_init()
{
    if (s_mutex == nullptr) {
        s_mutex = xSemaphoreCreateMutex();
    }
    if (s_store_ptr == nullptr) {
        s_store_ptr = static_cast<StatusSnapshot*>(
            heap_caps_calloc(1, sizeof(StatusSnapshot), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
        if (s_store_ptr == nullptr) {
            // Geen INTERNAL-fallback: dat at DMA vóór hosted-RX (sdio_rx_get_buffer).
            ESP_LOGE(TAG, "geen PSRAM voor StatusSnapshot (%u B); geen interne fallback",
                     static_cast<unsigned>(sizeof(StatusSnapshot)));
        } else {
            ESP_LOGI(TAG, "status_store klaar (snapshot %u B in PSRAM, niet op LVGL-stack)",
                     static_cast<unsigned>(sizeof(StatusSnapshot)));
        }
    }
    if (s_store_ptr == nullptr) {
        ESP_LOGE(TAG, "geen geheugen voor StatusSnapshot");
        return;
    }
    s_store = StatusSnapshot{};
}

void status_store_set_fetching()
{
    if (s_store_ptr == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_store.fetching = true;
    if (s_store.fetch == StatusFetchState::Never) {
        s_store.fetch = StatusFetchState::Fetching;
    }
    s_store.error_detail[0] = '\0';
    xSemaphoreGive(s_mutex);
}

void status_store_set_network_error(const char* reason)
{
    if (s_store_ptr == nullptr || s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_store.fetching = false;
    if (s_store.fetch != StatusFetchState::TokenInvalid) {
        s_store.fetch = StatusFetchState::Error;
    }
    copy_z(s_store.error_detail, sizeof(s_store.error_detail), reason);
    xSemaphoreGive(s_mutex);
}

void status_store_set_http_error(int http_status, const char* reason)
{
    if (s_store_ptr == nullptr || s_mutex == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_store.fetching = false;
    if (http_status == 401) {
        s_store.fetch = StatusFetchState::TokenInvalid;
        copy_z(s_store.error_detail, sizeof(s_store.error_detail),
               "Token ongeldig - controleer KOISENSEI_HA_TOKEN");
    } else {
        s_store.fetch = StatusFetchState::Error;
        copy_z(s_store.error_detail, sizeof(s_store.error_detail), reason);
    }
    xSemaphoreGive(s_mutex);
}

void status_store_apply_http(int http_status, const char* body, int body_len)
{
    if (http_status == 401) {
        status_store_set_http_error(401, nullptr);
        return;
    }
    if (http_status < 200 || http_status > 299) {
        char r[80];
        snprintf(r, sizeof(r), "HTTP %d", http_status);
        status_store_set_http_error(http_status, r);
        return;
    }
    if (body == nullptr || body_len <= 0) {
        status_store_set_http_error(http_status, "leeg antwoord");
        return;
    }
    if (s_store_ptr == nullptr) {
        return;
    }

    cJSON* root = cJSON_Parse(body);
    if (root == nullptr) {
        ESP_LOGE(TAG, "ha-status: JSON parse mislukt (len %d)", body_len);
        ESP_LOGE(TAG, "ha-status ruwe vorm: parse faalde, eerste bytes: '%.80s'", body);
        status_store_set_http_error(http_status, "ongeldige JSON");
        return;
    }

    log_json_shape_once(root);

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_store.fetching = false;
    s_store.fetch = StatusFetchState::Ok;
    s_store.has_data = true;
    s_store.error_detail[0] = '\0';
    s_store.fetched_at_unix = time_sync_is_synced() ? static_cast<int64_t>(time(nullptr)) : 0;

    ascii_from_utf8(s_store.season, sizeof(s_store.season), json_str(root, "season"));
    s_store.season_present = s_store.season[0] != '\0';
    copy_z(s_store.season_since, sizeof(s_store.season_since), json_str(root, "season_since"));

    bool dok = true;
    s_store.data_ok_present = json_bool(root, "data_ok", &dok);
    s_store.data_ok = s_store.data_ok_present ? dok : true;

    s_store.feed_label[0] = '\0';
    s_store.feed_present = false;
    const cJSON* feed = cJSON_GetObjectItemCaseSensitive(root, "feed_band");
    if (cJSON_IsString(feed) && feed->valuestring != nullptr && feed->valuestring[0] != '\0') {
        ascii_from_utf8(s_store.feed_label, sizeof(s_store.feed_label), feed->valuestring);
        s_store.feed_present = s_store.feed_label[0] != '\0';
    } else if (cJSON_IsObject(feed)) {
        // Later model (§7.1): voeradvies uit feed_band.label. Geen extra velden verzinnen.
        ascii_from_utf8(s_store.feed_label, sizeof(s_store.feed_label), json_str(feed, "label"));
        s_store.feed_present = true;
    }

    s_store.water_temp_24h_present = false;
    s_store.water_temp_24h = 0;
    s_store.water_temp_week_present = false;
    s_store.water_temp_week = 0;
    s_store.trend_present = false;
    s_store.trend[0] = '\0';
    double wt24 = 0;
    if (json_num(root, "water_temp_24h", &wt24)) {
        s_store.water_temp_24h = static_cast<float>(wt24);
        s_store.water_temp_24h_present = true;
    }
    double wtweek = 0;
    if (json_num(root, "water_temp_week", &wtweek)) {
        s_store.water_temp_week = static_cast<float>(wtweek);
        s_store.water_temp_week_present = true;
    }
    const cJSON* trend = cJSON_GetObjectItemCaseSensitive(root, "trend");
    if (cJSON_IsString(trend) && trend->valuestring != nullptr && trend->valuestring[0] != '\0') {
        ascii_from_utf8(s_store.trend, sizeof(s_store.trend), trend->valuestring);
        s_store.trend_present = s_store.trend[0] != '\0';
    } else if (cJSON_IsNumber(trend)) {
        char tmp[24];
        snprintf(tmp, sizeof(tmp), "%.1f", trend->valuedouble);
        for (char* p = tmp; *p != '\0'; p++) {
            if (*p == '.') {
                *p = ',';
            }
        }
        copy_z(s_store.trend, sizeof(s_store.trend), tmp);
        s_store.trend_present = s_store.trend[0] != '\0';
    }

    double ot = 0;
    const bool have_ot = json_num(root, "open_tasks", &ot);

    s_store.task_count = 0;
    const cJSON* tasks = cJSON_GetObjectItemCaseSensitive(root, "tasks");
    if (cJSON_IsArray(tasks)) {
        const int n = cJSON_GetArraySize(tasks);
        const int take = (n > k_status_tasks_max) ? k_status_tasks_max : n;
        for (int i = 0; i < take; i++) {
            const cJSON* item = cJSON_GetArrayItem(tasks, i);
            parse_task(item, &s_store.tasks[s_store.task_count]);
            log_task_json_keys(s_store.task_count, item, s_store.tasks[s_store.task_count]);
            s_store.task_count++;
        }
        if (n > k_status_tasks_max) {
            ESP_LOGW(TAG, "ha-status: %d taken, alleen de eerste %d getoond", n, k_status_tasks_max);
        }
    }
    s_store.open_tasks = have_ot ? static_cast<int>(ot) : s_store.task_count;

    apply_latest_readings(root);

    int with_actions = 0;
    int due_nu = 0;
    int with_fields = 0;
    for (int i = 0; i < s_store.task_count; i++) {
        if (s_store.tasks[i].action_done || s_store.tasks[i].action_seen ||
            s_store.tasks[i].action_dismissed) {
            with_actions++;
        }
        if (s_store.tasks[i].field_count > 0) {
            with_fields++;
        }
        if (status_task_is_due_now(s_store.tasks[i])) {
            due_nu++;
        }
    }
    const int open_log = s_store.open_tasks;
    const int n_log = s_store.task_count;
    const int season_log = s_store.season_present ? 1 : 0;
    const int feed_log = s_store.feed_present ? 1 : 0;
    const int lr_log = s_store.latest_readings_seen ? 1 : 0;
    const int tijd_log = time_sync_is_synced() ? 1 : 0;
    const int fields_log = with_fields;

    xSemaphoreGive(s_mutex);
    cJSON_Delete(root);

    ESP_LOGI(TAG, "ha-status verwerkt: seizoen=%d voer=%d open_taken=%d due_nu=%d later=%d "
                  "taken=%d met_actions=%d met_invoervelden=%d latest_readings=%d tijd_sync=%d",
             season_log, feed_log, open_log, due_nu, n_log - due_nu, n_log, with_actions, fields_log,
             lr_log, tijd_log);
}

void status_store_begin_close(const char* task_id)
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_store.close_busy = true;
    copy_z(s_store.close_task_id, sizeof(s_store.close_task_id), task_id);
    xSemaphoreGive(s_mutex);
}

void status_store_close_ok(const char* task_id)
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (task_id != nullptr && task_id[0] != '\0') {
        int w = 0;
        for (int i = 0; i < s_store.task_count; i++) {
            if (strcmp(s_store.tasks[i].id, task_id) == 0) {
                continue;
            }
            if (w != i) {
                s_store.tasks[w] = s_store.tasks[i];
            }
            w++;
        }
        s_store.task_count = w;
        if (s_store.open_tasks > 0) {
            s_store.open_tasks--;
        }
        ESP_LOGI(TAG, "taak lokaal verwijderd na POST ok (niet wachten op GET): '%s'",
                 task_id);
    }
    end_close();
    // GET volgt meteen: fetching nu al, anders unfreezet de UI tussen close_ok en do_fetch
    // (tweede rebuild in dezelfde tick → 14 kaarten tegelijk tekenen).
    s_store.fetching = true;
    xSemaphoreGive(s_mutex);
}

void status_store_close_already_closed()
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    end_close();
    raise_popup(StatusPopup::AlreadyClosed);
    xSemaphoreGive(s_mutex);
}

void status_store_close_endpoint_missing()
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    end_close();
    copy_z(s_store.error_detail, sizeof(s_store.error_detail),
           "Afronden nog niet beschikbaar (geen task-close)");
    xSemaphoreGive(s_mutex);
    ESP_LOGW(TAG, "task-close: 404 zonder task_not_found; endpoint ontbreekt waarschijnlijk");
}

void status_store_close_token()
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    end_close();
    s_store.fetch = StatusFetchState::TokenInvalid;
    copy_z(s_store.error_detail, sizeof(s_store.error_detail),
           "Token ongeldig - controleer KOISENSEI_HA_TOKEN");
    raise_popup(StatusPopup::TokenInvalid);
    xSemaphoreGive(s_mutex);
}

void status_store_close_server_error()
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    end_close();
    raise_popup(StatusPopup::ServerError);
    xSemaphoreGive(s_mutex);
}

void status_store_close_network_error()
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    end_close();
    raise_popup(StatusPopup::NoNetwork);
    xSemaphoreGive(s_mutex);
}

void status_store_close_abort()
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    end_close();
    xSemaphoreGive(s_mutex);
}

void status_store_popup_ack(uint32_t seq)
{
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (s_store.popup_seq == seq) {
        s_store.popup = StatusPopup::None;
    }
    xSemaphoreGive(s_mutex);
}

void status_store_snapshot(StatusSnapshot* out)
{
    if (out == nullptr || s_store_ptr == nullptr) {
        return;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    *out = s_store;
    xSemaphoreGive(s_mutex);

    fill_due_now(out);

    if (out->fetched_at_unix > 0 && time_sync_is_synced()) {
        const int64_t now = static_cast<int64_t>(time(nullptr));
        const int64_t age = (now > out->fetched_at_unix) ? (now - out->fetched_at_unix) : 0;
        out->data_age_s = (age > 0x7FFFFFFF) ? 0x7FFFFFFF : static_cast<int32_t>(age);
        out->data_stale_warn = out->data_age_s > APP_STATUS_STALE_WARN_S;
    }
}

bool status_store_is_close_busy()
{
    if (s_store_ptr == nullptr || s_mutex == nullptr) {
        return false;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const bool busy = s_store.close_busy;
    xSemaphoreGive(s_mutex);
    return busy;
}
