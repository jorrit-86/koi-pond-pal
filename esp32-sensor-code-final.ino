#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>

#define TEMP_SENSOR_PIN 14  // GPIO 14

OneWire oneWire(TEMP_SENSOR_PIN);
DallasTemperature tempSensor(&oneWire);

// WiFi credentials
const char* ssid = "Aruba AP22";
const char* password = "Rhodoniet9";

// Supabase Edge Function URLs
const char* supabaseURL = "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/sensor-data";
const char* pingURL = "https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/sensor-ping";

// Unique Sensor ID - Change this for each ESP32
const char* SENSOR_ID = "KOIoT-A1b2C3";

// Ping interval (in milliseconds) - ping every 10 minutes
const unsigned long PING_INTERVAL = 10 * 60 * 1000;
unsigned long lastPingTime = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 Koi Pond Sensor - Supabase Integration");
  Serial.println("=============================================");
  
  // Start temperatuur sensor
  tempSensor.begin();
  
  // Start WiFi
  WiFi.begin(ssid, password);
  Serial.print("Verbinden met WiFi: ");
  Serial.println(ssid);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println();
  Serial.println("✅ WiFi verbonden!");
  Serial.print("IP adres: ");
  Serial.println(WiFi.localIP());
  
  // Test sensor
  int deviceCount = tempSensor.getDeviceCount();
  Serial.println("Gevonden sensoren: " + String(deviceCount));
  
  Serial.println("🎯 Supabase URL: " + String(supabaseURL));
}

void loop() {
  // Lees temperatuur
  tempSensor.requestTemperatures();
  float temperature = tempSensor.getTempCByIndex(0);
  
  if (temperature != DEVICE_DISCONNECTED_C) {
    Serial.println("🌡️  Temperatuur: " + String(temperature, 2) + "°C");
    
    // Verzend data naar Supabase
    sendDataToSupabase(temperature);
    
    // Temperatuur interpretatie voor koi
    if (temperature < 4) {
      Serial.println("⚠️  Te koud voor koi (< 4°C)");
    } else if (temperature > 30) {
      Serial.println("⚠️  Te warm voor koi (> 30°C)");
    } else if (temperature >= 18 && temperature <= 25) {
      Serial.println("✅ Ideale temperatuur voor koi");
    } else {
      Serial.println("⚠️  Acceptabele temperatuur voor koi");
    }
  } else {
    Serial.println("❌ Sensor fout!");
  }
  
  // Check if it's time to send a ping
  if (millis() - lastPingTime >= PING_INTERVAL) {
    sendPingToSupabase();
    lastPingTime = millis();
  }
  
  Serial.println("-------------------");
  delay(300000); // Elke 5 minuten (300 seconden)
}

void sendDataToSupabase(float temperature) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(supabaseURL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4");
    
    // JSON data
    String jsonData = "{\"temperature\":" + String(temperature, 2) + ",\"sensor_id\":\"" + String(SENSOR_ID) + "\"}";
    
    Serial.println("📤 Verzenden naar Supabase...");
    Serial.println("📋 Data: " + jsonData);
    
    int httpResponseCode = http.POST(jsonData);
    
    if (httpResponseCode > 0) {
      Serial.println("✅ Data verzonden naar Supabase - Status: " + String(httpResponseCode));
      String response = http.getString();
      Serial.println("📥 Response: " + response);
    } else {
      Serial.println("❌ Fout bij verzenden data - Status: " + String(httpResponseCode));
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
    
    // JSON data for ping
    String jsonData = "{\"sensor_id\":\"" + String(SENSOR_ID) + "\",\"ping_time\":" + String(millis()) + "}";
    
    Serial.println("🏓 Ping naar Supabase...");
    Serial.println("📋 Ping Data: " + jsonData);
    
    int httpResponseCode = http.POST(jsonData);
    
    if (httpResponseCode > 0) {
      Serial.println("✅ Ping verzonden - Status: " + String(httpResponseCode));
      String response = http.getString();
      Serial.println("📥 Ping Response: " + response);
    } else {
      Serial.println("❌ Fout bij ping - Status: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("❌ WiFi niet verbonden - kan ping niet verzenden");
  }
}
