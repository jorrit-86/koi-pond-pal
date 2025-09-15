-- Koi Sensai Database Setup (Safe Version)
-- Run this in your Supabase SQL Editor
-- This version checks if tables already exist before creating them

-- Create users table (extends auth.users) - only if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create water_parameters table - only if it doesn't exist
CREATE TABLE IF NOT EXISTS public.water_parameters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  parameter_type TEXT NOT NULL CHECK (parameter_type IN ('ph', 'temperature', 'kh', 'gh', 'nitrite', 'nitrate', 'phosphate')),
  value DECIMAL NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create koi table - only if it doesn't exist
CREATE TABLE IF NOT EXISTS public.koi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  breed TEXT,
  size DECIMAL,
  age INTEGER,
  color TEXT,
  health_status TEXT DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'sick', 'recovering')),
  last_feeding TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_settings table - only if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'nl')),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  temperature_unit TEXT DEFAULT 'celsius' CHECK (temperature_unit IN ('celsius', 'fahrenheit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (safe to run multiple times)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.koi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

DROP POLICY IF EXISTS "Users can view own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can insert own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can update own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can delete own water parameters" ON public.water_parameters;

DROP POLICY IF EXISTS "Users can view own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can insert own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can update own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can delete own koi" ON public.koi;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for water_parameters table
CREATE POLICY "Users can view own water parameters" ON public.water_parameters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water parameters" ON public.water_parameters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water parameters" ON public.water_parameters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own water parameters" ON public.water_parameters
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for koi table
CREATE POLICY "Users can view own koi" ON public.koi
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own koi" ON public.koi
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own koi" ON public.koi
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own koi" ON public.koi
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_settings table
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Drop existing triggers first (they depend on functions)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_koi_updated_at ON public.koi;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;

-- Drop and recreate functions if they exist
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers are already dropped above

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_koi_updated_at BEFORE UPDATE ON public.koi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_water_parameters_user_id ON public.water_parameters(user_id);
CREATE INDEX IF NOT EXISTS idx_water_parameters_created_at ON public.water_parameters(created_at);
CREATE INDEX IF NOT EXISTS idx_koi_user_id ON public.koi(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);
