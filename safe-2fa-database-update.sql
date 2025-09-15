-- Safe 2FA Database Update Script
-- This script safely adds 2FA columns while preserving all existing data including profile photos

-- First, let's check the current state
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
ORDER BY ordinal_position;

-- Check if 2FA columns already exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
AND column_name LIKE 'two_factor%';

-- Add 2FA related columns to users table (only if they don't exist)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_setup_completed BOOLEAN DEFAULT FALSE;

-- Add comments to explain the columns
COMMENT ON COLUMN public.users.two_factor_secret IS 'TOTP secret for 2FA authentication';
COMMENT ON COLUMN public.users.two_factor_backup_codes IS 'Array of backup codes for 2FA recovery';
COMMENT ON COLUMN public.users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN public.users.two_factor_setup_completed IS 'Whether 2FA setup has been completed';

-- Create index for better performance on 2FA queries
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON public.users(two_factor_enabled);

-- Verify all existing data is preserved
SELECT 
    id, 
    email, 
    full_name, 
    profile_photo_url, 
    street, 
    house_number, 
    postal_code, 
    city, 
    country, 
    role, 
    two_factor_enabled,
    created_at 
FROM public.users 
ORDER BY created_at DESC;

-- Verify the new columns were added successfully
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
AND column_name LIKE 'two_factor%';

-- Check profile photos are still accessible
SELECT COUNT(*) as total_users, 
       COUNT(profile_photo_url) as users_with_photos
FROM public.users;
