-- Check if healthStatus and location columns exist in koi table
-- Run this to verify the columns were added successfully

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'location')
ORDER BY column_name;
