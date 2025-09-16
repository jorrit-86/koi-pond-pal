-- Update filter media options in database
-- Run this in your Supabase SQL Editor

-- Update the filter_media constraint to include new options
-- Note: PostgreSQL arrays don't have CHECK constraints, so we'll add a comment for documentation

COMMENT ON COLUMN public.user_preferences.filter_media IS 'Array of filter media types: sponges, sand, foam, ceramic_rings, bio_balls, lava_rock, matrix, activated_carbon, zeolite, phosphate_remover';

-- Verify the column exists and has the correct type
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name = 'filter_media';

SELECT 'Filter media options updated successfully' as status;
