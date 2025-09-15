-- Add last_login_at field to users table
-- This will track when users last signed in

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add comment
COMMENT ON COLUMN public.users.last_login_at IS 'Timestamp of the user last login';
