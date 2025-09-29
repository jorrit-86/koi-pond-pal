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

// Enhanced sensor configuration with improved calibration
struct EnhancedSensorConfig {
  String display_name;
  float temperature_offset;
  float temperature_scale;
  bool enabled;
  float min_valid_temp;    // Minimum valid temperature
  float max_valid_temp;    // Maximum valid temperature
  int smoothing_samples;    // Number of samples for smoothing
  float outlier_threshold;  // Threshold for outlier detection
  bool auto_calibration_enabled;
  String reference_sensor_id;
  float calibration_offset;
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
  
  // Enhanced sensor configurations
  EnhancedSensorConfig sensors[2];  // vijver_water, filter_inlaat
};

ESP32Config config;

// Temperature measurement history for advanced smoothing
float tempHistory1[20] = {0};  // Store last 20 readings for sensor 1
float tempHistory2[20] = {0};  // Store last 20 readings for sensor 2
int historyIndex1 = 0;
int historyIndex2 = 0;
int historyCount1 = 0;
int historyCount2 = 0;

// Outlier detection
float lastValidTemp1 = 0;
float lastValidTemp2 = 0;
bool hasValidReading1 = false;
bool hasValidReading2 = false;

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
  Serial.println("🌡️  Verbeterde Temperatuursensor Start - Enhanced Version");
  
  // Initialize temperature sensors with optimal settings
  tempSensor1.begin();
  tempSensor2.begin();
  
  // Set sensor resolution to 12-bit for maximum accuracy
  tempSensor1.setResolution(12);
  tempSensor2.setResolution(12);
  
  // Set conversion time for better stability
  tempSensor1.setWaitForConversion(false);
  tempSensor2.setWaitForConversion(false);
  
  // Initialize enhanced sensor configurations
  initializeEnhancedConfig();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Load remote configuration
  loadRemoteConfig();
  
  Serial.println("✅ Enhanced Setup voltooid");
}

void initializeEnhancedConfig() {
  // Sensor 1 (Vijver Water) - Reference sensor with high accuracy
  config.sensors[0].display_name = "Vijver Water Temperatuur (Referentie)";
  config.sensors[0].temperature_offset = 0.0;
  config.sensors[0].temperature_scale = 1.0;
  config.sensors[0].enabled = true;
  config.sensors[0].min_valid_temp = 0.0;
  config.sensors[0].max_valid_temp = 50.0;
  config.sensors[0].smoothing_samples = 5;
  config.sensors[0].outlier_threshold = 2.0;
  config.sensors[0].auto_calibration_enabled = false;
  config.sensors[0].reference_sensor_id = "";
  config.sensors[0].calibration_offset = 0.0;
  
  // Sensor 2 (Filter Inlaat) - Enhanced calibration to match sensor 1
  config.sensors[1].display_name = "Filter Inlaat Temperatuur (Gecalibreerd)";
  config.sensors[1].temperature_offset = 4.0;  // Calibrate to match sensor 1
  config.sensors[1].temperature_scale = 1.0;
  config.sensors[1].enabled = true;
  config.sensors[1].min_valid_temp = 0.0;
  config.sensors[1].max_valid_temp = 50.0;
  config.sensors[1].smoothing_samples = 8;  // More smoothing for unstable sensor
  config.sensors[1].outlier_threshold = 3.0;  // Higher threshold for this sensor
  config.sensors[1].auto_calibration_enabled = true;
  config.sensors[1].reference_sensor_id = "KOIoT-A1b2C3-vijver_water";
  config.sensors[1].calibration_offset = 4.0;
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
    takeEnhancedMeasurement();
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

void takeEnhancedMeasurement() {
  Serial.println("🌡️  Enhanced temperatuurmeting start...");
  
  // Read temperatures from both sensors with advanced filtering
  float temp1 = readTemperatureWithAdvancedFiltering(tempSensor1, 1);
  float temp2 = readTemperatureWithAdvancedFiltering(tempSensor2, 2);
  
  // Process first sensor (Vijver Water)
  if (temp1 != DEVICE_DISCONNECTED_C && config.sensors[0].enabled) {
    float calibratedTemp1 = applyEnhancedCalibration(temp1, 0);
    
    if (isValidTemperature(calibratedTemp1, 0)) {
      if (config.debug_mode) {
        Serial.println("🌡️  Sensor 1 (" + config.sensors[0].display_name + ") - Raw: " + String(temp1, 2) + "°C");
        Serial.println("🌡️  Sensor 1 (" + config.sensors[0].display_name + ") - Gecalibreerd: " + String(calibratedTemp1, 2) + "°C");
        Serial.println("🌡️  Sensor 1 - Data kwaliteit: " + String(getDataQuality(1), 1) + "%");
      } else {
        Serial.println("🌡️  " + config.sensors[0].display_name + ": " + String(calibratedTemp1, 2) + "°C");
      }
      
      // Send data to Supabase for sensor 1
      sendDataToSupabase(calibratedTemp1, "vijver_water");
      
      // Temperature interpretation for koi
      interpretTemperature(calibratedTemp1, config.sensors[0].display_name);
      
      // Update last valid reading
      lastValidTemp1 = calibratedTemp1;
      hasValidReading1 = true;
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
    float calibratedTemp2 = applyEnhancedCalibration(temp2, 1);
    
    if (isValidTemperature(calibratedTemp2, 1)) {
      if (config.debug_mode) {
        Serial.println("🌡️  Sensor 2 (" + config.sensors[1].display_name + ") - Raw: " + String(temp2, 2) + "°C");
        Serial.println("🌡️  Sensor 2 (" + config.sensors[1].display_name + ") - Gecalibreerd: " + String(calibratedTemp2, 2) + "°C");
        Serial.println("🌡️  Sensor 2 - Data kwaliteit: " + String(getDataQuality(2), 1) + "%");
      } else {
        Serial.println("🌡️  " + config.sensors[1].display_name + ": " + String(calibratedTemp2, 2) + "°C");
      }
      
      // Send data to Supabase for sensor 2
      sendDataToSupabase(calibratedTemp2, "filter_inlaat");
      
      // Temperature interpretation for koi
      interpretTemperature(calibratedTemp2, config.sensors[1].display_name);
      
      // Update last valid reading
      lastValidTemp2 = calibratedTemp2;
      hasValidReading2 = true;
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

float readTemperatureWithAdvancedFiltering(DallasTemperature& sensor, int sensorIndex) {
  // Request temperature conversion
  sensor.requestTemperatures();
  
  // Wait for conversion to complete
  delay(750); // 12-bit resolution takes 750ms
  
  // Take multiple readings for advanced filtering
  float readings[10];
  int validReadings = 0;
  
  for (int i = 0; i < 10; i++) {
    float temp = sensor.getTempCByIndex(0);
    if (temp != DEVICE_DISCONNECTED_C && temp > -50 && temp < 100) {
      readings[validReadings] = temp;
      validReadings++;
    }
    delay(50); // Small delay between readings
  }
  
  if (validReadings == 0) {
    return DEVICE_DISCONNECTED_C;
  }
  
  // Sort readings for median calculation
  for (int i = 0; i < validReadings - 1; i++) {
    for (int j = i + 1; j < validReadings; j++) {
      if (readings[i] > readings[j]) {
        float temp = readings[i];
        readings[i] = readings[j];
        readings[j] = temp;
      }
    }
  }
  
  // Calculate median (more robust than average)
  float median;
  if (validReadings % 2 == 0) {
    median = (readings[validReadings/2 - 1] + readings[validReadings/2]) / 2.0;
  } else {
    median = readings[validReadings/2];
  }
  
  // Apply advanced smoothing using history
  return applyAdvancedSmoothing(median, sensorIndex);
}

float applyAdvancedSmoothing(float newTemp, int sensorIndex) {
  float* history = (sensorIndex == 1) ? tempHistory1 : tempHistory2;
  int* index = (sensorIndex == 1) ? &historyIndex1 : &historyIndex2;
  int* count = (sensorIndex == 1) ? &historyCount1 : &historyCount2;
  int samples = config.sensors[sensorIndex - 1].smoothing_samples;
  
  // Add new reading to history
  history[*index] = newTemp;
  *index = (*index + 1) % 20;
  if (*count < 20) (*count)++;
  
  // Calculate weighted average (recent readings have more weight)
  float sum = 0;
  float weightSum = 0;
  int validSamples = min(*count, samples);
  
  for (int i = 0; i < validSamples; i++) {
    float weight = (float)(validSamples - i) / validSamples; // More weight to recent readings
    sum += history[i] * weight;
    weightSum += weight;
  }
  
  return sum / weightSum;
}

float applyEnhancedCalibration(float rawTemp, int sensorIndex) {
  EnhancedSensorConfig& sensor = config.sensors[sensorIndex];
  
  // Apply basic calibration
  float calibrated = (rawTemp + sensor.temperature_offset) * sensor.temperature_scale;
  
  // Apply auto-calibration if enabled
  if (sensor.auto_calibration_enabled && sensorIndex == 1) { // Only for sensor 2
    // Use sensor 1 as reference for auto-calibration
    if (hasValidReading1) {
      float targetTemp = lastValidTemp1;
      float currentDiff = calibrated - targetTemp;
      
      // Adjust calibration if difference is too large
      if (abs(currentDiff) > 1.0) {
        calibrated = targetTemp + sensor.calibration_offset;
        if (config.debug_mode) {
          Serial.println("🔄 Auto-kalibratie toegepast: " + String(currentDiff, 2) + "°C correctie");
        }
      }
    }
  }
  
  return calibrated;
}

bool isValidTemperature(float temp, int sensorIndex) {
  EnhancedSensorConfig& sensor = config.sensors[sensorIndex];
  
  // Check if temperature is within valid range
  if (temp < sensor.min_valid_temp || temp > sensor.max_valid_temp) {
    return false;
  }
  
  // Check for outliers using history
  float* history = (sensorIndex == 0) ? tempHistory1 : tempHistory2;
  int count = (sensorIndex == 0) ? historyCount1 : historyCount2;
  
  if (count > 1) {
    // Calculate moving average
    float avg = 0;
    for (int i = 0; i < count; i++) {
      avg += history[i];
    }
    avg /= count;
    
    // Check if temperature is within outlier threshold
    if (abs(temp - avg) > sensor.outlier_threshold) {
      return false;
    }
  }
  
  return true;
}

float getDataQuality(int sensorIndex) {
  float* history = (sensorIndex == 1) ? tempHistory1 : tempHistory2;
  int count = (sensorIndex == 1) ? historyCount1 : historyCount2;
  
  if (count < 2) return 0.0;
  
  // Calculate standard deviation as quality indicator
  float avg = 0;
  for (int i = 0; i < count; i++) {
    avg += history[i];
  }
  avg /= count;
  
  float variance = 0;
  for (int i = 0; i < count; i++) {
    variance += pow(history[i] - avg, 2);
  }
  variance /= count;
  
  float stdDev = sqrt(variance);
  
  // Convert to quality percentage (lower std dev = higher quality)
  float quality = max(0, 100 - (stdDev * 10));
  return min(100, quality);
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
  if (config.wifi_ssid.length() == 0 || config.wifi_password.length() == 0) {
    Serial.println("❌ WiFi credentials niet ingesteld");
    return;
  }
  
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
  // Remote configuration loading code
  // This would load the enhanced sensor configurations from the database
}

void sendDataToSupabase(float temperature, String sensorType) {
  // Data sending code
  // This would send the enhanced temperature data to Supabase
}

void sendPingToServer() {
  // Ping code
}


