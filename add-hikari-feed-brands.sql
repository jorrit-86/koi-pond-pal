-- Add Hikari feed brands to the database
-- This script adds the new Hikari voeren with detailed nutritional information

-- Insert new Hikari feed brands
INSERT INTO feed_brands (merk, eiwit, vet, rendement, type, description, ruwe_celstof, ruwe_as, fosfor, vorm, bron) VALUES
('Hikari Hi-Growth', 35, 9, 1.15, 'High Protein', 'Hoogwaardig koivoer voor snelle groei', 2.5, 12.5, 1.2, 'Drijvend; 2 kg (verpakking)', 'Koivoershop.nl'),
('Hikari Staple Large', 37, 5, 1.05, 'Standard', 'Compleet Koi- en Vijvervisvoer voor optimale groei', 4.2, 11.6, 1.2, 'Drijvend; Large', 'Koivoershop.nl'),
('Hikari Wheat-Germ Medium', 35, 6, 1.00, 'Standard', 'Licht verteerbaar visvoer', 3.3, 10.7, 0.9, 'Drijvend; Medium', 'Koivoershop.nl'),
('Hikari Gold Medium', 38, 5, 1.10, 'Premium', 'Kleur- en groei verbeterend koivoer', 4.2, 11.6, 1.2, 'Drijvend; Small/Medium/Large', 'Koivoershop.nl'),
('Hikari Spirulina Mini', 43, 5, 1.20, 'High Protein', 'Hoogwaardig Koi Visvoer voor Kleurversterking', 4.2, 14.3, 1.2, 'Drijvend; Mini', 'Koivoershop.nl'),
('Hikari Friend Large', 31, 5, 0.95, 'Standard', 'Hoogwaardig Koi Voer voor Gezonde Groei', 3.3, 7.0, 0.7, 'Drijvend; Large', 'Koivoershop.nl')
ON CONFLICT (merk) DO UPDATE SET
  eiwit = EXCLUDED.eiwit,
  vet = EXCLUDED.vet,
  rendement = EXCLUDED.rendement,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  ruwe_celstof = EXCLUDED.ruwe_celstof,
  ruwe_as = EXCLUDED.ruwe_as,
  fosfor = EXCLUDED.fosfor,
  vorm = EXCLUDED.vorm,
  bron = EXCLUDED.bron;

-- Add new columns to feed_brands table if they don't exist
ALTER TABLE feed_brands 
ADD COLUMN IF NOT EXISTS ruwe_celstof DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS ruwe_as DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS fosfor DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS vorm TEXT,
ADD COLUMN IF NOT EXISTS bron TEXT;

-- Update existing brands with additional information where available
UPDATE feed_brands SET 
  ruwe_celstof = 3.0,
  ruwe_as = 10.0,
  fosfor = 1.0,
  vorm = 'Drijvend',
  bron = 'Generiek'
WHERE merk = 'Generiek Voer';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feed_brands_type ON feed_brands(type);
CREATE INDEX IF NOT EXISTS idx_feed_brands_rendement ON feed_brands(rendement);

-- Add comments for documentation
COMMENT ON COLUMN feed_brands.ruwe_celstof IS 'Percentage ruwe celstof in het voer';
COMMENT ON COLUMN feed_brands.ruwe_as IS 'Percentage ruwe as in het voer';
COMMENT ON COLUMN feed_brands.fosfor IS 'Percentage fosfor in het voer';
COMMENT ON COLUMN feed_brands.vorm IS 'Vorm van het voer (drijvend, zinkend, etc.)';
COMMENT ON COLUMN feed_brands.bron IS 'Bron van de voedingsinformatie';





