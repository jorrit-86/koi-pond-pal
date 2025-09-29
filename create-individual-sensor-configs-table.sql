-- Maak de individual_sensor_configs tabel aan
-- Run this in your Supabase SQL Editor

-- 1. Maak de tabel aan
CREATE TABLE IF NOT EXISTS public.individual_sensor_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id TEXT NOT NULL,
  sensor_type TEXT NOT NULL,
  device_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  temperature_offset DECIMAL DEFAULT 0.0,
  temperature_scale DECIMAL DEFAULT 1.0,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sensor_id, sensor_type)
);

-- 2. Maak indexen voor betere performance
CREATE INDEX IF NOT EXISTS idx_individual_sensor_configs_sensor_id ON public.individual_sensor_configs(sensor_id);
CREATE INDEX IF NOT EXISTS idx_individual_sensor_configs_device_id ON public.individual_sensor_configs(device_id);
CREATE INDEX IF NOT EXISTS idx_individual_sensor_configs_sensor_type ON public.individual_sensor_configs(sensor_type);

-- 3. Enable Row Level Security
ALTER TABLE public.individual_sensor_configs ENABLE ROW LEVEL SECURITY;

-- 4. Maak policies aan
CREATE POLICY "Allow anonymous individual sensor config access" ON public.individual_sensor_configs
  FOR ALL USING (true);

-- 5. Voeg test data toe voor KOIoT-A1b2C3
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
  'KOIoT-A1b2C3',
  'vijver_water',
  'ESP32-001',
  'Vijver Water Temperatuur',
  0.0,
  1.0,
  true
),
(
  'KOIoT-A1b2C3',
  'filter_inlaat',
  'ESP32-001',
  'Filter Inlaat Temperatuur',
  0.0,
  1.0,
  true
) ON CONFLICT (sensor_id, sensor_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  temperature_offset = EXCLUDED.temperature_offset,
  temperature_scale = EXCLUDED.temperature_scale,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- 6. Controleer of de data is toegevoegd
SELECT 
  sensor_id,
  sensor_type,
  display_name,
  temperature_offset,
  temperature_scale,
  enabled
FROM public.individual_sensor_configs 
WHERE sensor_id = 'KOIoT-A1b2C3'
ORDER BY sensor_type;
