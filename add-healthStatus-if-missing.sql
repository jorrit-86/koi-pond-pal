-- Add healthStatus column if it doesn't exist
-- This script will only add the column if it's missing

DO $$ 
BEGIN
    -- Check if healthStatus column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'koi' AND column_name = 'healthStatus'
    ) THEN
        -- Add the column
        ALTER TABLE koi ADD COLUMN healthStatus VARCHAR(20) DEFAULT 'good';
        RAISE NOTICE 'healthStatus column added successfully';
    ELSE
        RAISE NOTICE 'healthStatus column already exists';
    END IF;
END $$;

-- Update existing records
UPDATE koi SET healthStatus = 'good' WHERE healthStatus IS NULL;

-- Verify both columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('healthStatus', 'location')
ORDER BY column_name;
