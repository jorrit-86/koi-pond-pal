-- Extra metingen: humidity (-02), pH (-03). Flow kolommen bestaan al.
-- Temperature mag NULL zijn zodat pH/flow POSTs zonder temperatuur werken.
-- Run in Supabase SQL Editor.

ALTER TABLE public.sensor_data
  ADD COLUMN IF NOT EXISTS humidity NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS ph NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS flow_rate NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS flow_total NUMERIC NULL;

ALTER TABLE public.sensor_data
  ALTER COLUMN temperature DROP NOT NULL;

COMMENT ON COLUMN public.sensor_data.humidity IS
  'Relative humidity % from SHT31 on sensor -02 (optional)';
COMMENT ON COLUMN public.sensor_data.ph IS
  'pH value from analog probe on sensor -03 (optional)';
COMMENT ON COLUMN public.sensor_data.flow_rate IS
  'Current water flow rate in L/min from YF-S201 on sensor -04 (optional)';
COMMENT ON COLUMN public.sensor_data.flow_total IS
  'Cumulative water volume in L on sensor -04 (monotonic; use latest value, never average)';
