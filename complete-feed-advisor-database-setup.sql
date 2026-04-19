-- Complete Feed Advisor Database Setup
-- Execute this script in your Supabase SQL Editor to set up all required tables

-- Step 1: Create pond_properties table
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

-- Step 2: Create feed_brands table
CREATE TABLE IF NOT EXISTS public.feed_brands (
    id SERIAL PRIMARY KEY,
    merk VARCHAR(100) NOT NULL UNIQUE,
    eiwit INTEGER NOT NULL,
    vet INTEGER NOT NULL,
    rendement DECIMAL(3,2) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create feed_calculations table for history tracking
CREATE TABLE IF NOT EXISTS public.feed_calculations (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pond_temp DECIMAL(4,1) NOT NULL,
    ambient_temp DECIMAL(4,1) NOT NULL,
    total_feed DECIMAL(8,2) NOT NULL,
    num_meals INTEGER NOT NULL,
    biomass DECIMAL(8,2) NOT NULL,
    temp_factor DECIMAL(4,2) NOT NULL,
    filter_factor DECIMAL(4,2) NOT NULL,
    water_quality_factor DECIMAL(4,2) NOT NULL,
    feed_brand_factor DECIMAL(4,2) NOT NULL,
    warnings TEXT[],
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Enable Row Level Security
ALTER TABLE public.pond_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_calculations ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for pond_properties
CREATE POLICY "Users can view their own pond properties" ON public.pond_properties
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pond properties" ON public.pond_properties
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pond properties" ON public.pond_properties
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pond properties" ON public.pond_properties
    FOR DELETE USING (auth.uid() = user_id);

-- Step 6: Create RLS policies for feed_calculations
CREATE POLICY "Users can view their own feed calculations" ON public.feed_calculations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feed calculations" ON public.feed_calculations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Step 7: Insert default feed brands
INSERT INTO public.feed_brands (merk, eiwit, vet, rendement, type, description) VALUES
('Saki-Hikari Growth', 40, 6, 1.10, 'High Protein', 'Premium groeivoer met hoog eiwitgehalte'),
('Hikari Staple', 35, 4, 1.00, 'Standard', 'Basisvoer voor dagelijks gebruik'),
('Takazumi Gold Plus', 38, 7, 1.05, 'Premium', 'Premium voer voor kleurversterking'),
('Coppens Basic', 32, 4, 0.85, 'Economy', 'Economisch basisvoer'),
('Tetra Pond Sticks', 30, 3, 0.90, 'Standard', 'Drijvende sticks voor gemakkelijk voeren'),
('JBL Novo Pond', 33, 5, 0.95, 'Standard', 'Gebalanceerd voer voor alle seizoenen'),
('Generiek Voer', 30, 4, 1.00, 'Generic', 'Standaard voer zonder specifiek merk')
ON CONFLICT (merk) DO NOTHING;

-- Step 8: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pond_properties_user_id ON public.pond_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_calculations_user_id ON public.feed_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_calculations_created_at ON public.feed_calculations(created_at);
CREATE INDEX IF NOT EXISTS idx_feed_brands_merk ON public.feed_brands(merk);

-- Step 9: Add table comments
COMMENT ON TABLE public.pond_properties IS 'Pond configuration and settings for Feed Advisor';
COMMENT ON TABLE public.feed_brands IS 'Database of feed brands with efficiency ratings';
COMMENT ON TABLE public.feed_calculations IS 'History of feed calculations for analytics and tracking';

-- Step 10: Create default pond properties for existing users (optional)
-- This will create a default pond profile for users who don't have one yet
INSERT INTO public.pond_properties (user_id, pond_name, filter_status, voer_merk, voer_type, voer_rendement)
SELECT 
    id as user_id,
    'Mijn Vijver' as pond_name,
    'Actief' as filter_status,
    'Generiek Voer' as voer_merk,
    'Standard' as voer_type,
    1.00 as voer_rendement
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.pond_properties)
ON CONFLICT DO NOTHING;
