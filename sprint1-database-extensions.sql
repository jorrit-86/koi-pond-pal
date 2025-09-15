-- Sprint 1: Smart Water Analysis - Database Extensions
-- Run this in your Supabase SQL Editor

-- Create recommendations table
CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'water_change', 'filter_maintenance', 'ph_adjustment', 
    'temperature_control', 'chemical_treatment'
  )),
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5), -- 1=urgent, 5=info
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_required BOOLEAN DEFAULT FALSE,
  estimated_effort TEXT CHECK (estimated_effort IN ('low', 'medium', 'high')),
  estimated_duration TEXT, -- "15 minutes", "1 hour", etc.
  related_parameters TEXT[], -- ['ph', 'temperature']
  conditions JSONB, -- Conditions that triggered this recommendation
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create analysis_logs table for AI learning
CREATE TABLE IF NOT EXISTS public.analysis_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  input_data JSONB NOT NULL,
  analysis_result JSONB NOT NULL,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_preferences table for personalization
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  pond_size_liters INTEGER,
  koi_count INTEGER,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'expert')),
  maintenance_frequency TEXT CHECK (maintenance_frequency IN ('daily', 'weekly', 'bi-weekly', 'monthly')),
  preferred_chemicals TEXT[], -- ['baking_soda', 'vinegar', 'commercial_products']
  seasonal_awareness BOOLEAN DEFAULT TRUE,
  auto_recommendations BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommendations table
CREATE POLICY "Users can view own recommendations" ON public.recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations" ON public.recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations" ON public.recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recommendations" ON public.recommendations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for analysis_logs table
CREATE POLICY "Users can view own analysis logs" ON public.analysis_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis logs" ON public.analysis_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_preferences table
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON public.recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON public.recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON public.recommendations(created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_logs_user_id ON public.analysis_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_analysis_type ON public.analysis_logs(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON public.analysis_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Create trigger for updated_at on user_preferences
CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON public.user_preferences 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically create user preferences on user creation
CREATE OR REPLACE FUNCTION public.create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, experience_level, maintenance_frequency, seasonal_awareness, auto_recommendations)
  VALUES (NEW.id, 'beginner', 'weekly', TRUE, TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user preferences when user is created
DROP TRIGGER IF EXISTS on_user_created_preferences ON public.users;
CREATE TRIGGER on_user_created_preferences
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_preferences();

-- Function to clean up expired recommendations
CREATE OR REPLACE FUNCTION public.cleanup_expired_recommendations()
RETURNS void AS $$
BEGIN
  UPDATE public.recommendations 
  SET status = 'dismissed' 
  WHERE expires_at < NOW() AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up expired recommendations (if using pg_cron)
-- SELECT cron.schedule('cleanup-expired-recommendations', '0 2 * * *', 'SELECT public.cleanup_expired_recommendations();');
