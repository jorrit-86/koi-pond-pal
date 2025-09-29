-- Sensor Configurations Table
-- Run this in your Supabase SQL Editor

-- Create sensor_configurations table
CREATE TABLE public.sensor_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id TEXT NOT NULL UNIQUE,
  sensor_name TEXT NOT NULL, -- Herkenbare naam voor de sensor (bijv. "Vijver Water", "Filter Inlaat")
  device_id TEXT, -- ESP32 device ID
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Measurement settings
  measurement_interval INTEGER DEFAULT 300, -- seconds (60-3600)
  
  -- WiFi settings
  wifi_ssid TEXT,
  wifi_password TEXT,
  wifi_auto_connect BOOLEAN DEFAULT TRUE,
  
  -- Sensor settings
  temperature_offset DECIMAL DEFAULT 0.0,
  temperature_scale DECIMAL DEFAULT 1.0,
  
  -- Power management
  deep_sleep_enabled BOOLEAN DEFAULT FALSE,
  deep_sleep_duration INTEGER DEFAULT 3600, -- seconds
  
  -- Debug settings
  debug_mode BOOLEAN DEFAULT FALSE,
  log_level TEXT DEFAULT 'info' CHECK (log_level IN ('error', 'warn', 'info', 'debug')),
  
  -- Configuration metadata
  config_version INTEGER DEFAULT 1,
  pending_changes BOOLEAN DEFAULT FALSE,
  last_config_applied TIMESTAMP WITH TIME ZONE,
  restart_requested BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_sensor_configurations_sensor_id ON public.sensor_configurations(sensor_id);
CREATE INDEX idx_sensor_configurations_user_id ON public.sensor_configurations(user_id);
CREATE INDEX idx_sensor_configurations_device_id ON public.sensor_configurations(device_id);
CREATE INDEX idx_sensor_configurations_pending_changes ON public.sensor_configurations(pending_changes);

-- Enable Row Level Security
ALTER TABLE public.sensor_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow anonymous sensor configuration access" ON public.sensor_configurations
  FOR ALL USING (true);

-- Insert default configuration for KOIoT-A1b2C3
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
);
