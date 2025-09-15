-- Admin Setup Script
-- Run this AFTER creating the admin user account through the app

-- Update admin user role to 'admin'
-- Replace 'admin-user-uuid' with the actual UUID of the admin user
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'admin@koisensei.nl';

-- Verify admin user exists and has admin role
SELECT id, email, full_name, role, created_at 
FROM public.users 
WHERE email = 'admin@koisensei.nl';
