-- Stap 1.3: Voeg device configuratie toe
-- Run dit in Supabase SQL Editor

-- Voeg device configuratie toe
INSERT INTO public.sensor_configurations (
  sensor_id,        -- Device ID
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
  pending_changes,
  restart_requested
) VALUES (
  'KOIoT-001122',   -- Device ID
  'ESP32 Device KOIoT-001122',
  'KOIoT-001122',   -- Same as sensor_id for device config
  300,              -- 5 minutes
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
  false,
  false
)
ON CONFLICT (sensor_id) DO UPDATE SET
  sensor_name = EXCLUDED.sensor_name,
  device_id = EXCLUDED.device_id,
  measurement_interval = EXCLUDED.measurement_interval,
  wifi_ssid = EXCLUDED.wifi_ssid,
  wifi_password = EXCLUDED.wifi_password,
  wifi_auto_connect = EXCLUDED.wifi_auto_connect,
  temperature_offset = EXCLUDED.temperature_offset,
  temperature_scale = EXCLUDED.temperature_scale,
  deep_sleep_enabled = EXCLUDED.deep_sleep_enabled,
  deep_sleep_duration = EXCLUDED.deep_sleep_duration,
  debug_mode = EXCLUDED.debug_mode,
  log_level = EXCLUDED.log_level,
  config_version = EXCLUDED.config_version,
  pending_changes = EXCLUDED.pending_changes,
  restart_requested = EXCLUDED.restart_requested,
  updated_at = NOW();

-- Controleer resultaat
SELECT 'Device configuratie:' as info;
SELECT sensor_id, sensor_name, device_id, measurement_interval, debug_mode
FROM public.sensor_configurations 
WHERE sensor_id = 'KOIoT-001122';
