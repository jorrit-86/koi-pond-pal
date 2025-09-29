-- Add only healthStatus column (location already exists)
-- This script will only add the healthStatus column

-- Add healthStatus column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'koi' AND column_name = 'healthStatus'
    ) THEN
        ALTER TABLE koi ADD COLUMN healthStatus VARCHAR(20) DEFAULT 'good';
        RAISE NOTICE 'healthStatus column added successfully';
    ELSE
        RAISE NOTICE 'healthStatus column already exists';
    END IF;
END $$;

-- Update existing records with default healthStatus
UPDATE koi SET healthStatus = 'good' WHERE healthStatus IS NULL;

-- Verify the healthStatus column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name = 'healthStatus';

-- Check the actual data
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 5;
