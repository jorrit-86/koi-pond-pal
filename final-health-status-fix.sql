-- Final fix for healthStatus and location columns
-- This script will ensure the columns exist with the correct names and data

-- Drop any existing columns to avoid conflicts
ALTER TABLE koi DROP COLUMN IF EXISTS healthStatus;
ALTER TABLE koi DROP COLUMN IF EXISTS health_status;
ALTER TABLE koi DROP COLUMN IF EXISTS location;
ALTER TABLE koi DROP COLUMN IF EXISTS koi_location;

-- Add the columns with the correct names
ALTER TABLE koi ADD COLUMN healthStatus VARCHAR(20) DEFAULT 'good';
ALTER TABLE koi ADD COLUMN location VARCHAR(20) DEFAULT 'pond';

-- Update all existing records
UPDATE koi SET healthStatus = 'good' WHERE healthStatus IS NULL;
UPDATE koi SET location = 'pond' WHERE location IS NULL;

-- Verify the columns and data
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'location')
ORDER BY column_name;

-- Check the actual data
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 5;
