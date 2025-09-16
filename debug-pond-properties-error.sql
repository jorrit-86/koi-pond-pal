-- Debug specific pond properties error
-- Run this in your Supabase SQL Editor

-- Check if all required columns exist
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name IN (
    'pond_size_liters',
    'pond_depth_cm', 
    'pond_type',
    'location',
    'climate_zone',
    'maintenance_frequency',
    'seasonal_awareness',
    'auto_recommendations'
)
ORDER BY column_name;

-- Check if the user_preferences table has the correct structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS policies specifically
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_preferences' 
AND schemaname = 'public';

-- Check if there are any check constraints that might be failing
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'user_preferences'
AND tc.table_schema = 'public'
AND tc.constraint_type = 'CHECK';

-- Try to create a test record to see what specific error occurs
-- This will help identify the exact issue
DO $$
DECLARE
    test_user_id UUID;
    error_message TEXT;
BEGIN
    -- Get a real user ID
    SELECT id INTO test_user_id FROM public.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        BEGIN
            -- Try to insert with minimal data first
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
            
            RAISE NOTICE 'SUCCESS: Test insert worked!';
            DELETE FROM public.user_preferences WHERE user_id = test_user_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                error_message := SQLERRM;
                RAISE NOTICE 'ERROR: %', error_message;
        END;
    ELSE
        RAISE NOTICE 'No users found in system';
    END IF;
END $$;

SELECT 'Debug complete' as status;
