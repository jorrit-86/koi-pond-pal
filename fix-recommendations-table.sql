-- Fix recommendations table to accept custom UUIDs
-- Run this in your Supabase SQL Editor

-- First, check if the table exists and has the DEFAULT constraint
DO $$
BEGIN
    -- Check if the recommendations table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recommendations' AND table_schema = 'public') THEN
        -- Remove the DEFAULT constraint if it exists
        ALTER TABLE public.recommendations ALTER COLUMN id DROP DEFAULT;
        
        -- Make sure the column is still UUID PRIMARY KEY
        ALTER TABLE public.recommendations ALTER COLUMN id SET NOT NULL;
        
        RAISE NOTICE 'Recommendations table updated successfully';
    ELSE
        RAISE NOTICE 'Recommendations table does not exist yet';
    END IF;
END $$;

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'recommendations' 
AND table_schema = 'public'
AND column_name = 'id';
