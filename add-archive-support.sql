-- Add archive support to koi table
-- This script adds columns to support archiving koi

-- Add archive columns to koi table
ALTER TABLE public.koi 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archive_reason TEXT,
ADD COLUMN IF NOT EXISTS archive_date TIMESTAMP WITH TIME ZONE;

-- Add check constraint for archive_reason
ALTER TABLE public.koi 
ADD CONSTRAINT check_archive_reason 
CHECK (archive_reason IS NULL OR archive_reason IN ('overleden', 'verkocht', 'overige'));

-- Create index for better performance when filtering archived koi
CREATE INDEX IF NOT EXISTS idx_koi_archived ON public.koi(archived, user_id);

-- Update existing koi to have archived = false
UPDATE public.koi SET archived = FALSE WHERE archived IS NULL;


