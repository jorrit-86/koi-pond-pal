-- Safe Database Update Script
-- This script safely adds new columns while preserving all existing data
-- Run this script to add the last_login_at field to existing users table

-- Add last_login_at column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the column
COMMENT ON COLUMN public.users.last_login_at IS 'Timestamp of the user last login';

-- Verify the column was added successfully
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
AND column_name = 'last_login_at';

-- Show current users to verify data is preserved
SELECT id, email, full_name, role, created_at, last_login_at 
FROM public.users 
ORDER BY created_at DESC;

-- Note: This script is safe to run multiple times
-- It will not affect existing data, only add the new column
