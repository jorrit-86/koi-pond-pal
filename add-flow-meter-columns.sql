-- Add optional flow meter columns to sensor_data
-- Run in Supabase SQL Editor

ALTER TABLE public.sensor_data
  ADD COLUMN IF NOT EXISTS flow_rate NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS flow_total NUMERIC NULL;

COMMENT ON COLUMN public.sensor_data.flow_rate IS
  'Current water flow rate in L/min (optional; from ESP32 flow meter)';

COMMENT ON COLUMN public.sensor_data.flow_total IS
  'Cumulative water volume in L since sensor first became active (monotonic counter; use latest value, never average)';

CREATE INDEX IF NOT EXISTS idx_sensor_data_flow_total
  ON public.sensor_data (sensor_id, created_at DESC)
  WHERE flow_total IS NOT NULL;
