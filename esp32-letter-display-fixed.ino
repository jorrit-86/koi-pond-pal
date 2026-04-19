#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>   // gebruik SH1106-driver

// ---------- WiFi ----------
const char* ssid = "Aruba AP22";
const char* password = "Rhodoniet9";

// ---------- Supabase REST API ----------
const char* apiURL =
  "https://pbpuvumeshaeplbwbwzv.supabase.co/rest/v1/esp32_config_test?"
  "select=display_letter,update_interval&order=updated_at.desc&limit=1";

const char* apiKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
  "InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMs"
  "ImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4";

const char* bearerToken =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJl"
  "ZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2"
  "MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4";

// ---------- OLED ----------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define SDA_PIN 25
#define SCL_PIN 26
#define OLED_ADDR 0x3C

Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire);

// ---------- Variabelen ----------
String currentLetter = "A";  // Start met "A" in plaats van "?"
int updateInterval = 5;             // seconden (verkort voor snellere testing)
unsigned long lastUpdateTime = 0;   // millis van laatste update
bool configLoaded = false;           // Track of config succesvol is geladen

// ---------- Setup ----------
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Letter Display (Supabase REST · SH1106) ===");

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);  // snellere I²C (optioneel)

  if (!display.begin(OLED_ADDR, true)) {  // true = interne reset
    Serial.println("Display niet gevonden!");
    while (true);
  }

  display.clearDisplay();
  display.setRotation(0);
  display.display();

  Serial.print("Verbinden met WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi verbonden!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi niet verbonden!");
  }

  // Probeer config te laden, maar behoud "A" als fallback
  fetchConfig();
  lastUpdateTime = millis();
}

// ---------- Hoofdlus ----------
void loop() {
  unsigned long now = millis();
  int remaining = updateInterval - ((now - lastUpdateTime) / 1000);
  if (remaining < 0) remaining = 0;

  display.clearDisplay();

  // Grote letter centraal
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(5);
  display.setCursor(40, 8);
  display.print(currentLetter);

  // Status indicator
  display.setTextSize(1);
  display.setCursor(8, 54);
  if (configLoaded) {
    display.print("Next update in: ");
    display.print(remaining);
    display.print("s");
  } else {
    display.print("Loading config...");
  }
  display.display();

  if (now - lastUpdateTime >= (updateInterval * 1000UL)) {
    fetchConfig();
    lastUpdateTime = millis();
  }

  delay(500);
}

// ---------- Config ophalen ----------
void fetchConfig() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Geen WiFi, overslaan...");
    return;
  }

  Serial.println("\n=== Fetching config ===");
  Serial.println("URL: " + String(apiURL));
  
  HTTPClient http;
  http.begin(apiURL);
  http.addHeader("apikey", apiKey);
  http.addHeader("Authorization", bearerToken);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.GET();
  Serial.println("HTTP Code: " + String(httpCode));
  
  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println("Raw Response: " + payload);
    Serial.println("Response length: " + String(payload.length()));

    DynamicJsonDocument doc(512);
    DeserializationError err = deserializeJson(doc, payload);
    if (err) {
      Serial.println("JSON parse error: " + String(err.c_str()));
      Serial.println("Behoud huidige letter: " + currentLetter);
    } else {
      Serial.println("JSON parsed successfully");
      Serial.println("Array size: " + String(doc.size()));
      
      if (doc.size() > 0) {
        // Debug: print all fields
        JsonObject obj = doc[0];
        Serial.println("Fields in response:");
        for (JsonPair pair : obj) {
          Serial.println("  " + String(pair.key().c_str()) + ": " + String(pair.value().as<String>()));
        }
        
        // Alleen updaten als we geldige data krijgen
        String newLetter = doc[0]["display_letter"];
        int newInterval = doc[0]["update_interval"];
        
        Serial.println("New letter from API: '" + newLetter + "'");
        Serial.println("New interval from API: " + String(newInterval));
        
        if (newLetter.length() == 1) {
          currentLetter = newLetter;
          Serial.println("Letter updated to: " + currentLetter);
        } else {
          Serial.println("Invalid letter received, keeping: " + currentLetter);
        }
        
        if (newInterval > 0) {
          updateInterval = newInterval;
          Serial.println("Interval updated to: " + String(updateInterval) + "s");
        }
        
        configLoaded = true;
        Serial.println("Config loaded successfully!");
      } else {
        Serial.println("Geen records gevonden in de database.");
        Serial.println("Behoud huidige letter: " + currentLetter);
      }
    }
  } else {
    Serial.println("HTTP fout: " + String(httpCode));
    Serial.println("Behoud huidige letter: " + currentLetter);
  }

  http.end();
  Serial.println("=== End fetch config ===\n");
}
