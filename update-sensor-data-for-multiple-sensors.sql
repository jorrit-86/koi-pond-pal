-- Update sensor_data table to support multiple sensors per device
-- Run this in your Supabase SQL Editor

-- Add sensor_type column to distinguish between different sensors on the same device
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS sensor_type TEXT DEFAULT 'vijver_water';

-- Add sensor_name column for human-readable names
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS sensor_name TEXT;

-- Create index for sensor_type for better performance
CREATE INDEX IF NOT EXISTS idx_sensor_data_sensor_type ON public.sensor_data(sensor_type);

-- Update existing records to have default sensor_type
UPDATE public.sensor_data 
SET sensor_type = 'vijver_water', sensor_name = 'Vijver Water Temperatuur'
WHERE sensor_type IS NULL;

-- Create a view for easier querying of sensor data with names
CREATE OR REPLACE VIEW public.sensor_data_with_names AS
SELECT 
  sd.*,
  sc.sensor_name as configured_sensor_name
FROM public.sensor_data sd
LEFT JOIN public.sensor_configurations sc ON sd.sensor_id = sc.sensor_id;

-- Insert configuration for the second sensor (Filter Inlaat)
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
  'KOIoT-A1b2C3-FILTER',
  'Filter Inlaat Temperatuur',
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
);
