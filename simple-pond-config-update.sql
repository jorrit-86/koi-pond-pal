-- Simple Pond Configuration Update
-- Run this in your Supabase SQL Editor step by step

-- Step 1: Add basic columns first
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS filtration_type TEXT DEFAULT 'mechanical_biological',
ADD COLUMN IF NOT EXISTS uv_sterilizer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS protein_skimmer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waterfall BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fountain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS aeration_system BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS heater BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chiller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_feeder BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS water_source TEXT DEFAULT 'tap_water',
ADD COLUMN IF NOT EXISTS water_changes_manual BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS plants_present BOOLEAN DEFAULT FALSE;

-- Step 2: Add array columns
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS filter_media TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS plant_types TEXT[] DEFAULT '{}';

-- Step 3: Add constraints
ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_filtration_type_check;

ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_filtration_type_check 
CHECK (filtration_type IN ('mechanical_biological', 'mechanical_only', 'biological_only', 'natural', 'none'));

ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_water_source_check;

ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_water_source_check 
CHECK (water_source IN ('tap_water', 'well_water', 'rain_water', 'ro_water', 'mixed'));

-- Step 4: Verify columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name IN ('filtration_type', 'filter_media', 'uv_sterilizer', 'protein_skimmer', 'waterfall', 'fountain', 'aeration_system', 'heater', 'chiller', 'auto_feeder', 'water_source', 'water_changes_manual', 'plants_present', 'plant_types')
ORDER BY column_name;

SELECT 'Pond configuration columns added successfully' as status;
