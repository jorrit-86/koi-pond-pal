-- AI Training Database Extensions
-- Run this in your Supabase SQL Editor

-- Create user feedback table for AI learning
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES public.recommendations(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful', 'completed', 'dismissed', 'ignored')),
  effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 5),
  actual_outcome TEXT,
  notes TEXT,
  water_parameters_before JSONB, -- Parameters before following recommendation
  water_parameters_after JSONB,  -- Parameters after following recommendation
  time_to_implement INTERVAL,    -- How long it took to implement
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI learning patterns table
CREATE TABLE IF NOT EXISTS public.ai_learning_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL, -- 'seasonal', 'pond_size', 'koi_count', 'user_behavior'
  pattern_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recommendation effectiveness tracking
CREATE TABLE IF NOT EXISTS public.recommendation_effectiveness (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_type TEXT NOT NULL,
  parameter_conditions JSONB NOT NULL,
  success_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  average_effectiveness DECIMAL(3,2) DEFAULT 0.0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_effectiveness ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_feedback
CREATE POLICY "Users can view own feedback" ON public.user_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON public.user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback" ON public.user_feedback
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for ai_learning_patterns (read-only for users)
CREATE POLICY "Users can view learning patterns" ON public.ai_learning_patterns
  FOR SELECT USING (true);

-- RLS Policies for recommendation_effectiveness (read-only for users)
CREATE POLICY "Users can view effectiveness data" ON public.recommendation_effectiveness
  FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_recommendation_id ON public.user_feedback(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_feedback_type ON public.user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_learning_patterns_type ON public.ai_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_ai_learning_patterns_confidence ON public.ai_learning_patterns(confidence_score);

CREATE INDEX IF NOT EXISTS idx_recommendation_effectiveness_type ON public.recommendation_effectiveness(recommendation_type);

-- Create trigger for updated_at on ai_learning_patterns
CREATE TRIGGER update_ai_learning_patterns_updated_at 
  BEFORE UPDATE ON public.ai_learning_patterns 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update recommendation effectiveness
CREATE OR REPLACE FUNCTION public.update_recommendation_effectiveness()
RETURNS TRIGGER AS $$
BEGIN
  -- Update effectiveness tracking when feedback is added
  INSERT INTO public.recommendation_effectiveness (
    recommendation_type,
    parameter_conditions,
    success_count,
    total_count,
    average_effectiveness
  )
  SELECT 
    r.type,
    r.conditions,
    CASE WHEN NEW.feedback_type IN ('helpful', 'completed') THEN 1 ELSE 0 END,
    1,
    CASE WHEN NEW.feedback_type IN ('helpful', 'completed') THEN 1.0 ELSE 0.0 END
  FROM public.recommendations r
  WHERE r.id = NEW.recommendation_id
  ON CONFLICT (recommendation_type, parameter_conditions)
  DO UPDATE SET
    success_count = recommendation_effectiveness.success_count + 
      CASE WHEN NEW.feedback_type IN ('helpful', 'completed') THEN 1 ELSE 0 END,
    total_count = recommendation_effectiveness.total_count + 1,
    average_effectiveness = (
      recommendation_effectiveness.success_count + 
      CASE WHEN NEW.feedback_type IN ('helpful', 'completed') THEN 1 ELSE 0 END
    )::DECIMAL / (recommendation_effectiveness.total_count + 1),
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update effectiveness when feedback is added
CREATE TRIGGER on_feedback_added_effectiveness
  AFTER INSERT ON public.user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_recommendation_effectiveness();

-- Function to learn from user patterns
CREATE OR REPLACE FUNCTION public.learn_from_user_patterns()
RETURNS void AS $$
BEGIN
  -- Analyze seasonal patterns
  INSERT INTO public.ai_learning_patterns (pattern_type, pattern_data, confidence_score)
  SELECT 
    'seasonal',
    jsonb_build_object(
      'month', EXTRACT(MONTH FROM wp.created_at),
      'parameter_type', wp.parameter_type,
      'avg_value', AVG(wp.value),
      'trend', CASE 
        WHEN AVG(wp.value) > LAG(AVG(wp.value)) OVER (PARTITION BY wp.parameter_type ORDER BY EXTRACT(MONTH FROM wp.created_at)) 
        THEN 'increasing' 
        ELSE 'decreasing' 
      END
    ),
    0.7 -- Base confidence
  FROM public.water_parameters wp
  WHERE wp.created_at >= NOW() - INTERVAL '1 year'
  GROUP BY EXTRACT(MONTH FROM wp.created_at), wp.parameter_type
  ON CONFLICT DO NOTHING;
  
  -- Analyze pond size patterns
  INSERT INTO public.ai_learning_patterns (pattern_type, pattern_data, confidence_score)
  SELECT 
    'pond_size',
    jsonb_build_object(
      'pond_size_liters', up.pond_size_liters,
      'koi_count', up.koi_count,
      'maintenance_frequency', up.maintenance_frequency,
      'avg_parameter_stability', AVG(CASE WHEN wp.value BETWEEN 6.8 AND 8.2 THEN 1 ELSE 0 END)
    ),
    0.6
  FROM public.user_preferences up
  JOIN public.water_parameters wp ON wp.user_id = up.user_id
  WHERE up.pond_size_liters IS NOT NULL
  GROUP BY up.pond_size_liters, up.koi_count, up.maintenance_frequency
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.user_feedback IS 'User feedback on AI recommendations for machine learning';
COMMENT ON TABLE public.ai_learning_patterns IS 'Learned patterns from user data and behavior';
COMMENT ON TABLE public.recommendation_effectiveness IS 'Effectiveness tracking for different recommendation types';
