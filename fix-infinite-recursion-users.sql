-- Fix Infinite Recursion in Users Table RLS Policy
-- De "Admins can view all users" policy veroorzaakt infinite recursion
-- Dit script verwijdert de recursieve policy en maakt een veilige versie

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

-- ============================================
-- 2. DISABLE RLS TEMPORARILY TO BREAK RECURSION
-- ============================================

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CREATE SECURITY DEFINER FUNCTION FOR ADMIN CHECK
-- ============================================

-- Maak een security definer functie die de recursie doorbreekt
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deze functie heeft security definer, dus bypass RLS
  RETURN EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

-- ============================================
-- 4. RE-ENABLE RLS
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CREATE NON-RECURSIVE POLICIES
-- ============================================

-- Basis policy voor users om hun eigen profiel te bekijken
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT 
    USING (auth.uid() = id);

-- Policy voor users om hun eigen profiel te updaten
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy voor users om hun eigen profiel aan te maken
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Admin policy die de security definer functie gebruikt (geen recursie!)
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT 
    USING (public.is_admin(auth.uid()));

-- ============================================
-- 6. VERIFY POLICIES
-- ============================================

-- Toon alle policies om te verifiëren dat ze correct zijn aangemaakt
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%users%' AND qual NOT LIKE '%public.is_admin%' THEN '⚠️ POTENTIAL RECURSION'
        ELSE '✅ SAFE'
    END as recursion_check
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'users'
ORDER BY policyname;

-- ============================================
-- 7. GRANT EXECUTE PERMISSION ON FUNCTION
-- ============================================

-- Zorg dat alle authenticated users de functie kunnen gebruiken
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;












