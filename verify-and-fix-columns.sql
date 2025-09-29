-- Verify and fix koi table columns
-- This script will ensure healthStatus and location columns exist

-- First, check if columns exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'koi' AND column_name = 'healthStatus') 
        THEN 'healthStatus column exists' 
        ELSE 'healthStatus column missing' 
    END as healthStatus_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'koi' AND column_name = 'location') 
        THEN 'location column exists' 
        ELSE 'location column missing' 
    END as location_status;

-- Add healthStatus column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'koi' AND column_name = 'healthStatus') THEN
        ALTER TABLE koi ADD COLUMN healthStatus VARCHAR(20) DEFAULT 'good';
        RAISE NOTICE 'Added healthStatus column';
    ELSE
        RAISE NOTICE 'healthStatus column already exists';
    END IF;
END $$;

-- Add location column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'koi' AND column_name = 'location') THEN
        ALTER TABLE koi ADD COLUMN location VARCHAR(20) DEFAULT 'pond';
        RAISE NOTICE 'Added location column';
    ELSE
        RAISE NOTICE 'location column already exists';
    END IF;
END $$;

-- Update existing records with default values
UPDATE koi SET healthStatus = 'good' WHERE healthStatus IS NULL;
UPDATE koi SET location = 'pond' WHERE location IS NULL;

-- Final verification
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'location')
ORDER BY column_name;
