-- Simple version: Add missing columns to koi table
-- This script adds the healthStatus and location columns that are used in the application

-- Add healthStatus column
ALTER TABLE koi 
ADD COLUMN IF NOT EXISTS healthStatus VARCHAR(20) DEFAULT 'good';

-- Add location column
ALTER TABLE koi 
ADD COLUMN IF NOT EXISTS location VARCHAR(20) DEFAULT 'pond';

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
