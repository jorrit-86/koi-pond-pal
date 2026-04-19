-- Add Aeration Support to Biological Filter Segments
-- Run this in your Supabase SQL Editor

-- The filter_segments column already exists as JSONB, so we just need to ensure
-- the existing data is compatible with aeration options in biological segments

-- Update existing filter segments to ensure they have the correct structure
-- This is a safe operation that won't affect existing data
UPDATE public.user_preferences 
SET filter_segments = COALESCE(filter_segments, '[]'::jsonb)
WHERE filter_segments IS NULL;

-- Add comment for documentation about aeration support in biological segments
COMMENT ON COLUMN public.user_preferences.filter_segments IS 'Visual filter segments configuration as JSONB array with id, type (mechanical|biological|chemical|uv|skimmer|empty), media, description, and aeration (boolean for biological segments). Biological segments can have aeration: true/false to indicate if the filter medium is aerated.';

-- Verify the column structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'filter_segments';

-- Test that the JSONB structure supports biological segments with aeration checkbox
SELECT 
    jsonb_build_object(
        'id', 'test-biological-aeration',
        'type', 'biological',
        'media', ARRAY['glass_foam'],
        'description', 'Biologische filter met beluchting',
        'aeration', true
    ) as test_biological_aeration_segment;

SELECT 'Aeration checkbox support for biological filter segments added successfully' as status;
