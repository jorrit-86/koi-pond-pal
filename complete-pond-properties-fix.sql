-- Complete fix for pond properties saving issue
-- Run this in your Supabase SQL Editor

-- First, ensure all required columns exist
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS pond_size_liters INTEGER,
ADD COLUMN IF NOT EXISTS pond_depth_cm INTEGER,
ADD COLUMN IF NOT EXISTS pond_type TEXT DEFAULT 'outdoor',
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS climate_zone TEXT DEFAULT 'temperate',
ADD COLUMN IF NOT EXISTS maintenance_frequency TEXT DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS seasonal_awareness BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_recommendations BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'beginner',
ADD COLUMN IF NOT EXISTS koi_count INTEGER,
ADD COLUMN IF NOT EXISTS preferred_chemicals TEXT[];

-- Drop existing constraints and recreate them with all options
ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_maintenance_frequency_check;

ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_pond_type_check;

ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_climate_zone_check;

ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_experience_level_check;

-- Add new constraints with all valid options
ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_maintenance_frequency_check 
CHECK (maintenance_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'seasonal'));

ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_pond_type_check 
CHECK (pond_type IN ('outdoor', 'indoor', 'greenhouse', 'pondless'));

ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_climate_zone_check 
CHECK (climate_zone IN ('temperate', 'continental', 'mediterranean', 'tropical', 'arctic'));

ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_experience_level_check 
CHECK (experience_level IN ('beginner', 'intermediate', 'expert'));

-- Ensure RLS is enabled
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate them
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

-- Add comments for documentation
COMMENT ON COLUMN public.user_preferences.pond_size_liters IS 'Pond size in liters';
COMMENT ON COLUMN public.user_preferences.pond_depth_cm IS 'Pond depth in centimeters';
COMMENT ON COLUMN public.user_preferences.pond_type IS 'Type of pond: outdoor, indoor, greenhouse, or pondless';
COMMENT ON COLUMN public.user_preferences.location IS 'Geographic location (city/region) for seasonal adjustments';
COMMENT ON COLUMN public.user_preferences.climate_zone IS 'Climate zone for seasonal recommendations';
COMMENT ON COLUMN public.user_preferences.maintenance_frequency IS 'How often maintenance is performed';
COMMENT ON COLUMN public.user_preferences.seasonal_awareness IS 'Whether user is aware of seasonal changes';
COMMENT ON COLUMN public.user_preferences.auto_recommendations IS 'Whether to show automatic recommendations';
COMMENT ON COLUMN public.user_preferences.experience_level IS 'User experience level with koi keeping';
COMMENT ON COLUMN public.user_preferences.koi_count IS 'Number of koi in pond';
COMMENT ON COLUMN public.user_preferences.preferred_chemicals IS 'Array of preferred chemical treatments';

-- Test the setup with a dummy insert (will be rolled back)
BEGIN;
INSERT INTO public.user_preferences (
    user_id,
    pond_size_liters,
    pond_depth_cm,
    pond_type,
    location,
    climate_zone,
    maintenance_frequency,
    seasonal_awareness,
    auto_recommendations,
    experience_level,
    koi_count,
    preferred_chemicals
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- dummy UUID
    5000,
    120,
    'outdoor',
    'Test Location',
    'temperate',
    'weekly',
    true,
    true,
    'beginner',
    5,
    ARRAY['baking_soda', 'vinegar']
);
ROLLBACK;

-- Verify final table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Pond properties fix completed successfully' as status;
