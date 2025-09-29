-- Add healthStatus with alternative name to avoid schema cache issues
-- This script will add the column with a different name

-- Add the column with a different name
ALTER TABLE koi ADD COLUMN health_status VARCHAR(20) DEFAULT 'good';

-- Update all records
UPDATE koi SET health_status = 'good' WHERE health_status IS NULL;

-- Verify the column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name = 'health_status';

-- Check the data
SELECT id, name, health_status, location 
FROM koi 
LIMIT 5;
