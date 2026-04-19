-- Add timer configurations table for user-specific timer settings
-- This allows timer settings to be stored in database and synced between devices

CREATE TABLE IF NOT EXISTS public.user_timer_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  parameter_type TEXT NOT NULL CHECK (parameter_type IN ('ph', 'temperature', 'kh', 'gh', 'nitrite', 'nitrate', 'phosphate', 'ammonia')),
  enabled BOOLEAN DEFAULT false NOT NULL,
  duration INTEGER DEFAULT 30 NOT NULL CHECK (duration > 0 AND duration <= 1440), -- 1 minute to 24 hours
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, parameter_type)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_timer_configs_user_id ON public.user_timer_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_timer_configs_parameter_type ON public.user_timer_configs(parameter_type);

-- Enable RLS (Row Level Security)
ALTER TABLE public.user_timer_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own timer configs" ON public.user_timer_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own timer configs" ON public.user_timer_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own timer configs" ON public.user_timer_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own timer configs" ON public.user_timer_configs
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_timer_configs_updated_at 
  BEFORE UPDATE ON public.user_timer_configs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();




