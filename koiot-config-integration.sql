-- KOIoT Configuration Integration
-- Integreer ESP32 configuratie in bestaande KOIoT functionaliteit
-- Run this in your Supabase SQL Editor

-- Voeg configuratie velden toe aan bestaande sensor_data tabel
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS measurement_interval INTEGER DEFAULT 300;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS wifi_ssid TEXT;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS wifi_password TEXT;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS wifi_auto_connect BOOLEAN DEFAULT TRUE;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS temperature_offset DECIMAL DEFAULT 0.0;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS temperature_scale DECIMAL DEFAULT 1.0;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS deep_sleep_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS deep_sleep_duration INTEGER DEFAULT 3600;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS debug_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS log_level TEXT DEFAULT 'info' CHECK (log_level IN ('error', 'warn', 'info', 'debug'));
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS config_version INTEGER DEFAULT 1;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS pending_changes BOOLEAN DEFAULT FALSE;
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS last_config_applied TIMESTAMP WITH TIME ZONE;

-- Voeg device_id toe voor ESP32 identificatie
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Maak index voor betere performance
CREATE INDEX IF NOT EXISTS idx_sensor_data_device_id ON public.sensor_data(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_pending_changes ON public.sensor_data(pending_changes);

-- Update bestaande sensor data met default configuratie waarden
UPDATE public.sensor_data 
SET 
  measurement_interval = 300,
  wifi_auto_connect = TRUE,
  temperature_offset = 0.0,
  temperature_scale = 1.0,
  deep_sleep_enabled = FALSE,
  deep_sleep_duration = 3600,
  debug_mode = FALSE,
  log_level = 'info',
  config_version = 1,
  pending_changes = FALSE
WHERE measurement_interval IS NULL;

-- Maak een functie voor het verhogen van config_version
CREATE OR REPLACE FUNCTION increment_config_version(sensor_id_param TEXT)
RETURNS INTEGER AS $$
BEGIN
  UPDATE public.sensor_data 
  SET config_version = config_version + 1
  WHERE sensor_id = sensor_id_param;
  
  RETURN (SELECT config_version FROM public.sensor_data WHERE sensor_id = sensor_id_param LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- Voeg comments toe voor documentatie
COMMENT ON COLUMN public.sensor_data.measurement_interval IS 'Time between measurements in seconds (60-3600)';
COMMENT ON COLUMN public.sensor_data.wifi_ssid IS 'WiFi network name for ESP32';
COMMENT ON COLUMN public.sensor_data.wifi_password IS 'WiFi password for ESP32';
COMMENT ON COLUMN public.sensor_data.wifi_auto_connect IS 'Automatically connect to WiFi';
COMMENT ON COLUMN public.sensor_data.temperature_offset IS 'Temperature calibration offset in Celsius';
COMMENT ON COLUMN public.sensor_data.temperature_scale IS 'Temperature calibration scale factor';
COMMENT ON COLUMN public.sensor_data.deep_sleep_enabled IS 'Enable deep sleep for power saving';
COMMENT ON COLUMN public.sensor_data.deep_sleep_duration IS 'Deep sleep duration in seconds';
COMMENT ON COLUMN public.sensor_data.debug_mode IS 'Enable debug mode for detailed logging';
COMMENT ON COLUMN public.sensor_data.log_level IS 'Logging level: error, warn, info, debug';
COMMENT ON COLUMN public.sensor_data.config_version IS 'Configuration version for change tracking';
COMMENT ON COLUMN public.sensor_data.pending_changes IS 'Indicates if device needs to fetch new configuration';
COMMENT ON COLUMN public.sensor_data.last_config_applied IS 'Timestamp when configuration was last applied';
COMMENT ON COLUMN public.sensor_data.device_id IS 'Unique ESP32 device identifier';
