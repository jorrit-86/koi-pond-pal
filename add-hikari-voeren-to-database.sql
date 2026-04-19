-- Add Hikari voeren to Supabase database
-- Run this in Supabase SQL Editor

-- Insert the new Hikari voeren
INSERT INTO feed_brands (merk, eiwit, vet, rendement, type, description) VALUES
('Hikari Hi-Growth', 35, 9, 1.15, 'High Protein', 'Hoogwaardig koivoer voor snelle groei'),
('Hikari Staple Large', 37, 5, 1.05, 'Standard', 'Compleet Koi- en Vijvervisvoer voor optimale groei'),
('Hikari Wheat-Germ Medium', 35, 6, 1.00, 'Standard', 'Licht verteerbaar visvoer'),
('Hikari Gold Medium', 38, 5, 1.10, 'Premium', 'Kleur- en groei verbeterend koivoer'),
('Hikari Spirulina Mini', 43, 5, 1.20, 'High Protein', 'Hoogwaardig Koi Visvoer voor Kleurversterking'),
('Hikari Friend Large', 31, 5, 0.95, 'Standard', 'Hoogwaardig Koi Voer voor Gezonde Groei')
ON CONFLICT (merk) DO UPDATE SET
  eiwit = EXCLUDED.eiwit,
  vet = EXCLUDED.vet,
  rendement = EXCLUDED.rendement,
  type = EXCLUDED.type,
  description = EXCLUDED.description;

-- Update existing Hikari Staple to correct rendement
UPDATE feed_brands SET rendement = 1.05 WHERE merk = 'Hikari Staple';

-- Check the results
SELECT merk, eiwit, vet, rendement, type FROM feed_brands WHERE merk LIKE 'Hikari%' ORDER BY merk;





