-- Check and update healthStatus data
-- This script will verify the column exists and update the data

-- First, check if the column exists and what data is in it
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name = 'healthStatus';

-- Check current data in the healthStatus column
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 10;

-- Update all records that have NULL or empty healthStatus
UPDATE koi 
SET healthStatus = 'good' 
WHERE healthStatus IS NULL OR healthStatus = '';

-- Also update location if needed
UPDATE koi 
SET location = 'pond' 
WHERE location IS NULL OR location = '';

-- Verify the updates worked
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 10;
