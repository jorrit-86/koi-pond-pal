-- Fix RLS Policies voor Localhost Testomgeving
-- Dit script zorgt ervoor dat RLS policies correct werken met authenticatie
-- Run dit in Supabase SQL Editor na het uploaden van je SQL

-- ============================================
-- 1. FIX USERS TABLE RLS POLICIES
-- ============================================

-- Drop bestaande policies om conflicten te voorkomen
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;

-- Maak nieuwe, simpele policies voor users table
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Admin policy voor het bekijken van alle users
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

-- Zorg dat RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. FIX KOI TABLE RLS POLICIES
-- ============================================

-- Drop bestaande policies
DROP POLICY IF EXISTS "Users can view own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can insert own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can update own koi" ON public.koi;
DROP POLICY IF EXISTS "Users can delete own koi" ON public.koi;

-- Maak nieuwe policies voor koi table
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

-- Zorg dat RLS is enabled
ALTER TABLE public.koi ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. FIX WATER_PARAMETERS TABLE RLS POLICIES
-- ============================================

-- Drop bestaande policies
DROP POLICY IF EXISTS "Users can view own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can insert own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can update own water parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Users can delete own water parameters" ON public.water_parameters;

-- Maak nieuwe policies voor water_parameters table
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

-- Zorg dat RLS is enabled
ALTER TABLE public.water_parameters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. FIX WATER_CHANGES TABLE RLS POLICIES (indien deze bestaat)
-- ============================================

-- Drop bestaande policies
DROP POLICY IF EXISTS "Users can view own water changes" ON public.water_changes;
DROP POLICY IF EXISTS "Users can insert own water changes" ON public.water_changes;
DROP POLICY IF EXISTS "Users can update own water changes" ON public.water_changes;
DROP POLICY IF EXISTS "Users can delete own water changes" ON public.water_changes;

-- Maak nieuwe policies voor water_changes table (indien table bestaat)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'water_changes') THEN
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
-- 5. VERIFY POLICIES
-- ============================================

-- Toon alle policies voor verificatie
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;












