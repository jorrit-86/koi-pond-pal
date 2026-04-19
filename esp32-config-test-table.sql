-- Create ESP32 configuration test table
-- This table stores a single global configuration for ESP32 letter display

CREATE TABLE IF NOT EXISTS esp32_config_test (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_letter TEXT NOT NULL DEFAULT 'A',
    update_interval INTEGER NOT NULL DEFAULT 15,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial configuration row
INSERT INTO esp32_config_test (display_letter, update_interval) 
VALUES ('A', 15)
ON CONFLICT (id) DO NOTHING;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row changes
CREATE TRIGGER update_esp32_config_test_updated_at 
    BEFORE UPDATE ON esp32_config_test 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your setup)
-- ALTER TABLE esp32_config_test ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read access" ON esp32_config_test FOR SELECT USING (true);
-- CREATE POLICY "Allow public write access" ON esp32_config_test FOR INSERT USING (true);
-- CREATE POLICY "Allow public update access" ON esp32_config_test FOR UPDATE USING (true);





