-- Fix RLS Policies for Data Access Issues
-- This script fixes Row Level Security policies that are blocking user data access
-- Run this in Supabase SQL Editor after authentication issues are resolved

-- ============================================
-- 1. Fix maintenance_tasks RLS Policies
-- ============================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own maintenance tasks" ON public.maintenance_tasks;
DROP POLICY IF EXISTS "Users can insert their own maintenance tasks" ON public.maintenance_tasks;
DROP POLICY IF EXISTS "Users can update their own maintenance tasks" ON public.maintenance_tasks;
DROP POLICY IF EXISTS "Users can delete their own maintenance tasks" ON public.maintenance_tasks;

-- Create correct policies for maintenance_tasks
CREATE POLICY "Users can view their own maintenance tasks" ON public.maintenance_tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own maintenance tasks" ON public.maintenance_tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own maintenance tasks" ON public.maintenance_tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own maintenance tasks" ON public.maintenance_tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Fix maintenance_task_templates RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own maintenance task templates" ON public.maintenance_task_templates;
DROP POLICY IF EXISTS "Users can insert their own maintenance task templates" ON public.maintenance_task_templates;
DROP POLICY IF EXISTS "Users can update their own maintenance task templates" ON public.maintenance_task_templates;
DROP POLICY IF EXISTS "Users can delete their own maintenance task templates" ON public.maintenance_task_templates;

-- Create correct policies
CREATE POLICY "Users can view their own maintenance task templates" ON public.maintenance_task_templates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own maintenance task templates" ON public.maintenance_task_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own maintenance task templates" ON public.maintenance_task_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own maintenance task templates" ON public.maintenance_task_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.maintenance_task_templates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Verify koi table RLS Policies
-- ============================================

-- Check if policies exist, create if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'koi' 
        AND policyname = 'Users can view their own koi'
    ) THEN
        CREATE POLICY "Users can view their own koi" ON public.koi
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'koi' 
        AND policyname = 'Users can insert their own koi'
    ) THEN
        CREATE POLICY "Users can insert their own koi" ON public.koi
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'koi' 
        AND policyname = 'Users can update their own koi'
    ) THEN
        CREATE POLICY "Users can update their own koi" ON public.koi
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'koi' 
        AND policyname = 'Users can delete their own koi'
    ) THEN
        CREATE POLICY "Users can delete their own koi" ON public.koi
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

ALTER TABLE public.koi ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Verify water_parameters RLS Policies
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'water_parameters' 
        AND policyname = 'Users can view their own water parameters'
    ) THEN
        CREATE POLICY "Users can view their own water parameters" ON public.water_parameters
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'water_parameters' 
        AND policyname = 'Users can insert their own water parameters'
    ) THEN
        CREATE POLICY "Users can insert their own water parameters" ON public.water_parameters
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'water_parameters' 
        AND policyname = 'Users can update their own water parameters'
    ) THEN
        CREATE POLICY "Users can update their own water parameters" ON public.water_parameters
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'water_parameters' 
        AND policyname = 'Users can delete their own water parameters'
    ) THEN
        CREATE POLICY "Users can delete their own water parameters" ON public.water_parameters
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

ALTER TABLE public.water_parameters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Fix users table RLS (if needed for profile queries)
-- ============================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Create simple, working policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Verification Queries (Optional - Run to verify)
-- ============================================

-- Uncomment to verify policies are created:
-- SELECT tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('maintenance_tasks', 'maintenance_task_templates', 'koi', 'water_parameters', 'users')
-- ORDER BY tablename, policyname;












