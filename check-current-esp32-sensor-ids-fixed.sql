-- Controleer of de sensor IDs van de huidige ESP32 code geregistreerd zijn
-- ESP32 code: esp32-koiot-tuya-integrated.ino (meest recent)
-- Device ID: KOIoT-001122
-- Sensor IDs: KOIoT-001122-01, KOIoT-001122-02

-- 1. Controleer device registratie in sensor_configurations
SELECT 
  'Device Registration Check' as check_type,
  sensor_id as device_id,
  user_id,
  sensor_name,
  created_at
FROM public.sensor_configurations
WHERE sensor_id = 'KOIoT-001122';

-- 2. Controleer individuele sensor registraties in user_sensors
SELECT 
  'Individual Sensor Registration Check' as check_type,
  sensor_id,
  user_id,
  status,
  sensor_name,
  created_at
FROM public.user_sensors
WHERE sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02')
ORDER BY sensor_id;

-- 3. Controleer recente data voor deze sensoren
SELECT 
  'Recent Sensor Data Check' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data
WHERE sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY sensor_id
ORDER BY sensor_id;

-- 4. Controleer alle data voor deze sensoren
SELECT 
  'All Sensor Data Check' as check_type,
  sensor_id,
  COUNT(*) as total_records,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data
WHERE sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02')
GROUP BY sensor_id
ORDER BY sensor_id;

-- 5. Controleer individual_sensor_configs tabel
SELECT 
  'Individual Sensor Configs Check' as check_type,
  sensor_id,
  sensor_type,
  display_name,
  enabled,
  created_at
FROM public.individual_sensor_configs
WHERE sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02')
ORDER BY sensor_id;

-- 6. Controleer welke sensor IDs recent data hebben (laatste 7 dagen)
SELECT 
  'All Recent Sensor Data (7 days)' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record
FROM public.sensor_data
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY sensor_id
ORDER BY MAX(created_at) DESC;

-- 7. Controleer of er data is voor de oude sensor ID (KOIoT-A1b2C3)
SELECT 
  'Old Sensor ID Data Check' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record
FROM public.sensor_data
WHERE sensor_id = 'KOIoT-A1b2C3'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY sensor_id;
