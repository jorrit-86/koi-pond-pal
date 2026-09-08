-- Optional: add device_id to sensor_configurations if you want schema parity with newer code.
-- Not required for sensor linking — sensor_id is used as the device identifier.

ALTER TABLE public.sensor_configurations
  ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sensor_configurations_device_id
  ON public.sensor_configurations(device_id);

-- Backfill: device_id = sensor_id for existing device rows
UPDATE public.sensor_configurations
SET device_id = sensor_id
WHERE device_id IS NULL
  AND sensor_id LIKE 'KOIoT-%';
