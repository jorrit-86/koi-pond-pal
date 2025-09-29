#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define TEMP_SENSOR_PIN_1 14  // GPIO 14 - Eerste sensor (Vijver Water)
#define TEMP_SENSOR_PIN_2 25  // GPIO 25 - Tweede sensor (Filter Inlaat)

OneWire oneWire1(TEMP_SENSOR_PIN_1);
OneWire oneWire2(TEMP_SENSOR_PIN_2);
DallasTemperature tempSensor1(&oneWire1);
DallasTemperature tempSensor2(&oneWire2);

// Individual sensor configuration
struct SensorConfig {
  String sensor_id;        // Individual sensor ID (KOIoT-001122-01, etc.)
  String display_name;
  float temperature_offset;
  float temperature_scale;
  bool enabled;
};

// Default configuration - will be overridden by remote config
struct ESP32Config {
  int measurement_interval = 300;  // 5 minutes default
  String wifi_ssid = "Aruba AP22";
  String wifi_password = "Rhodoniet9";
  float temperature_offset = 0.0;  // Global fallback
  float temperature_scale = 1.0;   // Global fallback
  bool deep_sleep_enabled = false;
  int deep_sleep_duration = 3600;
  bool debug_mode = true;
  String log_level = "info";
  int config_version = 0;
  bool pending_changes = false;
  bool restart_requested = false;
  
  // Individual sensor configurations
  SensorConfig sensors[2];  // vijver_water, filter_inlaat
};

ESP32Config config;

// Supabase Edge Function URLs
const char* supabaseURL = "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/sensor-data";
const char* pingURL = "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/sensor-ping";
const char* configURL = "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/esp32-config";

// Unique Device ID - Change this for each ESP32
const char* DEVICE_ID = "KOIoT-001122";

// Individual Sensor IDs - derived from device ID
const char* SENSOR_ID_1 = "KOIoT-001122-01";  // Vijver Water
const char* SENSOR_ID_2 = "KOIoT-001122-02";  // Filter Inlaat

// Timing variables
unsigned long lastMeasurementTime = 0;
unsigned long lastPingTime = 0;
unsigned long lastConfigCheckTime = 0;
const unsigned long PING_INTERVAL = 10 * 60 * 1000;  // 10 minutes
const unsigned long CONFIG_CHECK_INTERVAL = 30 * 1000;  // 30 seconds

// Restart protection
bool restartInProgress = false;
unsigned long restartRequestTime = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 Koi Pond Sensor - Remote Configuration");
  Serial.println("=============================================");
  Serial.println("Device ID: " + String(DEVICE_ID));
  Serial.println("Sensor 1 ID: " + String(SENSOR_ID_1));
  Serial.println("Sensor 2 ID: " + String(SENSOR_ID_2));
  
  // Reset restart protection after boot
  restartInProgress = false;
  restartRequestTime = 0;
  
  // Start temperature sensors
  tempSensor1.begin();
  tempSensor2.begin();
  
  // Load configuration from EEPROM or use defaults
  loadConfiguration();
  
  // Initialize individual sensor configurations
  initializeSensorConfigs();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Test sensors
  int deviceCount1 = tempSensor1.getDeviceCount();
  int deviceCount2 = tempSensor2.getDeviceCount();
  Serial.println("Gevonden sensoren op pin 14: " + String(deviceCount1));
  Serial.println("Gevonden sensoren op pin 25: " + String(deviceCount2));
  
  // Check for configuration updates
  checkForConfigurationUpdates();
  
  Serial.println("🎯 Supabase URL: " + String(supabaseURL));
  Serial.println("⚙️  Configuratie geladen - Meetinterval: " + String(config.measurement_interval) + "s");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check for configuration updates
  if (currentTime - lastConfigCheckTime >= CONFIG_CHECK_INTERVAL) {
    checkForConfigurationUpdates();
    lastConfigCheckTime = currentTime;
  }
  
  // Send ping if needed
  if (currentTime - lastPingTime >= PING_INTERVAL) {
    sendPingToSupabase();
    lastPingTime = currentTime;
  }
  
  // Take measurement if it's time
  if (currentTime - lastMeasurementTime >= (config.measurement_interval * 1000)) {
    takeMeasurement();
    lastMeasurementTime = currentTime;
  }
  
  // Handle deep sleep if enabled
  if (config.deep_sleep_enabled) {
    Serial.println("😴 Deep sleep ingeschakeld - slapen voor " + String(config.deep_sleep_duration) + " seconden");
    esp_deep_sleep(config.deep_sleep_duration * 1000000); // Convert to microseconds
  }
  
  // Small delay to prevent watchdog issues
  delay(1000);
}

void takeMeasurement() {
  // Read temperatures from both sensors
  tempSensor1.requestTemperatures();
  tempSensor2.requestTemperatures();
  
  float temperature1 = tempSensor1.getTempCByIndex(0);
  float temperature2 = tempSensor2.getTempCByIndex(0);
  
  // Process first sensor (Vijver Water)
  if (temperature1 != DEVICE_DISCONNECTED_C && config.sensors[0].enabled) {
    // Apply individual sensor calibration
    float calibratedTemp1 = (temperature1 + config.sensors[0].temperature_offset) * config.sensors[0].temperature_scale;
    
    if (config.debug_mode) {
      Serial.println("🌡️  Sensor 1 (" + config.sensors[0].display_name + ") - Raw: " + String(temperature1, 2) + "°C");
      Serial.println("🌡️  Sensor 1 (" + config.sensors[0].display_name + ") - Gecalibreerd: " + String(calibratedTemp1, 2) + "°C");
    } else {
      Serial.println("🌡️  " + config.sensors[0].display_name + ": " + String(calibratedTemp1, 2) + "°C");
    }
    
    // Send data to Supabase for sensor 1
    sendDataToSupabase(calibratedTemp1, config.sensors[0].sensor_id, "temperatuurmeter");
    
    // Temperature interpretation for koi
    interpretTemperature(calibratedTemp1, config.sensors[0].display_name);
  } else if (temperature1 == DEVICE_DISCONNECTED_C) {
    Serial.println("❌ Sensor 1 (" + config.sensors[0].display_name + ") fout!");
  } else if (!config.sensors[0].enabled) {
    Serial.println("⏸️  Sensor 1 (" + config.sensors[0].display_name + ") uitgeschakeld");
  }
  
  // Process second sensor (Filter Inlaat)
  if (temperature2 != DEVICE_DISCONNECTED_C && config.sensors[1].enabled) {
    // Apply individual sensor calibration
    float calibratedTemp2 = (temperature2 + config.sensors[1].temperature_offset) * config.sensors[1].temperature_scale;
    
    if (config.debug_mode) {
      Serial.println("🌡️  Sensor 2 (" + config.sensors[1].display_name + ") - Raw: " + String(temperature2, 2) + "°C");
      Serial.println("🌡️  Sensor 2 (" + config.sensors[1].display_name + ") - Gecalibreerd: " + String(calibratedTemp2, 2) + "°C");
    } else {
      Serial.println("🌡️  " + config.sensors[1].display_name + ": " + String(calibratedTemp2, 2) + "°C");
    }
    
    // Send data to Supabase for sensor 2
    sendDataToSupabase(calibratedTemp2, config.sensors[1].sensor_id, "temperatuurmeter");
    
    // Temperature interpretation for koi
    interpretTemperature(calibratedTemp2, config.sensors[1].display_name);
  } else if (temperature2 == DEVICE_DISCONNECTED_C) {
    Serial.println("❌ Sensor 2 (" + config.sensors[1].display_name + ") fout!");
  } else if (!config.sensors[1].enabled) {
    Serial.println("⏸️  Sensor 2 (" + config.sensors[1].display_name + ") uitgeschakeld");
  }
  
  Serial.println("-------------------");
}

void interpretTemperature(float temperature, String sensorName) {
  if (temperature < 4) {
    Serial.println("⚠️  " + sensorName + " - Te koud voor koi (< 4°C)");
  } else if (temperature > 30) {
    Serial.println("⚠️  " + sensorName + " - Te warm voor koi (> 30°C)");
  } else if (temperature >= 18 && temperature <= 25) {
    Serial.println("✅ " + sensorName + " - Ideale temperatuur voor koi");
  } else {
    Serial.println("⚠️  " + sensorName + " - Acceptabele temperatuur voor koi");
  }
}

void connectToWiFi() {
  // Ensure WiFi credentials are set
  String ssid = "Aruba AP22";
  String password = "Rhodoniet9";
  
  Serial.println("🔍 WiFi verbinding starten...");
  Serial.println("📶 SSID: " + ssid);
  Serial.println("🔑 Wachtwoord: " + String(password.length()) + " karakters");
  
  // Scan for available networks
  Serial.println("🔍 Beschikbare WiFi netwerken:");
  int networksFound = WiFi.scanNetworks();
  for (int i = 0; i < networksFound; i++) {
    Serial.println("  - " + WiFi.SSID(i) + " (RSSI: " + String(WiFi.RSSI(i)) + ")");
  }
  
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("🔄 Verbinden met WiFi: ");
  Serial.println(ssid);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
    
    // Show status every 5 attempts
    if (attempts % 5 == 0) {
      Serial.println();
      Serial.println("Status: " + String(WiFi.status()));
      Serial.println("Poging: " + String(attempts) + "/30");
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ WiFi verbonden!");
    Serial.print("IP adres: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC adres: ");
    Serial.println(WiFi.macAddress());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println();
    Serial.println("❌ WiFi verbinding mislukt!");
    Serial.println("Status code: " + String(WiFi.status()));
    Serial.println("🔄 Probeer opnieuw in 30 seconden...");
    delay(30000);
    connectToWiFi(); // Retry
  }
}

void checkForConfigurationUpdates() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi niet verbonden - kan configuratie niet ophalen");
    return;
  }
  
  // Skip config check if restart is in progress
  if (restartInProgress) {
    if (config.debug_mode) {
      Serial.println("⏳ Herstart in uitvoering - configuratie check overgeslagen");
    }
    return;
  }
  
  HTTPClient http;
  http.begin(configURL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4");
  
  // Request configuration - use device ID for main config
  String jsonData = "{\"sensor_id\":\"" + String(DEVICE_ID) + "\",\"action\":\"get_config\"}";
  
  // Validate JSON format
  if (jsonData.length() < 10) {
    Serial.println("❌ JSON data te kort: " + jsonData);
    return;
  }
  
  if (config.debug_mode) {
    Serial.println("⚙️  Configuratie ophalen...");
    Serial.println("📋 Request: " + jsonData);
    Serial.println("🕐 Config check interval: " + String(CONFIG_CHECK_INTERVAL/1000) + " seconden");
  }
  
  int httpResponseCode = http.POST(jsonData);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    
    if (config.debug_mode) {
      Serial.println("✅ Configuratie response - Status: " + String(httpResponseCode));
      Serial.println("📥 Response: " + response);
    }
    
    // Parse configuration (this will check for restart requests)
    parseConfiguration(response);
  } else {
    if (config.debug_mode) {
      Serial.println("❌ Fout bij ophalen configuratie - Status: " + String(httpResponseCode));
    }
  }
  
  http.end();
}

void parseConfiguration(String jsonResponse) {
  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, jsonResponse);
  
  if (error) {
    Serial.println("❌ JSON parse fout: " + String(error.c_str()));
    return;
  }
  
  // Check if configuration was updated
  int newConfigVersion = doc["config_version"];
  bool hasPendingChanges = doc["pending_changes"];
  bool restartRequested = doc["restart_requested"];
  
  // Check for restart request
  if (restartRequested && !restartInProgress) {
    Serial.println("🔄 Herstart aangevraagd via web interface!");
    Serial.println("⏳ ESP32 wordt herstart in 3 seconden...");
    Serial.println("📋 Restart status: " + String(restartRequested ? "true" : "false"));
    
    restartInProgress = true;
    restartRequestTime = millis();
    
    // Mark restart as applied BEFORE restarting
    markConfigurationApplied();
    
    delay(3000);
    Serial.println("🔄 Herstarten nu...");
    ESP.restart();
  }
  
  if (newConfigVersion > config.config_version || hasPendingChanges) {
    Serial.println("🔄 Nieuwe configuratie gevonden - versie: " + String(newConfigVersion));
    
    // Update configuration
    config.measurement_interval = doc["measurement_interval"] | config.measurement_interval;
    config.wifi_ssid = doc["wifi_ssid"].as<String>();
    config.wifi_password = doc["wifi_password"].as<String>();
    config.temperature_offset = doc["temperature_offset"] | config.temperature_offset;
    config.temperature_scale = doc["temperature_scale"] | config.temperature_scale;
    config.deep_sleep_enabled = doc["deep_sleep_enabled"] | config.deep_sleep_enabled;
    config.deep_sleep_duration = doc["deep_sleep_duration"] | config.deep_sleep_duration;
    config.debug_mode = doc["debug_mode"] | config.debug_mode;
    config.log_level = doc["log_level"].as<String>();
    config.config_version = newConfigVersion;
    config.pending_changes = false;
    
    // Update individual sensor configurations
    if (doc.containsKey("sensors")) {
      JsonObject sensors = doc["sensors"];
      
      // Update temperatuurmeter sensor (index 0)
      if (sensors.containsKey("temperatuurmeter")) {
        JsonObject temperatuurmeter = sensors["temperatuurmeter"];
        config.sensors[0].sensor_id = temperatuurmeter["sensor_id"].as<String>();
        config.sensors[0].display_name = temperatuurmeter["display_name"].as<String>();
        config.sensors[0].temperature_offset = temperatuurmeter["temperature_offset"] | config.sensors[0].temperature_offset;
        config.sensors[0].temperature_scale = temperatuurmeter["temperature_scale"] | config.sensors[0].temperature_scale;
        config.sensors[0].enabled = temperatuurmeter["enabled"] | config.sensors[0].enabled;
      }
      
      // Update temperatuurmeter sensor (index 1) - tweede sensor
      if (sensors.containsKey("temperatuurmeter") && config.sensors[0].sensor_id != "") {
        // Als er al een temperatuurmeter is geconfigureerd, gebruik de tweede entry
        JsonObject temperatuurmeter2 = sensors["temperatuurmeter"];
        config.sensors[1].sensor_id = temperatuurmeter2["sensor_id"].as<String>();
        config.sensors[1].display_name = temperatuurmeter2["display_name"].as<String>();
        config.sensors[1].temperature_offset = temperatuurmeter2["temperature_offset"] | config.sensors[1].temperature_offset;
        config.sensors[1].temperature_scale = temperatuurmeter2["temperature_scale"] | config.sensors[1].temperature_scale;
        config.sensors[1].enabled = temperatuurmeter2["enabled"] | config.sensors[1].enabled;
      }
    }
    config.restart_requested = false;
    
    // Save configuration to EEPROM
    saveConfiguration();
    
    // Mark configuration as applied
    markConfigurationApplied();
    
    Serial.println("✅ Configuratie bijgewerkt!");
    Serial.println("⚙️  Meetinterval: " + String(config.measurement_interval) + "s");
    Serial.println("📶 WiFi: " + config.wifi_ssid);
    Serial.println("🌡️  Temperatuur offset: " + String(config.temperature_offset) + "°C");
    
    // Reconnect to WiFi if credentials changed
    if (WiFi.SSID() != config.wifi_ssid) {
      Serial.println("🔄 WiFi credentials gewijzigd - herverbinden...");
      WiFi.disconnect();
      delay(1000);
      connectToWiFi();
    }
  } else {
    if (config.debug_mode) {
      Serial.println("✅ Configuratie up-to-date");
      Serial.println("📋 Restart requested: " + String(restartRequested ? "true" : "false"));
    }
  }
}

void markConfigurationApplied() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(configURL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4");
  
  String jsonData = "{\"sensor_id\":\"" + String(DEVICE_ID) + "\",\"action\":\"mark_applied\"}";
  
  if (config.debug_mode) {
    Serial.println("✅ Configuratie als toegepast markeren...");
  }
  
  int httpResponseCode = http.POST(jsonData);
  
  if (config.debug_mode && httpResponseCode > 0) {
    Serial.println("✅ Configuratie gemarkeerd als toegepast - Status: " + String(httpResponseCode));
  }
  
  http.end();
}

void sendDataToSupabase(float temperature, String sensorId, String sensorType) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(supabaseURL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4");
    
    // JSON data with individual sensor ID and device ID
    String jsonData = "{\"temperature\":" + String(temperature, 2) + ",\"sensor_id\":\"" + sensorId + "\",\"device_id\":\"" + String(DEVICE_ID) + "\",\"sensor_type\":\"" + sensorType + "\"}";
    
    Serial.println("=== SENDING DATA ===");
    Serial.println("URL: " + String(supabaseURL));
    Serial.println("Data: " + jsonData);
    Serial.println("Sensor Type: " + sensorType);
    
    int httpResponseCode = http.POST(jsonData);
    
    Serial.println("HTTP Response Code: " + String(httpResponseCode));
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Response: " + response);
      Serial.println("=== DATA SENT SUCCESSFULLY ===");
    } else {
      Serial.println("=== ERROR SENDING DATA ===");
      Serial.println("Error Code: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("❌ WiFi niet verbonden");
  }
}

void sendPingToSupabase() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(pingURL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4");
    
    // JSON data for ping - use device ID for ping
    String jsonData = "{\"sensor_id\":\"" + String(DEVICE_ID) + "\",\"device_id\":\"" + String(DEVICE_ID) + "\",\"ping_time\":" + String(millis()) + "}";
    
    if (config.debug_mode) {
      Serial.println("🏓 Ping naar Supabase...");
      Serial.println("📋 Ping Data: " + jsonData);
    }
    
    int httpResponseCode = http.POST(jsonData);
    
    if (httpResponseCode > 0) {
      if (config.debug_mode) {
        Serial.println("✅ Ping verzonden - Status: " + String(httpResponseCode));
        String response = http.getString();
        Serial.println("📥 Ping Response: " + response);
      }
    } else {
      Serial.println("❌ Fout bij ping - Status: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("❌ WiFi niet verbonden - kan ping niet verzenden");
  }
}

void loadConfiguration() {
  // Load default configuration values
  config.measurement_interval = 300;
  config.wifi_ssid = "Aruba AP22";
  config.wifi_password = "Rhodoniet9";
  config.temperature_offset = 0.0;
  config.temperature_scale = 1.0;
  config.deep_sleep_enabled = false;
  config.deep_sleep_duration = 3600;
  config.debug_mode = true;
  config.log_level = "info";
  config.config_version = 0;
  config.pending_changes = false;
  config.restart_requested = false;
  
  Serial.println("⚙️  Configuratie geladen (defaults)");
  Serial.println("📶 WiFi SSID: " + config.wifi_ssid);
  Serial.println("🔑 WiFi Password: " + String(config.wifi_password.length()) + " karakters");
}

void initializeSensorConfigs() {
  // Initialize sensor 1 (index 0) - Vijver Water
  config.sensors[0].sensor_id = SENSOR_ID_1;
  config.sensors[0].display_name = "Vijver Water Temperatuur";
  config.sensors[0].temperature_offset = 0.0;
  config.sensors[0].temperature_scale = 1.0;
  config.sensors[0].enabled = true;
  
  // Initialize sensor 2 (index 1) - Filter Inlaat
  config.sensors[1].sensor_id = SENSOR_ID_2;
  config.sensors[1].display_name = "Filter Inlaat Temperatuur";
  config.sensors[1].temperature_offset = 0.0;
  config.sensors[1].temperature_scale = 1.0;
  config.sensors[1].enabled = true;
  
  Serial.println("🔧 Individuele sensor configuraties geïnitialiseerd");
  Serial.println("📊 Sensor 1: " + config.sensors[0].sensor_id + " - " + config.sensors[0].display_name);
  Serial.println("📊 Sensor 2: " + config.sensors[1].sensor_id + " - " + config.sensors[1].display_name);
}

void saveConfiguration() {
  // In a real implementation, you would save to EEPROM
  // For now, we'll just log it
  Serial.println("💾 Configuratie opgeslagen");
}
