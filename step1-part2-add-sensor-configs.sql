-- Stap 1.2: Voeg individuele sensor configuraties toe
-- Run dit in Supabase SQL Editor

-- Voeg nieuwe entries toe voor device KOIoT-001122
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
  'KOIoT-001122-01',  -- Individual sensor ID
  'vijver_water',
  'KOIoT-001122',     -- Device ID
  'Vijver Water Temperatuur',
  0.0,
  1.0,
  true
),
(
  'KOIoT-001122-02',  -- Individual sensor ID
  'filter_inlaat',
  'KOIoT-001122',     -- Device ID
  'Filter Inlaat Temperatuur',
  0.0,
  1.0,
  true
)
ON CONFLICT (sensor_id, sensor_type) DO UPDATE SET
  device_id = EXCLUDED.device_id,
  display_name = EXCLUDED.display_name,
  temperature_offset = EXCLUDED.temperature_offset,
  temperature_scale = EXCLUDED.temperature_scale,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- Controleer resultaat
SELECT 'Toegevoegde sensor configuraties:' as info;
SELECT sensor_id, sensor_type, device_id, display_name, enabled
FROM public.individual_sensor_configs 
WHERE device_id = 'KOIoT-001122'
ORDER BY sensor_type;
