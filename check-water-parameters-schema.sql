-- Check water_parameters table schema
-- This script shows the current structure of the water_parameters table

-- Show table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'water_parameters' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if test_strip_photo_url column exists
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'water_parameters' 
  AND column_name = 'test_strip_photo_url'
  AND table_schema = 'public'
) as test_strip_photo_url_exists;
