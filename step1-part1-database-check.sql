-- Stap 1.1: Controleer huidige database structuur
-- Run dit eerst in Supabase SQL Editor

-- Controleer welke tabellen bestaan
SELECT 'Bestaande tabellen:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('individual_sensor_configs', 'sensor_configurations', 'user_sensors')
ORDER BY table_name;

-- Controleer huidige sensor_configurations structuur
SELECT 'Huidige sensor_configurations kolommen:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sensor_configurations' 
AND table_schema = 'public'
ORDER BY ordinal_position;
