-- Fix sensor ID mismatch tussen ESP32 code en database
-- Het probleem: ESP32 gebruikt KOIoT-A1b2C3 maar database verwacht nieuwe structuur

-- 1. Controleer huidige sensor registraties
SELECT 
  'Current Sensor Registrations' as check_type,
  sensor_id,
  user_id,
  status,
  created_at
FROM public.user_sensors
ORDER BY created_at DESC;

-- 2. Controleer welke sensor data er is
SELECT 
  'Current Sensor Data' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record
FROM public.sensor_data
GROUP BY sensor_id
ORDER BY latest_record DESC;

-- 3. Voeg de oude sensor ID toe aan user_sensors (als backup)
INSERT INTO public.user_sensors (
  sensor_id,
  user_id,
  status,
  created_at
) VALUES (
  'KOIoT-A1b2C3',
  '8fcdc486-4958-4c5a-9c4b-40c005a919ca', -- Vervang met je echte user ID
  'active',
  NOW()
) ON CONFLICT (sensor_id) DO UPDATE SET
  status = 'active',
  updated_at = NOW();

-- 4. Voeg ook de nieuwe sensor IDs toe (voor toekomstig gebruik)
INSERT INTO public.user_sensors (
  sensor_id,
  user_id,
  status,
  created_at
) VALUES 
(
  'KOIoT-001122-01',
  '8fcdc486-4958-4c5a-9c4b-40c005a919ca', -- Vervang met je echte user ID
  'active',
  NOW()
),
(
  'KOIoT-001122-02',
  '8fcdc486-4958-4c5a-9c4b-40c005a919ca', -- Vervang met je echte user ID
  'active',
  NOW()
) ON CONFLICT (sensor_id) DO UPDATE SET
  status = 'active',
  updated_at = NOW();

-- 5. Controleer of de registraties zijn toegevoegd
SELECT 
  'Updated Sensor Registrations' as check_type,
  sensor_id,
  user_id,
  status,
  created_at
FROM public.user_sensors
WHERE sensor_id IN ('KOIoT-A1b2C3', 'KOIoT-001122-01', 'KOIoT-001122-02')
ORDER BY sensor_id;

-- 6. Test of sensor data nu kan worden ingevoegd
INSERT INTO public.sensor_data (
  sensor_id,
  temperature,
  user_id,
  status,
  sensor_type
) VALUES (
  'KOIoT-A1b2C3',
  20.5,
  '8fcdc486-4958-4c5a-9c4b-40c005a919ca', -- Vervang met je echte user ID
  'active',
  'temperatuurmeter'
);

-- 7. Controleer of de test insert werkte
SELECT 
  'Test Insert Result' as check_type,
  sensor_id,
  temperature,
  created_at
FROM public.sensor_data
WHERE sensor_id = 'KOIoT-A1b2C3'
ORDER BY created_at DESC
LIMIT 1;
