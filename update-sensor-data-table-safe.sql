-- Safe update for sensor_data table
-- Run this in your Supabase SQL Editor

-- Drop existing policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Allow public sensor data insertion" ON public.sensor_data;
DROP POLICY IF EXISTS "Allow authenticated users to read sensor data" ON public.sensor_data;
DROP POLICY IF EXISTS "Allow users to read their own sensor data" ON public.sensor_data;

-- Drop the timestamp column if it exists
ALTER TABLE public.sensor_data DROP COLUMN IF EXISTS timestamp;

-- Add new columns (ignore errors if they already exist)
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS measurement_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.sensor_data ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Create new policies
CREATE POLICY "Allow anonymous sensor data insertion" ON public.sensor_data
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to read their own sensor data" ON public.sensor_data
  FOR SELECT USING (auth.uid() = user_id);

-- Update existing records to have measurement_time
UPDATE public.sensor_data 
SET measurement_time = created_at 
WHERE measurement_time IS NULL;
