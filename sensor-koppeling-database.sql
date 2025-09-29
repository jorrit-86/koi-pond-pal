-- Sensor Koppeling Database Uitbreiding
-- Run this in your Supabase SQL Editor

-- 1. Uitbreiden sensor_data tabel met user_id en status
ALTER TABLE public.sensor_data 
ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending_transfer', 'transferred', 'offline'));

-- 2. Index toevoegen voor betere performance
CREATE INDEX idx_sensor_data_user_id ON public.sensor_data(user_id);
CREATE INDEX idx_sensor_data_status ON public.sensor_data(status);

-- 3. Tabel voor sensor koppelingen
CREATE TABLE public.user_sensors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  sensor_id TEXT NOT NULL,
  sensor_name TEXT, -- Optionele naam voor de sensor (bijv. "Vijver Sensor", "Filter Sensor")
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending_transfer', 'transferred')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sensor_id) -- Elke sensor kan maar bij één gebruiker horen
);

-- 4. Tabel voor sensor overname verzoeken
CREATE TABLE public.sensor_transfer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id TEXT NOT NULL,
  from_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  message TEXT, -- Optionele boodschap van de aanvrager
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),ga door
  responded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- 5. Indexen voor performance
CREATE INDEX idx_user_sensors_user_id ON public.user_sensors(user_id);
CREATE INDEX idx_user_sensors_sensor_id ON public.user_sensors(sensor_id);
CREATE INDEX idx_sensor_transfer_requests_sensor_id ON public.sensor_transfer_requests(sensor_id);
CREATE INDEX idx_sensor_transfer_requests_to_user_id ON public.sensor_transfer_requests(to_user_id);
CREATE INDEX idx_sensor_transfer_requests_status ON public.sensor_transfer_requests(status);

-- 6. RLS Policies voor sensor_data
DROP POLICY IF EXISTS "Allow anonymous sensor data insertion" ON public.sensor_data;
DROP POLICY IF EXISTS "Allow anonymous sensor data select" ON public.sensor_data;

-- Nieuwe policies voor sensor_data
CREATE POLICY "Allow sensor data insertion with user_id" ON public.sensor_data
  FOR INSERT WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Allow users to read their own sensor data" ON public.sensor_data
  FOR SELECT USING (auth.uid() = user_id);

-- 7. RLS Policies voor user_sensors
ALTER TABLE public.user_sensors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read their own sensors" ON public.user_sensors
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own sensors" ON public.user_sensors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own sensors" ON public.user_sensors
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own sensors" ON public.user_sensors
  FOR DELETE USING (auth.uid() = user_id);

-- 8. RLS Policies voor sensor_transfer_requests
ALTER TABLE public.sensor_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read transfer requests they are involved in" ON public.sensor_transfer_requests
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Allow users to create transfer requests" ON public.sensor_transfer_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Allow users to update transfer requests they received" ON public.sensor_transfer_requests
  FOR UPDATE USING (auth.uid() = to_user_id);

-- 9. Functie om sensor overname te verwerken
CREATE OR REPLACE FUNCTION process_sensor_transfer(
  p_sensor_id TEXT,
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_accept BOOLEAN
) RETURNS BOOLEAN AS $$
DECLARE
  transfer_request RECORD;
BEGIN
  -- Zoek het transfer verzoek
  SELECT * INTO transfer_request
  FROM sensor_transfer_requests
  WHERE sensor_id = p_sensor_id
    AND from_user_id = p_from_user_id
    AND to_user_id = p_to_user_id
    AND status = 'pending'
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  IF p_accept THEN
    -- Accepteer de transfer
    UPDATE sensor_transfer_requests
    SET status = 'accepted', responded_at = NOW()
    WHERE id = transfer_request.id;
    
    -- Update de sensor eigenaar
    UPDATE user_sensors
    SET user_id = p_to_user_id, status = 'transferred', updated_at = NOW()
    WHERE sensor_id = p_sensor_id AND user_id = p_from_user_id;
    
    -- Update alle sensor_data records
    UPDATE sensor_data
    SET user_id = p_to_user_id, status = 'transferred'
    WHERE sensor_id = p_sensor_id AND user_id = p_from_user_id;
    
  ELSE
    -- Weiger de transfer
    UPDATE sensor_transfer_requests
    SET status = 'rejected', responded_at = NOW()
    WHERE id = transfer_request.id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Functie om sensor online status te controleren
CREATE OR REPLACE FUNCTION update_sensor_online_status() RETURNS VOID AS $$
BEGIN
  -- Markeer sensoren als offline als ze langer dan 10 minuten geen data hebben
  UPDATE user_sensors
  SET status = 'offline'
  WHERE sensor_id IN (
    SELECT DISTINCT us.sensor_id
    FROM user_sensors us
    LEFT JOIN sensor_data sd ON us.sensor_id = sd.sensor_id
    WHERE us.status = 'active'
    GROUP BY us.sensor_id
    HAVING MAX(sd.created_at) < NOW() - INTERVAL '10 minutes'
    OR MAX(sd.created_at) IS NULL
  );
  
  -- Markeer sensoren als online als ze recent data hebben
  UPDATE user_sensors
  SET status = 'active'
  WHERE sensor_id IN (
    SELECT DISTINCT sensor_id
    FROM sensor_data
    WHERE created_at > NOW() - INTERVAL '10 minutes'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Trigger om updated_at automatisch bij te werken
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_sensors_updated_at
  BEFORE UPDATE ON user_sensors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
