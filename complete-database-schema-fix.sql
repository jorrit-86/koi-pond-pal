-- Complete Database Schema Fix
-- This script fixes all missing columns that cause 406 errors

-- First, let's see what's currently in the users table
SELECT 'Current users table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
ORDER BY ordinal_position;

-- Add all missing columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS two_factor_setup_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS house_number TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Check if the columns were added
SELECT 'After adding columns to users:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
AND column_name IN ('two_factor_setup_completed', 'profile_photo_url', 'street', 'house_number', 'postal_code', 'city', 'country', 'last_login_at')
ORDER BY column_name;

-- Check user_preferences table structure
SELECT 'Current user_preferences table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public' 
ORDER BY ordinal_position;

-- Add missing columns to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS dashboard_sensor_selection JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pond_size_liters INTEGER;

-- Check if the columns were added to user_preferences
SELECT 'After adding columns to user_preferences:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public' 
AND column_name IN ('dashboard_sensor_selection', 'pond_size_liters')
ORDER BY column_name;

-- Check water_changes table structure
SELECT 'Current water_changes table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'water_changes' 
AND table_schema = 'public' 
ORDER BY ordinal_position;

-- Create water_changes table if it doesn't exist with correct structure
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

-- Enable RLS for water_changes
ALTER TABLE public.water_changes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for water_changes
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

-- Test queries to make sure they work
SELECT 'Test users query:' as info;
SELECT id, email, full_name, role, two_factor_enabled, two_factor_setup_completed
FROM public.users 
LIMIT 3;

SELECT 'Test user_preferences query:' as info;
SELECT user_id, dashboard_sensor_selection, pond_size_liters
FROM public.user_preferences 
LIMIT 3;

SELECT 'Test water_changes query:' as info;
SELECT user_id, changed_at, liters_added
FROM public.water_changes 
LIMIT 3;

-- Check RLS policies
SELECT 'RLS policies for users:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

SELECT 'RLS policies for user_preferences:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'user_preferences' AND schemaname = 'public';

SELECT 'RLS policies for water_changes:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'water_changes' AND schemaname = 'public';
