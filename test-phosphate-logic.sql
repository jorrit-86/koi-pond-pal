-- Test script to demonstrate correct phosphate logic
-- This script adds test data with 0 mg/l phosphate to show it should be "good"

-- Insert test data with 0 mg/l phosphate (should be "good", not "warning")
INSERT INTO public.water_parameters (user_id, parameter_type, value, unit, notes, measured_at)
VALUES 
    -- Test with 0 mg/l phosphate (should be "good")
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 0.0, 'mg/l', 'Zero phosphate - should be good status', NOW()),
    
    -- Test with 0 mg/l nitrite (should also be "good")
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 0.0, 'mg/l', 'Zero nitrite - should be good status', NOW()),
    
    -- Test with other good values
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.2, '', 'Good pH level', NOW()),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 20.0, '°C', 'Good temperature', NOW()),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'kh', 5.0, '°dH', 'Good KH level', NOW()),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'gh', 8.0, '°dH', 'Good GH level', NOW()),
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 15, 'mg/l', 'Good nitrate level', NOW());

-- Expected result: No alerts should appear because all values are in the "good" range
-- Phosphate: 0 mg/l = "good" (not "warning")
-- Nitrite: 0 mg/l = "good" (not "warning")
