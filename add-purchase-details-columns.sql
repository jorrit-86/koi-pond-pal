-- Add purchase details columns to koi table
-- This script adds purchase_date, age_at_purchase, and length_at_purchase columns

-- Add purchase_date column to koi table
ALTER TABLE public.koi
ADD COLUMN IF NOT EXISTS purchase_date DATE;

-- Add age_at_purchase column to koi table
ALTER TABLE public.koi
ADD COLUMN IF NOT EXISTS age_at_purchase INTEGER;

-- Add length_at_purchase column to koi table
ALTER TABLE public.koi
ADD COLUMN IF NOT EXISTS length_at_purchase INTEGER;

-- Add comments to the columns
COMMENT ON COLUMN public.koi.purchase_date IS 'Date when the koi was purchased';
COMMENT ON COLUMN public.koi.age_at_purchase IS 'Age of the koi at the time of purchase (in years)';
COMMENT ON COLUMN public.koi.length_at_purchase IS 'Length of the koi at the time of purchase (in cm)';

-- Verify all columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'koi'
AND table_schema = 'public'
AND column_name IN ('purchase_date', 'age_at_purchase', 'length_at_purchase')
ORDER BY column_name;
