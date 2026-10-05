// KOIoT Paneel - Instellingen: Scherm (M1.7), Info/vijver/herstart (M3b),
// wifi-scan + wachtwoord zonder keyboard (M3c), MQTT runtime (M3d),
// device-token (M3e), Firmware/OTA (M3f).
#include "ui/screen_settings.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "lvgl.h"

#include "app_config.h"
#include "core/app_state.h"
#include "core/net_manager.h"
#include "core/screen_manager.h"
#include "core/settings_store.h"
#include "data/measurement_queue.h"
#include "data/status_store.h"
#include "io/backend_client.h"
#include "io/mqtt_link.h"
#include "io/ota_client.h"
#include "ui/ascii_text.h"
#include "ui/ui_chrome.h"

static const char* TAG = "screen_set";

static const lv_color_t COL_BG     = lv_color_hex(0x0E1216);
static const lv_color_t COL_TEXT   = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED  = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_BLUE   = lv_color_hex(0x3498DB);
static const lv_color_t COL_BTN    = lv_color_hex(0x2A3540);
static const lv_color_t COL_BTN_ON = lv_color_hex(0x1E8449);
static const lv_color_t COL_DIM    = lv_color_hex(0x000000);
static const lv_color_t COL_CARD   = lv_color_hex(0x1B2229);
static const lv_color_t COL_BORDER = lv_color_hex(0x2E3A45);
static const lv_color_t COL_RED    = lv_color_hex(0xC0392B);

static lv_obj_t* s_scr = nullptr;
static UiStatusBar s_status;
static UiNav s_nav;
static lv_obj_t* s_btn_ba = nullptr;
static lv_obj_t* s_btn_bi = nullptr;
static lv_obj_t* s_btn_t1 = nullptr;
static lv_obj_t* s_btn_t2 = nullptr;
static lv_obj_t* s_btn_idle = nullptr;
static lv_obj_t* s_btn_mock = nullptr;
static lv_obj_t* s_btn_pond = nullptr;
static lv_obj_t* s_info_panel = nullptr;
static lv_obj_t* s_info_fw = nullptr;
static lv_obj_t* s_info_ip = nullptr;
static lv_obj_t* s_info_rssi = nullptr;
static lv_obj_t* s_info_up = nullptr;
static lv_obj_t* s_info_heap = nullptr;
static lv_obj_t* s_info_psram = nullptr;
static lv_obj_t* s_confirm = nullptr;
static lv_obj_t* s_wifi_cur = nullptr;
static lv_obj_t* s_btn_ap = nullptr;
static lv_obj_t* s_wifi_pass_row = nullptr;
static lv_obj_t* s_wifi_msg = nullptr;
static lv_obj_t* s_pass = nullptr;
static lv_obj_t* s_pass_net = nullptr;
static lv_obj_t* s_pass_value = nullptr;
static lv_obj_t* s_pass_title = nullptr;
static lv_obj_t* s_pass_grp = nullptr;
static lv_obj_t* s_pass_ch = nullptr;
static lv_obj_t* s_mqtt_status = nullptr;
static lv_obj_t* s_mqtt_host_val = nullptr;
static lv_obj_t* s_mqtt_port_val = nullptr;
static lv_obj_t* s_mqtt_user_val = nullptr;
static lv_obj_t* s_mqtt_pass_row = nullptr;
static lv_obj_t* s_mqtt_msg = nullptr;
static lv_obj_t* s_token_val = nullptr;
static lv_obj_t* s_token_msg = nullptr;
static lv_obj_t* s_ota_ver = nullptr;
static lv_obj_t* s_ota_part = nullptr;
static lv_obj_t* s_ota_url_val = nullptr;
static lv_obj_t* s_ota_msg = nullptr;
static lv_obj_t* s_confirm_title = nullptr;
static lv_obj_t* s_confirm_hint = nullptr;
static lv_timer_t* s_step_timer = nullptr;

static WifiScanSnapshot s_scan{};
static int s_ap_idx = 0;
static char s_sel_ssid[APP_WIFI_SSID_MAX + 1] = "";
static bool s_sel_open = false;
static char s_pass_edit[APP_WIFI_PASS_MAX + 1] = "";
static bool s_pass_dirty = false;
static int s_pw_grp = 0;
static int s_pw_ch = 0;
static WifiStatus s_last_wifi = WifiStatus::Idle;
static bool s_join_requested = false;

enum class EditKind : uint8_t {
    WifiPass = 0,
    MqttHost,
    MqttPort,
    MqttUser,
    MqttPass,
    DeviceToken,
    OtaUrl,
};

static EditKind s_edit_kind = EditKind::WifiPass;
static char s_edit_buf[APP_OTA_URL_MAX + 1] = "";
static char s_mqtt_host[APP_MQTT_HOST_MAX + 1] = "";
static uint16_t s_mqtt_port = MQTT_BROKER_PORT;
static char s_mqtt_user[APP_MQTT_USER_MAX + 1] = "";
static char s_mqtt_pass_edit[APP_MQTT_PASS_MAX + 1] = "";
static bool s_mqtt_pass_dirty = false;
static bool s_mqtt_apply_requested = false;
static MqttStatus s_last_mqtt = MqttStatus::Idle;
static char s_token_edit[APP_TOKEN_MAX + 1] = "";
static bool s_token_dirty = false;
static bool s_token_apply_requested = false;
static bool s_token_saw_fetching = false;
static char s_ota_url_edit[APP_OTA_URL_MAX + 1] = "";
static bool s_ota_url_dirty = false;
static bool s_ota_confirm_shown = false;
static OtaState s_last_ota = OtaState::Idle;

enum class ConfirmKind : uint8_t {
    Restart = 0,
    OtaDone,
};

static ConfirmKind s_confirm_kind = ConfirmKind::Restart;

enum class Step : uint8_t {
    None = 0,
    ShowConfirm,
    HideConfirm,
    Restart,
    ShowPass,
    HidePass,
    HideOverlays,
};

static Step s_step = Step::None;

static const uint8_t k_br_act[] = {40, 60, 80, 100};
static const uint8_t k_br_idle[] = {5, 10, 15, 25};
static const uint32_t k_t1[] = {30, 60, 120, 300, 600};
static const uint32_t k_t2[] = {60, 300, 900, 1800, 0};
static const uint32_t k_pond[] = {8000, 10000, 12000, 13500, 15000, 18000, 20000, 25000};
static const int k_step_timer_ms = 80;
static const char* k_pw_grp[] = {
    "abcdefghijklmnopqrstuvwxyz ",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "0123456789",
    "!@#$%^&*()-_=+.,;:?/",
};
static const char* k_pw_grp_name[] = { "abc", "ABC", "123", "tekens" };
static const int k_pw_grp_n = 4;

static void format_t(uint32_t s, char* out, size_t out_len)
{
    if (s == 0) {
        snprintf(out, out_len, "nooit");
        return;
    }
    if (s < 60) {
        snprintf(out, out_len, "%u s", (unsigned)s);
        return;
    }
    snprintf(out, out_len, "%u min", (unsigned)(s / 60));
}

static void format_liters(uint32_t l, char* out, size_t out_len)
{
    if (l >= 1000) {
        snprintf(out, out_len, "%u.%03u L", (unsigned)(l / 1000), (unsigned)(l % 1000));
        return;
    }
    snprintf(out, out_len, "%u L", (unsigned)l);
}

static int index_of_u8(const uint8_t* arr, int n, uint8_t v)
{
    for (int i = 0; i < n; i++) {
        if (arr[i] == v) {
            return i;
        }
    }
    return 0;
}

static int index_of_u32(const uint32_t* arr, int n, uint32_t v)
{
    for (int i = 0; i < n; i++) {
        if (arr[i] == v) {
            return i;
        }
    }
    return 0;
}

static void request_step(Step step)
{
    s_step = step;
    if (s_step_timer == nullptr) {
        return;
    }
    lv_timer_reset(s_step_timer);
    lv_timer_resume(s_step_timer);
}

static void set_overlay_hidden(lv_obj_t* ov, bool hide)
{
    if (ov == nullptr || !lv_obj_is_valid(ov)) {
        return;
    }
    if (hide) {
        lv_obj_add_flag(ov, LV_OBJ_FLAG_HIDDEN);
        lv_obj_remove_flag(ov, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_remove_flag(ov, LV_OBJ_FLAG_FLOATING);
    } else {
        lv_obj_remove_flag(ov, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(ov, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_move_foreground(ov);
    }
}

static void set_confirm_hidden(bool hide)
{
    set_overlay_hidden(s_confirm, hide);
}

static void set_pass_hidden(bool hide)
{
    set_overlay_hidden(s_pass, hide);
}

static void mask_secret(char* out, size_t out_len, const char* secret)
{
    if (out == nullptr || out_len == 0) {
        return;
    }
    if (secret == nullptr || secret[0] == '\0') {
        snprintf(out, out_len, "(leeg)");
        return;
    }
    const size_t n = strlen(secret);
    if (out_len < 4) {
        out[0] = '\0';
        return;
    }
    size_t o = 0;
    for (size_t i = 0; i + 1 < n && o + 2 < out_len; i++) {
        out[o++] = '*';
    }
    out[o++] = secret[n - 1];
    out[o] = '\0';
}

static void current_saved_ssid(char* out, size_t out_len)
{
    char pass[APP_WIFI_PASS_MAX + 1] = "";
    if (settings_store_wifi_get(out, out_len, pass, sizeof(pass))) {
        return;
    }
    net_manager_current_ssid(out, out_len);
}

static const WifiScanAp* selected_ap()
{
    if (s_scan.count <= 0 || s_ap_idx < 0 || s_ap_idx >= s_scan.count) {
        return nullptr;
    }
    return &s_scan.aps[s_ap_idx];
}

static void apply_selected_from_scan()
{
    const WifiScanAp* ap = selected_ap();
    if (ap == nullptr) {
        current_saved_ssid(s_sel_ssid, sizeof(s_sel_ssid));
        s_sel_open = false;
        return;
    }
    strncpy(s_sel_ssid, ap->ssid, sizeof(s_sel_ssid) - 1);
    s_sel_ssid[sizeof(s_sel_ssid) - 1] = '\0';
    s_sel_open = ap->open;
}

static char* edit_buf()
{
    return (s_edit_kind == EditKind::WifiPass) ? s_pass_edit : s_edit_buf;
}

static size_t edit_max()
{
    switch (s_edit_kind) {
        case EditKind::WifiPass: return APP_WIFI_PASS_MAX;
        case EditKind::MqttHost: return APP_MQTT_HOST_MAX;
        case EditKind::MqttPort: return 5;
        case EditKind::MqttUser: return APP_MQTT_USER_MAX;
        case EditKind::MqttPass: return APP_MQTT_PASS_MAX;
        case EditKind::DeviceToken: return APP_TOKEN_MAX;
        case EditKind::OtaUrl: return APP_OTA_URL_MAX;
        default: return APP_WIFI_PASS_MAX;
    }
}

static bool edit_secret()
{
    return s_edit_kind == EditKind::WifiPass ||
           s_edit_kind == EditKind::MqttPass ||
           s_edit_kind == EditKind::DeviceToken;
}

static void load_mqtt_draft()
{
    const MqttRuntimeSettings m = settings_store_mqtt();
    strncpy(s_mqtt_host, m.host, sizeof(s_mqtt_host) - 1);
    s_mqtt_host[sizeof(s_mqtt_host) - 1] = '\0';
    s_mqtt_port = m.port != 0 ? m.port : MQTT_BROKER_PORT;
    strncpy(s_mqtt_user, m.user, sizeof(s_mqtt_user) - 1);
    s_mqtt_user[sizeof(s_mqtt_user) - 1] = '\0';
}

static const char* mqtt_status_text(MqttStatus st, const char* err)
{
    switch (st) {
        case MqttStatus::Connected:    return "verbonden";
        case MqttStatus::Connecting:   return "verbinden...";
        case MqttStatus::Disconnected: return "niet verbonden";
        case MqttStatus::Error:        return (err != nullptr && err[0]) ? err : "fout";
        case MqttStatus::Idle:
        default:                       return "wacht op wifi";
    }
}

static void refresh_token_labels()
{
    if (s_token_val != nullptr) {
        if (s_token_dirty) {
            lv_label_set_text_fmt(s_token_val, "%u tekens",
                                  (unsigned)strlen(s_token_edit));
        } else {
            char mask[24] = "";
            settings_store_token_mask(mask, sizeof(mask));
            lv_label_set_text(s_token_val, mask);
        }
    }
}

static void format_url_short(char* out, size_t out_len, const char* url)
{
    if (out == nullptr || out_len == 0) {
        return;
    }
    if (url == nullptr || url[0] == '\0') {
        snprintf(out, out_len, "(leeg)");
        return;
    }
    const size_t n = strlen(url);
    if (n + 1 <= out_len) {
        snprintf(out, out_len, "%s", url);
        return;
    }
    if (out_len < 8) {
        snprintf(out, out_len, "...");
        return;
    }
    snprintf(out, out_len, "%.*s...", (int)(out_len - 4), url);
}

static void refresh_ota_labels()
{
    if (s_ota_ver != nullptr) {
        lv_label_set_text(s_ota_ver, APP_FW_VERSION);
    }
    if (s_ota_part != nullptr) {
        char part[12] = "";
        ota_client_running_partition_name(part, sizeof(part));
        lv_label_set_text(s_ota_part, part[0] ? part : "--");
    }
    if (s_ota_url_val != nullptr) {
        char shown[48] = "";
        if (s_ota_url_dirty) {
            format_url_short(shown, sizeof(shown), s_ota_url_edit);
        } else {
            char url[APP_OTA_URL_MAX + 1] = "";
            settings_store_ota_url_copy(url, sizeof(url));
            format_url_short(shown, sizeof(shown), url);
        }
        lv_label_set_text(s_ota_url_val, shown);
    }
}

static void refresh_mqtt_labels()
{
    if (s_mqtt_host_val != nullptr) {
        lv_label_set_text(s_mqtt_host_val, s_mqtt_host[0] ? s_mqtt_host : "--");
    }
    if (s_mqtt_port_val != nullptr) {
        lv_label_set_text_fmt(s_mqtt_port_val, "%u", (unsigned)s_mqtt_port);
    }
    if (s_mqtt_user_val != nullptr) {
        lv_label_set_text(s_mqtt_user_val, s_mqtt_user[0] ? s_mqtt_user : "(leeg)");
    }
    if (s_mqtt_pass_row != nullptr) {
        if (s_mqtt_pass_dirty) {
            lv_label_set_text_fmt(s_mqtt_pass_row, "%u tekens",
                                  (unsigned)strlen(s_mqtt_pass_edit));
        } else {
            lv_label_set_text(s_mqtt_pass_row, "ongewijzigd");
        }
    }
}

static void refresh_pass_overlay()
{
    const char* raw = edit_buf();
    char shown[APP_OTA_URL_MAX + 8] = "";
    if (edit_secret()) {
        mask_secret(shown, sizeof(shown), raw);
    } else {
        strncpy(shown, raw && raw[0] ? raw : "(leeg)", sizeof(shown) - 1);
        shown[sizeof(shown) - 1] = '\0';
    }
    if (s_pass_title != nullptr) {
        switch (s_edit_kind) {
            case EditKind::MqttHost: lv_label_set_text(s_pass_title, "MQTT-host"); break;
            case EditKind::MqttPort: lv_label_set_text(s_pass_title, "MQTT-poort"); break;
            case EditKind::MqttUser: lv_label_set_text(s_pass_title, "MQTT-gebruiker"); break;
            case EditKind::MqttPass: lv_label_set_text(s_pass_title, "MQTT-wachtwoord"); break;
            case EditKind::DeviceToken: lv_label_set_text(s_pass_title, "Device-token"); break;
            case EditKind::OtaUrl: lv_label_set_text(s_pass_title, "OTA-URL"); break;
            case EditKind::WifiPass:
            default:                 lv_label_set_text(s_pass_title, "Wifi-wachtwoord"); break;
        }
    }
    if (s_pass_net != nullptr) {
        switch (s_edit_kind) {
            case EditKind::MqttHost:
                lv_label_set_text(s_pass_net, "Host van de broker (IP of naam)");
                break;
            case EditKind::MqttPort:
                lv_label_set_text(s_pass_net, "Poort 1-65535 (meestal 1883)");
                break;
            case EditKind::MqttUser:
                lv_label_set_text(s_pass_net, "Gebruikersnaam (mag leeg)");
                break;
            case EditKind::MqttPass:
                lv_label_set_text(s_pass_net, "Leeg laten = huidig wachtwoord houden");
                break;
            case EditKind::DeviceToken:
                lv_label_set_text(s_pass_net, "Leeg laten = huidig token houden");
                break;
            case EditKind::OtaUrl:
                lv_label_set_text(s_pass_net, "HTTPS .bin. Leeg of alleen https:// = vorige URL houden");
                break;
            case EditKind::WifiPass:
            default:
                lv_label_set_text_fmt(s_pass_net, "Netwerk: %s",
                                      s_sel_ssid[0] ? s_sel_ssid : "--");
                break;
        }
    }
    if (s_pass_value != nullptr) {
        lv_label_set_text(s_pass_value, shown);
    }
    if (s_pass_grp != nullptr) {
        lv_label_set_text(s_pass_grp, k_pw_grp_name[s_pw_grp]);
    }
    if (s_pass_ch != nullptr) {
        const char* grp = k_pw_grp[s_pw_grp];
        const int n = static_cast<int>(strlen(grp));
        if (n <= 0) {
            lv_label_set_text(s_pass_ch, "-");
        } else {
            if (s_pw_ch >= n) {
                s_pw_ch = 0;
            }
            const char ch = grp[s_pw_ch];
            if (ch == ' ') {
                lv_label_set_text(s_pass_ch, "spatie");
            } else {
                char buf[4] = {ch, 0, 0, 0};
                lv_label_set_text(s_pass_ch, buf);
            }
        }
    }
}

static void refresh_wifi_labels()
{
    char saved[APP_WIFI_SSID_MAX + 1] = "";
    current_saved_ssid(saved, sizeof(saved));
    if (s_sel_ssid[0] == '\0') {
        strncpy(s_sel_ssid, saved, sizeof(s_sel_ssid) - 1);
    }

    if (s_wifi_cur != nullptr) {
        lv_label_set_text(s_wifi_cur, saved[0] ? saved : "--");
    }

    if (s_btn_ap != nullptr) {
        const WifiScanAp* ap = selected_ap();
        if (ap != nullptr) {
            char line[80];
            snprintf(line, sizeof(line), "%s  %d dBm%s",
                     ap->ssid, (int)ap->rssi, ap->open ? "  open" : "");
            char ascii[80];
            ascii_from_utf8(ascii, sizeof(ascii), line);
            lv_label_set_text(s_btn_ap, ascii);
        } else if (s_sel_ssid[0] != '\0') {
            lv_label_set_text(s_btn_ap, s_sel_ssid);
        } else {
            lv_label_set_text(s_btn_ap, "tik Zoeken");
        }
    }

    if (s_wifi_pass_row != nullptr) {
        if (s_sel_open) {
            lv_label_set_text(s_wifi_pass_row, "(open)");
        } else if (s_pass_dirty) {
            lv_label_set_text_fmt(s_wifi_pass_row, "%u tekens",
                                  (unsigned)strlen(s_pass_edit));
        } else {
            char saved_ssid[APP_WIFI_SSID_MAX + 1] = "";
            current_saved_ssid(saved_ssid, sizeof(saved_ssid));
            if (s_sel_ssid[0] != '\0' && strcmp(s_sel_ssid, saved_ssid) == 0) {
                lv_label_set_text(s_wifi_pass_row, "ongewijzigd");
            } else {
                lv_label_set_text(s_wifi_pass_row, "niet gezet");
            }
        }
    }
}

static void refresh_labels()
{
    const ScreenSettings s = settings_store_screen();
    char t1[16];
    char t2[16];
    char pond[24];
    format_t(s.t1_s, t1, sizeof(t1));
    format_t(s.t2_s, t2, sizeof(t2));
    format_liters(settings_store_pond_volume_l(), pond, sizeof(pond));
    if (s_btn_ba != nullptr) {
        lv_label_set_text_fmt(s_btn_ba, "%u %%", (unsigned)s.brightness_active);
    }
    if (s_btn_bi != nullptr) {
        lv_label_set_text_fmt(s_btn_bi, "%u %%", (unsigned)s.brightness_idle);
    }
    if (s_btn_t1 != nullptr) {
        lv_label_set_text(s_btn_t1, t1);
    }
    if (s_btn_t2 != nullptr) {
        lv_label_set_text(s_btn_t2, t2);
    }
    if (s_btn_idle != nullptr) {
        lv_label_set_text(s_btn_idle, s.idle_screen_enabled ? "Aan" : "Uit");
    }
    if (s_btn_mock != nullptr) {
        lv_label_set_text(s_btn_mock, measurement_queue_mock() ? "Aan" : "Uit");
    }
    if (s_btn_pond != nullptr) {
        lv_label_set_text(s_btn_pond, pond);
    }
    refresh_wifi_labels();
    refresh_mqtt_labels();
    refresh_token_labels();
    refresh_ota_labels();
}

static void apply(const ScreenSettings& next)
{
    settings_store_set_screen(next);
    screen_manager_apply_brightness();
    refresh_labels();
}

static void on_cycle_ba(lv_event_t*)
{
    ScreenSettings s = settings_store_screen();
    const int i = index_of_u8(k_br_act, 4, s.brightness_active);
    s.brightness_active = k_br_act[(i + 1) % 4];
    ESP_LOGI(TAG, "helderheid actief -> %u%%", (unsigned)s.brightness_active);
    apply(s);
}

static void on_cycle_bi(lv_event_t*)
{
    ScreenSettings s = settings_store_screen();
    const int i = index_of_u8(k_br_idle, 4, s.brightness_idle);
    s.brightness_idle = k_br_idle[(i + 1) % 4];
    ESP_LOGI(TAG, "helderheid rust -> %u%%", (unsigned)s.brightness_idle);
    apply(s);
}

static void on_cycle_t1(lv_event_t*)
{
    ScreenSettings s = settings_store_screen();
    const int i = index_of_u32(k_t1, 5, s.t1_s);
    s.t1_s = k_t1[(i + 1) % 5];
    ESP_LOGI(TAG, "T1 -> %u s", (unsigned)s.t1_s);
    apply(s);
}

static void on_cycle_t2(lv_event_t*)
{
    ScreenSettings s = settings_store_screen();
    const int i = index_of_u32(k_t2, 5, s.t2_s);
    s.t2_s = k_t2[(i + 1) % 5];
    ESP_LOGI(TAG, "T2 -> %u s (0=nooit)", (unsigned)s.t2_s);
    apply(s);
}

static void on_cycle_idle(lv_event_t*)
{
    ScreenSettings s = settings_store_screen();
    s.idle_screen_enabled = !s.idle_screen_enabled;
    ESP_LOGI(TAG, "rustscherm -> %s", s.idle_screen_enabled ? "aan" : "uit");
    apply(s);
}

static void on_cycle_mock(lv_event_t*)
{
    const bool next = !measurement_queue_mock();
    measurement_queue_set_mock(next);
    ESP_LOGI(TAG, "backend MOCK -> %s", next ? "aan" : "uit");
    refresh_labels();
}

static void on_cycle_pond(lv_event_t*)
{
    const uint32_t cur = settings_store_pond_volume_l();
    const int i = index_of_u32(k_pond, 8, cur);
    const uint32_t next = k_pond[(i + 1) % 8];
    settings_store_set_pond_volume_l(next);
    ESP_LOGI(TAG, "vijverinhoud -> %u L", (unsigned)next);
    refresh_labels();
}

static void on_cycle_ap(lv_event_t*)
{
    if (s_scan.count <= 0) {
        ESP_LOGI(TAG, "wifi: geen scanlijst; tik eerst Zoeken");
        if (s_wifi_msg != nullptr) {
            lv_label_set_text(s_wifi_msg, "Eerst Zoeken voor een lijst.");
        }
        return;
    }
    s_ap_idx = (s_ap_idx + 1) % s_scan.count;
    apply_selected_from_scan();
    ESP_LOGI(TAG, "wifi: gekozen SSID '%s'%s",
             s_sel_ssid, s_sel_open ? " (open)" : "");
    refresh_wifi_labels();
}

static void on_scan(lv_event_t*)
{
    ESP_LOGI(TAG, "wifi: scan via timer/net_task");
    net_manager_request_scan();
    if (s_wifi_msg != nullptr) {
        lv_label_set_text(s_wifi_msg, "Zoeken...");
    }
}

static void on_join(lv_event_t*)
{
    if (s_sel_ssid[0] == '\0') {
        if (s_wifi_msg != nullptr) {
            lv_label_set_text(s_wifi_msg, "Kies eerst een netwerk.");
        }
        ESP_LOGW(TAG, "wifi verbinden geweigerd: geen SSID");
        return;
    }
    char saved[APP_WIFI_SSID_MAX + 1] = "";
    current_saved_ssid(saved, sizeof(saved));
    const bool same = (strcmp(s_sel_ssid, saved) == 0);
    const char* pass = "";
    if (s_sel_open) {
        pass = "";
    } else if (s_pass_dirty) {
        pass = s_pass_edit;
    } else if (same) {
        pass = "";
    } else {
        if (s_wifi_msg != nullptr) {
            lv_label_set_text(s_wifi_msg, "Zet eerst een wachtwoord (Wijzig).");
        }
        ESP_LOGW(TAG, "wifi verbinden geweigerd: wachtwoord ontbreekt voor '%s'",
                 s_sel_ssid);
        return;
    }
    ESP_LOGI(TAG, "wifi: verbinden met '%s' (wachtwoord %s)",
             s_sel_ssid,
             (pass[0] || same) ? (s_pass_dirty ? "nieuw" : "ongewijzigd") : "leeg");
    s_join_requested = true;
    net_manager_request_apply(s_sel_ssid, pass);
    if (s_wifi_msg != nullptr) {
        lv_label_set_text_fmt(s_wifi_msg, "Verbinden met %s...", s_sel_ssid);
    }
}

static void start_text_edit(EditKind kind)
{
    s_edit_kind = kind;
    s_pw_grp = 0;
    s_pw_ch = 0;
    s_edit_buf[0] = '\0';
    switch (kind) {
        case EditKind::MqttHost:
            strncpy(s_edit_buf, s_mqtt_host, sizeof(s_edit_buf) - 1);
            ESP_LOGI(TAG, "MQTT: host-overlay via timer");
            break;
        case EditKind::MqttPort:
            snprintf(s_edit_buf, sizeof(s_edit_buf), "%u", (unsigned)s_mqtt_port);
            s_pw_grp = 2;
            ESP_LOGI(TAG, "MQTT: poort-overlay via timer");
            break;
        case EditKind::MqttUser:
            strncpy(s_edit_buf, s_mqtt_user, sizeof(s_edit_buf) - 1);
            ESP_LOGI(TAG, "MQTT: gebruiker-overlay via timer");
            break;
        case EditKind::MqttPass:
            s_edit_buf[0] = '\0';
            ESP_LOGI(TAG, "MQTT: wachtwoord-overlay via timer");
            break;
        case EditKind::DeviceToken:
            s_edit_buf[0] = '\0';
            ESP_LOGI(TAG, "token: overlay via timer");
            break;
        case EditKind::OtaUrl:
            if (s_ota_url_edit[0] != '\0') {
                strncpy(s_edit_buf, s_ota_url_edit, sizeof(s_edit_buf) - 1);
            } else {
                char stored[APP_OTA_URL_MAX + 1] = "";
                settings_store_ota_url_copy(stored, sizeof(stored));
                if (stored[0] != '\0') {
                    strncpy(s_edit_buf, stored, sizeof(s_edit_buf) - 1);
                } else {
                    strncpy(s_edit_buf, "https://", sizeof(s_edit_buf) - 1);
                }
            }
            s_edit_buf[sizeof(s_edit_buf) - 1] = '\0';
            ESP_LOGI(TAG, "OTA: URL-overlay via timer");
            break;
        case EditKind::WifiPass:
        default:
            ESP_LOGI(TAG, "wifi: wachtwoord-overlay via timer");
            break;
    }
    request_step(Step::ShowPass);
}

static void on_pass_open(lv_event_t*)
{
    start_text_edit(EditKind::WifiPass);
}

static void on_mqtt_host(lv_event_t*)
{
    start_text_edit(EditKind::MqttHost);
}

static void on_mqtt_port(lv_event_t*)
{
    start_text_edit(EditKind::MqttPort);
}

static void on_mqtt_user(lv_event_t*)
{
    start_text_edit(EditKind::MqttUser);
}

static void on_mqtt_pass(lv_event_t*)
{
    start_text_edit(EditKind::MqttPass);
}

static void on_token_open(lv_event_t*)
{
    start_text_edit(EditKind::DeviceToken);
}

static void on_ota_url(lv_event_t*)
{
    start_text_edit(EditKind::OtaUrl);
}

static void on_ota_install(lv_event_t*)
{
    OtaSnapshot cur{};
    ota_client_snapshot(&cur);
    if (cur.state == OtaState::Success) {
        if (s_ota_msg != nullptr) {
            lv_label_set_text(s_ota_msg, "Al klaar; herstart om de nieuwe firmware te laden.");
        }
        ESP_LOGW(TAG, "OTA: install geweigerd (wacht op herstart)");
        return;
    }
    if (ota_client_is_busy()) {
        if (s_ota_msg != nullptr) {
            lv_label_set_text(s_ota_msg, "OTA is al bezig...");
        }
        ESP_LOGW(TAG, "OTA: install geweigerd (al bezig)");
        return;
    }
    if (s_ota_url_dirty) {
        const bool keep = (s_ota_url_edit[0] == '\0' ||
                           strcmp(s_ota_url_edit, "https://") == 0);
        settings_store_set_ota_url(keep ? "" : s_ota_url_edit);
        if (!keep) {
            s_ota_url_dirty = false;
        }
    }
    char url[APP_OTA_URL_MAX + 1] = "";
    settings_store_ota_url_copy(url, sizeof(url));
    if (url[0] == '\0') {
        if (s_ota_msg != nullptr) {
            lv_label_set_text(s_ota_msg, "Zet eerst een HTTPS-URL (Wijzig).");
        }
        ESP_LOGW(TAG, "OTA: geen URL");
        return;
    }
    ESP_LOGI(TAG, "OTA: Controleren/Installeren (url len=%u)", (unsigned)strlen(url));
    s_ota_confirm_shown = false;
    if (s_ota_msg != nullptr) {
        lv_label_set_text(s_ota_msg, "Starten...");
    }
    ota_client_request_install();
    refresh_ota_labels();
}

static void on_token_apply(lv_event_t*)
{
    const bool dirty = s_token_dirty;
    const char* token = dirty ? s_token_edit : "";
    ESP_LOGI(TAG, "token: toepassen (%s, %u tekens)",
             dirty ? "nieuw" : "ongewijzigd",
             (unsigned)(dirty ? strlen(s_token_edit) : 0));
    settings_store_set_token(token);
    s_token_dirty = false;
    s_token_edit[0] = '\0';
    s_token_apply_requested = true;
    s_token_saw_fetching = false;
    backend_client_request_fetch();
    refresh_token_labels();
    if (s_token_msg != nullptr) {
        lv_label_set_text(s_token_msg,
                          dirty ? "Token bewaard; ha-status ophalen..."
                                : "Huidig token gehouden; ha-status ophalen...");
    }
}

static void on_mqtt_apply(lv_event_t*)
{
    if (s_mqtt_host[0] == '\0') {
        if (s_mqtt_msg != nullptr) {
            lv_label_set_text(s_mqtt_msg, "Host mag niet leeg zijn.");
        }
        ESP_LOGW(TAG, "MQTT toepassen geweigerd: lege host");
        return;
    }
    if (s_mqtt_port == 0) {
        if (s_mqtt_msg != nullptr) {
            lv_label_set_text(s_mqtt_msg, "Ongeldige poort.");
        }
        ESP_LOGW(TAG, "MQTT toepassen geweigerd: poort 0");
        return;
    }
    const char* pass = s_mqtt_pass_dirty ? s_mqtt_pass_edit : "";
    ESP_LOGI(TAG, "MQTT: toepassen %s:%u user '%s' (wachtwoord %s)",
             s_mqtt_host, (unsigned)s_mqtt_port, s_mqtt_user,
             s_mqtt_pass_dirty ? "nieuw" : "ongewijzigd");
    s_mqtt_apply_requested = true;
    mqtt_link_request_apply(s_mqtt_host, s_mqtt_port, s_mqtt_user, pass);
    if (s_mqtt_msg != nullptr) {
        lv_label_set_text_fmt(s_mqtt_msg, "Opnieuw verbinden met %s:%u...",
                              s_mqtt_host, (unsigned)s_mqtt_port);
    }
}

static bool accept_mqtt_edit()
{
    switch (s_edit_kind) {
        case EditKind::MqttHost:
            if (s_edit_buf[0] == '\0') {
                ESP_LOGW(TAG, "MQTT: host geweigerd (leeg)");
                return false;
            }
            strncpy(s_mqtt_host, s_edit_buf, sizeof(s_mqtt_host) - 1);
            s_mqtt_host[sizeof(s_mqtt_host) - 1] = '\0';
            ESP_LOGI(TAG, "MQTT: host '%s'", s_mqtt_host);
            return true;
        case EditKind::MqttPort: {
            char* end = nullptr;
            const unsigned long p = strtoul(s_edit_buf, &end, 10);
            if (s_edit_buf[0] == '\0' || end == s_edit_buf || p < 1 || p > 65535) {
                ESP_LOGW(TAG, "MQTT: poort geweigerd ('%s')", s_edit_buf);
                return false;
            }
            s_mqtt_port = static_cast<uint16_t>(p);
            ESP_LOGI(TAG, "MQTT: poort %u", (unsigned)s_mqtt_port);
            return true;
        }
        case EditKind::MqttUser:
            strncpy(s_mqtt_user, s_edit_buf, sizeof(s_mqtt_user) - 1);
            s_mqtt_user[sizeof(s_mqtt_user) - 1] = '\0';
            ESP_LOGI(TAG, "MQTT: gebruiker '%s'", s_mqtt_user);
            return true;
        case EditKind::MqttPass:
            if (s_edit_buf[0] == '\0') {
                s_mqtt_pass_dirty = false;
                s_mqtt_pass_edit[0] = '\0';
                ESP_LOGI(TAG, "MQTT: wachtwoord ongewijzigd (leeg)");
                return true;
            }
            strncpy(s_mqtt_pass_edit, s_edit_buf, sizeof(s_mqtt_pass_edit) - 1);
            s_mqtt_pass_edit[sizeof(s_mqtt_pass_edit) - 1] = '\0';
            s_mqtt_pass_dirty = true;
            ESP_LOGI(TAG, "MQTT: wachtwoord gezet (%u tekens)",
                     (unsigned)strlen(s_mqtt_pass_edit));
            return true;
        case EditKind::DeviceToken:
            if (s_edit_buf[0] == '\0') {
                s_token_dirty = false;
                s_token_edit[0] = '\0';
                ESP_LOGI(TAG, "token: ongewijzigd (leeg)");
                return true;
            }
            strncpy(s_token_edit, s_edit_buf, sizeof(s_token_edit) - 1);
            s_token_edit[sizeof(s_token_edit) - 1] = '\0';
            s_token_dirty = true;
            ESP_LOGI(TAG, "token: gezet (%u tekens)",
                     (unsigned)strlen(s_token_edit));
            return true;
        case EditKind::OtaUrl:
            if (s_edit_buf[0] == '\0' || strcmp(s_edit_buf, "https://") == 0) {
                s_ota_url_dirty = false;
                s_ota_url_edit[0] = '\0';
                ESP_LOGI(TAG, "OTA: URL ongewijzigd (leeg)");
                return true;
            }
            strncpy(s_ota_url_edit, s_edit_buf, sizeof(s_ota_url_edit) - 1);
            s_ota_url_edit[sizeof(s_ota_url_edit) - 1] = '\0';
            s_ota_url_dirty = true;
            ESP_LOGI(TAG, "OTA: URL gezet (len=%u)",
                     (unsigned)strlen(s_ota_url_edit));
            return true;
        case EditKind::WifiPass:
        default:
            s_pass_dirty = true;
            ESP_LOGI(TAG, "wifi: wachtwoord gezet (%u tekens)",
                     (unsigned)strlen(s_pass_edit));
            return true;
    }
}

static void on_pass_ok(lv_event_t*)
{
    if (!accept_mqtt_edit()) {
        return;
    }
    request_step(Step::HidePass);
}

static void on_pass_cancel(lv_event_t*)
{
    ESP_LOGI(TAG, "wifi: wachtwoord Annuleren via timer");
    request_step(Step::HidePass);
}

static void on_pass_grp(lv_event_t*)
{
    s_pw_grp = (s_pw_grp + 1) % k_pw_grp_n;
    s_pw_ch = 0;
    refresh_pass_overlay();
}

static void on_pass_ch(lv_event_t*)
{
    const int n = static_cast<int>(strlen(k_pw_grp[s_pw_grp]));
    if (n > 0) {
        s_pw_ch = (s_pw_ch + 1) % n;
    }
    refresh_pass_overlay();
}

static void on_pass_add(lv_event_t*)
{
    const char* grp = k_pw_grp[s_pw_grp];
    const int n = static_cast<int>(strlen(grp));
    if (n <= 0) {
        return;
    }
    if (s_pw_ch >= n) {
        s_pw_ch = 0;
    }
    const char ch = grp[s_pw_ch];
    if (s_edit_kind == EditKind::MqttPort && (ch < '0' || ch > '9')) {
        return;
    }
    if (s_edit_kind == EditKind::MqttHost && ch == ' ') {
        return;
    }
    if (s_edit_kind == EditKind::OtaUrl && ch == ' ') {
        return;
    }
    char* buf = edit_buf();
    const size_t used = strlen(buf);
    if (used >= edit_max()) {
        ESP_LOGW(TAG, "invoer vol (%u)", (unsigned)used);
        return;
    }
    buf[used] = ch;
    buf[used + 1] = '\0';
    if (s_edit_kind == EditKind::WifiPass) {
        s_pass_dirty = true;
    }
    refresh_pass_overlay();
}

static void on_pass_del(lv_event_t*)
{
    char* buf = edit_buf();
    const size_t used = strlen(buf);
    if (used == 0) {
        return;
    }
    buf[used - 1] = '\0';
    if (s_edit_kind == EditKind::WifiPass) {
        s_pass_dirty = true;
    }
    refresh_pass_overlay();
}

static void apply_confirm_text()
{
    if (s_confirm_title != nullptr) {
        lv_label_set_text(s_confirm_title,
                          s_confirm_kind == ConfirmKind::OtaDone
                              ? "Firmware geinstalleerd?"
                              : "Paneel herstarten?");
    }
    if (s_confirm_hint != nullptr) {
        lv_label_set_text(s_confirm_hint,
                          s_confirm_kind == ConfirmKind::OtaDone
                              ? "Nieuwe image staat klaar. Herstarten laadt de nieuwe firmware."
                              : "Wifi, MQTT en de wachtrij starten daarna opnieuw.");
    }
}

static void on_restart(lv_event_t*)
{
    ESP_LOGI(TAG, "herstart: bevestiging via timer");
    s_confirm_kind = ConfirmKind::Restart;
    request_step(Step::ShowConfirm);
}

static void on_confirm_yes(lv_event_t*)
{
    ESP_LOGW(TAG, "herstart: Ja; esp_restart via timer");
    request_step(Step::Restart);
}

static void on_confirm_no(lv_event_t*)
{
    ESP_LOGI(TAG, "herstart: Annuleren via timer");
    request_step(Step::HideConfirm);
}

static void step_timer_cb(lv_timer_t* t)
{
    if (t != nullptr) {
        lv_timer_pause(t);
    }
    const Step step = s_step;
    s_step = Step::None;
    switch (step) {
        case Step::ShowConfirm:
            set_pass_hidden(true);
            apply_confirm_text();
            set_confirm_hidden(false);
            break;
        case Step::HideConfirm:
            set_confirm_hidden(true);
            break;
        case Step::ShowPass:
            set_confirm_hidden(true);
            refresh_pass_overlay();
            set_pass_hidden(false);
            break;
        case Step::HidePass:
            set_pass_hidden(true);
            refresh_wifi_labels();
            refresh_mqtt_labels();
            refresh_token_labels();
            refresh_ota_labels();
            break;
        case Step::HideOverlays:
            set_confirm_hidden(true);
            set_pass_hidden(true);
            refresh_wifi_labels();
            refresh_mqtt_labels();
            refresh_token_labels();
            refresh_ota_labels();
            break;
        case Step::Restart:
            set_confirm_hidden(true);
            set_pass_hidden(true);
            ESP_LOGW(TAG, "herstart nu");
            esp_restart();
            break;
        case Step::None:
        default:
            break;
    }
}

static lv_obj_t* make_cycle_btn(lv_obj_t* parent, int x, int y, int w, int h,
                                lv_event_cb_t cb, lv_obj_t** label_out)
{
    lv_obj_t* btn = lv_obj_create(parent);
    lv_obj_set_pos(btn, x, y);
    lv_obj_set_size(btn, w, h);
    lv_obj_set_style_bg_color(btn, COL_BTN, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(btn, 0, 0);
    lv_obj_set_style_radius(btn, 10, 0);
    lv_obj_set_style_pad_all(btn, 0, 0);
    lv_obj_set_style_bg_color(btn, COL_BTN_ON, LV_STATE_PRESSED);
    lv_obj_remove_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(btn, LV_OBJ_FLAG_SCROLL_CHAIN);
    lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, nullptr);

    lv_obj_t* lbl = lv_label_create(btn);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(lbl);
    *label_out = lbl;
    return btn;
}

static lv_obj_t* make_info_val(lv_obj_t* parent, int x, int y, int w)
{
    if (parent == nullptr || !lv_obj_is_valid(parent)) {
        return nullptr;
    }
    lv_obj_t* lbl = lv_label_create(parent);
    if (lbl == nullptr) {
        return nullptr;
    }
    lv_obj_set_pos(lbl, x, y);
    lv_obj_set_width(lbl, w);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
    lv_obj_set_style_text_align(lbl, LV_TEXT_ALIGN_RIGHT, 0);
    lv_label_set_long_mode(lbl, LV_LABEL_LONG_CLIP);
    lv_label_set_text(lbl, "--");
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    return lbl;
}

static void make_confirm(lv_obj_t* parent)
{
    s_confirm = lv_obj_create(parent);
    lv_obj_set_pos(s_confirm, 0, 0);
    lv_obj_set_size(s_confirm, 1024, 600);
    lv_obj_set_style_bg_color(s_confirm, COL_DIM, 0);
    lv_obj_set_style_bg_opa(s_confirm, LV_OPA_70, 0);
    lv_obj_set_style_border_width(s_confirm, 0, 0);
    lv_obj_set_style_pad_all(s_confirm, 0, 0);
    lv_obj_remove_flag(s_confirm, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_confirm, LV_OBJ_FLAG_FLOATING);
    lv_obj_add_flag(s_confirm, LV_OBJ_FLAG_IGNORE_LAYOUT);
    lv_obj_add_flag(s_confirm, LV_OBJ_FLAG_HIDDEN);
    lv_obj_remove_flag(s_confirm, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s_confirm, on_confirm_no, LV_EVENT_CLICKED, nullptr);

    lv_obj_t* box = lv_obj_create(s_confirm);
    lv_obj_set_size(box, 720, 280);
    lv_obj_center(box);
    lv_obj_set_style_bg_color(box, COL_CARD, 0);
    lv_obj_set_style_bg_opa(box, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(box, COL_BORDER, 0);
    lv_obj_set_style_border_width(box, 2, 0);
    lv_obj_set_style_radius(box, 12, 0);
    lv_obj_set_style_pad_all(box, 16, 0);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(box, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_EVENT_BUBBLE);

    s_confirm_title = lv_label_create(box);
    lv_obj_set_pos(s_confirm_title, 8, 8);
    lv_obj_set_style_text_font(s_confirm_title, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(s_confirm_title, COL_TEXT, 0);
    lv_label_set_text(s_confirm_title, "Paneel herstarten?");
    lv_obj_remove_flag(s_confirm_title, LV_OBJ_FLAG_CLICKABLE);

    s_confirm_hint = lv_label_create(box);
    lv_obj_set_pos(s_confirm_hint, 8, 52);
    lv_obj_set_width(s_confirm_hint, 680);
    lv_obj_set_style_text_font(s_confirm_hint, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_confirm_hint, COL_MUTED, 0);
    lv_label_set_long_mode(s_confirm_hint, LV_LABEL_LONG_CLIP);
    lv_label_set_text(s_confirm_hint, "Wifi, MQTT en de wachtrij starten daarna opnieuw.");
    lv_obj_remove_flag(s_confirm_hint, LV_OBJ_FLAG_CLICKABLE);

    lv_obj_t* yes = lv_obj_create(box);
    lv_obj_set_pos(yes, 8, 164);
    lv_obj_set_size(yes, 330, 80);
    lv_obj_set_style_bg_color(yes, COL_RED, 0);
    lv_obj_set_style_bg_opa(yes, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(yes, 0, 0);
    lv_obj_set_style_radius(yes, 10, 0);
    lv_obj_set_style_pad_all(yes, 0, 0);
    lv_obj_remove_flag(yes, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(yes, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(yes, on_confirm_yes, LV_EVENT_CLICKED, nullptr);
    lv_obj_t* yes_l = lv_label_create(yes);
    lv_label_set_text(yes_l, "Ja");
    lv_obj_set_style_text_font(yes_l, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(yes_l, COL_TEXT, 0);
    lv_obj_remove_flag(yes_l, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(yes_l);

    lv_obj_t* no = lv_obj_create(box);
    lv_obj_set_pos(no, 354, 164);
    lv_obj_set_size(no, 330, 80);
    lv_obj_set_style_bg_color(no, COL_BTN, 0);
    lv_obj_set_style_bg_opa(no, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(no, 0, 0);
    lv_obj_set_style_radius(no, 10, 0);
    lv_obj_set_style_pad_all(no, 0, 0);
    lv_obj_remove_flag(no, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(no, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(no, on_confirm_no, LV_EVENT_CLICKED, nullptr);
    lv_obj_t* no_l = lv_label_create(no);
    lv_label_set_text(no_l, "Annuleren");
    lv_obj_set_style_text_font(no_l, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(no_l, COL_TEXT, 0);
    lv_obj_remove_flag(no_l, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(no_l);
}

static lv_obj_t* make_action_btn(lv_obj_t* parent, int x, int y, int w, int h,
                                 lv_color_t bg, const char* title, lv_event_cb_t cb)
{
    lv_obj_t* btn = lv_obj_create(parent);
    if (btn == nullptr) {
        return nullptr;
    }
    lv_obj_set_pos(btn, x, y);
    lv_obj_set_size(btn, w, h);
    lv_obj_set_style_bg_color(btn, bg, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(btn, 0, 0);
    lv_obj_set_style_radius(btn, 10, 0);
    lv_obj_set_style_pad_all(btn, 0, 0);
    lv_obj_remove_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(btn, LV_OBJ_FLAG_SCROLL_CHAIN);
    if (cb != nullptr) {
        lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, nullptr);
    }
    lv_obj_t* lbl = lv_label_create(btn);
    if (lbl != nullptr) {
        lv_label_set_text(lbl, title);
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_24, 0);
        lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
        lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_center(lbl);
    }
    return btn;
}

static void make_pass_overlay(lv_obj_t* parent)
{
    s_pass = lv_obj_create(parent);
    if (s_pass == nullptr) {
        ESP_LOGE(TAG, "wachtwoord-overlay: create mislukt");
        return;
    }
    lv_obj_set_pos(s_pass, 0, 0);
    lv_obj_set_size(s_pass, 1024, 600);
    lv_obj_set_style_bg_color(s_pass, COL_DIM, 0);
    lv_obj_set_style_bg_opa(s_pass, LV_OPA_70, 0);
    lv_obj_set_style_border_width(s_pass, 0, 0);
    lv_obj_set_style_pad_all(s_pass, 0, 0);
    lv_obj_remove_flag(s_pass, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_pass, LV_OBJ_FLAG_FLOATING);
    lv_obj_add_flag(s_pass, LV_OBJ_FLAG_IGNORE_LAYOUT);
    lv_obj_add_flag(s_pass, LV_OBJ_FLAG_HIDDEN);
    lv_obj_remove_flag(s_pass, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s_pass, on_pass_cancel, LV_EVENT_CLICKED, nullptr);

    lv_obj_t* box = lv_obj_create(s_pass);
    if (box == nullptr) {
        return;
    }
    lv_obj_set_size(box, 880, 500);
    lv_obj_center(box);
    lv_obj_set_style_bg_color(box, COL_CARD, 0);
    lv_obj_set_style_bg_opa(box, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(box, COL_BORDER, 0);
    lv_obj_set_style_border_width(box, 2, 0);
    lv_obj_set_style_radius(box, 12, 0);
    lv_obj_set_style_pad_all(box, 16, 0);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(box, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_EVENT_BUBBLE);

    s_pass_title = lv_label_create(box);
    lv_obj_set_pos(s_pass_title, 8, 4);
    lv_obj_set_style_text_font(s_pass_title, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(s_pass_title, COL_TEXT, 0);
    lv_label_set_text(s_pass_title, "Wifi-wachtwoord");
    lv_obj_remove_flag(s_pass_title, LV_OBJ_FLAG_CLICKABLE);

    s_pass_net = lv_label_create(box);
    lv_obj_set_pos(s_pass_net, 8, 40);
    lv_obj_set_width(s_pass_net, 840);
    lv_obj_set_style_text_font(s_pass_net, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(s_pass_net, COL_MUTED, 0);
    lv_label_set_long_mode(s_pass_net, LV_LABEL_LONG_CLIP);
    lv_label_set_text(s_pass_net, "Netwerk: --");
    lv_obj_remove_flag(s_pass_net, LV_OBJ_FLAG_CLICKABLE);

    s_pass_value = lv_label_create(box);
    lv_obj_set_pos(s_pass_value, 8, 76);
    lv_obj_set_width(s_pass_value, 840);
    lv_obj_set_style_text_font(s_pass_value, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(s_pass_value, COL_TEXT, 0);
    lv_label_set_long_mode(s_pass_value, LV_LABEL_LONG_CLIP);
    lv_label_set_text(s_pass_value, "(leeg)");
    lv_obj_remove_flag(s_pass_value, LV_OBJ_FLAG_CLICKABLE);

    ui_make_label(box, 8, 124, &lv_font_montserrat_14, COL_MUTED,
                  "Geen toetsenbord (TWDT). Tik Groep/Teken, dan Toevoegen.");

    make_cycle_btn(box, 8, 160, 410, 72, on_pass_grp, &s_pass_grp);
    make_cycle_btn(box, 438, 160, 410, 72, on_pass_ch, &s_pass_ch);
    make_action_btn(box, 8, 248, 410, 72, COL_BTN, "Toevoegen", on_pass_add);
    make_action_btn(box, 438, 248, 410, 72, COL_BTN, "Wissen", on_pass_del);
    make_action_btn(box, 8, 336, 410, 80, COL_BTN_ON, "Klaar", on_pass_ok);
    make_action_btn(box, 438, 336, 410, 80, COL_BTN, "Annuleren", on_pass_cancel);
}

lv_obj_t* screen_settings_create()
{
    if (s_scr != nullptr) {
        return s_scr;
    }

    s_scr = lv_obj_create(nullptr);
    lv_obj_set_size(s_scr, 1024, 600);
    lv_obj_set_style_bg_color(s_scr, COL_BG, 0);
    lv_obj_set_style_bg_opa(s_scr, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(s_scr, 0, 0);
    lv_obj_set_style_pad_all(s_scr, 0, 0);
    lv_obj_remove_flag(s_scr, LV_OBJ_FLAG_SCROLLABLE);

    s_status = ui_status_bar_create(s_scr);

    const int scroll_h = APP_UI_SCREEN_H - APP_UI_STATUS_H - APP_UI_NAV_H;
    lv_obj_t* scroll = lv_obj_create(s_scr);
    lv_obj_set_pos(scroll, 0, APP_UI_STATUS_H);
    lv_obj_set_size(scroll, APP_UI_SCREEN_W, scroll_h);
    lv_obj_set_style_bg_color(scroll, COL_BG, 0);
    lv_obj_set_style_bg_opa(scroll, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(scroll, 0, 0);
    lv_obj_set_style_radius(scroll, 0, 0);
    lv_obj_set_style_pad_all(scroll, 0, 0);
    lv_obj_set_scroll_dir(scroll, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(scroll, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_add_flag(scroll, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(scroll, LV_OBJ_FLAG_CLICKABLE);

    lv_obj_t* card = ui_make_card(scroll, 12, 8, 1000, 8);
    lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(card, LV_OBJ_FLAG_SCROLL_CHAIN);
    lv_obj_remove_flag(card, LV_OBJ_FLAG_SCROLLABLE);

    const int row_h = 56;
    const int info_h = 36;
    const int btn_w = 180;
    const int btn_h = 52;
    const int btn_x = 1000 - 24 - btn_w - 16;
    const int val_x = 360;
    const int val_w = 600;
    int y = 4;

    ui_make_label(card, 8, y, &lv_font_montserrat_24, COL_BLUE, "Wifi");
    y += 36;
    ui_make_label(card, 8, y, &lv_font_montserrat_14, COL_MUTED,
                  "Zoeken, kies een netwerk, daarna Verbinden. Wachtwoord zonder toetsenbord.");
    y += 28;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_TEXT, "Huidig");
    s_wifi_cur = make_info_val(card, val_x, y + 6, val_w);
    y += 40;
    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Netwerk");
    make_cycle_btn(card, btn_x - 160, y, btn_w + 160, btn_h, on_cycle_ap, &s_btn_ap);
    y += row_h;
    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Wachtwoord");
    s_wifi_pass_row = make_info_val(card, 220, y + 18, 360);
    make_action_btn(card, btn_x, y, btn_w, btn_h, COL_BTN, "Wijzig", on_pass_open);
    y += row_h + 8;
    make_action_btn(card, 8, y, 470, 80, COL_BLUE, "Zoeken", on_scan);
    make_action_btn(card, 494, y, 470, 80, COL_BTN_ON, "Verbinden", on_join);
    y += 88;
    s_wifi_msg = lv_label_create(card);
    lv_obj_set_pos(s_wifi_msg, 8, y);
    lv_obj_set_width(s_wifi_msg, 960);
    lv_obj_set_style_text_font(s_wifi_msg, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_wifi_msg, COL_MUTED, 0);
    lv_label_set_long_mode(s_wifi_msg, LV_LABEL_LONG_CLIP);
    lv_label_set_text(s_wifi_msg, "NVS gaat voor secrets.h. Leeg wachtwoord = huidig houden.");
    lv_obj_remove_flag(s_wifi_msg, LV_OBJ_FLAG_CLICKABLE);
    y += 32;

    ui_make_label(card, 8, y, &lv_font_montserrat_24, COL_BLUE, "MQTT");
    y += 36;
    ui_make_label(card, 8, y, &lv_font_montserrat_14, COL_MUTED,
                  "Broker host, poort, gebruiker en wachtwoord. Zelfde invoer als wifi, geen toetsenbord.");
    y += 28;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_TEXT, "Status");
    s_mqtt_status = make_info_val(card, val_x, y + 6, val_w);
    y += 40;
    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Host");
    s_mqtt_host_val = make_info_val(card, 220, y + 18, 360);
    make_action_btn(card, btn_x, y, btn_w, btn_h, COL_BTN, "Wijzig", on_mqtt_host);
    y += row_h;
    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Poort");
    s_mqtt_port_val = make_info_val(card, 220, y + 18, 360);
    make_action_btn(card, btn_x, y, btn_w, btn_h, COL_BTN, "Wijzig", on_mqtt_port);
    y += row_h;
    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Gebruiker");
    s_mqtt_user_val = make_info_val(card, 220, y + 18, 360);
    make_action_btn(card, btn_x, y, btn_w, btn_h, COL_BTN, "Wijzig", on_mqtt_user);
    y += row_h;
    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Wachtwoord");
    s_mqtt_pass_row = make_info_val(card, 220, y + 18, 360);
    make_action_btn(card, btn_x, y, btn_w, btn_h, COL_BTN, "Wijzig", on_mqtt_pass);
    y += row_h + 8;
    make_action_btn(card, 8, y, 952, 80, COL_BTN_ON, "Toepassen", on_mqtt_apply);
    y += 88;
    s_mqtt_msg = lv_label_create(card);
    lv_obj_set_pos(s_mqtt_msg, 8, y);
    lv_obj_set_width(s_mqtt_msg, 960);
    lv_obj_set_style_text_font(s_mqtt_msg, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_mqtt_msg, COL_MUTED, 0);
    lv_label_set_long_mode(s_mqtt_msg, LV_LABEL_LONG_CLIP);
    lv_label_set_text(s_mqtt_msg, "NVS gaat voor secrets.h. Leeg wachtwoord = huidig houden.");
    lv_obj_remove_flag(s_mqtt_msg, LV_OBJ_FLAG_CLICKABLE);
    y += 32;

    ui_make_label(card, 8, y, &lv_font_montserrat_24, COL_BLUE, "Scherm");
    y += 36;
    ui_make_label(card, 8, y, &lv_font_montserrat_14, COL_MUTED,
                  "Tik op een waarde om te wisselen. Test: T1 = 30 s, T2 = 1 min.");
    y += 28;

    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Helderheid actief");
    make_cycle_btn(card, btn_x, y, btn_w, btn_h, on_cycle_ba, &s_btn_ba);
    y += row_h;

    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Helderheid rust");
    make_cycle_btn(card, btn_x, y, btn_w, btn_h, on_cycle_bi, &s_btn_bi);
    y += row_h;

    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Naar rust (T1)");
    make_cycle_btn(card, btn_x, y, btn_w, btn_h, on_cycle_t1, &s_btn_t1);
    y += row_h;

    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Naar uit (T2)");
    make_cycle_btn(card, btn_x, y, btn_w, btn_h, on_cycle_t2, &s_btn_t2);
    y += row_h;

    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Rustscherm");
    make_cycle_btn(card, btn_x, y, btn_w, btn_h, on_cycle_idle, &s_btn_idle);
    y += row_h + 8;

    ui_make_label(card, 8, y, &lv_font_montserrat_24, COL_BLUE, "Backend");
    y += 36;
    ui_make_label(card, 8, y, &lv_font_montserrat_14, COL_MUTED,
                  "MOCK voor uploads. Device-token (X-HA-Token) in NVS, zelfde invoer als wifi, geen toetsenbord.");
    y += 28;
    ui_make_label(card, 8, y + 12, &lv_font_montserrat_20, COL_TEXT, "MOCK-modus");
    make_cycle_btn(card, btn_x, y, btn_w, btn_h, on_cycle_mock, &s_btn_mock);
    y += row_h;
    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "Device-token");
    s_token_val = make_info_val(card, 220, y + 18, 360);
    make_action_btn(card, btn_x, y, btn_w, btn_h, COL_BTN, "Wijzig", on_token_open);
    y += row_h + 8;
    make_action_btn(card, 8, y, 952, 80, COL_BTN_ON, "Toepassen", on_token_apply);
    y += 88;
    s_token_msg = lv_label_create(card);
    lv_obj_set_pos(s_token_msg, 8, y);
    lv_obj_set_width(s_token_msg, 960);
    lv_obj_set_style_text_font(s_token_msg, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_token_msg, COL_MUTED, 0);
    lv_label_set_long_mode(s_token_msg, LV_LABEL_LONG_CLIP);
    lv_label_set_text(s_token_msg, "NVS gaat voor secrets.h. Leeg token = huidig houden.");
    lv_obj_remove_flag(s_token_msg, LV_OBJ_FLAG_CLICKABLE);
    y += 32;

    ui_make_label(card, 8, y, &lv_font_montserrat_24, COL_BLUE, "Firmware / OTA");
    y += 36;
    ui_make_label(card, 8, y, &lv_font_montserrat_14, COL_MUTED,
                  "HTTPS .bin. Download in achtergrondtaak. Crash voor bevestiging = rollback.");
    y += 28;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_TEXT, "Versie");
    s_ota_ver = make_info_val(card, val_x, y + 6, val_w);
    y += 40;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_TEXT, "Partitie");
    s_ota_part = make_info_val(card, val_x, y + 6, val_w);
    y += 40;
    ui_make_label(card, 8, y + 18, &lv_font_montserrat_20, COL_TEXT, "URL");
    s_ota_url_val = make_info_val(card, 220, y + 18, 360);
    make_action_btn(card, btn_x, y, btn_w, btn_h, COL_BTN, "Wijzig", on_ota_url);
    y += row_h + 8;
    make_action_btn(card, 8, y, 952, 80, COL_BTN_ON, "Controleren / Installeren",
                    on_ota_install);
    y += 88;
    s_ota_msg = lv_label_create(card);
    if (s_ota_msg != nullptr) {
        lv_obj_set_pos(s_ota_msg, 8, y);
        lv_obj_set_width(s_ota_msg, 960);
        lv_obj_set_style_text_font(s_ota_msg, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(s_ota_msg, COL_MUTED, 0);
        lv_label_set_long_mode(s_ota_msg, LV_LABEL_LONG_CLIP);
        lv_label_set_text(s_ota_msg, "Lege URL houdt de vorige. Alleen HTTPS; hosted/C6 wordt niet geupdate.");
        lv_obj_remove_flag(s_ota_msg, LV_OBJ_FLAG_CLICKABLE);
    }
    y += 32;

    ui_make_label(card, 8, y, &lv_font_montserrat_24, COL_BLUE, "Vijver");
    y += 36;
    ui_make_label(card, 8, y + 12, &lv_font_montserrat_20, COL_TEXT, "Inhoud");
    make_cycle_btn(card, btn_x, y, btn_w, btn_h, on_cycle_pond, &s_btn_pond);
    y += row_h + 8;

    ui_make_label(card, 8, y, &lv_font_montserrat_24, COL_BLUE, "Info");
    y += 36;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_MUTED, "Paneel");
    s_info_panel = make_info_val(card, val_x, y + 6, val_w);
    y += info_h;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_MUTED, "Firmware");
    s_info_fw = make_info_val(card, val_x, y + 6, val_w);
    y += info_h;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_MUTED, "IP");
    s_info_ip = make_info_val(card, val_x, y + 6, val_w);
    y += info_h;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_MUTED, "RSSI");
    s_info_rssi = make_info_val(card, val_x, y + 6, val_w);
    y += info_h;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_MUTED, "Uptime");
    s_info_up = make_info_val(card, val_x, y + 6, val_w);
    y += info_h;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_MUTED, "Vrij intern");
    s_info_heap = make_info_val(card, val_x, y + 6, val_w);
    y += info_h;
    ui_make_label(card, 8, y + 6, &lv_font_montserrat_20, COL_MUTED, "Vrij PSRAM");
    s_info_psram = make_info_val(card, val_x, y + 6, val_w);
    y += info_h + 12;

    ui_make_label(card, 8, y, &lv_font_montserrat_24, COL_BLUE, "Onderhoud");
    y += 40;
    lv_obj_t* restart = lv_obj_create(card);
    lv_obj_set_pos(restart, 8, y);
    lv_obj_set_size(restart, 1000 - 48, 80);
    lv_obj_set_style_bg_color(restart, COL_RED, 0);
    lv_obj_set_style_bg_opa(restart, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(restart, 0, 0);
    lv_obj_set_style_radius(restart, 10, 0);
    lv_obj_set_style_pad_all(restart, 0, 0);
    lv_obj_remove_flag(restart, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(restart, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(restart, LV_OBJ_FLAG_SCROLL_CHAIN);
    lv_obj_add_event_cb(restart, on_restart, LV_EVENT_CLICKED, nullptr);
    lv_obj_t* restart_l = lv_label_create(restart);
    lv_label_set_text(restart_l, "Herstarten");
    lv_obj_set_style_text_font(restart_l, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(restart_l, COL_TEXT, 0);
    lv_obj_remove_flag(restart_l, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(restart_l);

    const int body_h = y + 80 + 36;
    lv_obj_set_height(card, body_h);

    s_nav = ui_nav_create(s_scr, 4);
    make_confirm(s_scr);
    make_pass_overlay(s_scr);
    s_step_timer = lv_timer_create(step_timer_cb, k_step_timer_ms, nullptr);
    if (s_step_timer != nullptr) {
        lv_timer_pause(s_step_timer);
    }

    if (s_info_fw != nullptr) {
        lv_label_set_text(s_info_fw, APP_FW_VERSION);
    }
    load_mqtt_draft();
    settings_store_ota_url_copy(s_ota_url_edit, sizeof(s_ota_url_edit));
    refresh_labels();
    ESP_LOGI(TAG, "instellingen klaar (M3f: OTA, token, MQTT, wifi-scan, scroll %dx%d)",
             APP_UI_SCREEN_W, scroll_h);
    return s_scr;
}

static void refresh_info(const AppState& st)
{
    if (s_info_panel != nullptr) {
        lv_label_set_text(s_info_panel, st.panel_id[0] ? st.panel_id : "--");
    }
    if (s_info_ip != nullptr) {
        if (st.wifi == WifiStatus::Connected && st.ip[0] != '\0') {
            lv_label_set_text(s_info_ip, st.ip);
        } else {
            lv_label_set_text(s_info_ip, "--");
        }
    }
    if (s_info_rssi != nullptr) {
        if (st.wifi == WifiStatus::Connected) {
            lv_label_set_text_fmt(s_info_rssi, "%d dBm", (int)st.rssi);
        } else {
            lv_label_set_text(s_info_rssi, "--");
        }
    }
    if (s_info_up != nullptr) {
        const int64_t up_s = esp_timer_get_time() / 1000000;
        const int days = static_cast<int>(up_s / 86400);
        const int hh = static_cast<int>((up_s / 3600) % 24);
        const int mm = static_cast<int>((up_s / 60) % 60);
        const int ss = static_cast<int>(up_s % 60);
        if (days > 0) {
            lv_label_set_text_fmt(s_info_up, "%d d %d:%02d:%02d", days, hh, mm, ss);
        } else {
            lv_label_set_text_fmt(s_info_up, "%d:%02d:%02d", hh, mm, ss);
        }
    }
    if (s_info_heap != nullptr) {
        lv_label_set_text_fmt(s_info_heap, "%u KB",
                              (unsigned)(heap_caps_get_free_size(MALLOC_CAP_INTERNAL) / 1024));
    }
    if (s_info_psram != nullptr) {
        lv_label_set_text_fmt(s_info_psram, "%u KB",
                              (unsigned)(heap_caps_get_free_size(MALLOC_CAP_SPIRAM) / 1024));
    }
}

void screen_settings_update(const AppState& st, const StatusSnapshot& app)
{
    if (s_scr == nullptr) {
        return;
    }
    ui_status_bar_update(s_status, st, app);
    ui_nav_set_badge(s_nav, app.due_now_count);
    refresh_info(st);

    WifiScanSnapshot scan{};
    net_manager_scan_snapshot(&scan);
    const bool scan_changed =
        scan.state != s_scan.state || scan.count != s_scan.count;
    s_scan = scan;
    if (scan_changed && scan.state == WifiScanState::Done) {
        s_ap_idx = 0;
        for (int i = 0; i < scan.count; i++) {
            if (s_sel_ssid[0] != '\0' &&
                strncmp(scan.aps[i].ssid, s_sel_ssid, APP_WIFI_SSID_MAX) == 0) {
                s_ap_idx = i;
                break;
            }
        }
        apply_selected_from_scan();
        ESP_LOGI(TAG, "wifi-scan in UI: %d netwerk(en)", scan.count);
    }
    if (s_wifi_msg != nullptr) {
        if (st.wifi == WifiStatus::WaitPowerCycle) {
            lv_label_set_text(s_wifi_msg, "Wifi wacht op stroom-eraf (C6).");
        } else if (s_join_requested &&
                   (net_manager_apply_pending() || st.wifi == WifiStatus::Connecting)) {
            lv_label_set_text_fmt(s_wifi_msg, "Verbinden met %s...",
                                  s_sel_ssid[0] ? s_sel_ssid : "--");
        } else if (scan_changed && scan.message[0] != '\0') {
            lv_label_set_text(s_wifi_msg, scan.message);
        } else if (st.wifi == WifiStatus::Connected &&
                   s_last_wifi != WifiStatus::Connected && st.ssid[0] != '\0') {
            lv_label_set_text_fmt(s_wifi_msg, "Verbonden met %s", st.ssid);
            s_join_requested = false;
        } else if (s_join_requested && st.wifi == WifiStatus::Disconnected &&
                   s_last_wifi == WifiStatus::Connecting) {
            lv_label_set_text(s_wifi_msg, "Verbinden mislukt; controleer wachtwoord.");
            s_join_requested = false;
        }
    }
    s_last_wifi = st.wifi;
    refresh_wifi_labels();

    if (s_mqtt_status != nullptr) {
        lv_label_set_text(s_mqtt_status, mqtt_status_text(st.mqtt, st.mqtt_error));
    }
    if (s_mqtt_msg != nullptr) {
        if (s_mqtt_apply_requested &&
            (mqtt_link_apply_pending() || st.mqtt == MqttStatus::Connecting)) {
            lv_label_set_text_fmt(s_mqtt_msg, "Opnieuw verbinden met %s:%u...",
                                  s_mqtt_host[0] ? s_mqtt_host : "--",
                                  (unsigned)s_mqtt_port);
        } else if (s_mqtt_apply_requested && st.mqtt == MqttStatus::Connected &&
                   s_last_mqtt != MqttStatus::Connected) {
            lv_label_set_text_fmt(s_mqtt_msg, "Verbonden met %s:%u",
                                  s_mqtt_host, (unsigned)s_mqtt_port);
            s_mqtt_apply_requested = false;
        } else if (s_mqtt_apply_requested &&
                   (st.mqtt == MqttStatus::Error || st.mqtt == MqttStatus::Disconnected) &&
                   s_last_mqtt == MqttStatus::Connecting) {
            lv_label_set_text(s_mqtt_msg,
                              st.mqtt_error[0] ? st.mqtt_error
                                               : "Verbinden mislukt; controleer host/user/wachtwoord.");
            s_mqtt_apply_requested = false;
        }
    }
    s_last_mqtt = st.mqtt;
    refresh_mqtt_labels();

    if (s_token_msg != nullptr && s_token_apply_requested) {
        if (app.fetching || app.fetch == StatusFetchState::Fetching) {
            s_token_saw_fetching = true;
            lv_label_set_text(s_token_msg, "ha-status ophalen...");
        } else if (s_token_saw_fetching && app.fetch == StatusFetchState::Ok) {
            lv_label_set_text(s_token_msg, "ha-status OK (token geldig)");
            s_token_apply_requested = false;
        } else if (s_token_saw_fetching && app.fetch == StatusFetchState::TokenInvalid) {
            lv_label_set_text(s_token_msg, "Token ongeldig - controleer Instellingen");
            s_token_apply_requested = false;
        } else if (s_token_saw_fetching && app.fetch == StatusFetchState::Error) {
            lv_label_set_text(s_token_msg,
                              app.error_detail[0] ? app.error_detail
                                                  : "ha-status mislukt");
            s_token_apply_requested = false;
        }
    }
    refresh_token_labels();

    OtaSnapshot ota{};
    ota_client_snapshot(&ota);
    if (s_ota_msg != nullptr) {
        if (ota.state == OtaState::Starting || ota.state == OtaState::Downloading ||
            ota.state == OtaState::Verifying || ota.state == OtaState::Success ||
            ota.state == OtaState::Error) {
            if (ota.message[0] != '\0') {
                lv_label_set_text(s_ota_msg, ota.message);
            }
        }
    }
    if (ota.state == OtaState::Success && !s_ota_confirm_shown &&
        s_last_ota != OtaState::Success) {
        s_ota_confirm_shown = true;
        s_confirm_kind = ConfirmKind::OtaDone;
        ESP_LOGI(TAG, "OTA: klaar; bevestiging via timer");
        request_step(Step::ShowConfirm);
    }
    if (ota.state != OtaState::Success) {
        s_ota_confirm_shown = false;
    }
    s_last_ota = ota.state;
    refresh_ota_labels();
}

void screen_settings_set_nav_badge(int open_tasks)
{
    ui_nav_set_badge(s_nav, open_tasks);
}

void screen_settings_dismiss()
{
    request_step(Step::HideOverlays);
}
