-- Controleer of alle benodigde tabellen bestaan
-- Run this in your Supabase SQL Editor

-- 1. Controleer of individual_sensor_configs tabel bestaat
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'individual_sensor_configs'
    ) 
    THEN '✅ individual_sensor_configs tabel bestaat'
    ELSE '❌ individual_sensor_configs tabel bestaat NIET'
  END as tabel_status;

-- 2. Controleer of sensor_configurations tabel bestaat
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'sensor_configurations'
    ) 
    THEN '✅ sensor_configurations tabel bestaat'
    ELSE '❌ sensor_configurations tabel bestaat NIET'
  END as tabel_status;

-- 3. Als de tabellen niet bestaan, maak ze aan
-- (Voer dit alleen uit als de bovenstaande queries ❌ tonen)

-- Maak individual_sensor_configs tabel aan
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

-- Maak sensor_configurations tabel aan
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

-- 4. Voeg test data toe
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
) ON CONFLICT (sensor_id, sensor_type) DO NOTHING;

-- 5. Controleer de data
SELECT * FROM public.individual_sensor_configs WHERE sensor_id = 'KOIoT-A1b2C3';
