-- Add filter_segments column to user_preferences table
-- Run this in your Supabase SQL Editor

-- Add filter_segments column as JSONB to store the visual filter configuration
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS filter_segments JSONB DEFAULT '[
  {"id": "1", "type": "mechanical", "media": ["vortex_chamber"], "description": "Vortexkamer - grove filtering"},
  {"id": "2", "type": "biological", "media": ["moving_bed_k1"], "description": "Moving Bed K1 - biologische filtering"}
]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.user_preferences.filter_segments IS 'Visual filter segments configuration as JSONB array with id, type, media, and description';

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'filter_segments';

SELECT 'Filter segments column added successfully' as status;
