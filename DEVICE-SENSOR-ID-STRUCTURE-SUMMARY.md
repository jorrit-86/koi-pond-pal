# Device/Sensor ID Structure - Implementatie Samenvatting

## 🎯 Probleem Opgelost
De verwarring tussen device IDs en sensor IDs is opgelost. Het systeem gebruikt nu een duidelijke hiërarchie:

## 📋 Nieuwe ID Structuur

### Device Level
- **Device ID**: `KOIoT-001122` (het ESP32 board)
- **Gebruikt voor**: Configuratie, ping, device management

### Sensor Level  
- **Sensor 1 ID**: `KOIoT-001122-01` (Vijver Water)
- **Sensor 2 ID**: `KOIoT-001122-02` (Filter Inlaat)
- **Gebruikt voor**: Data verzending, individuele sensor configuratie

## 🔧 Wijzigingen Doorgevoerd

### 1. ESP32 Code (`esp32-sensor-KOIoT-001122.ino`)
- ✅ **Device ID**: `KOIoT-001122`
- ✅ **Sensor IDs**: `KOIoT-001122-01`, `KOIoT-001122-02`
- ✅ **Configuratie**: Device ID gebruikt voor configuratie ophalen
- ✅ **Data verzending**: Individuele sensor IDs gebruikt voor data
- ✅ **Ping**: Device ID gebruikt voor status monitoring

### 2. Database Schema (`update-device-sensor-id-structure.sql`)
- ✅ **sensor_configurations**: Device ID als primary identifier
- ✅ **individual_sensor_configs**: Individuele sensor IDs met device referentie
- ✅ **user_sensors**: Individuele sensor registratie
- ✅ **Data entries**: Voor KOIoT-001122 device en sensoren

### 3. Supabase Edge Functions

#### sensor-data/index.ts
- ✅ **Validatie**: Ondersteunt beide ID formaten (12 en 15 karakters)
- ✅ **Sensor type detectie**: Automatisch via ID suffix (-01, -02)
- ✅ **Data opslag**: Met individuele sensor ID

#### esp32-config/index.ts
- ✅ **Configuratie ophalen**: Via device ID
- ✅ **Individuele configs**: Via device_id lookup
- ✅ **Response**: Inclusief individuele sensor IDs

## 🗂️ Database Structuur

### sensor_configurations
```sql
sensor_id: 'KOIoT-001122'     -- Device ID
device_id: 'KOIoT-001122'     -- Same as sensor_id for device config
sensor_name: 'ESP32 Device KOIoT-001122'
```

### individual_sensor_configs
```sql
-- Sensor 1
sensor_id: 'KOIoT-001122-01'  -- Individual sensor ID
device_id: 'KOIoT-001122'     -- Device reference
sensor_type: 'vijver_water'

-- Sensor 2  
sensor_id: 'KOIoT-001122-02'  -- Individual sensor ID
device_id: 'KOIoT-001122'     -- Device reference
sensor_type: 'filter_inlaat'
```

### user_sensors
```sql
-- Sensor 1
sensor_id: 'KOIoT-001122-01'
device_id: 'KOIoT-001122'
sensor_name: 'Vijver Water Temperatuur'

-- Sensor 2
sensor_id: 'KOIoT-001122-02'  
device_id: 'KOIoT-001122'
sensor_name: 'Filter Inlaat Temperatuur'
```

## 🚀 Implementatie Stappen

### 1. Database Update
```bash
# Run in Supabase SQL Editor
psql -f update-device-sensor-id-structure.sql
```

### 2. ESP32 Upload
```bash
# Upload naar ESP32
arduino-cli upload -p /dev/ttyUSB0 esp32-sensor-KOIoT-001122.ino
```

### 3. Verificatie
- ✅ Device registreert met ID: `KOIoT-001122`
- ✅ Sensor 1 verzendt data met ID: `KOIoT-001122-01`
- ✅ Sensor 2 verzendt data met ID: `KOIoT-001122-02`
- ✅ Configuratie wordt opgehaald via device ID
- ✅ Ping gebruikt device ID

## 📊 Data Flow

```
ESP32 Device (KOIoT-001122)
├── Configuratie ophalen → device ID
├── Ping verzenden → device ID  
├── Sensor 1 data → KOIoT-001122-01
└── Sensor 2 data → KOIoT-001122-02
```

## 🔍 Validatie

### ESP32 Serial Output
```
Device ID: KOIoT-001122
Sensor 1 ID: KOIoT-001122-01
Sensor 2 ID: KOIoT-001122-02
```

### Database Queries
```sql
-- Check device config
SELECT * FROM sensor_configurations WHERE sensor_id = 'KOIoT-001122';

-- Check individual sensors
SELECT * FROM individual_sensor_configs WHERE device_id = 'KOIoT-001122';

-- Check sensor data
SELECT * FROM sensor_data WHERE sensor_id LIKE 'KOIoT-001122-%';
```

## ✅ Voordelen van Nieuwe Structuur

1. **Duidelijke hiërarchie**: Device → Sensors
2. **Schaalbaarheid**: Eenvoudig nieuwe sensoren toevoegen
3. **Onderhoudbaarheid**: Logische ID structuur
4. **Flexibiliteit**: Individuele sensor configuratie
5. **Compatibiliteit**: Backward compatible met bestaande systemen

## 🎯 Resultaat

Het systeem gebruikt nu consequent:
- **Device ID** voor device-level operaties
- **Sensor IDs** voor individuele sensor data
- **Hiërarchische structuur** voor betere organisatie
- **Consistente benaming** door het hele systeem
