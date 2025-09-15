-- Fix Storage Policies for profile-photos bucket
-- This script creates the correct RLS policies for the profile-photos bucket

-- First, let's check if the bucket exists and create it if it doesn't
-- (This needs to be done manually in Supabase Dashboard)

-- Create a simple policy that allows authenticated users to manage profile photos
CREATE POLICY "Allow authenticated users to manage profile photos" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'profile-photos');

-- Alternative: If the above doesn't work, try this more permissive policy
-- CREATE POLICY "Allow all authenticated users to manage profile photos" ON storage.objects
-- FOR ALL TO authenticated
-- USING (true);

-- If you want to be more specific about user ownership, use this:
-- CREATE POLICY "Users can manage their own profile photos" ON storage.objects
-- FOR ALL TO authenticated
-- USING (
--   bucket_id = 'profile-photos' AND 
--   auth.uid()::text = (storage.foldername(name))[1]
-- );
