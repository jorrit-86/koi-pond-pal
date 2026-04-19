-- Complete setup for automatic feed calculations
-- This script creates all necessary tables and policies

-- 1. Create auto_feed_calculations table
CREATE TABLE IF NOT EXISTS public.auto_feed_calculations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    pond_temperature DECIMAL(4,2),
    ambient_temperature DECIMAL(4,2),
    avg_pond_temperature_3d DECIMAL(4,2),
    avg_ambient_temperature_3d DECIMAL(4,2),
    season VARCHAR(20),
    filter_status VARCHAR(20),
    water_quality_ammonia DECIMAL(4,2),
    water_quality_nitrite DECIMAL(4,2),
    feed_brand VARCHAR(100),
    feed_brand_efficiency DECIMAL(3,2),
    total_biomass DECIMAL(10,2),
    temperature_scale DECIMAL(3,2),
    filter_factor DECIMAL(3,2),
    water_quality_factor DECIMAL(3,2),
    feed_brand_factor DECIMAL(3,2),
    total_daily_feed DECIMAL(8,2),
    feeding_frequency INTEGER,
    feeding_times TEXT[],
    warnings TEXT[],
    calculation_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create feed_calculation_schedule table
CREATE TABLE IF NOT EXISTS public.feed_calculation_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    calculation_interval_days INTEGER DEFAULT 3,
    next_calculation_date TIMESTAMP WITH TIME ZONE,
    last_calculation_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auto_feed_calculations_user_id ON public.auto_feed_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_feed_calculations_date ON public.auto_feed_calculations(calculation_date);
CREATE INDEX IF NOT EXISTS idx_auto_feed_calculations_user_date ON public.auto_feed_calculations(user_id, calculation_date DESC);

CREATE INDEX IF NOT EXISTS idx_feed_calculation_schedule_user_id ON public.feed_calculation_schedule(user_id);

-- 4. Enable RLS
ALTER TABLE public.auto_feed_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_calculation_schedule ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for auto_feed_calculations
CREATE POLICY "Users can view their own auto feed calculations" ON public.auto_feed_calculations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auto feed calculations" ON public.auto_feed_calculations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto feed calculations" ON public.auto_feed_calculations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto feed calculations" ON public.auto_feed_calculations
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Create RLS policies for feed_calculation_schedule
CREATE POLICY "Users can manage their own calculation schedule" ON public.feed_calculation_schedule
    FOR ALL USING (auth.uid() = user_id);

-- 7. Insert default schedule for existing users
INSERT INTO public.feed_calculation_schedule (user_id, is_enabled, calculation_interval_days, next_calculation_date)
SELECT 
    id as user_id,
    true as is_enabled,
    3 as calculation_interval_days,
    (NOW() + INTERVAL '3 days')::timestamp with time zone as next_calculation_date
FROM auth.users
WHERE id NOT IN (
    SELECT user_id FROM public.feed_calculation_schedule
)
ON CONFLICT (user_id) DO NOTHING;

-- 8. Add comments for documentation
COMMENT ON TABLE public.auto_feed_calculations IS 'Stores automatic feed calculations with 3-day average temperatures';
COMMENT ON TABLE public.feed_calculation_schedule IS 'Manages automatic calculation scheduling for users';
COMMENT ON COLUMN public.auto_feed_calculations.avg_pond_temperature_3d IS '3-day average pond temperature used for calculation';
COMMENT ON COLUMN public.auto_feed_calculations.calculation_details IS 'JSON object with additional calculation metadata';
