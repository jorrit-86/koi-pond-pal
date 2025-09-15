-- Rollback 2FA Changes Script
-- This script safely removes the 2FA columns if they're causing issues

-- First, let's check what columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
AND column_name LIKE 'two_factor%';

-- If the columns exist and are causing issues, we can remove them
-- (Only run this if you're sure you want to remove 2FA functionality)

-- DROP INDEX IF EXISTS idx_users_two_factor_enabled;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS two_factor_secret;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS two_factor_backup_codes;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS two_factor_enabled;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS two_factor_setup_completed;

-- Check current users table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
ORDER BY ordinal_position;
