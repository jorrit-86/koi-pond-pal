-- Add photo support to koi table and water_parameters table
-- This script adds photo_url columns to both tables

-- Add photo_url column to koi table
ALTER TABLE public.koi 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add test_strip_photo_url column to water_parameters table
ALTER TABLE public.water_parameters 
ADD COLUMN IF NOT EXISTS test_strip_photo_url TEXT;

-- Create photos storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for photos bucket
CREATE POLICY "Users can upload their own photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own photos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add comments to photo columns
COMMENT ON COLUMN public.koi.photo_url IS 'URL to the koi photo stored in Supabase Storage';
COMMENT ON COLUMN public.water_parameters.test_strip_photo_url IS 'URL to the water test strip photo stored in Supabase Storage';
