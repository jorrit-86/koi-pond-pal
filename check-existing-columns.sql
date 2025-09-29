-- Check what columns actually exist in the koi table
-- This will help us find a column we can use to store healthStatus

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
ORDER BY column_name;
