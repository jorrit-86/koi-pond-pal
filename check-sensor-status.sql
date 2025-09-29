-- Check current sensor status and ownership
-- Run this in your Supabase SQL Editor

-- Check who owns the sensor
SELECT 
  us.*,
  au.email,
  au.raw_user_meta_data->>'full_name' as full_name
FROM public.user_sensors us
LEFT JOIN auth.users au ON us.user_id = au.id
WHERE us.sensor_id = 'KOIoT-A1b2C3';

-- Check if there are any sensor data records
SELECT COUNT(*) as total_records, 
       MAX(created_at) as latest_record
FROM public.sensor_data 
WHERE sensor_id = 'KOIoT-A1b2C3';

-- Check recent sensor data
SELECT * FROM public.sensor_data 
WHERE sensor_id = 'KOIoT-A1b2C3' 
ORDER BY created_at DESC 
LIMIT 5;
