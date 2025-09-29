-- Fix dashboard sensor selection issue
-- Run this in your Supabase SQL Editor

-- First, check if the dashboard_sensor_selection column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'dashboard_sensor_selection';

-- If the column doesn't exist, add it
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS dashboard_sensor_selection TEXT DEFAULT 'sensor_1';

-- Update existing users to have the default setting
UPDATE public.user_preferences 
SET dashboard_sensor_selection = 'sensor_1' 
WHERE dashboard_sensor_selection IS NULL;

-- Check if RLS policies exist for user_preferences
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_preferences' 
AND schemaname = 'public';

-- Ensure RLS is enabled
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they work correctly
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" ON public.user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Test the setup by checking if we can query the table
SELECT COUNT(*) as total_preferences FROM public.user_preferences;

-- Show the final table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
ORDER BY ordinal_position;

