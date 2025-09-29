-- Update Device/Sensor ID Structure
-- Run this in your Supabase SQL Editor
-- This script updates the system to properly handle device IDs vs sensor IDs

-- Step 1: Update sensor_configurations table to use device_id as primary identifier
-- The sensor_id in this table should represent the device ID (KOIoT-001122)
-- Individual sensors will have their own entries in individual_sensor_configs

-- First, let's check current structure
SELECT 'Current sensor_configurations structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sensor_configurations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Update individual_sensor_configs to use proper sensor IDs
-- Sensor IDs should be: KOIoT-001122-01, KOIoT-001122-02, etc.

-- Add new entries for the new device KOIoT-001122
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

-- Step 3: Add device configuration entry
INSERT INTO public.sensor_configurations (
  sensor_id,        -- This will be the device ID
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
  'KOIoT-001122',   -- Device ID used as sensor_id for main config
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

-- Step 4: Verify the new structure
SELECT 'New device configuration:' as info;
SELECT sensor_id, sensor_name, device_id, measurement_interval, debug_mode
FROM public.sensor_configurations 
WHERE sensor_id = 'KOIoT-001122';

SELECT 'New individual sensor configurations:' as info;
SELECT sensor_id, sensor_type, device_id, display_name, enabled
FROM public.individual_sensor_configs 
WHERE device_id = 'KOIoT-001122'
ORDER BY sensor_type;

-- Step 5: Update user_sensors table if it exists (for sensor registration)
-- This table should link individual sensor IDs to users
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sensors' AND table_schema = 'public') THEN
        -- Add entries for the new individual sensors
        INSERT INTO public.user_sensors (sensor_id, user_id, status, sensor_name, device_id)
        SELECT 
            isc.sensor_id,
            '00000000-0000-0000-0000-000000000000'::uuid,  -- Default user, should be updated
            'active',
            isc.display_name,
            isc.device_id
        FROM public.individual_sensor_configs isc
        WHERE isc.device_id = 'KOIoT-001122'
        ON CONFLICT (sensor_id) DO UPDATE SET
            device_id = EXCLUDED.device_id,
            sensor_name = EXCLUDED.sensor_name,
            updated_at = NOW();
            
        SELECT 'Updated user_sensors table:' as info;
        SELECT sensor_id, device_id, sensor_name, status
        FROM public.user_sensors 
        WHERE device_id = 'KOIoT-001122'
        ORDER BY sensor_id;
    ELSE
        SELECT 'user_sensors table does not exist - skipping user registration' as info;
    END IF;
END $$;

-- Step 6: Summary
SELECT '=== SUMMARY ===' as info;
SELECT 
    'Device ID: KOIoT-001122' as device_info,
    'Sensor 1: KOIoT-001122-01 (Vijver Water)' as sensor1_info,
    'Sensor 2: KOIoT-001122-02 (Filter Inlaat)' as sensor2_info;
