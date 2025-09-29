-- Water Changes Database Setup
-- This script creates the water_changes table for tracking water changes

-- Create water_changes table
CREATE TABLE IF NOT EXISTS public.water_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    liters_added DECIMAL(10,2) NOT NULL,
    water_type TEXT NOT NULL CHECK (water_type IN ('tap_water', 'well_water', 'rain_water', 'ro_water', 'mixed')),
    reason TEXT NOT NULL CHECK (reason IN ('routine', 'problem', 'emergency', 'seasonal', 'maintenance', 'other')),
    notes TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.water_changes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own water changes" ON public.water_changes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own water changes" ON public.water_changes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own water changes" ON public.water_changes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own water changes" ON public.water_changes
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_water_changes_user_id ON public.water_changes(user_id);
CREATE INDEX idx_water_changes_changed_at ON public.water_changes(changed_at);
CREATE INDEX idx_water_changes_water_type ON public.water_changes(water_type);
CREATE INDEX idx_water_changes_reason ON public.water_changes(reason);

-- Create updated_at trigger
CREATE TRIGGER update_water_changes_updated_at 
    BEFORE UPDATE ON public.water_changes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.water_changes IS 'Tracks water changes performed by users';
COMMENT ON COLUMN public.water_changes.liters_added IS 'Amount of water added in liters';
COMMENT ON COLUMN public.water_changes.water_type IS 'Type of water added: tap_water, well_water, rain_water, ro_water, mixed';
COMMENT ON COLUMN public.water_changes.reason IS 'Reason for water change: routine, problem, emergency, seasonal, maintenance, other';
COMMENT ON COLUMN public.water_changes.changed_at IS 'When the water change was performed';
