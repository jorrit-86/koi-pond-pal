-- Comprehensive Fix voor Localhost Data Access Problemen
-- Dit script lost 401 en 406 errors op door RLS policies en triggers te fixen
-- Run dit in Supabase SQL Editor

-- ============================================
-- 1. CREATE/FIX FUNCTION TO AUTO-CREATE USER PROFILES
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, two_factor_enabled, two_factor_setup_completed, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'admin@koisensei.nl' THEN 'admin' ELSE 'user' END,
    false,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. CREATE TRIGGER FOR AUTO USER CREATION
-- ============================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires when new auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. FIX USERS TABLE RLS POLICIES
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;

-- Recreate policies with proper permissions
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (needed for manual creation)
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Admin policy using security definer function to avoid recursion
-- First create the function if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;

-- Admin policy (non-recursive using security definer function)
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT 
    USING (public.is_admin(auth.uid()));

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. VERIFY AND FIX KOI TABLE RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can insert own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can update own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can delete own koi" ON public.koi;

CREATE POLICY "Users can view own koi" ON public.koi
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own koi" ON public.koi
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own koi" ON public.koi
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own koi" ON public.koi
    FOR DELETE 
    USING (auth.uid() = user_id);

ALTER TABLE public.koi ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. VERIFY AND FIX WATER_PARAMETERS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can insert own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can update own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can delete own water parameters" ON public.water_parameters;

CREATE POLICY "Users can view own water parameters" ON public.water_parameters
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water parameters" ON public.water_parameters
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water parameters" ON public.water_parameters
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own water parameters" ON public.water_parameters
    FOR DELETE 
    USING (auth.uid() = user_id);

ALTER TABLE public.water_parameters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. FIX WATER_CHANGES TABLE (if exists)
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'water_changes') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own water changes" ON public.water_changes';
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own water changes" ON public.water_changes';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own water changes" ON public.water_changes';
        EXECUTE 'DROP POLICY IF EXISTS "Users can delete own water changes" ON public.water_changes';
        
        EXECUTE 'CREATE POLICY "Users can view own water changes" ON public.water_changes
            FOR SELECT 
            USING (auth.uid() = user_id)';
        
        EXECUTE 'CREATE POLICY "Users can insert own water changes" ON public.water_changes
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'CREATE POLICY "Users can update own water changes" ON public.water_changes
            FOR UPDATE 
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'CREATE POLICY "Users can delete own water changes" ON public.water_changes
            FOR DELETE 
            USING (auth.uid() = user_id)';
        
        EXECUTE 'ALTER TABLE public.water_changes ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- ============================================
-- 7. VERIFY SETUP
-- ============================================

-- Show all policies for verification
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as has_using,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('users', 'koi', 'water_parameters', 'water_changes')
ORDER BY tablename, policyname;

