-- Fix Database Issues
-- Run this in your Supabase SQL Editor to resolve all console errors

-- 1. Create ai_chat_history table
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
    content TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own chat history" ON public.ai_chat_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages" ON public.ai_chat_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat messages" ON public.ai_chat_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat messages" ON public.ai_chat_history
    FOR DELETE USING (auth.uid() = user_id);

-- 2. Fix user_preferences table - add missing columns
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS ai_recommendations_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_risk_assessment_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_trend_analysis_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_learning_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pond_size_liters INTEGER,
ADD COLUMN IF NOT EXISTS pond_depth_cm INTEGER,
ADD COLUMN IF NOT EXISTS pond_type TEXT DEFAULT 'outdoor' CHECK (pond_type IN ('outdoor', 'indoor')),
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS climate_zone TEXT DEFAULT 'temperate' CHECK (climate_zone IN ('tropical', 'subtropical', 'temperate', 'continental', 'polar')),
ADD COLUMN IF NOT EXISTS maintenance_frequency TEXT DEFAULT 'weekly' CHECK (maintenance_frequency IN ('daily', 'weekly', 'bi-weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS seasonal_awareness BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_recommendations BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS filtration_type TEXT DEFAULT 'mechanical_biological' CHECK (filtration_type IN ('mechanical', 'biological', 'chemical', 'mechanical_biological', 'mechanical_chemical', 'biological_chemical', 'all_three')),
ADD COLUMN IF NOT EXISTS filter_media TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS filter_segments JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS uv_sterilizer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS protein_skimmer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waterfall BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fountain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS aeration_system BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS heater BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chiller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_feeder BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS water_source TEXT DEFAULT 'tap_water' CHECK (water_source IN ('tap_water', 'well_water', 'rain_water', 'filtered_water', 'ro_water')),
ADD COLUMN IF NOT EXISTS water_changes_manual BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS plants_present BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plant_types TEXT[] DEFAULT '{}';

-- 3. Fix water_parameters table - ensure proper structure
-- Check if water_parameters table exists and has correct columns
DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'water_parameters' AND column_name = 'parameter_type') THEN
        ALTER TABLE public.water_parameters ADD COLUMN parameter_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'water_parameters' AND column_name = 'value') THEN
        ALTER TABLE public.water_parameters ADD COLUMN value DECIMAL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'water_parameters' AND column_name = 'unit') THEN
        ALTER TABLE public.water_parameters ADD COLUMN unit TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'water_parameters' AND column_name = 'status') THEN
        ALTER TABLE public.water_parameters ADD COLUMN status TEXT DEFAULT 'normal';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'water_parameters' AND column_name = 'user_id') THEN
        ALTER TABLE public.water_parameters ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'water_parameters' AND column_name = 'created_at') THEN
        ALTER TABLE public.water_parameters ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 4. Ensure RLS is enabled on all tables
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_parameters ENABLE ROW LEVEL SECURITY;

-- 5. Create missing RLS policies for user_preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- 6. Create missing RLS policies for water_parameters
DROP POLICY IF EXISTS "Users can view their own water parameters" ON public.water_parameters;
CREATE POLICY "Users can view their own water parameters" ON public.water_parameters
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own water parameters" ON public.water_parameters;
CREATE POLICY "Users can insert their own water parameters" ON public.water_parameters
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own water parameters" ON public.water_parameters;
CREATE POLICY "Users can update their own water parameters" ON public.water_parameters
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own water parameters" ON public.water_parameters;
CREATE POLICY "Users can delete their own water parameters" ON public.water_parameters
    FOR DELETE USING (auth.uid() = user_id);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user_id ON public.ai_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_created_at ON public.ai_chat_history(created_at);
CREATE INDEX IF NOT EXISTS idx_water_parameters_user_id ON public.water_parameters(user_id);
CREATE INDEX IF NOT EXISTS idx_water_parameters_created_at ON public.water_parameters(created_at);
CREATE INDEX IF NOT EXISTS idx_water_parameters_parameter_type ON public.water_parameters(parameter_type);

-- 8. Verify tables exist
SELECT 'Database setup completed successfully' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('ai_chat_history', 'user_preferences', 'water_parameters');
