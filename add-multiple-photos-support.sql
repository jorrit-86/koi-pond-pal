-- Add support for multiple photos per koi
-- This script creates a new table for koi photos and migrates existing data

-- Create koi_photos table
CREATE TABLE IF NOT EXISTS public.koi_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    koi_id UUID NOT NULL REFERENCES public.koi(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for koi_photos
ALTER TABLE public.koi_photos ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own koi photos
CREATE POLICY "Users can view their own koi photos" ON public.koi_photos
    FOR SELECT USING (
        koi_id IN (
            SELECT id FROM public.koi WHERE user_id = auth.uid()
        )
    );

-- Policy for users to insert their own koi photos
CREATE POLICY "Users can insert their own koi photos" ON public.koi_photos
    FOR INSERT WITH CHECK (
        koi_id IN (
            SELECT id FROM public.koi WHERE user_id = auth.uid()
        )
    );

-- Policy for users to update their own koi photos
CREATE POLICY "Users can update their own koi photos" ON public.koi_photos
    FOR UPDATE USING (
        koi_id IN (
            SELECT id FROM public.koi WHERE user_id = auth.uid()
        )
    );

-- Policy for users to delete their own koi photos
CREATE POLICY "Users can delete their own koi photos" ON public.koi_photos
    FOR DELETE USING (
        koi_id IN (
            SELECT id FROM public.koi WHERE user_id = auth.uid()
        )
    );

-- Migrate existing photo_url data to koi_photos table
INSERT INTO public.koi_photos (koi_id, photo_url, is_primary, display_order)
SELECT 
    id as koi_id,
    photo_url,
    TRUE as is_primary,
    0 as display_order
FROM public.koi 
WHERE photo_url IS NOT NULL AND photo_url != '';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_koi_photos_koi_id ON public.koi_photos(koi_id);
CREATE INDEX IF NOT EXISTS idx_koi_photos_display_order ON public.koi_photos(koi_id, display_order);
CREATE INDEX IF NOT EXISTS idx_koi_photos_primary ON public.koi_photos(koi_id, is_primary);

-- Add comments
COMMENT ON TABLE public.koi_photos IS 'Stores multiple photos for each koi';
COMMENT ON COLUMN public.koi_photos.koi_id IS 'Reference to the koi this photo belongs to';
COMMENT ON COLUMN public.koi_photos.photo_url IS 'URL to the photo stored in Supabase Storage';
COMMENT ON COLUMN public.koi_photos.is_primary IS 'Whether this is the primary/display photo for the koi';
COMMENT ON COLUMN public.koi_photos.display_order IS 'Order in which photos should be displayed';

-- Verify the migration
SELECT 
    k.id,
    k.name,
    k.photo_url as old_photo_url,
    kp.photo_url as new_photo_url,
    kp.is_primary
FROM public.koi k
LEFT JOIN public.koi_photos kp ON k.id = kp.koi_id
WHERE k.photo_url IS NOT NULL
ORDER BY k.name;
