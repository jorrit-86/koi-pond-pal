-- Simple script to add missing columns
-- Run this in Supabase SQL Editor

-- Add healthStatus column
ALTER TABLE koi ADD COLUMN healthStatus VARCHAR(20) DEFAULT 'good';

-- Add location column  
ALTER TABLE koi ADD COLUMN location VARCHAR(20) DEFAULT 'pond';

-- Update existing records
UPDATE koi SET healthStatus = 'good' WHERE healthStatus IS NULL;
UPDATE koi SET location = 'pond' WHERE location IS NULL;
