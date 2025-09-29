# ESP32 Remote Configuration Implementation Guide

## 🎯 **Overzicht**

Dit document beschrijft hoe je het ESP32 remote configuratie systeem implementeert. Het systeem stelt je in staat om ESP32 devices te configureren via de web interface, inclusief meetinterval en WiFi instellingen.

## 📋 **Wat is geïmplementeerd**

### **✅ Database Schema**
- `esp32_devices` - ESP32 device registratie
- `esp32_configurations` - Device configuratie instellingen
- `esp32_configuration_history` - Audit trail voor configuratie wijzigingen

### **✅ Web Interface**
- ESP32 configuratie pagina in Settings
- Meetinterval aanpassing (60s - 3600s)
- WiFi instellingen (SSID, wachtwoord, auto-connect)
- Sensor kalibratie (offset, schaal)
- Energiebeheer (deep sleep)
- Debug instellingen

### **✅ ESP32 Code**
- Remote configuratie ophalen van Supabase
- Runtime configuratie wijzigingen
- WiFi credentials wijzigen zonder herprogrammeren
- Meetinterval aanpassen zonder herprogrammeren

### **✅ API Endpoints**
- Supabase Edge Function voor configuratie
- Device status updates
- Configuration versioning

---

## 🚀 **Implementatie Stappen**

### **Stap 1: Database Setup**

1. **Voer het database script uit in Supabase:**
   ```sql
   -- Run esp32-config-database.sql in Supabase SQL Editor
   ```

2. **Controleer of de tabellen zijn aangemaakt:**
   - `esp32_devices`
   - `esp32_configurations` 
   - `esp32_configuration_history`

### **Stap 2: Supabase Edge Function**

1. **Deploy de Edge Function:**
   ```bash
   supabase functions deploy esp32-config
   ```

2. **Controleer de function URL:**
   - URL: `https://your-project.supabase.co/functions/v1/esp32-config`

### **Stap 3: Web Interface**

1. **De web interface is al geïmplementeerd:**
   - Ga naar Settings → ESP32 Config
   - Registreer je eerste ESP32 device
   - Configureer meetinterval en WiFi instellingen

### **Stap 4: ESP32 Code**

1. **Upload de nieuwe ESP32 code:**
   - Gebruik `esp32-sensor-code-remote-config.ino`
   - Pas `DEVICE_ID` aan naar een unieke waarde
   - Pas `SENSOR_ID` aan naar je KOIoT sensor ID

2. **Installeer benodigde libraries:**
   ```cpp
   #include <ArduinoJson.h>  // Voor JSON parsing
   ```

---

## ⚙️ **Configuratie Opties**

### **Meetinstellingen**
- **Meetinterval**: 60 seconden tot 3600 seconden (1 uur)
- **Minimum**: 60 seconden (1 minuut)
- **Maximum**: 3600 seconden (1 uur)

### **WiFi Instellingen**
- **SSID**: WiFi netwerk naam
- **Wachtwoord**: WiFi wachtwoord
- **Auto-connect**: Automatisch verbinden

### **Sensor Instellingen**
- **Temperatuur Offset**: Kalibratie offset in °C
- **Temperatuur Schaal**: Kalibratie schaal factor

### **Energiebeheer**
- **Deep Sleep**: Inschakelen voor energiebesparing
- **Deep Sleep Duur**: 60 seconden tot 24 uur

### **Debug Instellingen**
- **Debug Mode**: Uitgebreide logging
- **Log Level**: Error, Warning, Info, Debug

---

## 🔄 **Hoe het werkt**

### **1. Device Registratie**
1. ESP32 start op met default configuratie
2. Device registreert zich in de database
3. Default configuratie wordt aangemaakt

### **2. Configuratie Wijzigingen**
1. Gebruiker wijzigt instellingen via web interface
2. Configuratie wordt opgeslagen in database
3. `pending_changes` wordt op `true` gezet

### **3. Configuratie Ophalen**
1. ESP32 controleert elke 5 minuten voor nieuwe configuratie
2. Als `pending_changes` is `true`, haalt ESP32 nieuwe configuratie op
3. ESP32 past nieuwe instellingen toe
4. ESP32 markeert configuratie als toegepast

### **4. Status Updates**
1. ESP32 stuurt ping elke 10 minuten
2. Device status wordt bijgewerkt naar "online"
3. `last_seen` timestamp wordt bijgewerkt

---

## 📱 **Gebruikersinterface**

### **ESP32 Configuratie Pagina**
- **Device Overzicht**: Alle geregistreerde ESP32 devices
- **Status Indicatoren**: Online/Offline/Pending Changes
- **Configuratie Editor**: Inline editing van alle instellingen
- **Validatie**: Real-time validatie van instellingen

### **Settings Integratie**
- **Navigatie**: Settings → ESP32 Config
- **Submenu**: Geïntegreerd in bestaande settings structuur
- **Responsive**: Werkt op alle schermgroottes

---

## 🔧 **Technische Details**

### **Database Schema**
```sql
-- ESP32 Devices
esp32_devices (
  id, user_id, device_name, device_id, sensor_id,
  status, last_seen, firmware_version, hardware_version
)

-- ESP32 Configurations  
esp32_configurations (
  id, device_id, user_id, measurement_interval,
  wifi_ssid, wifi_password, wifi_auto_connect,
  temperature_offset, temperature_scale,
  deep_sleep_enabled, deep_sleep_duration,
  debug_mode, log_level, config_version,
  pending_changes, last_applied
)
```

### **API Endpoints**
```typescript
// Get Configuration
POST /functions/v1/esp32-config
{
  "device_id": "ESP32-001",
  "action": "get_config"
}

// Mark Applied
POST /functions/v1/esp32-config  
{
  "device_id": "ESP32-001",
  "action": "mark_applied"
}
```

### **ESP32 Configuration Structure**
```cpp
struct ESP32Config {
  int measurement_interval = 300;
  String wifi_ssid = "default";
  String wifi_password = "default";
  float temperature_offset = 0.0;
  float temperature_scale = 1.0;
  bool deep_sleep_enabled = false;
  int deep_sleep_duration = 3600;
  bool debug_mode = false;
  String log_level = "info";
  int config_version = 0;
  bool pending_changes = false;
};
```

---

## 🧪 **Testing**

### **1. Database Test**
```sql
-- Test device registratie
INSERT INTO esp32_devices (user_id, device_name, device_id, sensor_id)
VALUES ('your-user-id', 'Test ESP32', 'ESP32-001', 'KOIoT-TEST');

-- Test configuratie
INSERT INTO esp32_configurations (device_id, user_id, measurement_interval)
VALUES ('ESP32-001', 'your-user-id', 600);
```

### **2. Web Interface Test**
1. Ga naar Settings → ESP32 Config
2. Registreer een test device
3. Wijzig meetinterval van 300 naar 600 seconden
4. Controleer of `pending_changes` wordt `true`

### **3. ESP32 Test**
1. Upload de nieuwe code
2. Open Serial Monitor
3. Controleer of configuratie wordt opgehaald
4. Wijzig instellingen via web interface
5. Controleer of ESP32 nieuwe configuratie ophaalt

---

## 🚨 **Troubleshooting**

### **ESP32 kan geen configuratie ophalen**
- Controleer WiFi verbinding
- Controleer Supabase Edge Function URL
- Controleer device_id in database

### **Configuratie wordt niet toegepast**
- Controleer `pending_changes` status
- Controleer ESP32 configuratie check interval
- Controleer Serial Monitor voor errors

### **Web interface toont geen devices**
- Controleer user_id in database
- Controleer RLS policies
- Controleer browser console voor errors

---

## 🎉 **Resultaat**

Na implementatie heb je:
- ✅ **Remote configuratie** van ESP32 devices
- ✅ **Meetinterval aanpassing** zonder herprogrammeren
- ✅ **WiFi instellingen wijzigen** zonder herprogrammeren
- ✅ **Real-time status monitoring** van ESP32 devices
- ✅ **Audit trail** van alle configuratie wijzigingen
- ✅ **Gebruiksvriendelijke web interface**

**Het systeem is nu volledig operationeel!** 🚀

