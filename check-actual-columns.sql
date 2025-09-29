-- Check what columns actually exist in the koi table
-- This will help us understand what's available

-- Check all columns in the koi table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
ORDER BY column_name;

-- Check if there are any health-related columns
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND (column_name ILIKE '%health%' OR column_name ILIKE '%status%')
ORDER BY column_name;
