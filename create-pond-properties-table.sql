-- Create pond_properties table for Feed Advisor
-- This table stores pond configuration and settings

CREATE TABLE IF NOT EXISTS public.pond_properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic pond information
    pond_name VARCHAR(100) DEFAULT 'Mijn Vijver',
    pond_volume DECIMAL(8,2), -- in liters
    pond_depth DECIMAL(4,2), -- in meters
    
    -- Filter information
    filter_type VARCHAR(50) DEFAULT 'Biologisch',
    filter_status VARCHAR(50) DEFAULT 'Actief',
    filter_media TEXT,
    
    -- Water quality settings
    ammoniak DECIMAL(4,2) DEFAULT 0.0, -- mg/L
    nitriet DECIMAL(4,2) DEFAULT 0.0, -- mg/L
    last_water_test TIMESTAMP WITH TIME ZONE,
    
    -- Feed settings
    voer_merk VARCHAR(100) DEFAULT 'Generiek Voer',
    voer_type VARCHAR(50) DEFAULT 'Standard',
    voer_rendement DECIMAL(3,2) DEFAULT 1.00,
    
    -- Water quality tracking
    last_ammoniak_test TIMESTAMP WITH TIME ZONE,
    last_nitriet_test TIMESTAMP WITH TIME ZONE,
    ammoniak_threshold DECIMAL(4,2) DEFAULT 0.1,
    nitriet_threshold DECIMAL(4,2) DEFAULT 0.5,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.pond_properties ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own pond properties" ON public.pond_properties
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pond properties" ON public.pond_properties
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pond properties" ON public.pond_properties
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pond properties" ON public.pond_properties
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pond_properties_user_id ON public.pond_properties(user_id);

-- Add comments
COMMENT ON TABLE public.pond_properties IS 'Pond configuration and settings for Feed Advisor';
COMMENT ON COLUMN public.pond_properties.pond_name IS 'Name of the pond';
COMMENT ON COLUMN public.pond_properties.pond_volume IS 'Pond volume in liters';
COMMENT ON COLUMN public.pond_properties.pond_depth IS 'Pond depth in meters';
COMMENT ON COLUMN public.pond_properties.filter_type IS 'Type of filter system';
COMMENT ON COLUMN public.pond_properties.filter_status IS 'Current filter status (Actief, Opstartend, Rust)';
COMMENT ON COLUMN public.pond_properties.ammoniak IS 'Current ammonia level in mg/L';
COMMENT ON COLUMN public.pond_properties.nitriet IS 'Current nitrite level in mg/L';
COMMENT ON COLUMN public.pond_properties.voer_merk IS 'Feed brand name for efficiency calculations';
COMMENT ON COLUMN public.pond_properties.voer_type IS 'Type of feed (High Protein, Standard, Economy, etc.)';
COMMENT ON COLUMN public.pond_properties.voer_rendement IS 'Feed efficiency multiplier (1.0 = standard, >1.0 = premium)';





