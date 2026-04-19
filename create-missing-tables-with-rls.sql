-- Create missing tables with proper RLS setup
-- This script ensures all tables mentioned in security warnings exist with proper RLS

-- ==============================================
-- CREATE MISSING TABLES IF THEY DON'T EXIST
-- ==============================================

-- Create admin_audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feed_brands table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.feed_brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merk TEXT NOT NULL,
  eiwit DECIMAL NOT NULL,
  vet DECIMAL NOT NULL,
  rendement DECIMAL NOT NULL DEFAULT 1.0,
  type TEXT NOT NULL,
  description TEXT,
  ruwe_celstof DECIMAL,
  ruwe_as DECIMAL,
  fosfor DECIMAL,
  vorm TEXT,
  bron TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create esp32_config_test table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.esp32_config_test (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  display_letter TEXT NOT NULL DEFAULT 'A',
  update_interval INTEGER NOT NULL DEFAULT 300,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sensor_configurations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sensor_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  sensor_id TEXT NOT NULL,
  device_name TEXT,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- ENABLE RLS ON ALL TABLES
-- ==============================================

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esp32_config_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_configurations ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ==============================================

-- Indexes for admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON public.admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_type ON public.admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at);

-- Indexes for feed_brands
CREATE INDEX IF NOT EXISTS idx_feed_brands_merk ON public.feed_brands(merk);
CREATE INDEX IF NOT EXISTS idx_feed_brands_type ON public.feed_brands(type);

-- Indexes for esp32_config_test
CREATE INDEX IF NOT EXISTS idx_esp32_config_test_updated_at ON public.esp32_config_test(updated_at);

-- Indexes for sensor_configurations
CREATE INDEX IF NOT EXISTS idx_sensor_configurations_user_id ON public.sensor_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_sensor_configurations_sensor_id ON public.sensor_configurations(sensor_id);

-- ==============================================
-- CREATE RLS POLICIES
-- ==============================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admin audit log access" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admin audit log insert" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Feed brands read access" ON public.feed_brands;
DROP POLICY IF EXISTS "ESP32 config read access" ON public.esp32_config_test;
DROP POLICY IF EXISTS "ESP32 config write access" ON public.esp32_config_test;
DROP POLICY IF EXISTS "ESP32 config update access" ON public.esp32_config_test;
DROP POLICY IF EXISTS "Users can view own sensor configurations" ON public.sensor_configurations;
DROP POLICY IF EXISTS "Users can insert own sensor configurations" ON public.sensor_configurations;
DROP POLICY IF EXISTS "Users can update own sensor configurations" ON public.sensor_configurations;
DROP POLICY IF EXISTS "Users can delete own sensor configurations" ON public.sensor_configurations;

-- RLS Policies for admin_audit_log table
CREATE POLICY "Admin audit log access" ON public.admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin audit log insert" ON public.admin_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for feed_brands table (public read access)
CREATE POLICY "Feed brands read access" ON public.feed_brands
  FOR SELECT USING (true);

-- RLS Policies for esp32_config_test table (public access for ESP32 devices)
CREATE POLICY "ESP32 config read access" ON public.esp32_config_test
  FOR SELECT USING (true);

CREATE POLICY "ESP32 config write access" ON public.esp32_config_test
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ESP32 config update access" ON public.esp32_config_test
  FOR UPDATE USING (true);

-- RLS Policies for sensor_configurations table
CREATE POLICY "Users can view own sensor configurations" ON public.sensor_configurations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sensor configurations" ON public.sensor_configurations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sensor configurations" ON public.sensor_configurations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sensor configurations" ON public.sensor_configurations
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON TABLE public.admin_audit_log IS 'Audit log for all admin actions';
COMMENT ON TABLE public.feed_brands IS 'Database of feed brands with efficiency ratings';
COMMENT ON TABLE public.esp32_config_test IS 'Configuration table for ESP32 letter display';
COMMENT ON TABLE public.sensor_configurations IS 'User sensor device configurations';



