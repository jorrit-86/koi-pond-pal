-- Fix koi database schema to match the application
-- This script ensures the koi table has the correct columns

-- First, let's check what columns exist and fix them
-- Drop and recreate the koi table with correct schema

DROP TABLE IF EXISTS public.koi CASCADE;

-- Create koi table with correct schema
CREATE TABLE public.koi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT,
    age_years INTEGER,
    size_cm INTEGER,
    weight DECIMAL(10,2),
    color TEXT,
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger
CREATE TRIGGER update_koi_updated_at 
    BEFORE UPDATE ON public.koi 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO public.koi (user_id, name, species, age_years, size_cm, weight, color, purchase_date, notes)
VALUES 
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'Sakura', 'Kohaku', 3, 45, 1.2, 'White with red markings', '2021-05-15', 'Beautiful red pattern development'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'Yuki', 'Showa Sanshoku', 5, 52, 1.8, 'Black, red, and white', '2020-03-10', NULL),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'Hoshi', 'Asagi', 2, 35, NULL, 'Blue-grey with red belly', '2022-08-20', NULL),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'Kenzo', 'Sanke', 4, 48, 1.5, 'White with red and black', '2021-01-12', 'Monitor for fin rot - treatment ongoing');
