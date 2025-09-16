-- Add missing pond properties columns to user_preferences table
-- Run this in your Supabase SQL Editor

-- Add missing columns to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS pond_depth_cm INTEGER,
ADD COLUMN IF NOT EXISTS pond_type TEXT DEFAULT 'outdoor' CHECK (pond_type IN ('outdoor', 'indoor', 'greenhouse', 'pondless')),
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS climate_zone TEXT DEFAULT 'temperate' CHECK (climate_zone IN ('temperate', 'continental', 'mediterranean', 'tropical', 'arctic'));

-- Update maintenance_frequency to include 'biweekly' and 'seasonal' options
ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_maintenance_frequency_check;

ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_maintenance_frequency_check 
CHECK (maintenance_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'seasonal'));

-- Add comments for documentation
COMMENT ON COLUMN public.user_preferences.pond_depth_cm IS 'Pond depth in centimeters';
COMMENT ON COLUMN public.user_preferences.pond_type IS 'Type of pond: outdoor, indoor, greenhouse, or pondless';
COMMENT ON COLUMN public.user_preferences.location IS 'Geographic location (city/region) for seasonal adjustments';
COMMENT ON COLUMN public.user_preferences.climate_zone IS 'Climate zone for seasonal recommendations';

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test insert to verify everything works
SELECT 'Pond properties columns added successfully' as status;
