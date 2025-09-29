-- Add a new column for koi condition/health status
-- Using a completely different name to avoid schema cache issues

-- Add the new column
ALTER TABLE koi ADD COLUMN koi_condition VARCHAR(20) DEFAULT 'good';

-- Update all existing records
UPDATE koi SET koi_condition = 'good' WHERE koi_condition IS NULL;

-- Verify the column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name = 'koi_condition';

-- Check the data
SELECT id, name, koi_condition, location 
FROM koi 
LIMIT 5;
