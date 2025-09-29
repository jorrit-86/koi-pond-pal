-- Force refresh the schema cache
-- This script will help refresh the Supabase schema cache

-- First, let's verify the columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'location')
ORDER BY column_name;

-- Try to refresh the schema by doing a simple query
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 1;

-- If the above works, the columns exist and the cache should refresh
