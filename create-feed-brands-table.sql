-- Create feed_brands table for Feed Advisor
-- This table stores feed brand information and efficiency ratings

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

-- Insert default feed brands
INSERT INTO public.feed_brands (merk, eiwit, vet, rendement, type, description) VALUES
('Saki-Hikari Growth', 40, 6, 1.10, 'High Protein', 'Premium groeivoer met hoog eiwitgehalte'),
('Hikari Staple', 35, 4, 1.00, 'Standard', 'Basisvoer voor dagelijks gebruik'),
('Takazumi Gold Plus', 38, 7, 1.05, 'Premium', 'Premium voer voor kleurversterking'),
('Coppens Basic', 32, 4, 0.85, 'Economy', 'Economisch basisvoer'),
('Tetra Pond Sticks', 30, 3, 0.90, 'Standard', 'Drijvende sticks voor gemakkelijk voeren'),
('JBL Novo Pond', 33, 5, 0.95, 'Standard', 'Gebalanceerd voer voor alle seizoenen'),
('Generiek Voer', 30, 4, 1.00, 'Generic', 'Standaard voer zonder specifiek merk')
ON CONFLICT (merk) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feed_brands_merk ON public.feed_brands(merk);

-- Add comments
COMMENT ON TABLE public.feed_brands IS 'Database of feed brands with efficiency ratings';
COMMENT ON COLUMN public.feed_brands.merk IS 'Feed brand name';
COMMENT ON COLUMN public.feed_brands.eiwit IS 'Protein percentage';
COMMENT ON COLUMN public.feed_brands.vet IS 'Fat percentage';
COMMENT ON COLUMN public.feed_brands.rendement IS 'Efficiency multiplier for feed calculations';
COMMENT ON COLUMN public.feed_brands.type IS 'Feed type category';





