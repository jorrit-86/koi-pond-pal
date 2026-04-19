-- Create table for automatic feed calculations
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auto_feed_calculations_user_id ON public.auto_feed_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_feed_calculations_date ON public.auto_feed_calculations(calculation_date);
CREATE INDEX IF NOT EXISTS idx_auto_feed_calculations_user_date ON public.auto_feed_calculations(user_id, calculation_date DESC);

-- Enable RLS
ALTER TABLE public.auto_feed_calculations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own auto feed calculations" ON public.auto_feed_calculations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auto feed calculations" ON public.auto_feed_calculations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto feed calculations" ON public.auto_feed_calculations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto feed calculations" ON public.auto_feed_calculations
    FOR DELETE USING (auth.uid() = user_id);

-- Create table for scheduled calculations
CREATE TABLE IF NOT EXISTS public.feed_calculation_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    calculation_interval_days INTEGER DEFAULT 3,
    next_calculation_date TIMESTAMP WITH TIME ZONE,
    last_calculation_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for schedule table
ALTER TABLE public.feed_calculation_schedule ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for schedule table
CREATE POLICY "Users can manage their own calculation schedule" ON public.feed_calculation_schedule
    FOR ALL USING (auth.uid() = user_id);

-- Insert default schedule for existing users (optional)
-- This would be done via application logic, not SQL





