-- 2FA Database Setup Script
-- This script adds 2FA support to the users table

-- Add 2FA related columns to users table
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

-- Verify the columns were added successfully
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
AND column_name LIKE 'two_factor%';

-- Show current users to verify data is preserved
SELECT id, email, role, two_factor_enabled, two_factor_setup_completed 
FROM public.users 
ORDER BY created_at DESC;
