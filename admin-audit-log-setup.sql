-- Create admin audit log table
-- This table will track all admin actions for security and accountability

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'user_activate', 'user_deactivate', 'role_change', 'password_reset', 'user_delete', etc.
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB, -- Additional details about the action
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON public.admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_type ON public.admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at);

-- Add comments
COMMENT ON TABLE public.admin_audit_log IS 'Audit log for all admin actions';
COMMENT ON COLUMN public.admin_audit_log.admin_user_id IS 'ID of the admin user who performed the action';
COMMENT ON COLUMN public.admin_audit_log.action_type IS 'Type of action performed';
COMMENT ON COLUMN public.admin_audit_log.target_user_id IS 'ID of the user affected by the action (if applicable)';
COMMENT ON COLUMN public.admin_audit_log.details IS 'Additional details about the action in JSON format';
COMMENT ON COLUMN public.admin_audit_log.ip_address IS 'IP address of the admin user';
COMMENT ON COLUMN public.admin_audit_log.user_agent IS 'User agent of the admin user';
