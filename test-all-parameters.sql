-- Test script to demonstrate all water parameters with historical data
-- This script adds test data for all parameters with multiple measurements per date

-- Insert test data for all parameters with multiple measurements per date
INSERT INTO public.water_parameters (user_id, parameter_type, value, unit, notes, measured_at)
VALUES 
    -- KH (Carbonate Hardness) - Multiple measurements per date
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'kh', 5.0, '°dKH', 'Morning KH', '2024-01-15 08:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'kh', 6.0, '°dKH', 'Afternoon KH', '2024-01-15 14:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'kh', 7.0, '°dKH', 'Evening KH (most recent)', '2024-01-15 20:00:00'),
    
    -- GH (General Hardness) - Multiple measurements per date
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'gh', 8.0, '°dGH', 'Morning GH', '2024-01-16 09:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'gh', 9.0, '°dGH', 'Afternoon GH', '2024-01-16 15:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'gh', 10.0, '°dGH', 'Evening GH (most recent)', '2024-01-16 21:00:00'),
    
    -- Nitrite - Multiple measurements per date
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 0.1, 'mg/L', 'Morning nitrite', '2024-01-17 10:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 0.05, 'mg/L', 'Afternoon nitrite', '2024-01-17 16:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 0.02, 'mg/L', 'Evening nitrite (most recent)', '2024-01-17 22:00:00'),
    
    -- Nitrate - Multiple measurements per date
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 20.0, 'mg/L', 'Morning nitrate', '2024-01-18 11:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 25.0, 'mg/L', 'Afternoon nitrate', '2024-01-18 17:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 30.0, 'mg/L', 'Evening nitrate (most recent)', '2024-01-18 23:00:00'),
    
    -- Phosphate - Multiple measurements per date
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 0.1, 'mg/L', 'Morning phosphate', '2024-01-19 12:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 0.2, 'mg/L', 'Afternoon phosphate', '2024-01-19 18:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 0.3, 'mg/L', 'Evening phosphate (most recent)', '2024-01-19 24:00:00'),
    
    -- Single measurements on different dates for variety
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'kh', 8.0, '°dKH', 'Single measurement', '2024-01-20 10:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'gh', 11.0, '°dGH', 'Single measurement', '2024-01-20 11:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 0.0, 'mg/L', 'Single measurement', '2024-01-20 12:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 15.0, 'mg/L', 'Single measurement', '2024-01-20 13:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 0.0, 'mg/L', 'Single measurement', '2024-01-20 14:00:00'),
    
    -- More recent data
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'kh', 9.0, '°dKH', 'Recent measurement', '2024-01-21 15:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'gh', 12.0, '°dGH', 'Recent measurement', '2024-01-21 16:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 0.1, 'mg/L', 'Recent measurement', '2024-01-21 17:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 35.0, 'mg/L', 'Recent measurement', '2024-01-21 18:00:00'),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 0.4, 'mg/L', 'Recent measurement', '2024-01-21 19:00:00');

-- Expected results:
-- KH: Should show 7.0 for 2024-01-15 (evening measurement), 8.0 for 2024-01-20, 9.0 for 2024-01-21
-- GH: Should show 10.0 for 2024-01-16 (evening measurement), 11.0 for 2024-01-20, 12.0 for 2024-01-21
-- Nitrite: Should show 0.02 for 2024-01-17 (evening measurement), 0.0 for 2024-01-20, 0.1 for 2024-01-21
-- Nitrate: Should show 30.0 for 2024-01-18 (evening measurement), 15.0 for 2024-01-20, 35.0 for 2024-01-21
-- Phosphate: Should show 0.3 for 2024-01-19 (evening measurement), 0.0 for 2024-01-20, 0.4 for 2024-01-21
-- All charts should show only one data point per date (the most recent measurement)
