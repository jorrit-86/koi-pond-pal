-- Completely recreate the healthStatus column with a new name
-- This will avoid any schema cache issues

-- First, drop any existing health status columns
ALTER TABLE koi DROP COLUMN IF EXISTS healthStatus;
ALTER TABLE koi DROP COLUMN IF EXISTS health_status;
ALTER TABLE koi DROP COLUMN IF EXISTS healthstatus;

-- Add the new column with a completely different name
ALTER TABLE koi ADD COLUMN koi_health VARCHAR(20) DEFAULT 'good';

-- Update all existing records
UPDATE koi SET koi_health = 'good' WHERE koi_health IS NULL;

-- Verify the column exists and has data
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name = 'koi_health';

-- Check the data
SELECT id, name, koi_health, location 
FROM koi 
LIMIT 5;
