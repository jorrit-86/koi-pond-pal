-- Individual Sensor Configurations
-- Run this in your Supabase SQL Editor

-- Create individual_sensor_configs table for per-sensor settings
CREATE TABLE public.individual_sensor_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id TEXT NOT NULL, -- Main sensor ID (KOIoT-A1b2C3)
  sensor_type TEXT NOT NULL, -- vijver_water, filter_inlaat, etc.
  device_id TEXT NOT NULL, -- ESP32 device ID
  
  -- Sensor specific settings
  display_name TEXT NOT NULL, -- User-friendly name
  temperature_offset DECIMAL DEFAULT 0.0, -- Individual offset per sensor
  temperature_scale DECIMAL DEFAULT 1.0, -- Individual scale per sensor
  enabled BOOLEAN DEFAULT TRUE, -- Enable/disable individual sensor
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per sensor type per device
  UNIQUE(sensor_id, sensor_type)
);

-- Create indexes
CREATE INDEX idx_individual_sensor_configs_sensor_id ON public.individual_sensor_configs(sensor_id);
CREATE INDEX idx_individual_sensor_configs_device_id ON public.individual_sensor_configs(device_id);
CREATE INDEX idx_individual_sensor_configs_sensor_type ON public.individual_sensor_configs(sensor_type);

-- Enable Row Level Security
ALTER TABLE public.individual_sensor_configs ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow anonymous individual sensor config access" ON public.individual_sensor_configs
  FOR ALL USING (true);

-- Insert default configurations for KOIoT-A1b2C3
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
);

-- Update sensor_data table to reference individual configs
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS individual_config_id UUID REFERENCES public.individual_sensor_configs(id);

-- Create a view for easy querying
CREATE OR REPLACE VIEW public.sensor_data_with_individual_configs AS
SELECT 
  sd.*,
  isc.display_name,
  isc.temperature_offset,
  isc.temperature_scale,
  isc.enabled as sensor_enabled
FROM public.sensor_data sd
LEFT JOIN public.individual_sensor_configs isc ON sd.sensor_id = isc.sensor_id AND sd.sensor_type = isc.sensor_type;
