-- Add breeder and dealer columns to koi table
-- This script adds the missing columns that are causing the error

-- Add breeder column to koi table
ALTER TABLE public.koi 
ADD COLUMN IF NOT EXISTS breeder TEXT;

-- Add dealer column to koi table  
ALTER TABLE public.koi 
ADD COLUMN IF NOT EXISTS dealer TEXT;

-- Add comments to the columns
COMMENT ON COLUMN public.koi.breeder IS 'Name of the koi breeder';
COMMENT ON COLUMN public.koi.dealer IS 'Name of the koi dealer';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'koi' 
AND table_schema = 'public'
AND column_name IN ('breeder', 'dealer');
