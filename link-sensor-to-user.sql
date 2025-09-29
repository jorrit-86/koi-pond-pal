-- Link sensor KOIoT-A1b2C3 to user Jorrit Aafjes
-- Run this in your Supabase SQL Editor

-- First, find the user ID for Jorrit Aafjes
-- (This will show you the user ID - you can use this to verify)
SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE raw_user_meta_data->>'full_name' ILIKE '%Jorrit%' 
   OR raw_user_meta_data->>'full_name' ILIKE '%Aafjes%'
   OR email ILIKE '%jorrit%'
   OR email ILIKE '%aafjes%';

-- If the above doesn't find the user, try this broader search:
-- SELECT id, email, raw_user_meta_data FROM auth.users;

-- Once you have the user ID, use it in the INSERT below
-- Replace 'USER_ID_HERE' with the actual user ID from the query above

-- Insert the sensor link
INSERT INTO public.user_sensors (
  user_id,
  sensor_id,
  sensor_name,
  status,
  created_at,
  updated_at
) VALUES (
  'USER_ID_HERE',  -- Replace with actual user ID
  'KOIoT-A1b2C3',
  'Vijver Sensor',
  'active',
  NOW(),
  NOW()
);

-- Verify the sensor was linked
SELECT * FROM public.user_sensors WHERE sensor_id = 'KOIoT-A1b2C3';
