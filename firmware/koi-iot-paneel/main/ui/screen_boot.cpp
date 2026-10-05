// KOIoT Paneel - M1a-diagnosescherm (implementatie).
//
// Donker thema, hoog contrast. Alleen ASCII-teksten (ingebouwde Montserrat heeft geen ë/é).
// Touch-test uit M0 is weggelaten: de diagnoselog heeft voorrang.
#include "ui/screen_boot.h"

#include <cstdio>
#include <cstring>
#include <ctime>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"

#include "app_config.h"
#include "core/app_state.h"
#include "data/diag_store.h"

static const char* TAG = "screen_diag";

static const lv_color_t COL_BG      = lv_color_hex(0x0E1216);
static const lv_color_t COL_CARD    = lv_color_hex(0x1B2229);
static const lv_color_t COL_BORDER  = lv_color_hex(0x2E3A45);
static const lv_color_t COL_TEXT    = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED   = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_GREEN   = lv_color_hex(0x2ECC71);
static const lv_color_t COL_ORANGE  = lv_color_hex(0xF39C12);
static const lv_color_t COL_RED     = lv_color_hex(0xE74C3C);
static const lv_color_t COL_BLUE    = lv_color_hex(0x3498DB);

static lv_obj_t* s_scr = nullptr;
static lv_obj_t* s_lbl_panel_id = nullptr;
static lv_obj_t* s_lbl_wifi_status = nullptr;
static lv_obj_t* s_lbl_ip = nullptr;
static lv_obj_t* s_lbl_rssi = nullptr;
static lv_obj_t* s_lbl_clock = nullptr;
static lv_obj_t* s_lbl_date = nullptr;
static lv_obj_t* s_lbl_mqtt_status = nullptr;
static lv_obj_t* s_lbl_mqtt_broker = nullptr;
static lv_obj_t* s_lbl_mqtt_filter = nullptr;
static lv_obj_t* s_lbl_mqtt_count = nullptr;
static lv_obj_t* s_lbl_wait = nullptr;
static lv_obj_t* s_log_rows[APP_DIAG_STORE_CAPACITY] = {};
static lv_obj_t* s_lbl_footer = nullptr;

static const char* WEEKDAYS_NL[7] = {"zo", "ma", "di", "wo", "do", "vr", "za"};
static const char* MONTHS_NL[12]  = {"jan", "feb", "mrt", "apr", "mei", "jun",
                                     "jul", "aug", "sep", "okt", "nov", "dec"};

static lv_obj_t* make_card(lv_obj_t* parent, int x, int y, int w, int h)
{
    lv_obj_t* card = lv_obj_create(parent);
    lv_obj_set_pos(card, x, y);
    lv_obj_set_size(card, w, h);
    lv_obj_set_style_bg_color(card, COL_CARD, 0);
    lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(card, COL_BORDER, 0);
    lv_obj_set_style_border_width(card, 2, 0);
    lv_obj_set_style_radius(card, 12, 0);
    lv_obj_set_style_pad_all(card, 12, 0);
    lv_obj_remove_flag(card, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(card, LV_OBJ_FLAG_CLICKABLE);
    return card;
}

static lv_obj_t* make_label(lv_obj_t* parent, int x, int y, const lv_font_t* font, lv_color_t color, const char* text)
{
    lv_obj_t* lbl = lv_label_create(parent);
    lv_obj_set_pos(lbl, x, y);
    lv_obj_set_style_text_font(lbl, font, 0);
    lv_obj_set_style_text_color(lbl, color, 0);
    lv_label_set_text(lbl, text);
    return lbl;
}

static const char* topic_for_display(const char* topic)
{
    static const char k_prefix[] = MQTT_TOPIC_PREFIX "/" MQTT_DEVICE_ID "/";
    const size_t n = sizeof(k_prefix) - 1;
    if (strncmp(topic, k_prefix, n) == 0 && topic[n] != '\0') {
        return topic + n;
    }
    return topic;
}

static void format_entry_time(const DiagEntry& e, bool time_synced, char* out, size_t out_len)
{
    if (time_synced) {
        const int64_t now_us = esp_timer_get_time();
        const int64_t age_s = (now_us > e.recv_us) ? ((now_us - e.recv_us) / 1000000) : 0;
        const time_t then = time(nullptr) - static_cast<time_t>(age_s);
        struct tm tm_local = {};
        localtime_r(&then, &tm_local);
        snprintf(out, out_len, "%02d:%02d:%02d", tm_local.tm_hour, tm_local.tm_min, tm_local.tm_sec);
        return;
    }
    const int64_t sec = e.recv_us / 1000000;
    snprintf(out, out_len, "+%lld:%02lld", (long long)(sec / 60), (long long)(sec % 60));
}

lv_obj_t* screen_boot_create()
{
    s_scr = lv_obj_create(nullptr);
    lv_obj_set_style_bg_color(s_scr, COL_BG, 0);
    lv_obj_set_style_bg_opa(s_scr, LV_OPA_COVER, 0);
    lv_obj_remove_flag(s_scr, LV_OBJ_FLAG_SCROLLABLE);

    make_label(s_scr, 24, 12, &lv_font_montserrat_48, COL_TEXT, "KOIoT Paneel");
    s_lbl_panel_id = make_label(s_scr, 0, 16, &lv_font_montserrat_30, COL_BLUE, "KOIoT-P-??????");
    lv_obj_align(s_lbl_panel_id, LV_ALIGN_TOP_RIGHT, -24, 16);
    lv_obj_t* fw = make_label(s_scr, 0, 0, &lv_font_montserrat_20, COL_MUTED,
                             "fw " APP_FW_VERSION "  |  " APP_HW_VERSION);
    lv_obj_align(fw, LV_ALIGN_TOP_RIGHT, -24, 52);

    // --- Netwerk (compact) ---
    lv_obj_t* net = make_card(s_scr, 24, 84, 300, 168);
    make_label(net, 0, 0, &lv_font_montserrat_20, COL_BLUE, "Netwerk");
    s_lbl_wifi_status = make_label(net, 0, 32, &lv_font_montserrat_24, COL_MUTED, "Niet gestart");
    lv_obj_set_width(s_lbl_wifi_status, 268);
    lv_label_set_long_mode(s_lbl_wifi_status, LV_LABEL_LONG_DOT);
    s_lbl_ip = make_label(net, 0, 68, &lv_font_montserrat_24, COL_TEXT, "IP -");
    lv_obj_set_width(s_lbl_ip, 268);
    lv_label_set_long_mode(s_lbl_ip, LV_LABEL_LONG_DOT);
    s_lbl_rssi = make_label(net, 0, 108, &lv_font_montserrat_20, COL_MUTED, "Signaal -");
    lv_obj_set_width(s_lbl_rssi, 268);

    // --- Tijd ---
    lv_obj_t* tim = make_card(s_scr, 336, 84, 220, 168);
    make_label(tim, 0, 0, &lv_font_montserrat_20, COL_BLUE, "Tijd");
    s_lbl_clock = make_label(tim, 0, 36, &lv_font_montserrat_48, COL_TEXT, "--:--");
    lv_obj_set_width(s_lbl_clock, 188);
    lv_obj_set_style_text_align(s_lbl_clock, LV_TEXT_ALIGN_CENTER, 0);
    s_lbl_date = make_label(tim, 0, 108, &lv_font_montserrat_20, COL_MUTED, "-- --- ----");
    lv_obj_set_width(s_lbl_date, 188);
    lv_obj_set_style_text_align(s_lbl_date, LV_TEXT_ALIGN_CENTER, 0);

    // --- MQTT ---
    lv_obj_t* mq = make_card(s_scr, 568, 84, 432, 168);
    make_label(mq, 0, 0, &lv_font_montserrat_20, COL_BLUE, "MQTT");
    s_lbl_mqtt_status = make_label(mq, 0, 28, &lv_font_montserrat_24, COL_MUTED, "Wacht op wifi");
    lv_obj_set_width(s_lbl_mqtt_status, 400);
    lv_label_set_long_mode(s_lbl_mqtt_status, LV_LABEL_LONG_DOT);
    s_lbl_mqtt_broker = make_label(mq, 0, 62, &lv_font_montserrat_20, COL_TEXT, "");
    lv_label_set_text_fmt(s_lbl_mqtt_broker, "Broker  %s:%d", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    lv_obj_set_width(s_lbl_mqtt_broker, 400);
    lv_label_set_long_mode(s_lbl_mqtt_broker, LV_LABEL_LONG_DOT);
    s_lbl_mqtt_filter = make_label(mq, 0, 90, &lv_font_montserrat_20, COL_TEXT, "");
    lv_label_set_text_fmt(s_lbl_mqtt_filter, "Filter  %s/%s/#", MQTT_TOPIC_PREFIX, MQTT_DEVICE_ID);
    lv_obj_set_width(s_lbl_mqtt_filter, 400);
    lv_label_set_long_mode(s_lbl_mqtt_filter, LV_LABEL_LONG_DOT);
    s_lbl_mqtt_count = make_label(mq, 0, 118, &lv_font_montserrat_20, COL_MUTED, "Berichten  0");
    lv_obj_set_width(s_lbl_mqtt_count, 400);

    // --- Diagnoselog ---
    lv_obj_t* logc = make_card(s_scr, 24, 264, 976, 276);
    make_label(logc, 0, 0, &lv_font_montserrat_20, COL_BLUE, "Diagnoselog");
    s_lbl_wait = make_label(logc, 0, 110, &lv_font_montserrat_30, COL_MUTED, "wacht op data");
    lv_obj_set_width(s_lbl_wait, 944);
    lv_obj_set_style_text_align(s_lbl_wait, LV_TEXT_ALIGN_CENTER, 0);

    for (int i = 0; i < APP_DIAG_STORE_CAPACITY; i++) {
        s_log_rows[i] = make_label(logc, 0, 32 + i * 22, &lv_font_montserrat_20, COL_TEXT, "");
        lv_obj_set_width(s_log_rows[i], 944);
        lv_label_set_long_mode(s_log_rows[i], LV_LABEL_LONG_DOT);
        lv_obj_add_flag(s_log_rows[i], LV_OBJ_FLAG_HIDDEN);
    }

    s_lbl_footer = make_label(s_scr, 24, 552, &lv_font_montserrat_20, COL_MUTED, "Uptime 0:00:00");
    lv_obj_set_width(s_lbl_footer, 976);

    ESP_LOGI(TAG, "diagnosescherm opgebouwd");
    return s_scr;
}

void screen_boot_update(const AppState& st)
{
    lv_label_set_text(s_lbl_panel_id, st.panel_id);

    switch (st.wifi) {
        case WifiStatus::Idle:
            lv_label_set_text(s_lbl_wifi_status, "Niet gestart");
            lv_obj_set_style_text_color(s_lbl_wifi_status, COL_MUTED, 0);
            break;
        case WifiStatus::Connecting:
            lv_label_set_text(s_lbl_wifi_status, "Verbinden...");
            lv_obj_set_style_text_color(s_lbl_wifi_status, COL_ORANGE, 0);
            break;
        case WifiStatus::Connected:
            lv_label_set_text(s_lbl_wifi_status, "Verbonden");
            lv_obj_set_style_text_color(s_lbl_wifi_status, COL_GREEN, 0);
            break;
        case WifiStatus::Disconnected:
            if (st.next_retry_in_s >= 0) {
                lv_label_set_text_fmt(s_lbl_wifi_status, "Geen wifi (retry %ld s)", (long)st.next_retry_in_s);
            } else {
                lv_label_set_text(s_lbl_wifi_status, "Geen wifi");
            }
            lv_obj_set_style_text_color(s_lbl_wifi_status, COL_RED, 0);
            break;
        case WifiStatus::WaitPowerCycle:
            lv_label_set_text(s_lbl_wifi_status, "Wifi wacht op stroom-eraf (C6)");
            lv_obj_set_style_text_color(s_lbl_wifi_status, COL_ORANGE, 0);
            break;
    }
    lv_label_set_text_fmt(s_lbl_ip, "IP  %s", st.ip[0] ? st.ip : "-");
    if (st.wifi == WifiStatus::Connected && st.rssi != 0) {
        lv_label_set_text_fmt(s_lbl_rssi, "Signaal  %d dBm", (int)st.rssi);
    } else {
        lv_label_set_text(s_lbl_rssi, "Signaal  -");
    }

    if (st.time_synced) {
        time_t now = time(nullptr);
        struct tm tm_local = {};
        localtime_r(&now, &tm_local);
        lv_label_set_text_fmt(s_lbl_clock, "%02d:%02d:%02d", tm_local.tm_hour, tm_local.tm_min, tm_local.tm_sec);
        lv_label_set_text_fmt(s_lbl_date, "%s %d %s %d",
                              WEEKDAYS_NL[tm_local.tm_wday], tm_local.tm_mday,
                              MONTHS_NL[tm_local.tm_mon], tm_local.tm_year + 1900);
    } else {
        lv_label_set_text(s_lbl_clock, "--:--");
        lv_label_set_text(s_lbl_date, "-- --- ----");
    }

    switch (st.mqtt) {
        case MqttStatus::Idle:
            lv_label_set_text(s_lbl_mqtt_status, st.mqtt_error[0] ? st.mqtt_error : "Wacht op wifi");
            lv_obj_set_style_text_color(s_lbl_mqtt_status, COL_MUTED, 0);
            break;
        case MqttStatus::Connecting:
            lv_label_set_text(s_lbl_mqtt_status, "Verbinden...");
            lv_obj_set_style_text_color(s_lbl_mqtt_status, COL_ORANGE, 0);
            break;
        case MqttStatus::Connected:
            lv_label_set_text(s_lbl_mqtt_status, "Verbonden");
            lv_obj_set_style_text_color(s_lbl_mqtt_status, COL_GREEN, 0);
            break;
        case MqttStatus::Disconnected:
            lv_label_set_text_fmt(s_lbl_mqtt_status, "Ontkoppeld%s%s",
                                  st.mqtt_error[0] ? ": " : "", st.mqtt_error);
            lv_obj_set_style_text_color(s_lbl_mqtt_status, COL_ORANGE, 0);
            break;
        case MqttStatus::Error:
            lv_label_set_text_fmt(s_lbl_mqtt_status, "Fout: %s",
                                  st.mqtt_error[0] ? st.mqtt_error : "onbekend");
            lv_obj_set_style_text_color(s_lbl_mqtt_status, COL_RED, 0);
            break;
    }

    const DiagSnapshot diag = diag_store_snapshot();
    lv_label_set_text_fmt(s_lbl_mqtt_count, "Berichten  %lu", (unsigned long)diag.total_count);

    if (!diag.got_data) {
        lv_obj_remove_flag(s_lbl_wait, LV_OBJ_FLAG_HIDDEN);
        for (int i = 0; i < APP_DIAG_STORE_CAPACITY; i++) {
            lv_obj_add_flag(s_log_rows[i], LV_OBJ_FLAG_HIDDEN);
        }
    } else {
        lv_obj_add_flag(s_lbl_wait, LV_OBJ_FLAG_HIDDEN);
        for (size_t i = 0; i < APP_DIAG_STORE_CAPACITY; i++) {
            if (i < diag.entry_count) {
                char tbuf[16];
                format_entry_time(diag.entries[i], st.time_synced, tbuf, sizeof(tbuf));
                const char* topic = topic_for_display(diag.entries[i].topic);
                lv_label_set_text_fmt(s_log_rows[i], "%s  %s  %s%s",
                                      tbuf, topic,
                                      diag.entries[i].payload[0] ? diag.entries[i].payload : "(leeg)",
                                      diag.entries[i].payload_truncated ? " ..." : "");
                lv_obj_remove_flag(s_log_rows[i], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_add_flag(s_log_rows[i], LV_OBJ_FLAG_HIDDEN);
            }
        }
    }

    const int64_t up_s = esp_timer_get_time() / 1000000;
    lv_label_set_text_fmt(s_lbl_footer, "Uptime %lld:%02lld:%02lld   |   vrij intern %u KB, vrij PSRAM %u KB",
                          (long long)(up_s / 3600), (long long)((up_s / 60) % 60), (long long)(up_s % 60),
                          (unsigned)(heap_caps_get_free_size(MALLOC_CAP_INTERNAL) / 1024),
                          (unsigned)(heap_caps_get_free_size(MALLOC_CAP_SPIRAM) / 1024));
}
