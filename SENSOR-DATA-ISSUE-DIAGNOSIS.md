# Sensor Data Issue - Diagnose en Oplossing

## 🔍 Probleem Geïdentificeerd

Er komt geen data meer binnen van de sensor omdat er een **sensor ID mismatch** is tussen de ESP32 code en de database configuratie.

## 📋 Analyse Resultaten

### 1. ESP32 Code Versies
Er zijn meerdere ESP32 code versies met verschillende sensor IDs:

- **esp32-sensor-code-final.ino**: `KOIoT-A1b2C3` (oude ID)
- **esp32-sensor-code-remote-config.ino**: `KOIoT-A1b2C3` (oude ID)
- **esp32-sensor-KOIoT-001122.ino**: `KOIoT-001122-01`, `KOIoT-001122-02` (nieuwe structuur)
- **esp32-koiot-tuya-integrated.ino**: `KOIoT-001122-01`, `KOIoT-001122-02` (nieuwe structuur)

### 2. Database Configuratie
De database is geüpdatet naar de nieuwe ID structuur maar de ESP32 gebruikt waarschijnlijk nog de oude code.

### 3. Edge Function Validatie
De `sensor-data` Edge Function valideert sensor IDs en verwacht dat ze geregistreerd zijn in de `user_sensors` tabel.

## 🛠️ Oplossing

### Stap 1: Database Fix
Voer het SQL script `fix-sensor-id-mismatch.sql` uit om:
- De oude sensor ID (`KOIoT-A1b2C3`) toe te voegen aan `user_sensors`
- De nieuwe sensor IDs (`KOIoT-001122-01`, `KOIoT-001122-02`) toe te voegen
- Test data insertie te controleren

### Stap 2: ESP32 Code Update
Kies een van deze opties:

#### Optie A: Gebruik nieuwe code (Aanbevolen)
- Upload `esp32-sensor-KOIoT-001122.ino` naar de ESP32
- Deze code gebruikt de nieuwe ID structuur met individuele sensor IDs
- Ondersteunt remote configuratie

#### Optie B: Update oude code
- Update `esp32-sensor-code-final.ino` om de nieuwe sensor IDs te gebruiken
- Verander `SENSOR_ID` naar `KOIoT-001122-01` en `KOIoT-001122-02`

### Stap 3: Verificatie
1. Controleer of de ESP32 verbinding maakt met WiFi
2. Controleer of data wordt verzonden naar Supabase
3. Controleer de database voor nieuwe sensor data

## 🔧 Technische Details

### Sensor ID Structuur
- **Oude structuur**: `KOIoT-A1b2C3` (12 karakters)
- **Nieuwe structuur**: `KOIoT-001122-01`, `KOIoT-001122-02` (15 karakters)

### Edge Function Validatie
```typescript
// Valideert beide formaten
if (!sensor_id.startsWith('KOIoT-') || (sensor_id.length !== 12 && sensor_id.length !== 15)) {
  return error('Invalid sensor_id format')
}
```

### Database Schema
```sql
-- user_sensors tabel moet de sensor ID bevatten
INSERT INTO user_sensors (sensor_id, user_id, status) VALUES 
('KOIoT-A1b2C3', 'user-id', 'active'),
('KOIoT-001122-01', 'user-id', 'active'),
('KOIoT-001122-02', 'user-id', 'active');
```

## 📊 Monitoring

Na de fix, controleer:
1. **Recent data**: `check-recent-data.sql`
2. **Sensor status**: `check-sensor-status.sql`
3. **Database health**: `diagnose-sensor-data-issue.sql`

## 🚨 Belangrijke Opmerkingen

1. **User ID**: Vervang `8fcdc486-4958-4c5a-9c4b-40c005a919ca` met je echte Supabase user ID
2. **WiFi**: Controleer of de ESP32 nog verbinding heeft met WiFi
3. **Power**: Controleer of de ESP32 nog stroom heeft
4. **Sensors**: Controleer of de temperatuur sensoren nog werken

## 📝 Volgende Stappen

1. Voer `fix-sensor-id-mismatch.sql` uit in Supabase SQL Editor
2. Update de ESP32 code naar de nieuwste versie
3. Monitor de sensor data voor 24 uur
4. Controleer of alle functionaliteiten werken
