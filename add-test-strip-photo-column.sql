-- Add test_strip_photo_url column to water_parameters table
-- This script adds the missing column for test strip photos

-- Add test_strip_photo_url column to water_parameters table
ALTER TABLE public.water_parameters 
ADD COLUMN IF NOT EXISTS test_strip_photo_url TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.water_parameters.test_strip_photo_url IS 'URL to the water test strip photo stored in Supabase Storage';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'water_parameters' 
AND column_name = 'test_strip_photo_url'
AND table_schema = 'public';
