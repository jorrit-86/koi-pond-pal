-- Simple Database Check and Fix
-- This script checks what's missing and fixes it step by step

-- 1. Check current users table structure
SELECT 'Current users table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
ORDER BY ordinal_position;

-- 2. Add missing columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS two_factor_setup_completed BOOLEAN DEFAULT FALSE;

-- 3. Check if user_preferences table exists
SELECT 'Checking user_preferences table:' as info;
SELECT table_name, table_schema
FROM information_schema.tables 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public';

-- 4. Create user_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dashboard_sensor_selection JSONB DEFAULT '{}',
    pond_size_liters DECIMAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Check if water_changes table exists
SELECT 'Checking water_changes table:' as info;
SELECT table_name, table_schema
FROM information_schema.tables 
WHERE table_name = 'water_changes' 
AND table_schema = 'public';

-- 6. Create water_changes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.water_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    liters_added DECIMAL(10,2) NOT NULL,
    water_type TEXT NOT NULL CHECK (water_type IN ('tap_water', 'well_water', 'rain_water', 'ro_water', 'mixed')),
    reason TEXT NOT NULL CHECK (reason IN ('routine', 'problem', 'emergency', 'seasonal', 'maintenance', 'other')),
    notes TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Enable RLS on tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_changes ENABLE ROW LEVEL SECURITY;

-- 8. Create basic RLS policies
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;

CREATE POLICY "Users can view their own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own data" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- User preferences policies
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;

CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Water changes policies
DROP POLICY IF EXISTS "Users can view their own water changes" ON public.water_changes;
DROP POLICY IF EXISTS "Users can insert their own water changes" ON public.water_changes;
DROP POLICY IF EXISTS "Users can update their own water changes" ON public.water_changes;
DROP POLICY IF EXISTS "Users can delete their own water changes" ON public.water_changes;

CREATE POLICY "Users can view their own water changes" ON public.water_changes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own water changes" ON public.water_changes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own water changes" ON public.water_changes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own water changes" ON public.water_changes
    FOR DELETE USING (auth.uid() = user_id);

-- 9. Test the tables
SELECT 'Testing users table:' as info;
SELECT id, email, full_name, two_factor_setup_completed
FROM public.users 
LIMIT 3;

SELECT 'Testing user_preferences table:' as info;
SELECT user_id, dashboard_sensor_selection, pond_size_liters
FROM public.user_preferences 
LIMIT 3;

SELECT 'Testing water_changes table:' as info;
SELECT user_id, changed_at, liters_added
FROM public.water_changes 
LIMIT 3;
