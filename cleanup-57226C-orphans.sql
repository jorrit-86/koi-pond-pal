-- Clean up leftover KOIoT-57226C rows and restore KOIoT-001122 safely
-- (handles duplicate (sensor_id, sensor_type) rows)
-- Run in Supabase SQL Editor.

-- 1) Orphaned ownership rows for the deleted device
DELETE FROM public.user_sensors
WHERE sensor_id = 'KOIoT-57226C'
   OR sensor_id LIKE 'KOIoT-57226C-%';

-- 2) Orphaned individual sensor configs for 57226C
DELETE FROM public.individual_sensor_configs
WHERE sensor_id LIKE 'KOIoT-57226C-%'
   OR device_id = 'KOIoT-57226C';

-- 3) Device configuration for 57226C (if still present)
DELETE FROM public.sensor_configurations
WHERE sensor_id = 'KOIoT-57226C';

-- 4) Clear ALL individual configs for 001122 child sensors, then re-insert cleanly
--    (avoids unique constraint conflicts on (sensor_id, sensor_type))
DELETE FROM public.individual_sensor_configs
WHERE sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02')
   OR (device_id = 'KOIoT-001122' AND sensor_id LIKE 'KOIoT-001122-%');

INSERT INTO public.individual_sensor_configs (
  sensor_id,
  sensor_type,
  device_id,
  display_name,
  temperature_offset,
  temperature_scale,
  enabled
) VALUES
(
  'KOIoT-001122-01',
  'vijver_water',
  'KOIoT-001122',
  'Vijver Water Temperatuur',
  0.0,
  1.0,
  true
),
(
  'KOIoT-001122-02',
  'filter_inlaat',
  'KOIoT-001122',
  'Filter Inlaat Temperatuur',
  0.0,
  1.0,
  true
);

-- 5) Restore user_sensors labels for 001122
UPDATE public.user_sensors
SET sensor_name = 'Vijver Water Temperatuur', updated_at = NOW()
WHERE sensor_id = 'KOIoT-001122-01';

UPDATE public.user_sensors
SET sensor_name = 'Filter Inlaat Temperatuur', updated_at = NOW()
WHERE sensor_id = 'KOIoT-001122-02';

UPDATE public.user_sensors
SET sensor_name = 'Device KOIoT-001122', updated_at = NOW()
WHERE sensor_id = 'KOIoT-001122'
  AND (sensor_name IS NULL OR sensor_name ILIKE '%watertemperatuur%' OR sensor_name ILIKE '%omgeving%');

-- 6) Verify — should show only 001122 rows, no 57226C
SELECT 'user_sensors' AS src, sensor_id, sensor_name AS name
FROM public.user_sensors
WHERE sensor_id LIKE 'KOIoT-001122%' OR sensor_id LIKE 'KOIoT-57226C%'
UNION ALL
SELECT 'individual_sensor_configs', sensor_id, display_name
FROM public.individual_sensor_configs
WHERE sensor_id LIKE 'KOIoT-001122%'
   OR sensor_id LIKE 'KOIoT-57226C%'
   OR device_id IN ('KOIoT-001122', 'KOIoT-57226C')
ORDER BY 1, 2;
