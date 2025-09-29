-- Force refresh the Supabase schema cache
-- This script will help refresh the schema cache by querying the columns

-- First, let's verify the column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name = 'healthStatus';

-- Force a schema refresh by querying the table
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 1;

-- If the above query works, the column exists
-- If it fails, we need to add the column with a different approach
