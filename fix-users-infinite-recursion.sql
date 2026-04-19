-- Fix Infinite Recursion in Users Table RLS Policy
-- Dit script lost het infinite recursion probleem op door alle recursieve policies te verwijderen
-- en simpele, veilige policies te creëren

-- ============================================
-- 1. DROP ALL EXISTING POLICIES
-- ============================================

-- Verwijder alle bestaande policies die recursie kunnen veroorzaken
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can view pending user approvals" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile simple" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile simple" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile simple" ON public.users;

-- ============================================
-- 2. DISABLE RLS TEMPORARILY TO BREAK RECURSION
-- ============================================

-- Tijdelijk RLS uitschakelen om recursie te doorbreken
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RE-ENABLE RLS
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ============================================

-- BELANGRIJK: Deze policies gebruiken ALLEEN auth.uid() en vergelijken met id
-- Ze doen GEEN queries naar de users tabel zelf, dus geen recursie!

-- Users kunnen hun eigen profiel bekijken
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT 
    USING (auth.uid() = id);

-- Users kunnen hun eigen profiel updaten
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users kunnen hun eigen profiel aanmaken
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 5. VERIFY POLICIES
-- ============================================

-- Toon alle policies om te verifiëren
SELECT 
    tablename,
    policyname,
    cmd,
    qual as policy_condition
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'users'
ORDER BY policyname;

-- ============================================
-- NOTITIE: Admin Policy
-- ============================================
-- Als je admin functionaliteit nodig hebt om alle users te zien,
-- gebruik dan een SECURITY DEFINER functie (zie fix-infinite-recursion-users.sql)
-- Voor nu hebben we alleen de basis policies zonder admin support
-- om de recursie te voorkomen.












