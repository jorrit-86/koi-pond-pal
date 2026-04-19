-- Make esp32_config_test table publicly accessible
-- This script disables RLS and grants public access

-- Disable Row Level Security
ALTER TABLE esp32_config_test DISABLE ROW LEVEL SECURITY;

-- Grant public access to anonymous users
GRANT SELECT, INSERT, UPDATE ON esp32_config_test TO anon;
GRANT SELECT, INSERT, UPDATE ON esp32_config_test TO authenticated;

-- Verify the table is accessible
SELECT 'Table is now publicly accessible' as status;





