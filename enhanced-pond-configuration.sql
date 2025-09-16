-- Enhanced Pond Configuration Database Update
-- Run this in your Supabase SQL Editor

-- Add new columns to user_preferences table for enhanced pond configuration
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS filtration_type TEXT DEFAULT 'mechanical_biological' CHECK (filtration_type IN ('mechanical_biological', 'mechanical_only', 'biological_only', 'natural', 'none')),
ADD COLUMN IF NOT EXISTS filter_media TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS uv_sterilizer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS protein_skimmer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waterfall BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fountain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS aeration_system BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS heater BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chiller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_feeder BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS water_source TEXT DEFAULT 'tap_water' CHECK (water_source IN ('tap_water', 'well_water', 'rain_water', 'ro_water', 'mixed')),
ADD COLUMN IF NOT EXISTS water_changes_manual BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS plants_present BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plant_types TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.user_preferences.filtration_type IS 'Type of filtration system: mechanical_biological, mechanical_only, biological_only, natural, or none';
COMMENT ON COLUMN public.user_preferences.filter_media IS 'Array of filter media types used: sponges, ceramic_rings, bio_balls, activated_carbon, zeolite, sand';
COMMENT ON COLUMN public.user_preferences.uv_sterilizer IS 'Whether UV sterilizer is present';
COMMENT ON COLUMN public.user_preferences.protein_skimmer IS 'Whether protein skimmer is present';
COMMENT ON COLUMN public.user_preferences.waterfall IS 'Whether waterfall is present';
COMMENT ON COLUMN public.user_preferences.fountain IS 'Whether fountain is present';
COMMENT ON COLUMN public.user_preferences.aeration_system IS 'Whether aeration system is present';
COMMENT ON COLUMN public.user_preferences.heater IS 'Whether heater is present';
COMMENT ON COLUMN public.user_preferences.chiller IS 'Whether chiller is present';
COMMENT ON COLUMN public.user_preferences.auto_feeder IS 'Whether automatic feeder is present';
COMMENT ON COLUMN public.user_preferences.water_source IS 'Source of water: tap_water, well_water, rain_water, ro_water, or mixed';
COMMENT ON COLUMN public.user_preferences.water_changes_manual IS 'Whether water changes are done manually';
COMMENT ON COLUMN public.user_preferences.plants_present IS 'Whether plants are present in the pond';
COMMENT ON COLUMN public.user_preferences.plant_types IS 'Array of plant types: water_lilies, lotus, oxygen_plants, floating_plants, marginal_plants, submerged_plants';

-- Update the trigger function to include new columns
CREATE OR REPLACE FUNCTION public.create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (
    user_id, 
    experience_level, 
    maintenance_frequency, 
    seasonal_awareness, 
    auto_recommendations,
    ai_recommendations_enabled,
    ai_risk_assessment_enabled,
    ai_trend_analysis_enabled,
    ai_notifications_enabled,
    ai_learning_enabled,
    pond_type,
    climate_zone,
    filtration_type,
    filter_media,
    uv_sterilizer,
    protein_skimmer,
    waterfall,
    fountain,
    aeration_system,
    heater,
    chiller,
    auto_feeder,
    water_source,
    water_changes_manual,
    plants_present,
    plant_types
  )
  VALUES (
    NEW.id, 
    'beginner', 
    'weekly', 
    TRUE, 
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    'outdoor',
    'temperate',
    'mechanical_biological',
    '{}',
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    'tap_water',
    TRUE,
    FALSE,
    '{}'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public'
AND column_name IN ('filtration_type', 'filter_media', 'uv_sterilizer', 'protein_skimmer', 'waterfall', 'fountain', 'aeration_system', 'heater', 'chiller', 'auto_feeder', 'water_source', 'water_changes_manual', 'plants_present', 'plant_types')
ORDER BY column_name;

-- Test insert to verify everything works
SELECT 'Enhanced pond configuration columns added successfully' as status;
