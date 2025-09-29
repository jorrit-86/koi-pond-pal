-- Alternative approach: Add columns with different names
-- This might work if there's a naming conflict

-- Drop existing columns if they exist
ALTER TABLE koi DROP COLUMN IF EXISTS healthStatus;
ALTER TABLE koi DROP COLUMN IF EXISTS location;

-- Add columns with slightly different names
ALTER TABLE koi ADD COLUMN health_status VARCHAR(20) DEFAULT 'good';
ALTER TABLE koi ADD COLUMN koi_location VARCHAR(20) DEFAULT 'pond';

-- Update existing records
UPDATE koi SET health_status = 'good' WHERE health_status IS NULL;
UPDATE koi SET koi_location = 'pond' WHERE koi_location IS NULL;

-- Verify the columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND column_name IN ('health_status', 'koi_location')
ORDER BY column_name;
