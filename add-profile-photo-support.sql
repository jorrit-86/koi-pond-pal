-- Add profile photo support to users table
-- This script adds a profile_photo_url column to store the URL of the user's profile photo

-- Add profile_photo_url column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.users.profile_photo_url IS 'URL to the user profile photo stored in Supabase Storage';

-- Create a storage bucket for profile photos (this needs to be done in Supabase Dashboard)
-- The bucket should be named 'profile-photos' and have public access

-- Example policy for profile photos bucket (to be created in Supabase Dashboard):
-- Policy name: "Users can upload their own profile photos"
-- Policy type: INSERT
-- Target roles: authenticated
-- Policy definition: auth.uid() = (storage.foldername(name))[1]::uuid

-- Policy name: "Users can view profile photos"
-- Policy type: SELECT  
-- Target roles: authenticated
-- Policy definition: true

-- Policy name: "Users can update their own profile photos"
-- Policy type: UPDATE
-- Target roles: authenticated
-- Policy definition: auth.uid() = (storage.foldername(name))[1]::uuid

-- Policy name: "Users can delete their own profile photos"
-- Policy type: DELETE
-- Target roles: authenticated
-- Policy definition: auth.uid() = (storage.foldername(name))[1]::uuid
