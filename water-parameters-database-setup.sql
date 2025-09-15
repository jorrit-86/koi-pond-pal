-- Water Parameters Database Setup
-- This script creates the water_parameters table and related functionality

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.water_parameters CASCADE;

-- Create water_parameters table
CREATE TABLE public.water_parameters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    parameter_type TEXT NOT NULL CHECK (parameter_type IN ('ph', 'kh', 'gh', 'nitrite', 'nitrate', 'phosphate', 'temperature')),
    value DECIMAL(10,2) NOT NULL,
    unit TEXT,
    notes TEXT,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_water_parameters_user_id ON public.water_parameters(user_id);
CREATE INDEX idx_water_parameters_type ON public.water_parameters(parameter_type);
CREATE INDEX idx_water_parameters_measured_at ON public.water_parameters(measured_at);

-- Create updated_at trigger
CREATE TRIGGER update_water_parameters_updated_at 
    BEFORE UPDATE ON public.water_parameters 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO public.water_parameters (user_id, parameter_type, value, unit, notes, measured_at)
VALUES 
    -- Admin user sample data
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.2, '', 'Good pH level', NOW() - INTERVAL '1 hour'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 18.5, '°C', 'Optimal temperature', NOW() - INTERVAL '1 hour'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'kh', 4.5, '°dH', 'Good buffering capacity', NOW() - INTERVAL '1 hour'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'gh', 8.2, '°dH', 'Slightly high but acceptable', NOW() - INTERVAL '1 hour'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 0.1, 'mg/l', 'Safe level', NOW() - INTERVAL '1 hour'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 15, 'mg/l', 'Monitor closely', NOW() - INTERVAL '1 hour'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 0.8, 'mg/l', 'High - needs attention', NOW() - INTERVAL '1 hour'),
    
    -- Historical data for charts
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.1, '', NULL, NOW() - INTERVAL '1 day'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.3, '', NULL, NOW() - INTERVAL '2 days'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.0, '', NULL, NOW() - INTERVAL '3 days'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 19.2, '°C', NULL, NOW() - INTERVAL '1 day'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 17.8, '°C', NULL, NOW() - INTERVAL '2 days'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 18.1, '°C', NULL, NOW() - INTERVAL '3 days');
