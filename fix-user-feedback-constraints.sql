-- Fix user feedback constraints and triggers
-- Run this in your Supabase SQL Editor

-- First, let's check if the tables exist and their current structure
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('user_feedback', 'recommendation_effectiveness', 'recommendations')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Drop the problematic trigger and function first
DROP TRIGGER IF EXISTS on_feedback_added_effectiveness ON public.user_feedback;
DROP FUNCTION IF EXISTS public.update_recommendation_effectiveness();

-- Add unique constraint to recommendation_effectiveness table
-- This will allow the ON CONFLICT clause to work properly
ALTER TABLE public.recommendation_effectiveness 
ADD CONSTRAINT unique_recommendation_effectiveness 
UNIQUE (recommendation_type, parameter_conditions);

-- Recreate the function with proper error handling
CREATE OR REPLACE FUNCTION public.update_recommendation_effectiveness()
RETURNS TRIGGER AS $$
BEGIN
  -- Update effectiveness tracking when feedback is added
  INSERT INTO public.recommendation_effectiveness (
    recommendation_type,
    parameter_conditions,
    success_count,
    total_count,
    average_effectiveness
  )
  SELECT 
    r.type,
    r.conditions,
    CASE WHEN NEW.feedback_type IN ('helpful', 'completed') THEN 1 ELSE 0 END,
    1,
    CASE WHEN NEW.feedback_type IN ('helpful', 'completed') THEN 1.0 ELSE 0.0 END
  FROM public.recommendations r
  WHERE r.id = NEW.recommendation_id
  ON CONFLICT (recommendation_type, parameter_conditions)
  DO UPDATE SET
    success_count = recommendation_effectiveness.success_count + 
      CASE WHEN NEW.feedback_type IN ('helpful', 'completed') THEN 1 ELSE 0 END,
    total_count = recommendation_effectiveness.total_count + 1,
    average_effectiveness = (
      recommendation_effectiveness.success_count + 
      CASE WHEN NEW.feedback_type IN ('helpful', 'completed') THEN 1 ELSE 0 END
    )::DECIMAL / (recommendation_effectiveness.total_count + 1),
    last_updated = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the feedback insertion
    RAISE WARNING 'Error updating recommendation effectiveness: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_feedback_added_effectiveness
  AFTER INSERT ON public.user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_recommendation_effectiveness();

-- Verify the constraints are in place
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.recommendation_effectiveness'::regclass
AND contype = 'u';

-- Test the user_feedback table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_feedback' 
AND table_schema = 'public'
ORDER BY ordinal_position;
