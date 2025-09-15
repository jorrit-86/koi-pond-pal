-- Disable email confirmation in Supabase
-- This allows users to sign up without email verification

-- Update auth settings to disable email confirmation
UPDATE auth.config 
SET 
  enable_signup = true,
  enable_email_confirmations = false,
  enable_email_change_confirmations = false
WHERE id = 1;

-- If the above doesn't work, try this alternative approach
-- This creates a custom auth configuration
INSERT INTO auth.config (id, enable_signup, enable_email_confirmations, enable_email_change_confirmations)
VALUES (1, true, false, false)
ON CONFLICT (id) DO UPDATE SET
  enable_signup = true,
  enable_email_confirmations = false,
  enable_email_change_confirmations = false;
