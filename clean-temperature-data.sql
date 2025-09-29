-- Clean up corrupt temperature data in sensor_data table
-- This script will identify and remove invalid temperature readings

-- First, let's see what data we have
SELECT 
  id,
  sensor_id,
  temperature,
  created_at,
  CASE 
    WHEN temperature::text ~ '^[0-9]+\.?[0-9]*$' AND temperature::numeric BETWEEN 0 AND 50 THEN 'VALID'
    ELSE 'INVALID'
  END as status
FROM sensor_data 
ORDER BY created_at DESC 
LIMIT 20;

-- Show count of invalid records
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN temperature::text ~ '^[0-9]+\.?[0-9]*$' AND temperature::numeric BETWEEN 0 AND 50 THEN 1 END) as valid_records,
  COUNT(CASE WHEN NOT (temperature::text ~ '^[0-9]+\.?[0-9]*$' AND temperature::numeric BETWEEN 0 AND 50) THEN 1 END) as invalid_records
FROM sensor_data;

-- Delete invalid temperature records (uncomment to execute)
-- DELETE FROM sensor_data 
-- WHERE NOT (temperature::text ~ '^[0-9]+\.?[0-9]*$' AND temperature::numeric BETWEEN 0 AND 50);

-- Alternative: Update invalid records to NULL (safer option)
-- UPDATE sensor_data 
-- SET temperature = NULL 
-- WHERE NOT (temperature::text ~ '^[0-9]+\.?[0-9]*$' AND temperature::numeric BETWEEN 0 AND 50);

