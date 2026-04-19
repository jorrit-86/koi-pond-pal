-- Simple script to make esp32_config_test table publicly accessible
-- Run this in Supabase SQL Editor

-- Disable Row Level Security
ALTER TABLE esp32_config_test DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anonymous users
GRANT SELECT, INSERT, UPDATE ON esp32_config_test TO anon;
GRANT SELECT, INSERT, UPDATE ON esp32_config_test TO authenticated;

-- Test if it works
SELECT 'Table is now publicly accessible' as status;





