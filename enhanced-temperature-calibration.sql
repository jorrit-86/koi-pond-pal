-- Enhanced Temperature Calibration Database Setup
-- This script adds improved calibration options to the individual_sensor_configs table

-- Add new columns for enhanced temperature calibration
ALTER TABLE public.individual_sensor_configs 
ADD COLUMN IF NOT EXISTS min_valid_temp DECIMAL DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS max_valid_temp DECIMAL DEFAULT 50.0,
ADD COLUMN IF NOT EXISTS smoothing_samples INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS outlier_threshold DECIMAL DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS auto_calibration_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reference_sensor_id TEXT,
ADD COLUMN IF NOT EXISTS calibration_offset DECIMAL DEFAULT 0.0;

-- Create index for reference sensor lookups
CREATE INDEX IF NOT EXISTS idx_individual_sensor_configs_reference_sensor 
ON public.individual_sensor_configs(reference_sensor_id);

-- Update existing sensor configurations with improved defaults
UPDATE public.individual_sensor_configs 
SET 
  min_valid_temp = 0.0,
  max_valid_temp = 50.0,
  smoothing_samples = 5,
  outlier_threshold = 2.0,
  auto_calibration_enabled = FALSE
WHERE sensor_id = 'KOIoT-A1b2C3' AND sensor_type = 'vijver_water';

-- Configure sensor 2 (filter_inlaat) with enhanced calibration
UPDATE public.individual_sensor_configs 
SET 
  min_valid_temp = 0.0,
  max_valid_temp = 50.0,
  smoothing_samples = 8,  -- More smoothing for unstable sensor
  outlier_threshold = 3.0,  -- Higher threshold for this sensor
  auto_calibration_enabled = TRUE,
  reference_sensor_id = 'KOIoT-A1b2C3-vijver_water',  -- Use sensor 1 as reference
  calibration_offset = 4.0  -- Calibrate to match sensor 1
WHERE sensor_id = 'KOIoT-A1b2C3' AND sensor_type = 'filter_inlaat';

-- Create a view for temperature sensor statistics
CREATE OR REPLACE VIEW temperature_sensor_stats AS
SELECT 
  sensor_id,
  sensor_type,
  display_name,
  temperature_offset,
  temperature_scale,
  min_valid_temp,
  max_valid_temp,
  smoothing_samples,
  outlier_threshold,
  auto_calibration_enabled,
  reference_sensor_id,
  calibration_offset,
  enabled,
  created_at,
  updated_at
FROM public.individual_sensor_configs
WHERE sensor_type IN ('vijver_water', 'filter_inlaat', 'temperatuurmeter');

-- Create a function to get sensor calibration recommendations
CREATE OR REPLACE FUNCTION get_sensor_calibration_recommendations(target_sensor_id TEXT)
RETURNS TABLE (
  sensor_id TEXT,
  sensor_type TEXT,
  current_offset DECIMAL,
  recommended_offset DECIMAL,
  current_scale DECIMAL,
  recommended_scale DECIMAL,
  calibration_quality TEXT
) AS $$
DECLARE
  target_config RECORD;
  reference_config RECORD;
  temp_diff DECIMAL;
BEGIN
  -- Get target sensor configuration
  SELECT * INTO target_config
  FROM public.individual_sensor_configs
  WHERE individual_sensor_configs.sensor_id = target_sensor_id
  LIMIT 1;
  
  IF target_config.reference_sensor_id IS NOT NULL THEN
    -- Get reference sensor configuration
    SELECT * INTO reference_config
    FROM public.individual_sensor_configs
    WHERE individual_sensor_configs.sensor_id = target_config.reference_sensor_id
    LIMIT 1;
    
    -- Calculate recommended calibration
    -- This would be based on recent temperature data comparison
    -- For now, return current values with recommendations
    RETURN QUERY SELECT 
      target_config.sensor_id,
      target_config.sensor_type,
      target_config.temperature_offset,
      target_config.calibration_offset as recommended_offset,
      target_config.temperature_scale,
      1.0 as recommended_scale,
      CASE 
        WHEN target_config.auto_calibration_enabled THEN 'Auto-calibrated'
        ELSE 'Manual calibration needed'
      END as calibration_quality;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to analyze temperature data quality
CREATE OR REPLACE FUNCTION analyze_temperature_quality(sensor_id_param TEXT, days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  sensor_id TEXT,
  total_readings BIGINT,
  valid_readings BIGINT,
  invalid_readings BIGINT,
  average_temp DECIMAL,
  min_temp DECIMAL,
  max_temp DECIMAL,
  temp_range DECIMAL,
  outlier_count BIGINT,
  data_quality_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH temp_data AS (
    SELECT 
      sd.temperature,
      sd.created_at,
      CASE 
        WHEN sd.temperature IS NULL THEN 0
        WHEN sd.temperature < 0 OR sd.temperature > 50 THEN 0
        ELSE 1
      END as is_valid
    FROM public.sensor_data sd
    WHERE sd.sensor_id = sensor_id_param
      AND sd.created_at > NOW() - INTERVAL '1 day' * days_back
      AND sd.sensor_type = 'temperatuurmeter'
  ),
  stats AS (
    SELECT 
      COUNT(*) as total,
      SUM(is_valid) as valid,
      COUNT(*) - SUM(is_valid) as invalid,
      AVG(CASE WHEN is_valid = 1 THEN temperature END) as avg_temp,
      MIN(CASE WHEN is_valid = 1 THEN temperature END) as min_temp,
      MAX(CASE WHEN is_valid = 1 THEN temperature END) as max_temp
    FROM temp_data
  ),
  outliers AS (
    SELECT COUNT(*) as outlier_count
    FROM temp_data td
    JOIN stats s ON true
    WHERE td.is_valid = 1 
      AND ABS(td.temperature - s.avg_temp) > 2.0
  )
  SELECT 
    sensor_id_param,
    s.total,
    s.valid,
    s.invalid,
    s.avg_temp,
    s.min_temp,
    s.max_temp,
    s.max_temp - s.min_temp as temp_range,
    o.outlier_count,
    CASE 
      WHEN s.total = 0 THEN 0
      ELSE (s.valid::DECIMAL / s.total::DECIMAL) * 100
    END as data_quality_score
  FROM stats s, outliers o;
END;
$$ LANGUAGE plpgsql;

-- Insert improved default configurations for new sensors
INSERT INTO public.individual_sensor_configs (
  sensor_id,
  sensor_type,
  device_id,
  display_name,
  temperature_offset,
  temperature_scale,
  enabled,
  min_valid_temp,
  max_valid_temp,
  smoothing_samples,
  outlier_threshold,
  auto_calibration_enabled,
  reference_sensor_id,
  calibration_offset
) VALUES 
-- Sensor 1 (Vijver Water) - Reference sensor
(
  'KOIoT-A1b2C3',
  'vijver_water',
  'ESP32-001',
  'Vijver Water Temperatuur (Referentie)',
  0.0,
  1.0,
  true,
  0.0,
  50.0,
  5,
  2.0,
  false,
  null,
  0.0
),
-- Sensor 2 (Filter Inlaat) - Auto-calibrated to sensor 1
(
  'KOIoT-A1b2C3',
  'filter_inlaat',
  'ESP32-001',
  'Filter Inlaat Temperatuur (Gecalibreerd)',
  4.0,
  1.0,
  true,
  0.0,
  50.0,
  8,
  3.0,
  true,
  'KOIoT-A1b2C3-vijver_water',
  4.0
)
ON CONFLICT (sensor_id, sensor_type) 
DO UPDATE SET
  min_valid_temp = EXCLUDED.min_valid_temp,
  max_valid_temp = EXCLUDED.max_valid_temp,
  smoothing_samples = EXCLUDED.smoothing_samples,
  outlier_threshold = EXCLUDED.outlier_threshold,
  auto_calibration_enabled = EXCLUDED.auto_calibration_enabled,
  reference_sensor_id = EXCLUDED.reference_sensor_id,
  calibration_offset = EXCLUDED.calibration_offset,
  updated_at = NOW();

-- Create a trigger to automatically update calibration when reference sensor changes
CREATE OR REPLACE FUNCTION update_sensor_calibration()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a reference sensor update, update all dependent sensors
  IF NEW.auto_calibration_enabled = true AND NEW.reference_sensor_id IS NOT NULL THEN
    -- Update dependent sensors with new calibration
    UPDATE public.individual_sensor_configs
    SET 
      temperature_offset = NEW.calibration_offset,
      updated_at = NOW()
    WHERE reference_sensor_id = NEW.sensor_id || '-' || NEW.sensor_type;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sensor_calibration
  AFTER UPDATE ON public.individual_sensor_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_sensor_calibration();

-- Grant necessary permissions
GRANT SELECT ON temperature_sensor_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sensor_calibration_recommendations TO anon, authenticated;
GRANT EXECUTE ON FUNCTION analyze_temperature_quality TO anon, authenticated;


