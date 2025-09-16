-- Add location support to koi database
-- Run this in your Supabase SQL Editor

-- Add location column to koi table
ALTER TABLE public.koi 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'pond' CHECK (location IN ('pond', 'quarantine', 'hospital', 'breeding_tank', 'other'));

-- Add comment for documentation
COMMENT ON COLUMN public.koi.location IS 'Location where the koi is currently housed: pond, quarantine, hospital, breeding_tank, or other';

-- Create index for better performance when filtering by location
CREATE INDEX IF NOT EXISTS idx_koi_location ON public.koi(location);

-- Update existing koi records to have 'pond' as default location
UPDATE public.koi 
SET location = 'pond' 
WHERE location IS NULL;

-- Create a view for pond koi count (for AI recommendations)
CREATE OR REPLACE VIEW public.pond_koi_count AS
SELECT 
    user_id,
    COUNT(*) as koi_count,
    COUNT(CASE WHEN location = 'pond' THEN 1 END) as pond_koi_count,
    COUNT(CASE WHEN location = 'quarantine' THEN 1 END) as quarantine_koi_count,
    COUNT(CASE WHEN location = 'hospital' THEN 1 END) as hospital_koi_count
FROM public.koi
GROUP BY user_id;

-- Add RLS policy for the view
CREATE POLICY "Users can view own pond koi count" ON public.pond_koi_count
  FOR SELECT USING (auth.uid() = user_id);

-- Create function to get pond koi count for a user
CREATE OR REPLACE FUNCTION public.get_pond_koi_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) 
    FROM public.koi 
    WHERE user_id = user_uuid 
    AND location = 'pond'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_pond_koi_count(UUID) TO authenticated;
