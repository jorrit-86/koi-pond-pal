-- Update sensor names to Sensor 1, Sensor 2 etc.
-- Run this in your Supabase SQL Editor

-- 1. Update individual_sensor_configs met nieuwe namen
UPDATE public.individual_sensor_configs 
SET display_name = 'Sensor 1 - Vijver Water'
WHERE sensor_id = 'KOIoT-A1b2C3' AND sensor_type = 'vijver_water';

UPDATE public.individual_sensor_configs 
SET display_name = 'Sensor 2 - Filter Inlaat'
WHERE sensor_id = 'KOIoT-A1b2C3' AND sensor_type = 'filter_inlaat';

-- 2. Update sensor_configurations met nieuwe naam
UPDATE public.sensor_configurations 
SET sensor_name = 'Sensor 1 - Vijver Water'
WHERE sensor_id = 'KOIoT-A1b2C3';

-- 3. Controleer de updates
SELECT 
  'individual_sensor_configs' as tabel,
  sensor_type,
  display_name
FROM public.individual_sensor_configs 
WHERE sensor_id = 'KOIoT-A1b2C3'
UNION ALL
SELECT 
  'sensor_configurations' as tabel,
  'main' as sensor_type,
  sensor_name as display_name
FROM public.sensor_configurations 
WHERE sensor_id = 'KOIoT-A1b2C3';
