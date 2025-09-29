-- Check if there's a case sensitivity issue with the column name
-- PostgreSQL might be case sensitive

-- Check all columns in the koi table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND (column_name ILIKE '%health%' OR column_name ILIKE '%status%')
ORDER BY column_name;

-- Try to query with different case variations
SELECT id, name, "healthStatus", "healthstatus", "HealthStatus"
FROM koi 
LIMIT 3;
