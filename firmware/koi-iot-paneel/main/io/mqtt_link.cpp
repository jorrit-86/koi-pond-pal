// KOIoT Paneel - mqtt_link (implementatie).
#include "io/mqtt_link.h"

#include <cstdio>
#include <cstring>
#include <ctime>

#include "esp_log.h"
#include "esp_timer.h"
#include "mqtt_client.h"

#include "app_config.h"
#include "core/app_state.h"
#include "core/panel_id.h"
#include "core/screen_manager.h"
#include "core/settings_store.h"
#include "data/diag_store.h"
#include "data/live_store.h"
#include "data/measurement_queue.h"
#include "data/param_catalog.h"
#include "cJSON.h"
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

static const char* TAG = "mqtt_link";

static esp_mqtt_client_handle_t s_client = nullptr;
static bool s_started = false;
static bool s_mqtt_connected = false;
static int64_t s_disconnected_since_us = 0;  // 0 = nog nooit verbonden
static char s_host[APP_MQTT_HOST_MAX + 1] = "";
static uint16_t s_port = MQTT_BROKER_PORT;
static char s_user[APP_MQTT_USER_MAX + 1] = "";
static char s_pass[APP_MQTT_PASS_MAX + 1] = "";
static char s_apply_host[APP_MQTT_HOST_MAX + 1] = "";
static uint16_t s_apply_port = MQTT_BROKER_PORT;
static char s_apply_user[APP_MQTT_USER_MAX + 1] = "";
static char s_apply_pass[APP_MQTT_PASS_MAX + 1] = "";
static volatile bool s_apply_pending = false;
static portMUX_TYPE s_mqtt_mux = portMUX_INITIALIZER_UNLOCKED;
static char s_filter[80] = "";
static char s_client_id[16] = "";
static char s_avail_topic[48] = "";
static char s_screen_set_topic[56] = "";
static char s_screen_state_topic[56] = "";
static char s_disc_topic[80] = "";
static char s_disc_json[1024] = "";
static const char s_lwt_offline[] = "offline";
static int s_sub_sensor_id = -1;
static int s_sub_screen_id = -1;

// Fragmenten van een te groot bericht (topic alleen in het eerste MQTT_EVENT_DATA).
static char s_frag_topic[APP_DIAG_TOPIC_MAX] = "";
static char s_frag_payload[256];
static size_t s_frag_used = 0;
static int s_frag_total = 0;
static bool s_frag_trunc = false;

static void set_mqtt_status(MqttStatus status, const char* error)
{
    AppState& st = app_state_lock();
    st.mqtt = status;
    if (error != nullptr && error[0] != '\0') {
        strncpy(st.mqtt_error, error, sizeof(st.mqtt_error) - 1);
        st.mqtt_error[sizeof(st.mqtt_error) - 1] = '\0';
    } else {
        st.mqtt_error[0] = '\0';
    }
    app_state_unlock();
}

static const char* refuse_text(esp_mqtt_connect_return_code_t code)
{
    switch (code) {
        case MQTT_CONNECTION_ACCEPTED:                 return "geaccepteerd";
        case MQTT_CONNECTION_REFUSE_PROTOCOL:          return "verkeerd protocol";
        case MQTT_CONNECTION_REFUSE_ID_REJECTED:       return "client-id geweigerd";
        case MQTT_CONNECTION_REFUSE_SERVER_UNAVAILABLE: return "broker niet beschikbaar";
        case MQTT_CONNECTION_REFUSE_BAD_USERNAME:      return "gebruiker/wachtwoord fout";
        case MQTT_CONNECTION_REFUSE_NOT_AUTHORIZED:    return "niet geautoriseerd";
        default:                                       return "onbekende weigering";
    }
}

static bool is_printable_payload(const char* data, size_t len)
{
    for (size_t i = 0; i < len; i++) {
        const unsigned char c = static_cast<unsigned char>(data[i]);
        if (c == '\0') {
            return false;
        }
        if (c < 32 && c != '\t' && c != '\r' && c != '\n') {
            return false;
        }
    }
    return true;
}

static void log_payload(const char* topic, const char* data, int total_len, bool retain)
{
    if (data == nullptr) {
        data = "";
    }
    const size_t show = (total_len < 0) ? 0 : static_cast<size_t>(total_len);
    if (show == 0) {
        ESP_LOGI(TAG, "binnenkomend: topic='%s' len=0 retain=%d payload=(leeg)", topic, retain ? 1 : 0);
        return;
    }
    if (is_printable_payload(data, show)) {
        ESP_LOGI(TAG, "binnenkomend: topic='%s' len=%d retain=%d payload='%.*s'",
                 topic, total_len, retain ? 1 : 0, static_cast<int>(show), data);
        return;
    }

    char hex[96];
    size_t pos = 0;
    const size_t hex_bytes = (show < 24) ? show : 24;
    for (size_t i = 0; i < hex_bytes && pos + 3 < sizeof(hex); i++) {
        pos += static_cast<size_t>(snprintf(hex + pos, sizeof(hex) - pos, "%02X ",
                                            static_cast<unsigned>(static_cast<unsigned char>(data[i]))));
    }
    ESP_LOGI(TAG, "binnenkomend: topic='%s' len=%d retain=%d payload=(binair) %s%s",
             topic, total_len, retain ? 1 : 0, hex, (show > hex_bytes) ? "..." : "");
}

static void finish_message(bool retain)
{
    log_payload(s_frag_topic, s_frag_payload, static_cast<int>(s_frag_used), retain);
    if (s_frag_total != static_cast<int>(s_frag_used)) {
        ESP_LOGI(TAG, "  (originele payload %d B, gelogd %u B)",
                 s_frag_total, static_cast<unsigned>(s_frag_used));
    }
    if (s_screen_set_topic[0] != '\0' && strcmp(s_frag_topic, s_screen_set_topic) == 0) {
        char cmd[8] = "";
        size_t n = s_frag_used < sizeof(cmd) - 1 ? s_frag_used : sizeof(cmd) - 1;
        memcpy(cmd, s_frag_payload, n);
        cmd[n] = '\0';
        while (n > 0 && (cmd[n - 1] == '\r' || cmd[n - 1] == '\n' || cmd[n - 1] == ' ')) {
            cmd[--n] = '\0';
        }
        if (strcmp(cmd, "ON") == 0 || strcmp(cmd, "on") == 0) {
            ESP_LOGI(TAG, "schermcommando ON (HA-switch Paneelscherm)");
            screen_manager_request_ha_on();
        } else if (strcmp(cmd, "OFF") == 0 || strcmp(cmd, "off") == 0) {
            ESP_LOGI(TAG, "schermcommando OFF (HA-switch Paneelscherm)");
            screen_manager_request_ha_off();
        } else {
            ESP_LOGW(TAG, "schermcommando genegeerd: payload='%s'", cmd);
        }
        return;
    }
    diag_store_push(s_frag_topic, strlen(s_frag_topic), s_frag_payload, s_frag_used);
    live_store_apply(s_frag_topic, strlen(s_frag_topic), s_frag_payload, s_frag_used, retain);
    if (s_frag_trunc) {
        ESP_LOGW(TAG, "payload van '%s' (%d B) paste niet volledig in de diagnosestore",
                 s_frag_topic, s_frag_total);
    }
}

static void on_data(esp_mqtt_event_handle_t event)
{
    if (event->current_data_offset == 0) {
        s_frag_used = 0;
        s_frag_trunc = false;
        s_frag_total = event->total_data_len;
        if (event->topic != nullptr && event->topic_len > 0) {
            size_t n = static_cast<size_t>(event->topic_len);
            if (n >= sizeof(s_frag_topic)) {
                n = sizeof(s_frag_topic) - 1;
            }
            memcpy(s_frag_topic, event->topic, n);
            s_frag_topic[n] = '\0';
        } else {
            s_frag_topic[0] = '\0';
        }
    }

    if (event->data != nullptr && event->data_len > 0) {
        const size_t room = sizeof(s_frag_payload) - 1 - s_frag_used;
        const size_t take = (static_cast<size_t>(event->data_len) < room)
                                ? static_cast<size_t>(event->data_len) : room;
        if (take > 0) {
            memcpy(s_frag_payload + s_frag_used, event->data, take);
            s_frag_used += take;
        }
        if (static_cast<size_t>(event->data_len) > room) {
            s_frag_trunc = true;
        }
    }
    s_frag_payload[s_frag_used] = '\0';

    const int got = event->current_data_offset + event->data_len;
    if (got >= event->total_data_len) {
        finish_message(event->retain);
    }
}

static bool publish_retained(const char* topic, const char* payload)
{
    if (s_client == nullptr || topic == nullptr || payload == nullptr) {
        return false;
    }
    const int len = static_cast<int>(strlen(payload));
    ESP_LOGI(TAG, "poging: publish '%s' len=%d retain=1", topic, len);
    const int msg_id = esp_mqtt_client_publish(s_client, topic, payload, 0, 0, 1);
    if (msg_id < 0) {
        ESP_LOGE(TAG, "mislukt: publish '%s' len=%d (msg_id %d, payloadgrootte %d)",
                 topic, len, msg_id, len);
        return false;
    }
    ESP_LOGI(TAG, "publish verstuurd '%s' (msg_id %d, %d B)", topic, msg_id, len);
    return true;
}

static void fill_discovery_json()
{
    cJSON* root = cJSON_CreateObject();
    if (root == nullptr) {
        s_disc_json[0] = '\0';
        return;
    }
    cJSON_AddStringToObject(root, "name", "Paneelscherm");
    cJSON_AddStringToObject(root, "object_id", "paneelscherm");
    char unique[32];
    snprintf(unique, sizeof(unique), "%s_scherm", s_client_id);
    cJSON_AddStringToObject(root, "unique_id", unique);
    cJSON_AddStringToObject(root, "command_topic", s_screen_set_topic);
    cJSON_AddStringToObject(root, "state_topic", s_screen_state_topic);
    cJSON_AddStringToObject(root, "payload_on", "ON");
    cJSON_AddStringToObject(root, "payload_off", "OFF");
    cJSON_AddStringToObject(root, "availability_topic", s_avail_topic);
    cJSON_AddStringToObject(root, "payload_available", "online");
    cJSON_AddStringToObject(root, "payload_not_available", "offline");
    cJSON* dev = cJSON_AddObjectToObject(root, "device");
    if (dev != nullptr) {
        cJSON* ids = cJSON_AddArrayToObject(dev, "identifiers");
        if (ids != nullptr) {
            cJSON_AddItemToArray(ids, cJSON_CreateString(s_client_id));
        }
        cJSON_AddStringToObject(dev, "name", "Koi IoT Paneel");
        cJSON_AddStringToObject(dev, "manufacturer", "KOIoT");
        cJSON_AddStringToObject(dev, "model", "CrowPanel Advanced 10.1 ESP32-P4");
        cJSON_AddStringToObject(dev, "sw_version", APP_FW_VERSION);
    }
    if (!cJSON_PrintPreallocated(root, s_disc_json, static_cast<int>(sizeof(s_disc_json)), 0)) {
        ESP_LOGE(TAG, "mislukt: discovery-JSON paste niet in %u B",
                 static_cast<unsigned>(sizeof(s_disc_json)));
        s_disc_json[0] = '\0';
    }
    cJSON_Delete(root);
}

static void publish_panel_ha()
{
    publish_retained(s_avail_topic, "online");
    if (s_disc_json[0] == '\0') {
        fill_discovery_json();
    }
    if (s_disc_json[0] != '\0') {
        publish_retained(s_disc_topic, s_disc_json);
    }
    mqtt_link_publish_screen_state(screen_manager_ha_switch_on());
    mqtt_link_republish_manual();
}

static void subscribe_filter()
{
    ESP_LOGI(TAG, "poging: abonneren op '%s' (qos 0)", s_filter);
    s_sub_sensor_id = esp_mqtt_client_subscribe_single(s_client, s_filter, 0);
    if (s_sub_sensor_id < 0) {
        ESP_LOGE(TAG, "mislukt: abonneren op '%s' geweigerd (msg_id %d)", s_filter, s_sub_sensor_id);
        set_mqtt_status(MqttStatus::Error, "subscribe geweigerd");
        return;
    }
    ESP_LOGI(TAG, "subscribe-verzoek verstuurd voor '%s' (msg_id %d); wacht op bevestiging",
             s_filter, s_sub_sensor_id);

    ESP_LOGI(TAG, "poging: abonneren op '%s' (qos 0)", s_screen_set_topic);
    s_sub_screen_id = esp_mqtt_client_subscribe_single(s_client, s_screen_set_topic, 0);
    if (s_sub_screen_id < 0) {
        ESP_LOGE(TAG, "mislukt: abonneren op '%s' geweigerd (msg_id %d)",
                 s_screen_set_topic, s_sub_screen_id);
        return;
    }
    ESP_LOGI(TAG, "subscribe-verzoek verstuurd voor '%s' (msg_id %d); wacht op bevestiging",
             s_screen_set_topic, s_sub_screen_id);
}

static void on_error(esp_mqtt_event_handle_t event)
{
    if (event->error_handle == nullptr) {
        ESP_LOGE(TAG, "MQTT-fout: geen error_handle");
        set_mqtt_status(MqttStatus::Error, "onbekende fout");
        return;
    }

    const esp_mqtt_error_codes_t* eh = event->error_handle;
    if (eh->error_type == MQTT_ERROR_TYPE_CONNECTION_REFUSED) {
        ESP_LOGE(TAG, "mislukt: broker weigerde verbinding, code %d (%s)",
                 static_cast<int>(eh->connect_return_code), refuse_text(eh->connect_return_code));
        char reason[48];
        snprintf(reason, sizeof(reason), "geweigerd: %s", refuse_text(eh->connect_return_code));
        set_mqtt_status(MqttStatus::Error, reason);
        return;
    }
    if (eh->error_type == MQTT_ERROR_TYPE_SUBSCRIBE_FAILED) {
        ESP_LOGE(TAG, "mislukt: subscribe afgewezen (type %d)", static_cast<int>(eh->error_type));
        set_mqtt_status(MqttStatus::Error, "subscribe afgewezen");
        return;
    }
    if (eh->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT) {
        ESP_LOGE(TAG, "mislukt: TCP/transport naar %s:%u: esp_tls=0x%x sock_errno=%d",
                 s_host, (unsigned)s_port,
                 eh->esp_tls_last_esp_err, eh->esp_transport_sock_errno);
        set_mqtt_status(MqttStatus::Error, "broker onbereikbaar");
        return;
    }
    ESP_LOGE(TAG, "mislukt: MQTT-fout type %d", static_cast<int>(eh->error_type));
    set_mqtt_status(MqttStatus::Error, "MQTT-fout");
}

static void on_mqtt_event(void*, esp_event_base_t, int32_t event_id, void* event_data)
{
    auto* event = static_cast<esp_mqtt_event_handle_t>(event_data);
    switch (static_cast<esp_mqtt_event_id_t>(event_id)) {
        case MQTT_EVENT_BEFORE_CONNECT:
            ESP_LOGI(TAG, "poging: verbinden met broker %s:%u als '%s' (client_id %s)",
                     s_host, (unsigned)s_port, s_user, s_client_id);
            set_mqtt_status(MqttStatus::Connecting, nullptr);
            break;

        case MQTT_EVENT_CONNECTED:
            ESP_LOGI(TAG, "succes: verbonden met broker %s:%u (session_present=%d)",
                     s_host, (unsigned)s_port, event->session_present);
            s_mqtt_connected = true;
            s_disconnected_since_us = 0;
            set_mqtt_status(MqttStatus::Connected, nullptr);
            subscribe_filter();
            publish_panel_ha();
            break;

        case MQTT_EVENT_DISCONNECTED:
            ESP_LOGW(TAG, "MQTT ontkoppeld van %s:%u; auto-reconnect blijft actief zolang wifi staat",
                     s_host, (unsigned)s_port);
            s_mqtt_connected = false;
            s_disconnected_since_us = esp_timer_get_time();
            set_mqtt_status(MqttStatus::Disconnected, "ontkoppeld");
            break;

        case MQTT_EVENT_SUBSCRIBED:
            if (event->error_handle != nullptr &&
                event->error_handle->error_type == MQTT_ERROR_TYPE_SUBSCRIBE_FAILED) {
                ESP_LOGE(TAG, "mislukt: subscribe afgewezen (msg_id %d)", event->msg_id);
                set_mqtt_status(MqttStatus::Error, "subscribe afgewezen");
            } else {
                const char* which = (event->msg_id == s_sub_screen_id) ? s_screen_set_topic : s_filter;
                ESP_LOGI(TAG, "succes: geabonneerd op '%s' (msg_id %d)", which, event->msg_id);
            }
            break;

        case MQTT_EVENT_DATA:
            on_data(event);
            break;

        case MQTT_EVENT_ERROR:
            on_error(event);
            break;

        default:
            break;
    }
}

static void copy_mqtt_str(char* dst, size_t dst_len, const char* src)
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

static void load_runtime_creds()
{
    const MqttRuntimeSettings m = settings_store_mqtt();
    copy_mqtt_str(s_host, sizeof(s_host), m.host);
    s_port = m.port != 0 ? m.port : MQTT_BROKER_PORT;
    copy_mqtt_str(s_user, sizeof(s_user), m.user);
    copy_mqtt_str(s_pass, sizeof(s_pass), m.pass);
}

static bool create_client()
{
    if (s_pass[0] == '\0' || strcmp(s_pass, "CHANGE_ME") == 0) {
        ESP_LOGW(TAG, "LET OP: MQTT-wachtwoord is nog leeg of CHANGE_ME; "
                      "de broker weigert de login waarschijnlijk");
    }

    esp_mqtt_client_config_t cfg = {};
    cfg.broker.address.hostname = s_host;
    cfg.broker.address.port = s_port;
    cfg.broker.address.transport = MQTT_TRANSPORT_OVER_TCP;
    cfg.credentials.username = s_user;
    cfg.credentials.authentication.password = s_pass;
    cfg.credentials.client_id = s_client_id;
    cfg.session.keepalive = APP_MQTT_KEEPALIVE_S;
    cfg.network.disable_auto_reconnect = false;
    cfg.network.reconnect_timeout_ms = APP_MQTT_RECONNECT_MS;
    cfg.buffer.size = APP_MQTT_BUFFER_SIZE;
    cfg.buffer.out_size = APP_MQTT_BUFFER_SIZE;
    cfg.task.stack_size = APP_MQTT_TASK_STACK;
    cfg.session.last_will.topic = s_avail_topic;
    cfg.session.last_will.msg = s_lwt_offline;
    cfg.session.last_will.msg_len = sizeof(s_lwt_offline) - 1;
    cfg.session.last_will.qos = 0;
    cfg.session.last_will.retain = 1;

    s_client = esp_mqtt_client_init(&cfg);
    if (s_client == nullptr) {
        ESP_LOGE(TAG, "mislukt: esp_mqtt_client_init gaf NULL terug");
        set_mqtt_status(MqttStatus::Error, "client-init mislukt");
        return false;
    }

    esp_err_t err = esp_mqtt_client_register_event(s_client, MQTT_EVENT_ANY, &on_mqtt_event, nullptr);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: MQTT-events registreren: %s (0x%x)", esp_err_to_name(err), err);
        set_mqtt_status(MqttStatus::Error, "event-reg mislukt");
        return false;
    }

    ESP_LOGI(TAG, "MQTT-client klaar (nog niet gestart); broker %s:%u user '%s', filter '%s', "
                  "LWT '%s', scherm '%s', buffer %d B, auto-reconnect %d ms",
             s_host, (unsigned)s_port, s_user, s_filter, s_avail_topic, s_screen_set_topic,
             APP_MQTT_BUFFER_SIZE, APP_MQTT_RECONNECT_MS);
    return true;
}

void mqtt_link_init()
{
    snprintf(s_filter, sizeof(s_filter), "%s/%s/#", MQTT_TOPIC_PREFIX, MQTT_DEVICE_ID);
    strncpy(s_client_id, panel_id_get(), sizeof(s_client_id) - 1);
    s_client_id[sizeof(s_client_id) - 1] = '\0';
    snprintf(s_avail_topic, sizeof(s_avail_topic), "%s/%s/status", MQTT_TOPIC_PREFIX, s_client_id);
    snprintf(s_screen_set_topic, sizeof(s_screen_set_topic), "%s/%s/scherm/set",
             MQTT_TOPIC_PREFIX, s_client_id);
    snprintf(s_screen_state_topic, sizeof(s_screen_state_topic), "%s/%s/scherm/state",
             MQTT_TOPIC_PREFIX, s_client_id);
    snprintf(s_disc_topic, sizeof(s_disc_topic), "homeassistant/switch/%s/scherm/config",
             s_client_id);
    fill_discovery_json();
    load_runtime_creds();
    create_client();
}

void mqtt_link_on_network_up()
{
    if (s_client == nullptr) {
        ESP_LOGW(TAG, "wifi verbonden maar MQTT-client ontbreekt; start overgeslagen");
        return;
    }
    if (s_started) {
        ESP_LOGI(TAG, "wifi-IP ontvangen; MQTT-client loopt al (auto-reconnect blijft actief)");
        return;
    }

    ESP_LOGI(TAG, "poging: MQTT-client starten naar %s:%u", s_host, (unsigned)s_port);
    set_mqtt_status(MqttStatus::Connecting, nullptr);
    const esp_err_t err = esp_mqtt_client_start(s_client);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: esp_mqtt_client_start: %s (0x%x)", esp_err_to_name(err), err);
        set_mqtt_status(MqttStatus::Error, "start geweigerd");
        return;
    }
    s_started = true;
    ESP_LOGI(TAG, "MQTT-client gestart; wacht op verbinding met de broker");
}

void mqtt_link_on_network_down()
{
    if (s_client == nullptr || !s_started) {
        set_mqtt_status(MqttStatus::Idle, "wacht op wifi");
        return;
    }
    ESP_LOGW(TAG, "wifi weg; MQTT-client stoppen (geen broker-pogingen zonder netwerk)");
    s_mqtt_connected = false;
    if (s_disconnected_since_us == 0) {
        s_disconnected_since_us = esp_timer_get_time();
    }
    const esp_err_t err = esp_mqtt_client_stop(s_client);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "mislukt: esp_mqtt_client_stop: %s (0x%x)", esp_err_to_name(err), err);
        set_mqtt_status(MqttStatus::Error, "stop geweigerd");
    } else {
        ESP_LOGI(TAG, "MQTT-client gestopt na wifi-verlies");
        set_mqtt_status(MqttStatus::Idle, "wacht op wifi");
    }
    s_started = false;
}

bool mqtt_link_is_connected()
{
    return s_mqtt_connected;
}

void mqtt_link_request_apply(const char* host, uint16_t port, const char* user, const char* pass)
{
    if (host == nullptr || host[0] == '\0') {
        ESP_LOGW(TAG, "MQTT toepassen geweigerd: lege host");
        return;
    }
    if (port == 0) {
        ESP_LOGW(TAG, "MQTT toepassen geweigerd: ongeldige poort");
        return;
    }

    char use_pass[APP_MQTT_PASS_MAX + 1] = "";
    if (pass != nullptr && pass[0] != '\0') {
        copy_mqtt_str(use_pass, sizeof(use_pass), pass);
        ESP_LOGI(TAG, "MQTT toepassen: %s:%u user '%s' (wachtwoord nieuw)",
                 host, (unsigned)port, user ? user : "");
    } else {
        const MqttRuntimeSettings cur = settings_store_mqtt();
        copy_mqtt_str(use_pass, sizeof(use_pass), cur.pass);
        ESP_LOGI(TAG, "MQTT toepassen: %s:%u user '%s' (wachtwoord ongewijzigd)",
                 host, (unsigned)port, user ? user : "");
    }

    portENTER_CRITICAL(&s_mqtt_mux);
    copy_mqtt_str(s_apply_host, sizeof(s_apply_host), host);
    s_apply_port = port;
    copy_mqtt_str(s_apply_user, sizeof(s_apply_user), user);
    copy_mqtt_str(s_apply_pass, sizeof(s_apply_pass), use_pass);
    s_apply_pending = true;
    portEXIT_CRITICAL(&s_mqtt_mux);

    set_mqtt_status(MqttStatus::Connecting, "opnieuw verbinden");
}

bool mqtt_link_apply_pending()
{
    return s_apply_pending;
}

bool mqtt_link_process_apply()
{
    if (!s_apply_pending) {
        return false;
    }

    portENTER_CRITICAL(&s_mqtt_mux);
    copy_mqtt_str(s_host, sizeof(s_host), s_apply_host);
    s_port = s_apply_port;
    copy_mqtt_str(s_user, sizeof(s_user), s_apply_user);
    copy_mqtt_str(s_pass, sizeof(s_pass), s_apply_pass);
    s_apply_pending = false;
    portEXIT_CRITICAL(&s_mqtt_mux);

    ESP_LOGI(TAG, "MQTT-instellingen toepassen: %s:%u user '%s'",
             s_host, (unsigned)s_port, s_user);
    settings_store_set_mqtt(s_host, s_port, s_user, s_pass);

    if (s_client != nullptr) {
        if (s_started) {
            mqtt_link_on_network_down();
        }
        ESP_LOGI(TAG, "MQTT-client opnieuw opbouwen voor nieuwe broker");
        const esp_err_t err = esp_mqtt_client_destroy(s_client);
        s_client = nullptr;
        s_started = false;
        s_mqtt_connected = false;
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "mislukt: esp_mqtt_client_destroy: %s (0x%x)",
                     esp_err_to_name(err), err);
            set_mqtt_status(MqttStatus::Error, "herbouw mislukt");
            return true;
        }
    }

    if (!create_client()) {
        return true;
    }
    set_mqtt_status(MqttStatus::Connecting, "opnieuw verbinden");
    return true;
}

void mqtt_link_current(char* host, size_t host_len, uint16_t* port, char* user, size_t user_len)
{
    if (host != nullptr && host_len > 0) {
        copy_mqtt_str(host, host_len, s_host);
    }
    if (port != nullptr) {
        *port = s_port;
    }
    if (user != nullptr && user_len > 0) {
        copy_mqtt_str(user, user_len, s_user);
    }
}

bool mqtt_link_disconnected_over_s(int32_t seconds)
{
    if (s_mqtt_connected) {
        return false;
    }
    if (s_disconnected_since_us == 0) {
        return true;  // nog nooit verbonden
    }
    const int64_t gone = (esp_timer_get_time() - s_disconnected_since_us) / 1000000;
    return gone >= static_cast<int64_t>(seconds);
}

void mqtt_link_publish_screen_state(bool on)
{
    if (!s_mqtt_connected || s_client == nullptr || s_screen_state_topic[0] == '\0') {
        return;
    }
    publish_retained(s_screen_state_topic, on ? "ON" : "OFF");
}

static void add_device_object(cJSON* root)
{
    if (root == nullptr) {
        return;
    }
    cJSON* dev = cJSON_AddObjectToObject(root, "device");
    if (dev == nullptr) {
        return;
    }
    cJSON* ids = cJSON_AddArrayToObject(dev, "identifiers");
    if (ids != nullptr) {
        cJSON_AddItemToArray(ids, cJSON_CreateString(s_client_id));
    }
    cJSON_AddStringToObject(dev, "name", "Koi IoT Paneel");
    cJSON_AddStringToObject(dev, "manufacturer", "KOIoT");
    cJSON_AddStringToObject(dev, "model", "CrowPanel Advanced 10.1 ESP32-P4");
    cJSON_AddStringToObject(dev, "sw_version", APP_FW_VERSION);
}

static void publish_sensor_discovery(const char* key, const char* name,
                                     const char* unit, bool diagnostic)
{
    if (s_client == nullptr || key == nullptr || key[0] == '\0') {
        return;
    }
    char state_t[72];
    char attr_t[80];
    char disc_t[96];
    char unique[48];
    snprintf(state_t, sizeof(state_t), "%s/%s/%s", MQTT_TOPIC_PREFIX, s_client_id, key);
    snprintf(attr_t, sizeof(attr_t), "%s/%s/%s/attr", MQTT_TOPIC_PREFIX, s_client_id, key);
    snprintf(disc_t, sizeof(disc_t), "homeassistant/sensor/%s/%s/config", s_client_id, key);
    snprintf(unique, sizeof(unique), "%s_%s", s_client_id, key);

    cJSON* root = cJSON_CreateObject();
    if (root == nullptr) {
        return;
    }
    cJSON_AddStringToObject(root, "name", name != nullptr ? name : key);
    cJSON_AddStringToObject(root, "object_id", key);
    cJSON_AddStringToObject(root, "unique_id", unique);
    cJSON_AddStringToObject(root, "state_topic", state_t);
    if (!diagnostic) {
        cJSON_AddStringToObject(root, "json_attributes_topic", attr_t);
        cJSON_AddStringToObject(root, "state_class", "measurement");
    }
    if (unit != nullptr && unit[0] != '\0') {
        cJSON_AddStringToObject(root, "unit_of_measurement", unit);
    }
    cJSON_AddStringToObject(root, "availability_topic", s_avail_topic);
    cJSON_AddStringToObject(root, "payload_available", "online");
    cJSON_AddStringToObject(root, "payload_not_available", "offline");
    if (diagnostic) {
        cJSON_AddStringToObject(root, "entity_category", "diagnostic");
    }
    add_device_object(root);

    char json[APP_MQTT_BUFFER_SIZE];
    json[0] = '\0';
    if (!cJSON_PrintPreallocated(root, json, static_cast<int>(sizeof(json)), 0)) {
        ESP_LOGE(TAG, "mislukt: discovery-JSON '%s' paste niet in %u B",
                 key, static_cast<unsigned>(sizeof(json)));
        cJSON_Delete(root);
        return;
    }
    cJSON_Delete(root);
    publish_retained(disc_t, json);
}

void mqtt_link_publish_manual_state(const char* key, float value, const char* unit,
                                    int64_t measured_at, const char* uploadstatus)
{
    if (!s_mqtt_connected || s_client == nullptr || key == nullptr || key[0] == '\0') {
        return;
    }
    char state_t[72];
    char attr_t[80];
    snprintf(state_t, sizeof(state_t), "%s/%s/%s", MQTT_TOPIC_PREFIX, s_client_id, key);
    snprintf(attr_t, sizeof(attr_t), "%s/%s/%s/attr", MQTT_TOPIC_PREFIX, s_client_id, key);

    char state[32];
    snprintf(state, sizeof(state), "%.4g", static_cast<double>(value));
    publish_retained(state_t, state);

    cJSON* attr = cJSON_CreateObject();
    if (attr == nullptr) {
        return;
    }
    if (measured_at >= 1700000000) {
        const time_t t = static_cast<time_t>(measured_at);
        struct tm tm_u = {};
        gmtime_r(&t, &tm_u);
        char iso[40];
        snprintf(iso, sizeof(iso), "%04d-%02d-%02dT%02d:%02d:%02dZ",
                 tm_u.tm_year + 1900, tm_u.tm_mon + 1, tm_u.tm_mday,
                 tm_u.tm_hour, tm_u.tm_min, tm_u.tm_sec);
        cJSON_AddStringToObject(attr, "measured_at", iso);
    }
    cJSON_AddStringToObject(attr, "bron", "paneel");
    if (uploadstatus != nullptr && uploadstatus[0] != '\0') {
        cJSON_AddStringToObject(attr, "uploadstatus", uploadstatus);
    }
    if (unit != nullptr && unit[0] != '\0') {
        cJSON_AddStringToObject(attr, "unit", unit);
    }
    char json[256];
    json[0] = '\0';
    if (cJSON_PrintPreallocated(attr, json, static_cast<int>(sizeof(json)), 0)) {
        publish_retained(attr_t, json);
    }
    cJSON_Delete(attr);
}

void mqtt_link_publish_diagnostics()
{
    if (!s_mqtt_connected || s_client == nullptr) {
        return;
    }
    const AppState st = app_state_snapshot();
    char t[72];
    char v[24];
    snprintf(t, sizeof(t), "%s/%s/rssi", MQTT_TOPIC_PREFIX, s_client_id);
    snprintf(v, sizeof(v), "%d", static_cast<int>(st.rssi));
    publish_retained(t, v);

    snprintf(t, sizeof(t), "%s/%s/uptime", MQTT_TOPIC_PREFIX, s_client_id);
    snprintf(v, sizeof(v), "%u", static_cast<unsigned>(esp_timer_get_time() / 1000000ULL));
    publish_retained(t, v);

    snprintf(t, sizeof(t), "%s/%s/queue", MQTT_TOPIC_PREFIX, s_client_id);
    snprintf(v, sizeof(v), "%d", measurement_queue_pending_count());
    publish_retained(t, v);

    snprintf(t, sizeof(t), "%s/%s/fw", MQTT_TOPIC_PREFIX, s_client_id);
    publish_retained(t, APP_FW_VERSION);
}

void mqtt_link_republish_manual()
{
    if (!s_mqtt_connected || s_client == nullptr) {
        return;
    }
    for (int i = 0; i < param_catalog_count(); i++) {
        const ParamDef* p = param_catalog_get(i);
        if (p == nullptr) {
            continue;
        }
        const char* unit = (p->units[0] != nullptr) ? p->units[0] : "";
        publish_sensor_discovery(p->key, p->label, unit, false);
    }
    publish_sensor_discovery("rssi", "Wifi RSSI", "dBm", true);
    publish_sensor_discovery("uptime", "Uptime", "s", true);
    publish_sensor_discovery("queue", "Metingen in wachtrij", nullptr, true);
    publish_sensor_discovery("fw", "Firmware", nullptr, true);

    for (int i = 0; i < param_catalog_count(); i++) {
        MeasItem last;
        if (!measurement_queue_get_last(i, &last)) {
            continue;
        }
        const ParamDef* p = param_catalog_get(i);
        if (p == nullptr) {
            continue;
        }
        const int u = (last.unit < p->unit_count) ? last.unit : 0;
        const char* st = "in wachtrij";
        if (last.status == MeasStatus::Uploaded) {
            st = "geupload";
        } else if (last.status == MeasStatus::Rejected) {
            st = "afgewezen";
        }
        mqtt_link_publish_manual_state(p->key, last.value,
                                       p->units[u], last.measured_at, st);
    }
    mqtt_link_publish_diagnostics();
}
