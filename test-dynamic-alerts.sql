-- Test script to demonstrate dynamic alerts
-- This script adds test data with different parameter values to trigger various alerts

-- Insert test data with dangerous values to trigger alerts
INSERT INTO public.water_parameters (user_id, parameter_type, value, unit, notes, measured_at)
VALUES 
    -- Test user with dangerous pH (too low)
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 5.8, '', 'Dangerous low pH - should trigger critical alert', NOW()),
    
    -- Test user with dangerous temperature (too high)
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 32.0, '°C', 'Dangerous high temperature - should trigger critical alert', NOW()),
    
    -- Test user with dangerous nitrite
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 1.2, 'mg/l', 'Dangerous nitrite level - should trigger critical alert', NOW()),
    
    -- Test user with dangerous phosphate
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 2.5, 'mg/l', 'Dangerous phosphate level - should trigger critical alert', NOW()),
    
    -- Test user with warning level nitrate
    ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 35, 'mg/l', 'Warning level nitrate - should trigger warning alert', NOW());

-- You can also test with good values by running this instead:
-- INSERT INTO public.water_parameters (user_id, parameter_type, value, unit, notes, measured_at)
-- VALUES 
--     ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'ph', 7.2, '', 'Good pH level', NOW()),
--     ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'temperature', 20.0, '°C', 'Good temperature', NOW()),
--     ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrite', 0.1, 'mg/l', 'Good nitrite level', NOW()),
--     ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'nitrate', 15, 'mg/l', 'Good nitrate level', NOW()),
--     ('2db88c5f-3bed-46f5-98db-bfaaaa1bdf1d', 'phosphate', 0.3, 'mg/l', 'Good phosphate level', NOW());
