-- Stap-voor-stap database fix
-- Run this in your Supabase SQL Editor

-- Stap 1: Controleer welke tabellen bestaan
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('individual_sensor_configs', 'sensor_configurations')
ORDER BY table_name;

-- Stap 2: Maak individual_sensor_configs tabel aan (als deze niet bestaat)
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

-- Stap 3: Maak sensor_configurations tabel aan (als deze niet bestaat)
CREATE TABLE IF NOT EXISTS public.sensor_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id TEXT NOT NULL UNIQUE,
  sensor_name TEXT NOT NULL,
  device_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  measurement_interval INTEGER DEFAULT 300,
  wifi_ssid TEXT,
  wifi_password TEXT,
  wifi_auto_connect BOOLEAN DEFAULT TRUE,
  temperature_offset DECIMAL DEFAULT 0.0,
  temperature_scale DECIMAL DEFAULT 1.0,
  deep_sleep_enabled BOOLEAN DEFAULT FALSE,
  deep_sleep_duration INTEGER DEFAULT 3600,
  debug_mode BOOLEAN DEFAULT FALSE,
  log_level TEXT DEFAULT 'info' CHECK (log_level IN ('error', 'warn', 'info', 'debug')),
  config_version INTEGER DEFAULT 1,
  pending_changes BOOLEAN DEFAULT FALSE,
  last_config_applied TIMESTAMP WITH TIME ZONE,
  restart_requested BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stap 4: Enable Row Level Security
ALTER TABLE public.individual_sensor_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_configurations ENABLE ROW LEVEL SECURITY;

-- Stap 5: Maak policies aan
DROP POLICY IF EXISTS "Allow anonymous individual sensor config access" ON public.individual_sensor_configs;
CREATE POLICY "Allow anonymous individual sensor config access" ON public.individual_sensor_configs
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow anonymous sensor configuration access" ON public.sensor_configurations;
CREATE POLICY "Allow anonymous sensor configuration access" ON public.sensor_configurations
  FOR ALL USING (true);

-- Stap 6: Voeg test data toe voor individual_sensor_configs
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

-- Stap 7: Voeg test data toe voor sensor_configurations
INSERT INTO public.sensor_configurations (
  sensor_id,
  sensor_name,
  device_id,
  measurement_interval,
  wifi_ssid,
  wifi_password,
  wifi_auto_connect,
  temperature_offset,
  temperature_scale,
  deep_sleep_enabled,
  deep_sleep_duration,
  debug_mode,
  log_level,
  config_version,
  pending_changes
) VALUES (
  'KOIoT-A1b2C3',
  'Vijver Water Temperatuur',
  'ESP32-001',
  300,
  'Aruba AP22',
  'Rhodoniet9',
  true,
  0.0,
  1.0,
  false,
  3600,
  true,
  'info',
  1,
  false
) ON CONFLICT (sensor_id) DO UPDATE SET
  sensor_name = EXCLUDED.sensor_name,
  measurement_interval = EXCLUDED.measurement_interval,
  wifi_ssid = EXCLUDED.wifi_ssid,
  wifi_password = EXCLUDED.wifi_password,
  device_id = EXCLUDED.device_id,
  updated_at = NOW();

-- Stap 8: Controleer de resultaten
SELECT 'individual_sensor_configs' as tabel, COUNT(*) as aantal_records FROM public.individual_sensor_configs
UNION ALL
SELECT 'sensor_configurations' as tabel, COUNT(*) as aantal_records FROM public.sensor_configurations;

-- Stap 9: Toon de data
SELECT 'Individual Sensor Configs:' as info;
SELECT sensor_id, sensor_type, display_name, enabled FROM public.individual_sensor_configs WHERE sensor_id = 'KOIoT-A1b2C3';

SELECT 'Sensor Configurations:' as info;
SELECT sensor_id, sensor_name, device_id FROM public.sensor_configurations WHERE sensor_id = 'KOIoT-A1b2C3';
