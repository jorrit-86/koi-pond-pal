-- Force add columns to koi table
-- This script will add the columns even if they already exist

-- Drop columns if they exist (to avoid conflicts)
ALTER TABLE koi DROP COLUMN IF EXISTS healthStatus;
ALTER TABLE koi DROP COLUMN IF EXISTS location;

-- Add the columns
ALTER TABLE koi ADD COLUMN healthStatus VARCHAR(20) DEFAULT 'good';
ALTER TABLE koi ADD COLUMN location VARCHAR(20) DEFAULT 'pond';

-- Update existing records
UPDATE koi SET healthStatus = 'good' WHERE healthStatus IS NULL;
UPDATE koi SET location = 'pond' WHERE location IS NULL;

-- Verify the columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'location')
ORDER BY column_name;
