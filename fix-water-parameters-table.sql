-- Fix water_parameters table structure
-- Run this in your Supabase SQL Editor

-- First, let's check what columns exist in water_parameters
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'water_parameters' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- If the table doesn't exist or has wrong structure, recreate it
DROP TABLE IF EXISTS public.water_parameters CASCADE;

CREATE TABLE public.water_parameters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parameter_type TEXT NOT NULL,
    value DECIMAL NOT NULL,
    unit TEXT,
    status TEXT DEFAULT 'normal',
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    test_strip_photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.water_parameters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own water parameters" ON public.water_parameters
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own water parameters" ON public.water_parameters
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own water parameters" ON public.water_parameters
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own water parameters" ON public.water_parameters
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_water_parameters_user_id ON public.water_parameters(user_id);
CREATE INDEX idx_water_parameters_parameter_type ON public.water_parameters(parameter_type);
CREATE INDEX idx_water_parameters_measured_at ON public.water_parameters(measured_at);

-- Verify the table structure
SELECT 'water_parameters table recreated successfully' as status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'water_parameters' AND table_schema = 'public';


