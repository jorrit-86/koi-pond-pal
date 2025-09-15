-- Simple fix for user feedback - remove problematic trigger
-- Run this in your Supabase SQL Editor

-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS on_feedback_added_effectiveness ON public.user_feedback;
DROP FUNCTION IF EXISTS public.update_recommendation_effectiveness();

-- Verify user_feedback table exists and is accessible
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_feedback' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test a simple insert to verify the table works
-- (This will be rolled back, it's just a test)
BEGIN;
INSERT INTO public.user_feedback (
    user_id, 
    recommendation_id, 
    feedback_type, 
    effectiveness_rating, 
    actual_outcome, 
    notes
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- dummy UUID
    '00000000-0000-0000-0000-000000000000', -- dummy UUID  
    'helpful',
    5,
    'Test feedback',
    'This is a test'
);
ROLLBACK;

-- If we get here, the table structure is correct
SELECT 'User feedback table is ready for use' as status;
