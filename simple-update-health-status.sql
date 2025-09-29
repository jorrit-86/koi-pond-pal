-- Simple update script to set healthStatus for all koi
-- This will update all records to have a healthStatus value

-- Update all koi to have 'good' healthStatus
UPDATE koi 
SET healthStatus = 'good' 
WHERE healthStatus IS NULL OR healthStatus = '';

-- Also ensure location is set
UPDATE koi 
SET location = 'pond' 
WHERE location IS NULL OR location = '';

-- Check the results
SELECT COUNT(*) as total_koi, 
       COUNT(healthStatus) as with_health_status,
       COUNT(location) as with_location
FROM koi;

-- Show a few examples
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 5;
