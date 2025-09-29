-- Safe fix for healthStatus and location columns
-- This script will add the columns without dropping existing ones

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

-- Add location column if it doesn't exist (but don't drop existing one)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'koi' AND column_name = 'location'
    ) THEN
        ALTER TABLE koi ADD COLUMN location VARCHAR(20) DEFAULT 'pond';
        RAISE NOTICE 'location column added successfully';
    ELSE
        RAISE NOTICE 'location column already exists';
    END IF;
END $$;

-- Update existing records with default values
UPDATE koi SET healthStatus = 'good' WHERE healthStatus IS NULL;
UPDATE koi SET location = 'pond' WHERE location IS NULL;

-- Verify the columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'location')
ORDER BY column_name;

-- Check the actual data
SELECT id, name, healthStatus, location 
FROM koi 
LIMIT 5;
