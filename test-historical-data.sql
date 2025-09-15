-- Test script to demonstrate historical data functionality
-- This script adds test data with multiple measurements per date to show the "most recent per date" logic

-- Insert test data with multiple measurements per date
INSERT INTO public.water_parameters (user_id, parameter_type, value, unit, notes, measured_at)
VALUES 
    -- Multiple pH measurements on the same date (should use most recent)
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.0, '', 'Morning measurement', '2024-01-15 08:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.2, '', 'Afternoon measurement', '2024-01-15 14:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.4, '', 'Evening measurement (most recent)', '2024-01-15 20:00:00'),
    
    -- Multiple temperature measurements on the same date
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 18.0, '°C', 'Morning temperature', '2024-01-16 09:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 20.0, '°C', 'Afternoon temperature', '2024-01-16 15:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 19.5, '°C', 'Evening temperature (most recent)', '2024-01-16 21:00:00'),
    
    -- Single measurements on different dates
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.1, '', 'Single measurement', '2024-01-17 10:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 21.0, '°C', 'Single measurement', '2024-01-17 11:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.3, '', 'Single measurement', '2024-01-18 12:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 22.0, '°C', 'Single measurement', '2024-01-18 13:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.5, '', 'Single measurement', '2024-01-19 14:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 23.0, '°C', 'Single measurement', '2024-01-19 15:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.2, '', 'Single measurement', '2024-01-20 16:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 24.0, '°C', 'Single measurement', '2024-01-20 17:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.6, '', 'Single measurement', '2024-01-21 18:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 25.0, '°C', 'Single measurement', '2024-01-21 19:00:00');

-- Expected result:
-- For 2024-01-15: pH should show 7.4 (evening measurement, most recent)
-- For 2024-01-16: Temperature should show 19.5°C (evening measurement, most recent)
-- For other dates: Single measurements should be shown as-is
-- Charts should show only one data point per date (the most recent measurement)
