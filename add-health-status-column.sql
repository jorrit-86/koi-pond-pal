-- Add missing columns to koi table
-- This script adds the healthStatus and location columns that are used in the application

-- Add healthStatus column
ALTER TABLE koi 
ADD COLUMN IF NOT EXISTS healthStatus VARCHAR(20) DEFAULT 'good';

-- Add location column
ALTER TABLE koi 
ADD COLUMN IF NOT EXISTS location VARCHAR(20) DEFAULT 'pond';

-- Add check constraint for healthStatus to ensure only valid values
-- First drop the constraint if it exists, then add it
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_health_status') THEN
        ALTER TABLE koi DROP CONSTRAINT check_health_status;
    END IF;
END $$;

ALTER TABLE koi 
ADD CONSTRAINT check_health_status 
CHECK (healthStatus IN ('excellent', 'good', 'needs-attention'));

-- Add check constraint for location to ensure only valid values
-- First drop the constraint if it exists, then add it
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_location') THEN
        ALTER TABLE koi DROP CONSTRAINT check_location;
    END IF;
END $$;

ALTER TABLE koi 
ADD CONSTRAINT check_location 
CHECK (location IN ('pond', 'quarantine', 'hospital', 'breeding_tank', 'breeder', 'dealer', 'other'));

-- Update existing records to have default values
UPDATE koi 
SET healthStatus = 'good' 
WHERE healthStatus IS NULL;

UPDATE koi 
SET location = 'pond' 
WHERE location IS NULL;

-- Add comments to the columns
COMMENT ON COLUMN koi.healthStatus IS 'Health status of the koi: excellent, good, needs-attention';
COMMENT ON COLUMN koi.location IS 'Location of the koi: pond, quarantine, hospital, breeding_tank, breeder, dealer, other';
