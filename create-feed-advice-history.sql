-- Create feed_advice_history table for logging automatic and manual calculations
CREATE TABLE IF NOT EXISTS public.feed_advice_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    avg_water_temp DECIMAL(4,2),
    avg_air_temp DECIMAL(4,2),
    feed_advice_g DECIMAL(8,2),
    source VARCHAR(10) NOT NULL CHECK (source IN ('auto', 'manual')),
    calculation_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feed_advice_history_user_id ON public.feed_advice_history(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_advice_history_date ON public.feed_advice_history(calculation_date);
CREATE INDEX IF NOT EXISTS idx_feed_advice_history_user_date ON public.feed_advice_history(user_id, calculation_date DESC);
CREATE INDEX IF NOT EXISTS idx_feed_advice_history_source ON public.feed_advice_history(source);

-- Enable RLS
ALTER TABLE public.feed_advice_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own feed advice history" ON public.feed_advice_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feed advice history" ON public.feed_advice_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feed advice history" ON public.feed_advice_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feed advice history" ON public.feed_advice_history
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.feed_advice_history IS 'Stores feed advice calculations with 3-day averages and source tracking';
COMMENT ON COLUMN public.feed_advice_history.source IS 'Source of calculation: auto (nightly) or manual (user triggered)';
COMMENT ON COLUMN public.feed_advice_history.calculation_details IS 'JSON object with detailed calculation parameters and results';





