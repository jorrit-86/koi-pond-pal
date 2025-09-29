-- Check and fix healthStatus data in koi table
-- This script will verify the columns exist and add default data

-- First, check if the columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'health_status', 'location', 'koi_location')
ORDER BY column_name;

-- Check current data in the columns
SELECT id, name, healthStatus, health_status, location, koi_location 
FROM koi 
LIMIT 5;

-- Update all records to have default healthStatus if it's NULL or undefined
UPDATE koi 
SET healthStatus = 'good' 
WHERE healthStatus IS NULL;

-- Also try the alternative column name
UPDATE koi 
SET health_status = 'good' 
WHERE health_status IS NULL;

-- Update location columns
UPDATE koi 
SET location = 'pond' 
WHERE location IS NULL;

UPDATE koi 
SET koi_location = 'pond' 
WHERE koi_location IS NULL;

-- Verify the updates
SELECT id, name, healthStatus, health_status, location, koi_location 
FROM koi 
LIMIT 5;
