-- Diagnose pond properties saving issue (FIXED VERSION)
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

-- Test with a real user ID if any exist
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Get the first user ID from the users table
    SELECT id INTO test_user_id FROM public.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Test insert with real user ID (will be rolled back)
        BEGIN
            INSERT INTO public.user_preferences (
                user_id,
                pond_size_liters,
                pond_depth_cm,
                pond_type,
                location,
                climate_zone,
                maintenance_frequency,
                seasonal_awareness,
                auto_recommendations
            ) VALUES (
                test_user_id,
                5000,
                120,
                'outdoor',
                'Test Location',
                'temperate',
                'weekly',
                true,
                true
            );
            RAISE NOTICE 'Test insert successful with user ID: %', test_user_id;
            ROLLBACK;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Test insert failed: %', SQLERRM;
                ROLLBACK;
        END;
    ELSE
        RAISE NOTICE 'No users found in the system';
    END IF;
END $$;

SELECT 'Diagnosis complete' as status;
