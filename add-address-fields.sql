-- Add address fields to users table
-- This script adds address-related columns to store user address information

-- Add address fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS house_number TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Add comments to explain the columns
COMMENT ON COLUMN public.users.street IS 'User street address';
COMMENT ON COLUMN public.users.house_number IS 'User house number';
COMMENT ON COLUMN public.users.postal_code IS 'User postal code';
COMMENT ON COLUMN public.users.city IS 'User city';
COMMENT ON COLUMN public.users.country IS 'User country';
