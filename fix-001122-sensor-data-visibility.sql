-- Ensure KOIoT-001122 can receive + show temperature data
-- Run in Supabase SQL Editor.

-- 0) Inspect recent data (what IDs are actually being written?)
SELECT sensor_id, device_id, sensor_type, temperature, user_id, created_at
FROM public.sensor_data
WHERE sensor_id LIKE 'KOIoT-001122%'
   OR device_id = 'KOIoT-001122'
   OR sensor_id LIKE 'KOIoT-A1b2C3%'
ORDER BY created_at DESC
LIMIT 20;

-- 1) Ensure device + child sensors exist in user_sensors for the device owner
--    Uses the user_id already linked to KOIoT-001122 (device row).
INSERT INTO public.user_sensors (user_id, sensor_id, sensor_name, status)
SELECT
  us.user_id,
  v.sensor_id,
  v.sensor_name,
  'active'
FROM public.user_sensors us
CROSS JOIN (
  VALUES
    ('KOIoT-001122', 'Device KOIoT-001122'),
    ('KOIoT-001122-01', 'Vijver Water Temperatuur'),
    ('KOIoT-001122-02', 'Filter Inlaat Temperatuur')
) AS v(sensor_id, sensor_name)
WHERE us.sensor_id = 'KOIoT-001122'
ON CONFLICT (sensor_id) DO UPDATE
SET
  status = 'active',
  sensor_name = EXCLUDED.sensor_name,
  user_id = COALESCE(public.user_sensors.user_id, EXCLUDED.user_id),
  updated_at = NOW();

-- 2) If only child rows exist, copy user_id up to missing siblings
INSERT INTO public.user_sensors (user_id, sensor_id, sensor_name, status)
SELECT DISTINCT
  us.user_id,
  v.sensor_id,
  v.sensor_name,
  'active'
FROM public.user_sensors us
CROSS JOIN (
  VALUES
    ('KOIoT-001122', 'Device KOIoT-001122'),
    ('KOIoT-001122-01', 'Vijver Water Temperatuur'),
    ('KOIoT-001122-02', 'Filter Inlaat Temperatuur')
) AS v(sensor_id, sensor_name)
WHERE us.sensor_id LIKE 'KOIoT-001122%'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_sensors x WHERE x.sensor_id = v.sensor_id
  );

-- 3) Backfill user_id on recent sensor_data that belongs to this device but has NULL user_id
UPDATE public.sensor_data sd
SET user_id = us.user_id
FROM public.user_sensors us
WHERE us.sensor_id = 'KOIoT-001122'
  AND sd.user_id IS NULL
  AND (sd.sensor_id LIKE 'KOIoT-001122%' OR sd.device_id = 'KOIoT-001122');

-- 4) Verify ownership + latest readings
SELECT 'user_sensors' AS src, sensor_id, sensor_name, status, user_id::text
FROM public.user_sensors
WHERE sensor_id LIKE 'KOIoT-001122%'
UNION ALL
SELECT 'latest_sensor_data', sensor_id, sensor_type, status, user_id::text
FROM (
  SELECT DISTINCT ON (sensor_id)
    sensor_id, sensor_type, status, user_id, created_at
  FROM public.sensor_data
  WHERE sensor_id LIKE 'KOIoT-001122%'
  ORDER BY sensor_id, created_at DESC
) latest
ORDER BY 1, 2;
