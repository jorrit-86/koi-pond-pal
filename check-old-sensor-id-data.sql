-- Controleer of er nog data binnenkomt voor de oude sensor ID
-- Dit helpt bepalen of de ESP32 nog de oude code gebruikt

-- 1. Controleer oude sensor ID registratie
SELECT 
  'Old Sensor ID Registration Check' as check_type,
  sensor_id,
  user_id,
  status,
  created_at
FROM public.user_sensors
WHERE sensor_id = 'KOIoT-A1b2C3';

-- 2. Controleer recente data voor oude sensor ID
SELECT 
  'Old Sensor ID Recent Data Check' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data
WHERE sensor_id = 'KOIoT-A1b2C3'
  AND created_at > NOW() - INTERVAL '24 hours';

-- 3. Controleer alle data voor oude sensor ID
SELECT 
  'Old Sensor ID All Data Check' as check_type,
  sensor_id,
  COUNT(*) as total_records,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data
WHERE sensor_id = 'KOIoT-A1b2C3';

-- 4. Controleer welke sensor IDs recent data hebben (laatste 7 dagen)
SELECT 
  'All Recent Sensor Data (7 days)' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record
FROM public.sensor_data
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY sensor_id
ORDER BY latest_record DESC;

-- 5. Controleer welke sensor IDs ooit data hebben gehad
SELECT 
  'All Historical Sensor Data' as check_type,
  sensor_id,
  COUNT(*) as total_records,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data
GROUP BY sensor_id
ORDER BY latest_record DESC;
