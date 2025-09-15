-- AI Settings Database Update
-- Run this in your Supabase SQL Editor

-- Add AI preferences columns to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS ai_recommendations_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_risk_assessment_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_trend_analysis_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_learning_enabled BOOLEAN DEFAULT TRUE;

-- Update the trigger function to include AI settings
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
    ai_learning_enabled
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
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON COLUMN public.user_preferences.ai_recommendations_enabled IS 'Enable/disable AI-powered smart recommendations';
COMMENT ON COLUMN public.user_preferences.ai_risk_assessment_enabled IS 'Enable/disable AI risk assessment analysis';
COMMENT ON COLUMN public.user_preferences.ai_trend_analysis_enabled IS 'Enable/disable AI trend analysis and predictions';
COMMENT ON COLUMN public.user_preferences.ai_notifications_enabled IS 'Enable/disable AI-generated notifications and alerts';
COMMENT ON COLUMN public.user_preferences.ai_learning_enabled IS 'Enable/disable AI learning from user feedback and behavior';
