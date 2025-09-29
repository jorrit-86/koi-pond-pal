-- Test script voor individuele sensor configuraties
-- Run this in your Supabase SQL Editor

-- Test 1: Controleer of de tabel bestaat
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'individual_sensor_configs';

-- Test 2: Controleer de structuur van de tabel
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'individual_sensor_configs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 3: Controleer of er data in de tabel staat
SELECT * FROM public.individual_sensor_configs;

-- Test 4: Test insert van nieuwe configuratie
INSERT INTO public.individual_sensor_configs (
  sensor_id,
  sensor_type,
  device_id,
  display_name,
  temperature_offset,
  temperature_scale,
  enabled
) VALUES (
  'KOIoT-A1b2C3',
  'vijver_water',
  'ESP32-001',
  'Test Vijver Water',
  0.5,
  1.0,
  true
) ON CONFLICT (sensor_id, sensor_type) 
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  temperature_offset = EXCLUDED.temperature_offset,
  temperature_scale = EXCLUDED.temperature_scale,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- Test 5: Controleer de update
SELECT * FROM public.individual_sensor_configs WHERE sensor_id = 'KOIoT-A1b2C3';
