-- Verify that both columns exist and have data
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'location')
ORDER BY column_name;

-- Check if there's actual data in these columns
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 5;
