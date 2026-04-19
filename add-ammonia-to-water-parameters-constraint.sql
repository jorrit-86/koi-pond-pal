-- Add ammonia to water_parameters parameter_type constraint
-- This updates the existing constraint to include 'ammonia' as a valid parameter type

-- First, drop the existing constraint
ALTER TABLE public.water_parameters 
DROP CONSTRAINT IF EXISTS water_parameters_parameter_type_check;

-- Add the new constraint with ammonia included
ALTER TABLE public.water_parameters 
ADD CONSTRAINT water_parameters_parameter_type_check 
CHECK (parameter_type IN ('ph', 'temperature', 'kh', 'gh', 'nitrite', 'nitrate', 'phosphate', 'ammonia'));




