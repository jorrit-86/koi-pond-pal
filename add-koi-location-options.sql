-- Add new location options to koi table
-- Run this in your Supabase SQL Editor

-- Update the CHECK constraint to include new location options
ALTER TABLE public.koi 
DROP CONSTRAINT IF EXISTS koi_location_check;

ALTER TABLE public.koi 
ADD CONSTRAINT koi_location_check 
CHECK (location IN ('pond', 'quarantine', 'hospital', 'breeding_tank', 'breeder', 'dealer', 'other'));

-- Update the comment for documentation
COMMENT ON COLUMN public.koi.location IS 'Location where the koi is currently housed: pond, quarantine, hospital, breeding_tank, breeder, dealer, or other';

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.koi'::regclass 
AND conname = 'koi_location_check';

-- Test insert to verify the constraint works
SELECT 'Koi location options updated successfully' as status;
