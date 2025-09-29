-- Verify that the koi_condition column exists and has data
-- This will help us confirm the column was created successfully

-- Check if the column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name = 'koi_condition';

-- Check current data in the column
SELECT id, name, koi_condition, location 
FROM koi 
LIMIT 5;

-- If the column doesn't exist, create it
-- ALTER TABLE koi ADD COLUMN koi_condition VARCHAR(20) DEFAULT 'good';
-- UPDATE koi SET koi_condition = 'good' WHERE koi_condition IS NULL;
