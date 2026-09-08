-- Fix RLS for sensor_configurations so authenticated users can add/link sensors
-- Run this in the Supabase SQL Editor

-- Drop conflicting / outdated policies
DROP POLICY IF EXISTS "Allow anonymous sensor configuration access" ON public.sensor_configurations;
DROP POLICY IF EXISTS "Users can view own sensor configurations" ON public.sensor_configurations;
DROP POLICY IF EXISTS "Users can insert own sensor configurations" ON public.sensor_configurations;
DROP POLICY IF EXISTS "Users can update own sensor configurations" ON public.sensor_configurations;
DROP POLICY IF EXISTS "Users can delete own sensor configurations" ON public.sensor_configurations;
DROP POLICY IF EXISTS "ESP32 can read sensor configurations" ON public.sensor_configurations;
DROP POLICY IF EXISTS "Users can claim unassigned sensor configurations" ON public.sensor_configurations;

ALTER TABLE public.sensor_configurations ENABLE ROW LEVEL SECURITY;

-- Authenticated users: see own configs + unassigned (user_id IS NULL)
CREATE POLICY "Users can view own sensor configurations"
  ON public.sensor_configurations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Authenticated users: create configs for themselves
CREATE POLICY "Users can insert own sensor configurations"
  ON public.sensor_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users: update own configs, or claim unassigned ones
CREATE POLICY "Users can update own or unassigned sensor configurations"
  ON public.sensor_configurations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users: delete own configs
CREATE POLICY "Users can delete own sensor configurations"
  ON public.sensor_configurations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Anon (ESP32 edge calls with anon key): read + update config flags
CREATE POLICY "ESP32 can read sensor configurations"
  ON public.sensor_configurations
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "ESP32 can update sensor configurations"
  ON public.sensor_configurations
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Optional: verify policies
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'sensor_configurations'
ORDER BY policyname;
