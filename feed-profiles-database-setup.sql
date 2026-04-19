-- Feed Profiles Database Setup
-- Run this in your Supabase SQL Editor

-- Create feed_profiles table
CREATE TABLE IF NOT EXISTS public.feed_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_name TEXT NOT NULL,
    description TEXT,
    
    -- Koi data settings
    use_database_data BOOLEAN DEFAULT true,
    manual_lengths TEXT, -- Comma-separated lengths for manual input
    parameter_a DECIMAL(10,6) DEFAULT 0.014,
    parameter_b DECIMAL(10,6) DEFAULT 3.00,
    use_condition_factor BOOLEAN DEFAULT false,
    condition_factor DECIMAL(10,6) DEFAULT 1.0,
    
    -- Water parameters
    temperature DECIMAL(5,2) DEFAULT 20.0,
    protein DECIMAL(5,4) DEFAULT 0.40,
    tan DECIMAL(5,2) DEFAULT 0.5,
    ph DECIMAL(4,2) DEFAULT 7.0,
    oxygen DECIMAL(5,2), -- Optional, NULL means use default 7.0
    
    -- Filter and feeding settings
    filter_capacity TEXT DEFAULT 'strong' CHECK (filter_capacity IN ('weak', 'medium', 'strong')),
    use_auto_filter_capacity BOOLEAN DEFAULT true,
    feeding_method TEXT DEFAULT 'manual' CHECK (feeding_method IN ('manual', 'automatic')),
    goal_choice TEXT DEFAULT 'growth' CHECK (goal_choice IN ('growth', 'maintenance')),
    
    -- Calculated results (for quick reference)
    total_weight_grams DECIMAL(10,2),
    average_weight_grams DECIMAL(10,2),
    daily_feed_grams DECIMAL(10,2),
    feeding_frequency INTEGER,
    feed_per_meal_grams DECIMAL(10,2),
    
    -- Auto-feeder settings
    auto_feeder_enabled BOOLEAN DEFAULT false,
    auto_feeder_device_id TEXT, -- ID of connected auto-feeder device
    auto_feeder_schedule JSONB, -- Schedule configuration
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create auto_feeder_devices table for connected devices
CREATE TABLE IF NOT EXISTS public.auto_feeder_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT DEFAULT 'auto_feeder' CHECK (device_type IN ('auto_feeder', 'smart_feeder', 'dispenser')),
    device_id TEXT UNIQUE NOT NULL, -- Unique device identifier
    connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error')),
    last_seen TIMESTAMP WITH TIME ZONE,
    capabilities JSONB, -- Device capabilities (max_feed_amount, schedule_types, etc.)
    settings JSONB, -- Device-specific settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feed_schedules table for automated feeding
CREATE TABLE IF NOT EXISTS public.feed_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.feed_profiles(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.auto_feeder_devices(id) ON DELETE SET NULL,
    
    schedule_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Schedule configuration
    feeding_times JSONB NOT NULL, -- Array of feeding times (e.g., ["08:00", "12:00", "16:00", "20:00"])
    feed_amount_per_meal DECIMAL(10,2) NOT NULL, -- Amount in grams per feeding
    days_of_week INTEGER[] DEFAULT '{1,2,3,4,5,6,7}', -- 1=Monday, 7=Sunday
    
    -- Temperature-based adjustments
    temperature_adjustments JSONB, -- Adjustments based on temperature ranges
    weather_adjustments JSONB, -- Adjustments based on weather conditions
    
    -- Execution tracking
    last_executed TIMESTAMP WITH TIME ZONE,
    next_execution TIMESTAMP WITH TIME ZONE,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feed_executions table for tracking actual feedings
CREATE TABLE IF NOT EXISTS public.feed_executions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES public.feed_schedules(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.auto_feeder_devices(id) ON DELETE SET NULL,
    
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_time TIMESTAMP WITH TIME ZONE,
    planned_amount DECIMAL(10,2) NOT NULL,
    actual_amount DECIMAL(10,2), -- Actual amount dispensed
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'executed', 'failed', 'cancelled')),
    error_message TEXT,
    
    -- Environmental conditions at time of feeding
    temperature DECIMAL(5,2),
    weather_conditions TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feed_profiles_user_id ON public.feed_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_profiles_active ON public.feed_profiles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_auto_feeder_devices_user_id ON public.auto_feeder_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_schedules_user_id ON public.feed_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_schedules_active ON public.feed_schedules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_feed_executions_user_id ON public.feed_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_executions_scheduled_time ON public.feed_executions(scheduled_time);

-- Add RLS policies
ALTER TABLE public.feed_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_feeder_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for feed_profiles
CREATE POLICY "Users can view their own feed profiles" ON public.feed_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feed profiles" ON public.feed_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feed profiles" ON public.feed_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feed profiles" ON public.feed_profiles
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for auto_feeder_devices
CREATE POLICY "Users can view their own auto feeder devices" ON public.auto_feeder_devices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auto feeder devices" ON public.auto_feeder_devices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto feeder devices" ON public.auto_feeder_devices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto feeder devices" ON public.auto_feeder_devices
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for feed_schedules
CREATE POLICY "Users can view their own feed schedules" ON public.feed_schedules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feed schedules" ON public.feed_schedules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feed schedules" ON public.feed_schedules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feed schedules" ON public.feed_schedules
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for feed_executions
CREATE POLICY "Users can view their own feed executions" ON public.feed_executions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feed executions" ON public.feed_executions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feed executions" ON public.feed_executions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feed executions" ON public.feed_executions
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.feed_profiles IS 'Saved feed calculation profiles for automated feeding';
COMMENT ON TABLE public.auto_feeder_devices IS 'Connected auto-feeder devices';
COMMENT ON TABLE public.feed_schedules IS 'Automated feeding schedules';
COMMENT ON TABLE public.feed_executions IS 'Tracked feeding executions';

-- Verify tables were created
SELECT 'Feed profiles database setup completed successfully' as status;
