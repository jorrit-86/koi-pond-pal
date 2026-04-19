-- Add new fields to pond_properties table for enhanced Feed Advisor v2
-- This extends the existing pond_properties table with feed and water quality fields

-- Add feed brand and efficiency fields
ALTER TABLE pond_properties 
ADD COLUMN IF NOT EXISTS voer_merk VARCHAR(100) DEFAULT 'Generiek Voer',
ADD COLUMN IF NOT EXISTS voer_type VARCHAR(50) DEFAULT 'Standard',
ADD COLUMN IF NOT EXISTS voer_rendement DECIMAL(3,2) DEFAULT 1.00;

-- Add water quality tracking fields
ALTER TABLE pond_properties 
ADD COLUMN IF NOT EXISTS last_ammoniak_test TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_nitriet_test TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ammoniak_threshold DECIMAL(4,2) DEFAULT 0.1,
ADD COLUMN IF NOT EXISTS nitriet_threshold DECIMAL(4,2) DEFAULT 0.5;

-- Create feed brand database table
CREATE TABLE IF NOT EXISTS feed_brands (
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

-- Insert default feed brands
INSERT INTO feed_brands (merk, eiwit, vet, rendement, type, description) VALUES
('Saki-Hikari Growth', 40, 6, 1.10, 'High Protein', 'Premium groeivoer met hoog eiwitgehalte'),
('Hikari Staple', 35, 4, 1.00, 'Standard', 'Basisvoer voor dagelijks gebruik'),
('Takazumi Gold Plus', 38, 7, 1.05, 'Premium', 'Premium voer voor kleurversterking'),
('Coppens Basic', 32, 4, 0.85, 'Economy', 'Economisch basisvoer'),
('Tetra Pond Sticks', 30, 3, 0.90, 'Standard', 'Drijvende sticks voor gemakkelijk voeren'),
('JBL Novo Pond', 33, 5, 0.95, 'Standard', 'Gebalanceerd voer voor alle seizoenen'),
('Generiek Voer', 30, 4, 1.00, 'Generic', 'Standaard voer zonder specifiek merk')
ON CONFLICT (merk) DO NOTHING;

-- Create feed calculation history table for tracking
CREATE TABLE IF NOT EXISTS feed_calculations (
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

-- Add RLS policies for feed_calculations
ALTER TABLE feed_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feed calculations" ON feed_calculations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feed calculations" ON feed_calculations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feed_calculations_user_id ON feed_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_calculations_created_at ON feed_calculations(created_at);
CREATE INDEX IF NOT EXISTS idx_feed_brands_merk ON feed_brands(merk);

-- Update existing pond_properties records with default values
UPDATE pond_properties 
SET voer_merk = 'Generiek Voer',
    voer_type = 'Standard',
    voer_rendement = 1.00
WHERE voer_merk IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN pond_properties.voer_merk IS 'Feed brand name for feed efficiency calculations';
COMMENT ON COLUMN pond_properties.voer_type IS 'Type of feed (High Protein, Standard, Economy, etc.)';
COMMENT ON COLUMN pond_properties.voer_rendement IS 'Feed efficiency multiplier (1.0 = standard, >1.0 = premium)';
COMMENT ON COLUMN pond_properties.last_ammoniak_test IS 'Last ammonia test date for water quality tracking';
COMMENT ON COLUMN pond_properties.last_nitriet_test IS 'Last nitrite test date for water quality tracking';
COMMENT ON COLUMN pond_properties.ammoniak_threshold IS 'Ammonia threshold for feed reduction warnings';
COMMENT ON COLUMN pond_properties.nitriet_threshold IS 'Nitrite threshold for feed reduction warnings';

COMMENT ON TABLE feed_brands IS 'Database of feed brands with efficiency ratings';
COMMENT ON TABLE feed_calculations IS 'History of feed calculations for analytics and tracking';






