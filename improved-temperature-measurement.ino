#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define TEMP_SENSOR_PIN_1 14  // GPIO 14 - Eerste sensor (Vijver Water)
#define TEMP_SENSOR_PIN_2 25  // GPIO 25 - Tweede sensor (Filter Inlaat) - 3.3V kant

OneWire oneWire1(TEMP_SENSOR_PIN_1);
OneWire oneWire2(TEMP_SENSOR_PIN_2);
DallasTemperature tempSensor1(&oneWire1);
DallasTemperature tempSensor2(&oneWire2);

// Individual sensor configuration with improved calibration
struct SensorConfig {
  String display_name;
  float temperature_offset;
  float temperature_scale;
  bool enabled;
  float min_valid_temp;    // Minimum valid temperature
  float max_valid_temp;    // Maximum valid temperature
  int smoothing_samples;    // Number of samples for smoothing
  float outlier_threshold;  // Threshold for outlier detection
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

// Temperature measurement history for smoothing
float tempHistory1[10] = {0};  // Store last 10 readings for sensor 1
float tempHistory2[10] = {0};  // Store last 10 readings for sensor 2
int historyIndex1 = 0;
int historyIndex2 = 0;
int historyCount1 = 0;
int historyCount2 = 0;

// Supabase Edge Function URLs
const char* supabaseURL = "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/sensor-data";
const char* pingURL = "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/sensor-ping";
const char* configURL = "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/esp32-config";

// Unique Device ID - Change this for each ESP32
const char* DEVICE_ID = "ESP32-001";
const char* SENSOR_ID = "KOIoT-A1b2C3";

// Timing variables
unsigned long lastMeasurementTime = 0;
unsigned long lastPingTime = 0;
unsigned long lastConfigCheckTime = 0;
const unsigned long PING_INTERVAL = 10 * 60 * 1000;  // 10 minutes
const unsigned long CONFIG_CHECK_INTERVAL = 30 * 1000;  // 30 seconds

// Restart protection
bool restartInProgress = false;

void setup() {
  Serial.begin(115200);
  Serial.println("🌡️  Verbeterde Temperatuursensor Start");
  
  // Initialize temperature sensors
  tempSensor1.begin();
  tempSensor2.begin();
  
  // Set sensor resolution to 12-bit for better accuracy
  tempSensor1.setResolution(12);
  tempSensor2.setResolution(12);
  
  // Initialize default sensor configurations
  initializeDefaultConfig();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Load remote configuration
  loadRemoteConfig();
  
  Serial.println("✅ Setup voltooid");
}

void initializeDefaultConfig() {
  // Sensor 1 (Vijver Water) - Default config
  config.sensors[0].display_name = "Vijver Water Temperatuur";
  config.sensors[0].temperature_offset = 0.0;
  config.sensors[0].temperature_scale = 1.0;
  config.sensors[0].enabled = true;
  config.sensors[0].min_valid_temp = 0.0;
  config.sensors[0].max_valid_temp = 50.0;
  config.sensors[0].smoothing_samples = 5;
  config.sensors[0].outlier_threshold = 2.0;
  
  // Sensor 2 (Filter Inlaat) - Default config with calibration
  config.sensors[1].display_name = "Filter Inlaat Temperatuur";
  config.sensors[1].temperature_offset = 4.0;  // Calibrate to match sensor 1
  config.sensors[1].temperature_scale = 1.0;
  config.sensors[1].enabled = true;
  config.sensors[1].min_valid_temp = 0.0;
  config.sensors[1].max_valid_temp = 50.0;
  config.sensors[1].smoothing_samples = 8;  // More smoothing for unstable sensor
  config.sensors[1].outlier_threshold = 3.0;  // Higher threshold for this sensor
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check for restart request
  if (config.restart_requested && !restartInProgress) {
    Serial.println("🔄 Herstart aangevraagd...");
    restartInProgress = true;
    delay(2000);
    ESP.restart();
  }
  
  // Take measurements at regular intervals
  if (currentTime - lastMeasurementTime >= config.measurement_interval * 1000) {
    takeImprovedMeasurement();
    lastMeasurementTime = currentTime;
  }
  
  // Send ping to server
  if (currentTime - lastPingTime >= PING_INTERVAL) {
    sendPingToServer();
    lastPingTime = currentTime;
  }
  
  // Check for configuration updates
  if (currentTime - lastConfigCheckTime >= CONFIG_CHECK_INTERVAL) {
    loadRemoteConfig();
    lastConfigCheckTime = currentTime;
  }
  
  // Small delay to prevent watchdog issues
  delay(1000);
}

void takeImprovedMeasurement() {
  Serial.println("🌡️  Verbeterde temperatuurmeting start...");
  
  // Read temperatures from both sensors with multiple samples
  float temp1 = readTemperatureWithSmoothing(tempSensor1, 1);
  float temp2 = readTemperatureWithSmoothing(tempSensor2, 2);
  
  // Process first sensor (Vijver Water)
  if (temp1 != DEVICE_DISCONNECTED_C && config.sensors[0].enabled) {
    float calibratedTemp1 = applyCalibration(temp1, 0);
    
    if (isValidTemperature(calibratedTemp1, 0)) {
      if (config.debug_mode) {
        Serial.println("🌡️  Sensor 1 (" + config.sensors[0].display_name + ") - Raw: " + String(temp1, 2) + "°C");
        Serial.println("🌡️  Sensor 1 (" + config.sensors[0].display_name + ") - Gecalibreerd: " + String(calibratedTemp1, 2) + "°C");
      } else {
        Serial.println("🌡️  " + config.sensors[0].display_name + ": " + String(calibratedTemp1, 2) + "°C");
      }
      
      // Send data to Supabase for sensor 1
      sendDataToSupabase(calibratedTemp1, "vijver_water");
      
      // Temperature interpretation for koi
      interpretTemperature(calibratedTemp1, config.sensors[0].display_name);
    } else {
      Serial.println("❌ Sensor 1 - Ongeldige temperatuur: " + String(calibratedTemp1, 2) + "°C");
    }
  } else if (temp1 == DEVICE_DISCONNECTED_C) {
    Serial.println("❌ Sensor 1 (" + config.sensors[0].display_name + ") fout!");
  } else if (!config.sensors[0].enabled) {
    Serial.println("⏸️  Sensor 1 (" + config.sensors[0].display_name + ") uitgeschakeld");
  }
  
  // Process second sensor (Filter Inlaat)
  if (temp2 != DEVICE_DISCONNECTED_C && config.sensors[1].enabled) {
    float calibratedTemp2 = applyCalibration(temp2, 1);
    
    if (isValidTemperature(calibratedTemp2, 1)) {
      if (config.debug_mode) {
        Serial.println("🌡️  Sensor 2 (" + config.sensors[1].display_name + ") - Raw: " + String(temp2, 2) + "°C");
        Serial.println("🌡️  Sensor 2 (" + config.sensors[1].display_name + ") - Gecalibreerd: " + String(calibratedTemp2, 2) + "°C");
      } else {
        Serial.println("🌡️  " + config.sensors[1].display_name + ": " + String(calibratedTemp2, 2) + "°C");
      }
      
      // Send data to Supabase for sensor 2
      sendDataToSupabase(calibratedTemp2, "filter_inlaat");
      
      // Temperature interpretation for koi
      interpretTemperature(calibratedTemp2, config.sensors[1].display_name);
    } else {
      Serial.println("❌ Sensor 2 - Ongeldige temperatuur: " + String(calibratedTemp2, 2) + "°C");
    }
  } else if (temp2 == DEVICE_DISCONNECTED_C) {
    Serial.println("❌ Sensor 2 (" + config.sensors[1].display_name + ") fout!");
  } else if (!config.sensors[1].enabled) {
    Serial.println("⏸️  Sensor 2 (" + config.sensors[1].display_name + ") uitgeschakeld");
  }
  
  Serial.println("-------------------");
}

float readTemperatureWithSmoothing(DallasTemperature& sensor, int sensorIndex) {
  // Request temperature conversion
  sensor.requestTemperatures();
  
  // Take multiple readings for smoothing
  float readings[5];
  int validReadings = 0;
  
  for (int i = 0; i < 5; i++) {
    float temp = sensor.getTempCByIndex(0);
    if (temp != DEVICE_DISCONNECTED_C) {
      readings[validReadings] = temp;
      validReadings++;
    }
    delay(100); // Small delay between readings
  }
  
  if (validReadings == 0) {
    return DEVICE_DISCONNECTED_C;
  }
  
  // Calculate average of valid readings
  float sum = 0;
  for (int i = 0; i < validReadings; i++) {
    sum += readings[i];
  }
  float average = sum / validReadings;
  
  // Apply smoothing using history
  return applySmoothing(average, sensorIndex);
}

float applySmoothing(float newTemp, int sensorIndex) {
  float* history = (sensorIndex == 1) ? tempHistory1 : tempHistory2;
  int* index = (sensorIndex == 1) ? &historyIndex1 : &historyIndex2;
  int* count = (sensorIndex == 1) ? &historyCount1 : &historyCount2;
  int samples = config.sensors[sensorIndex - 1].smoothing_samples;
  
  // Add new reading to history
  history[*index] = newTemp;
  *index = (*index + 1) % 10;
  if (*count < 10) (*count)++;
  
  // Calculate smoothed average
  float sum = 0;
  int validSamples = min(*count, samples);
  for (int i = 0; i < validSamples; i++) {
    sum += history[i];
  }
  
  return sum / validSamples;
}

float applyCalibration(float rawTemp, int sensorIndex) {
  SensorConfig& sensor = config.sensors[sensorIndex];
  return (rawTemp + sensor.temperature_offset) * sensor.temperature_scale;
}

bool isValidTemperature(float temp, int sensorIndex) {
  SensorConfig& sensor = config.sensors[sensorIndex];
  
  // Check if temperature is within valid range
  if (temp < sensor.min_valid_temp || temp > sensor.max_valid_temp) {
    return false;
  }
  
  // Check for outliers using history
  float* history = (sensorIndex == 0) ? tempHistory1 : tempHistory2;
  int count = (sensorIndex == 0) ? historyCount1 : historyCount2;
  
  if (count > 1) {
    float avg = 0;
    for (int i = 0; i < count; i++) {
      avg += history[i];
    }
    avg /= count;
    
    if (abs(temp - avg) > sensor.outlier_threshold) {
      return false;
    }
  }
  
  return true;
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
  // WiFi connection code (same as before)
  WiFi.begin(config.wifi_ssid.c_str(), config.wifi_password.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    attempts++;
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✅ WiFi verbonden: " + WiFi.localIP().toString());
  } else {
    Serial.println("❌ WiFi verbinding mislukt");
  }
}

void loadRemoteConfig() {
  // Remote configuration loading code (same as before)
  // This would load the improved sensor configurations from the database
}

void sendDataToSupabase(float temperature, String sensorType) {
  // Data sending code (same as before)
  // This would send the improved temperature data to Supabase
}

void sendPingToServer() {
  // Ping code (same as before)
}


