-- Simple diagnose for pond properties saving issue
-- Run this in your Supabase SQL Editor

-- Check if user_preferences table exists and its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS policies on user_preferences table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_preferences' 
AND schemaname = 'public';

-- Check if RLS is enabled on user_preferences
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'user_preferences' 
AND schemaname = 'public';

-- Check for any constraints that might be causing issues
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'user_preferences'
AND tc.table_schema = 'public';

-- Check if there are any existing user_preferences records
SELECT COUNT(*) as existing_preferences_count FROM public.user_preferences;

-- Check if there are any users in the system
SELECT COUNT(*) as users_count FROM public.users;

-- Check what columns are missing by comparing with what the app expects
SELECT 
    CASE 
        WHEN column_name = 'pond_size_liters' THEN '✓ pond_size_liters exists'
        ELSE '✗ pond_size_liters missing'
    END as pond_size_liters_status
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'pond_size_liters'

UNION ALL

SELECT 
    CASE 
        WHEN column_name = 'pond_depth_cm' THEN '✓ pond_depth_cm exists'
        ELSE '✗ pond_depth_cm missing'
    END as pond_depth_cm_status
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'pond_depth_cm'

UNION ALL

SELECT 
    CASE 
        WHEN column_name = 'pond_type' THEN '✓ pond_type exists'
        ELSE '✗ pond_type missing'
    END as pond_type_status
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'pond_type'

UNION ALL

SELECT 
    CASE 
        WHEN column_name = 'location' THEN '✓ location exists'
        ELSE '✗ location missing'
    END as location_status
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'location'

UNION ALL

SELECT 
    CASE 
        WHEN column_name = 'climate_zone' THEN '✓ climate_zone exists'
        ELSE '✗ climate_zone missing'
    END as climate_zone_status
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'climate_zone';

SELECT 'Diagnosis complete' as status;
