-- Controleer sensor data sinds 16:37 vandaag
-- Om te zien waarom de data is gestopt

-- 1. Controleer exacte tijd van laatste data
SELECT 
  'Latest Sensor Data Check' as check_type,
  sensor_id,
  temperature,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM public.sensor_data
WHERE sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02')
ORDER BY created_at DESC
LIMIT 10;

-- 2. Controleer of er data is na 16:37 vandaag
SELECT 
  'Data After 16:37 Today' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data
WHERE sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02')
  AND created_at > '2025-09-21 16:37:00'::timestamp
GROUP BY sensor_id
ORDER BY sensor_id;

-- 3. Controleer data van de laatste 2 uur
SELECT 
  'Data Last 2 Hours' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record,
  MIN(created_at) as earliest_record
FROM public.sensor_data
WHERE sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02')
  AND created_at > NOW() - INTERVAL '2 hours'
GROUP BY sensor_id
ORDER BY sensor_id;

-- 4. Controleer of er data is voor de oude sensor ID sinds 16:37
SELECT 
  'Old Sensor ID Data Since 16:37' as check_type,
  sensor_id,
  COUNT(*) as record_count,
  MAX(created_at) as latest_record
FROM public.sensor_data
WHERE sensor_id = 'KOIoT-A1b2C3'
  AND created_at > '2025-09-21 16:37:00'::timestamp
GROUP BY sensor_id;

-- 5. Controleer alle sensor data van vandaag (chronologisch)
SELECT 
  'All Today Data (Chronological)' as check_type,
  sensor_id,
  temperature,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM public.sensor_data
WHERE created_at >= CURRENT_DATE
  AND sensor_id IN ('KOIoT-001122-01', 'KOIoT-001122-02', 'KOIoT-A1b2C3')
ORDER BY created_at DESC
LIMIT 20;
