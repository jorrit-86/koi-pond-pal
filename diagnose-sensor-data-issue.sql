-- Diagnose waarom er geen sensor data meer binnenkomt
-- Run this in your Supabase SQL Editor

-- 1. Controleer of de sensor geregistreerd is
SELECT 
  'Sensor Registration Check' as check_type,
  us.sensor_id,
  us.user_id,
  us.status,
  us.created_at,
  au.email,
  au.raw_user_meta_data->>'full_name' as full_name
FROM public.user_sensors us
LEFT JOIN auth.users au ON us.user_id = au.id
WHERE us.sensor_id = 'KOIoT-A1b2C3';

-- 2. Controleer recente sensor data (laatste 24 uur)
SELECT 
  'Recent Sensor Data Check' as check_type,
  COUNT(*) as total_records,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data 
WHERE sensor_id = 'KOIoT-A1b2C3'
  AND created_at > NOW() - INTERVAL '24 hours';

-- 3. Controleer alle sensor data voor deze sensor
SELECT 
  'All Sensor Data Check' as check_type,
  COUNT(*) as total_records,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data 
WHERE sensor_id = 'KOIoT-A1b2C3';

-- 4. Controleer of er data is voor andere sensoren
SELECT 
  'Other Sensors Data Check' as check_type,
  sensor_id,
  COUNT(*) as total_records,
  MAX(created_at) as latest_record
FROM public.sensor_data 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY sensor_id
ORDER BY latest_record DESC;

-- 5. Controleer user_sensors tabel structuur
SELECT 
  'User Sensors Table Structure' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_sensors'
ORDER BY ordinal_position;

-- 6. Controleer sensor_data tabel structuur
SELECT 
  'Sensor Data Table Structure' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sensor_data'
ORDER BY ordinal_position;

-- 7. Controleer of er RLS policies zijn die data blokkeren
SELECT 
  'RLS Policies Check' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('sensor_data', 'user_sensors');

-- 8. Test insert van sensor data (alleen als sensor geregistreerd is)
-- Voer dit alleen uit als de sensor geregistreerd is
INSERT INTO public.sensor_data (
  sensor_id,
  temperature,
  user_id,
  status,
  sensor_type
) VALUES (
  'KOIoT-A1b2C3',
  20.5,
  (SELECT user_id FROM public.user_sensors WHERE sensor_id = 'KOIoT-A1b2C3' LIMIT 1),
  'active',
  'temperatuurmeter'
) ON CONFLICT DO NOTHING;

-- 9. Controleer of de test insert werkte
SELECT 
  'Test Insert Check' as check_type,
  COUNT(*) as test_records,
  MAX(created_at) as latest_test_record
FROM public.sensor_data 
WHERE sensor_id = 'KOIoT-A1b2C3'
  AND created_at > NOW() - INTERVAL '1 minute';
