// KOIoT Paneel - settings_store (M1.7 scherm; M3a vijver; M3c wifi; M3d MQTT; M3e token; M3f OTA-URL).
#include "core/settings_store.h"

#include <cstdio>
#include <cstring>

#include "esp_log.h"
#include "nvs.h"

#include "app_config.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "secrets.h"

static const char* TAG = "settings";

static ScreenSettings s_screen;
static uint32_t s_pond_l = APP_POND_VOLUME_L;
static char s_wifi_ssid[APP_WIFI_SSID_MAX + 1] = "";
static char s_wifi_pass[APP_WIFI_PASS_MAX + 1] = "";
static bool s_wifi_from_nvs = false;
static char s_mqtt_host[APP_MQTT_HOST_MAX + 1] = "";
static uint16_t s_mqtt_port = MQTT_BROKER_PORT;
static char s_mqtt_user[APP_MQTT_USER_MAX + 1] = "";
static char s_mqtt_pass[APP_MQTT_PASS_MAX + 1] = "";
static bool s_mqtt_from_nvs = false;
static char s_token[APP_TOKEN_MAX + 1] = "";
static bool s_token_from_nvs = false;
static char s_ota_url[APP_OTA_URL_MAX + 1] = "";
static SemaphoreHandle_t s_mutex = nullptr;
static bool s_loaded = false;

static uint8_t clamp_u8(uint32_t v, uint8_t lo, uint8_t hi)
{
    if (v < lo) {
        return lo;
    }
    if (v > hi) {
        return hi;
    }
    return static_cast<uint8_t>(v);
}

static ScreenSettings clamp_screen(ScreenSettings s)
{
    if (s.t1_s < 10) {
        s.t1_s = 10;
    }
    if (s.t1_s > 3600) {
        s.t1_s = 3600;
    }
    if (s.t2_s > 12 * 3600) {
        s.t2_s = 12 * 3600;
    }
    s.brightness_active = clamp_u8(s.brightness_active, 1, 100);
    s.brightness_idle = clamp_u8(s.brightness_idle, 1, 100);
    return s;
}

static void save_nvs(const ScreenSettings& s)
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_SCREEN_NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS '%s' openen: %s (0x%x)", APP_SCREEN_NVS_NS,
                 esp_err_to_name(err), err);
        return;
    }
    nvs_set_u32(h, APP_SCREEN_NVS_T1, s.t1_s);
    nvs_set_u32(h, APP_SCREEN_NVS_T2, s.t2_s);
    nvs_set_u8(h, APP_SCREEN_NVS_BR_ACT, s.brightness_active);
    nvs_set_u8(h, APP_SCREEN_NVS_BR_IDLE, s.brightness_idle);
    nvs_set_u8(h, APP_SCREEN_NVS_IDLE_ON, s.idle_screen_enabled ? 1 : 0);
    err = nvs_commit(h);
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS scherminstellingen opslaan: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    ESP_LOGI(TAG, "scherminstellingen bewaard: T1=%u s T2=%u s (0=nooit) actief=%u%% rust=%u%% rustscherm=%s",
             (unsigned)s.t1_s, (unsigned)s.t2_s, (unsigned)s.brightness_active,
             (unsigned)s.brightness_idle, s.idle_screen_enabled ? "aan" : "uit");
}

static uint32_t clamp_pond(uint32_t v)
{
    if (v < APP_POND_VOL_MIN_L) {
        return APP_POND_VOL_MIN_L;
    }
    if (v > APP_POND_VOL_MAX_L) {
        return APP_POND_VOL_MAX_L;
    }
    return v;
}

static void save_pond_nvs(uint32_t liters)
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_POND_NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS '%s' openen: %s (0x%x)", APP_POND_NVS_NS,
                 esp_err_to_name(err), err);
        return;
    }
    nvs_set_u32(h, APP_POND_NVS_VOL, liters);
    err = nvs_commit(h);
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS vijverinhoud opslaan: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    ESP_LOGI(TAG, "vijverinhoud bewaard: %u L", (unsigned)liters);
}

static void load_pond_nvs()
{
    s_pond_l = APP_POND_VOLUME_L;
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_POND_NVS_NS, NVS_READONLY, &h);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "geen bewaarde vijverinhoud; default %u L",
                 (unsigned)s_pond_l);
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS vijver lezen mislukt: %s (0x%x); default %u L",
                 esp_err_to_name(err), err, (unsigned)s_pond_l);
        return;
    }
    uint32_t vol = s_pond_l;
    if (nvs_get_u32(h, APP_POND_NVS_VOL, &vol) == ESP_OK) {
        s_pond_l = clamp_pond(vol);
    }
    nvs_close(h);
    ESP_LOGI(TAG, "vijverinhoud uit NVS: %u L", (unsigned)s_pond_l);
}

static void load_nvs()
{
    s_screen = ScreenSettings{};
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_SCREEN_NVS_NS, NVS_READONLY, &h);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "geen bewaarde scherminstellingen; defaults T1=%u s T2=%u s",
                 (unsigned)s_screen.t1_s, (unsigned)s_screen.t2_s);
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS scherm lezen mislukt: %s (0x%x); defaults",
                 esp_err_to_name(err), err);
        return;
    }
    uint32_t t1 = s_screen.t1_s;
    uint32_t t2 = s_screen.t2_s;
    uint8_t ba = s_screen.brightness_active;
    uint8_t bi = s_screen.brightness_idle;
    uint8_t idle = s_screen.idle_screen_enabled ? 1 : 0;
    if (nvs_get_u32(h, APP_SCREEN_NVS_T1, &t1) == ESP_OK) {
        s_screen.t1_s = t1;
    }
    if (nvs_get_u32(h, APP_SCREEN_NVS_T2, &t2) == ESP_OK) {
        s_screen.t2_s = t2;
    }
    if (nvs_get_u8(h, APP_SCREEN_NVS_BR_ACT, &ba) == ESP_OK) {
        s_screen.brightness_active = ba;
    }
    if (nvs_get_u8(h, APP_SCREEN_NVS_BR_IDLE, &bi) == ESP_OK) {
        s_screen.brightness_idle = bi;
    }
    if (nvs_get_u8(h, APP_SCREEN_NVS_IDLE_ON, &idle) == ESP_OK) {
        s_screen.idle_screen_enabled = (idle != 0);
    }
    nvs_close(h);
    s_screen = clamp_screen(s_screen);
    ESP_LOGI(TAG, "scherminstellingen uit NVS: T1=%u s T2=%u s actief=%u%% rust=%u%% rustscherm=%s",
             (unsigned)s_screen.t1_s, (unsigned)s_screen.t2_s,
             (unsigned)s_screen.brightness_active, (unsigned)s_screen.brightness_idle,
             s_screen.idle_screen_enabled ? "aan" : "uit");
}

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

static void load_wifi_nvs()
{
    s_wifi_ssid[0] = '\0';
    s_wifi_pass[0] = '\0';
    s_wifi_from_nvs = false;
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_WIFI_NVS_NS, NVS_READONLY, &h);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "geen bewaard wifi-netwerk; secrets.h-fallback");
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS wifi lezen mislukt: %s (0x%x); secrets.h-fallback",
                 esp_err_to_name(err), err);
        return;
    }
    size_t slen = sizeof(s_wifi_ssid);
    size_t plen = sizeof(s_wifi_pass);
    const esp_err_t ssid_err = nvs_get_str(h, APP_WIFI_NVS_SSID, s_wifi_ssid, &slen);
    const esp_err_t pass_err = nvs_get_str(h, APP_WIFI_NVS_PASS, s_wifi_pass, &plen);
    nvs_close(h);
    if (ssid_err != ESP_OK || s_wifi_ssid[0] == '\0') {
        s_wifi_ssid[0] = '\0';
        s_wifi_pass[0] = '\0';
        ESP_LOGI(TAG, "geen geldige wifi-SSID in NVS; secrets.h-fallback");
        return;
    }
    if (pass_err != ESP_OK) {
        s_wifi_pass[0] = '\0';
    }
    s_wifi_from_nvs = true;
    ESP_LOGI(TAG, "wifi uit NVS: SSID '%s' (wachtwoord %s)",
             s_wifi_ssid, s_wifi_pass[0] ? "gezet" : "leeg");
}

static void save_wifi_nvs(const char* ssid, const char* pass)
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_WIFI_NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS '%s' openen: %s (0x%x)", APP_WIFI_NVS_NS,
                 esp_err_to_name(err), err);
        return;
    }
    nvs_set_str(h, APP_WIFI_NVS_SSID, ssid ? ssid : "");
    nvs_set_str(h, APP_WIFI_NVS_PASS, pass ? pass : "");
    err = nvs_commit(h);
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS wifi opslaan: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    ESP_LOGI(TAG, "wifi bewaard: SSID '%s' (wachtwoord %s)",
             ssid ? ssid : "", (pass && pass[0]) ? "gezet" : "leeg");
}

static uint16_t clamp_mqtt_port(uint32_t v)
{
    if (v < 1 || v > 65535) {
        return MQTT_BROKER_PORT;
    }
    return static_cast<uint16_t>(v);
}

static void fill_mqtt_defaults()
{
    copy_str(s_mqtt_host, sizeof(s_mqtt_host), MQTT_BROKER_HOST);
    s_mqtt_port = MQTT_BROKER_PORT;
    copy_str(s_mqtt_user, sizeof(s_mqtt_user), MQTT_USER);
    copy_str(s_mqtt_pass, sizeof(s_mqtt_pass), MQTT_PASS);
    s_mqtt_from_nvs = false;
}

static void load_mqtt_nvs()
{
    fill_mqtt_defaults();
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_MQTT_NVS_NS, NVS_READONLY, &h);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "geen bewaarde MQTT-instellingen; default %s:%u user '%s'",
                 s_mqtt_host, (unsigned)s_mqtt_port, s_mqtt_user);
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS MQTT lezen mislukt: %s (0x%x); compile-time/secrets-fallback",
                 esp_err_to_name(err), err);
        return;
    }
    char host[APP_MQTT_HOST_MAX + 1] = "";
    size_t hlen = sizeof(host);
    if (nvs_get_str(h, APP_MQTT_NVS_HOST, host, &hlen) == ESP_OK && host[0] != '\0') {
        copy_str(s_mqtt_host, sizeof(s_mqtt_host), host);
        s_mqtt_from_nvs = true;
    }
    uint16_t port = s_mqtt_port;
    if (nvs_get_u16(h, APP_MQTT_NVS_PORT, &port) == ESP_OK) {
        s_mqtt_port = clamp_mqtt_port(port);
        if (s_mqtt_host[0] != '\0') {
            s_mqtt_from_nvs = true;
        }
    }
    char user[APP_MQTT_USER_MAX + 1] = "";
    size_t ulen = sizeof(user);
    if (nvs_get_str(h, APP_MQTT_NVS_USER, user, &ulen) == ESP_OK) {
        copy_str(s_mqtt_user, sizeof(s_mqtt_user), user);
        if (s_mqtt_host[0] != '\0') {
            s_mqtt_from_nvs = true;
        }
    }
    char pass[APP_MQTT_PASS_MAX + 1] = "";
    size_t plen = sizeof(pass);
    if (nvs_get_str(h, APP_MQTT_NVS_PASS, pass, &plen) == ESP_OK) {
        copy_str(s_mqtt_pass, sizeof(s_mqtt_pass), pass);
    }
    nvs_close(h);
    ESP_LOGI(TAG, "MQTT %s: %s:%u user '%s' (wachtwoord %s)",
             s_mqtt_from_nvs ? "uit NVS" : "default (geen host in NVS)",
             s_mqtt_host, (unsigned)s_mqtt_port, s_mqtt_user,
             s_mqtt_pass[0] ? "gezet" : "leeg");
}

static void save_mqtt_nvs()
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_MQTT_NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS '%s' openen: %s (0x%x)", APP_MQTT_NVS_NS,
                 esp_err_to_name(err), err);
        return;
    }
    nvs_set_str(h, APP_MQTT_NVS_HOST, s_mqtt_host);
    nvs_set_u16(h, APP_MQTT_NVS_PORT, s_mqtt_port);
    nvs_set_str(h, APP_MQTT_NVS_USER, s_mqtt_user);
    nvs_set_str(h, APP_MQTT_NVS_PASS, s_mqtt_pass);
    err = nvs_commit(h);
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS MQTT opslaan: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    ESP_LOGI(TAG, "MQTT bewaard: %s:%u user '%s' (wachtwoord %s)",
             s_mqtt_host, (unsigned)s_mqtt_port, s_mqtt_user,
             s_mqtt_pass[0] ? "gezet" : "leeg");
}

static bool token_is_set(const char* t)
{
    return t != nullptr && t[0] != '\0' && strcmp(t, "CHANGE_ME") != 0;
}

static void token_last4(const char* token, char* out, size_t out_len)
{
    if (out == nullptr || out_len == 0) {
        return;
    }
    if (!token_is_set(token)) {
        snprintf(out, out_len, "%s", (token != nullptr && token[0]) ? "niet-gezet" : "leeg");
        return;
    }
    const size_t n = strlen(token);
    const char* p = (n >= 4) ? token + (n - 4) : token;
    snprintf(out, out_len, "%s", p);
}

static void fill_token_default()
{
    s_token[0] = '\0';
    s_token_from_nvs = false;
#ifdef KOISENSEI_HA_TOKEN
    copy_str(s_token, sizeof(s_token), KOISENSEI_HA_TOKEN);
#endif
}

static void format_token_mask(const char* token, char* out, size_t out_len)
{
    if (out == nullptr || out_len == 0) {
        return;
    }
    if (token == nullptr || token[0] == '\0') {
        snprintf(out, out_len, "(leeg)");
        return;
    }
    if (strcmp(token, "CHANGE_ME") == 0) {
        snprintf(out, out_len, "(niet gezet)");
        return;
    }
    char last[8] = "";
    token_last4(token, last, sizeof(last));
    snprintf(out, out_len, "****%s", last);
}

static void load_token_nvs()
{
    fill_token_default();
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_TOKEN_NVS_NS, NVS_READONLY, &h);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        char last[8] = "";
        token_last4(s_token, last, sizeof(last));
        ESP_LOGI(TAG, "geen bewaard device-token; secrets.h-fallback (len=%u last4=%s)",
                 (unsigned)strlen(s_token), last);
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS token lezen mislukt: %s (0x%x); secrets.h-fallback",
                 esp_err_to_name(err), err);
        return;
    }
    char token[APP_TOKEN_MAX + 1] = "";
    size_t tlen = sizeof(token);
    const esp_err_t tok_err = nvs_get_str(h, APP_TOKEN_NVS_KEY, token, &tlen);
    nvs_close(h);
    if (tok_err == ESP_OK && token_is_set(token)) {
        copy_str(s_token, sizeof(s_token), token);
        s_token_from_nvs = true;
        char last[8] = "";
        token_last4(s_token, last, sizeof(last));
        ESP_LOGI(TAG, "device-token uit NVS (len=%u last4=%s)",
                 (unsigned)strlen(s_token), last);
        return;
    }
    char last[8] = "";
    token_last4(s_token, last, sizeof(last));
    ESP_LOGI(TAG, "geen geldig token in NVS; secrets.h-fallback (len=%u last4=%s)",
             (unsigned)strlen(s_token), last);
}

static void save_token_nvs()
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_TOKEN_NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS '%s' openen: %s (0x%x)", APP_TOKEN_NVS_NS,
                 esp_err_to_name(err), err);
        return;
    }
    nvs_set_str(h, APP_TOKEN_NVS_KEY, s_token);
    err = nvs_commit(h);
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS device-token opslaan: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    char last[8] = "";
    token_last4(s_token, last, sizeof(last));
    ESP_LOGI(TAG, "device-token bewaard (len=%u last4=%s)",
             (unsigned)strlen(s_token), last);
}

static void load_ota_nvs()
{
    s_ota_url[0] = '\0';
#ifdef APP_OTA_URL_DEFAULT
    if (APP_OTA_URL_DEFAULT[0] != '\0') {
        copy_str(s_ota_url, sizeof(s_ota_url), APP_OTA_URL_DEFAULT);
    }
#endif
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_OTA_NVS_NS, NVS_READONLY, &h);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "geen bewaarde OTA-URL%s",
                 s_ota_url[0] ? " (compile-time default)" : " (leeg)");
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS OTA-URL lezen mislukt: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    char url[APP_OTA_URL_MAX + 1] = "";
    size_t ulen = sizeof(url);
    const esp_err_t url_err = nvs_get_str(h, APP_OTA_NVS_URL, url, &ulen);
    nvs_close(h);
    if (url_err == ESP_OK && url[0] != '\0') {
        copy_str(s_ota_url, sizeof(s_ota_url), url);
        ESP_LOGI(TAG, "OTA-URL uit NVS (len=%u)", (unsigned)strlen(s_ota_url));
        return;
    }
    ESP_LOGI(TAG, "geen geldige OTA-URL in NVS%s",
             s_ota_url[0] ? " (compile-time default)" : " (leeg)");
}

static void save_ota_nvs()
{
    nvs_handle_t h = 0;
    esp_err_t err = nvs_open(APP_OTA_NVS_NS, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS '%s' openen: %s (0x%x)", APP_OTA_NVS_NS,
                 esp_err_to_name(err), err);
        return;
    }
    nvs_set_str(h, APP_OTA_NVS_URL, s_ota_url);
    err = nvs_commit(h);
    nvs_close(h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: NVS OTA-URL opslaan: %s (0x%x)",
                 esp_err_to_name(err), err);
        return;
    }
    ESP_LOGI(TAG, "OTA-URL bewaard (len=%u)", (unsigned)strlen(s_ota_url));
}

void settings_store_init()
{
    if (s_mutex == nullptr) {
        s_mutex = xSemaphoreCreateMutex();
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (!s_loaded) {
        load_nvs();
        load_pond_nvs();
        load_wifi_nvs();
        load_mqtt_nvs();
        load_token_nvs();
        load_ota_nvs();
        s_loaded = true;
    }
    xSemaphoreGive(s_mutex);
}

ScreenSettings settings_store_screen()
{
    if (s_mutex == nullptr) {
        return ScreenSettings{};
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const ScreenSettings copy = s_screen;
    xSemaphoreGive(s_mutex);
    return copy;
}

void settings_store_set_screen(const ScreenSettings& in)
{
    const ScreenSettings clamped = clamp_screen(in);
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
        s_screen = clamped;
        xSemaphoreGive(s_mutex);
    } else {
        s_screen = clamped;
    }
    save_nvs(clamped);
}

uint32_t settings_store_pond_volume_l()
{
    if (s_mutex == nullptr) {
        return APP_POND_VOLUME_L;
    }
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    const uint32_t copy = s_pond_l;
    xSemaphoreGive(s_mutex);
    return copy;
}

void settings_store_set_pond_volume_l(uint32_t liters)
{
    const uint32_t clamped = clamp_pond(liters);
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
        s_pond_l = clamped;
        xSemaphoreGive(s_mutex);
    } else {
        s_pond_l = clamped;
    }
    save_pond_nvs(clamped);
}

bool settings_store_wifi_get(char* ssid, size_t ssid_len, char* pass, size_t pass_len)
{
    bool ok = false;
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    if (ssid != nullptr && ssid_len > 0) {
        copy_str(ssid, ssid_len, s_wifi_ssid);
    }
    if (pass != nullptr && pass_len > 0) {
        copy_str(pass, pass_len, s_wifi_pass);
    }
    ok = s_wifi_from_nvs && s_wifi_ssid[0] != '\0';
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
    return ok;
}

void settings_store_set_wifi(const char* ssid, const char* pass)
{
    if (ssid == nullptr || ssid[0] == '\0') {
        ESP_LOGW(TAG, "wifi opslaan geweigerd: lege SSID");
        return;
    }
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    copy_str(s_wifi_ssid, sizeof(s_wifi_ssid), ssid);
    copy_str(s_wifi_pass, sizeof(s_wifi_pass), pass);
    s_wifi_from_nvs = true;
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
    save_wifi_nvs(s_wifi_ssid, s_wifi_pass);
}

MqttRuntimeSettings settings_store_mqtt()
{
    MqttRuntimeSettings out{};
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    copy_str(out.host, sizeof(out.host), s_mqtt_host[0] ? s_mqtt_host : MQTT_BROKER_HOST);
    out.port = s_mqtt_port != 0 ? s_mqtt_port : MQTT_BROKER_PORT;
    copy_str(out.user, sizeof(out.user), s_mqtt_user);
    copy_str(out.pass, sizeof(out.pass), s_mqtt_pass);
    out.from_nvs = s_mqtt_from_nvs;
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
    return out;
}

void settings_store_set_mqtt(const char* host, uint16_t port, const char* user, const char* pass)
{
    if (host == nullptr || host[0] == '\0') {
        ESP_LOGW(TAG, "MQTT opslaan geweigerd: lege host");
        return;
    }
    const uint16_t use_port = clamp_mqtt_port(port);
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    copy_str(s_mqtt_host, sizeof(s_mqtt_host), host);
    s_mqtt_port = use_port;
    copy_str(s_mqtt_user, sizeof(s_mqtt_user), user);
    if (pass != nullptr && pass[0] != '\0') {
        copy_str(s_mqtt_pass, sizeof(s_mqtt_pass), pass);
    }
    s_mqtt_from_nvs = true;
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
    save_mqtt_nvs();
}

bool settings_store_token_ok()
{
    bool ok = false;
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    ok = token_is_set(s_token);
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
    return ok;
}

bool settings_store_token_from_nvs()
{
    bool from_nvs = false;
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    from_nvs = s_token_from_nvs;
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
    return from_nvs;
}

void settings_store_token_copy(char* out, size_t out_len)
{
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    copy_str(out, out_len, s_token);
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
}

void settings_store_token_mask(char* out, size_t out_len)
{
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    format_token_mask(s_token, out, out_len);
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
}

void settings_store_set_token(const char* token)
{
    if (token == nullptr || token[0] == '\0') {
        ESP_LOGI(TAG, "device-token ongewijzigd (leeg toepassen)");
        return;
    }
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    copy_str(s_token, sizeof(s_token), token);
    s_token_from_nvs = true;
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
    save_token_nvs();
}

void settings_store_ota_url_copy(char* out, size_t out_len)
{
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    copy_str(out, out_len, s_ota_url);
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
}

void settings_store_set_ota_url(const char* url)
{
    if (url == nullptr || url[0] == '\0') {
        ESP_LOGI(TAG, "OTA-URL ongewijzigd (leeg toepassen)");
        return;
    }
    if (s_mutex != nullptr) {
        xSemaphoreTake(s_mutex, portMAX_DELAY);
    }
    copy_str(s_ota_url, sizeof(s_ota_url), url);
    if (s_mutex != nullptr) {
        xSemaphoreGive(s_mutex);
    }
    save_ota_nvs();
}
