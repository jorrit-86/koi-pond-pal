-- Sensor Data Table for ESP32 Integration
-- Run this in your Supabase SQL Editor

-- Create sensor_data table
CREATE TABLE public.sensor_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id TEXT NOT NULL,
  temperature DECIMAL NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_sensor_data_sensor_id ON public.sensor_data(sensor_id);
CREATE INDEX idx_sensor_data_created_at ON public.sensor_data(created_at);

-- Enable Row Level Security
ALTER TABLE public.sensor_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public access for sensor data insertion
CREATE POLICY "Allow public sensor data insertion" ON public.sensor_data
  FOR INSERT WITH CHECK (true);

-- Create policy to allow authenticated users to read sensor data
CREATE POLICY "Allow authenticated users to read sensor data" ON public.sensor_data
  FOR SELECT USING (auth.role() = 'authenticated');
