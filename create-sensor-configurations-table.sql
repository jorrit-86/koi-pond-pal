-- Maak de sensor_configurations tabel aan (als deze nog niet bestaat)
-- Run this in your Supabase SQL Editor

-- 1. Maak de tabel aan
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

-- 2. Maak indexen
CREATE INDEX IF NOT EXISTS idx_sensor_configurations_sensor_id ON public.sensor_configurations(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_configurations_user_id ON public.sensor_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_sensor_configurations_device_id ON public.sensor_configurations(device_id);

-- 3. Enable Row Level Security
ALTER TABLE public.sensor_configurations ENABLE ROW LEVEL SECURITY;

-- 4. Maak policies aan
CREATE POLICY "Allow anonymous sensor configuration access" ON public.sensor_configurations
  FOR ALL USING (true);

-- 5. Voeg default configuratie toe voor KOIoT-A1b2C3
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

-- 6. Controleer de data
SELECT * FROM public.sensor_configurations WHERE sensor_id = 'KOIoT-A1b2C3';
