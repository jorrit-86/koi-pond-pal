-- Fix sensor_configurations tabel structuur
-- Run this in your Supabase SQL Editor

-- Stap 1: Controleer de huidige structuur van sensor_configurations
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sensor_configurations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Stap 2: Voeg de ontbrekende kolom toe (als deze niet bestaat)
ALTER TABLE public.sensor_configurations 
ADD COLUMN IF NOT EXISTS sensor_name TEXT;

-- Stap 3: Update bestaande records met een default sensor_name
UPDATE public.sensor_configurations 
SET sensor_name = 'Vijver Water Temperatuur'
WHERE sensor_name IS NULL AND sensor_id = 'KOIoT-A1b2C3';

-- Stap 4: Maak de kolom NOT NULL (als je wilt)
-- ALTER TABLE public.sensor_configurations ALTER COLUMN sensor_name SET NOT NULL;

-- Stap 5: Voeg test data toe (met de juiste kolom namen)
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

-- Stap 6: Controleer de resultaten
SELECT sensor_id, sensor_name, device_id, measurement_interval 
FROM public.sensor_configurations 
WHERE sensor_id = 'KOIoT-A1b2C3';
