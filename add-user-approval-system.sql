-- Add user approval system to the database
-- This script adds approval status and admin approval functionality

-- Add approval status columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create user_approvals table for tracking approval history
CREATE TABLE IF NOT EXISTS public.user_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  admin_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_approvals table
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_approvals table
CREATE POLICY "Admins can view all user approvals" ON public.user_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert user approvals" ON public.user_approvals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Update the handle_new_user function to set pending status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    CASE 
      WHEN NEW.email = 'admin@koisensei.nl' THEN 'admin'
      ELSE 'user'
    END,
    CASE 
      WHEN NEW.email = 'admin@koisensei.nl' THEN 'approved'
      ELSE 'pending'
    END
  );
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve a user
CREATE OR REPLACE FUNCTION public.approve_user(
  target_user_id UUID,
  admin_user_id UUID,
  approval_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update user approval status
  UPDATE public.users 
  SET 
    approval_status = 'approved',
    approved_at = NOW(),
    approved_by = admin_user_id
  WHERE id = target_user_id;
  
  -- Log the approval
  INSERT INTO public.user_approvals (user_id, admin_id, action, reason)
  VALUES (target_user_id, admin_user_id, 'approve', approval_reason);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a user
CREATE OR REPLACE FUNCTION public.reject_user(
  target_user_id UUID,
  admin_user_id UUID,
  rejection_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update user approval status
  UPDATE public.users 
  SET 
    approval_status = 'rejected',
    rejection_reason = rejection_reason
  WHERE id = target_user_id;
  
  -- Log the rejection
  INSERT INTO public.user_approvals (user_id, admin_id, action, reason)
  VALUES (target_user_id, admin_user_id, 'reject', rejection_reason);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON public.users(approval_status);
CREATE INDEX IF NOT EXISTS idx_user_approvals_user_id ON public.user_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_approvals_admin_id ON public.user_approvals(admin_id);
CREATE INDEX IF NOT EXISTS idx_user_approvals_created_at ON public.user_approvals(created_at);

-- Update existing users to have approved status (except pending ones)
UPDATE public.users 
SET approval_status = 'approved', approved_at = NOW()
WHERE approval_status = 'pending' AND role = 'admin';

-- Create a view for pending user approvals
CREATE OR REPLACE VIEW public.pending_user_approvals AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.street,
  u.house_number,
  u.postal_code,
  u.city,
  u.country,
  u.created_at,
  u.approval_status,
  u.rejection_reason
FROM public.users u
WHERE u.approval_status = 'pending'
ORDER BY u.created_at ASC;

-- Grant access to the view
GRANT SELECT ON public.pending_user_approvals TO authenticated;



