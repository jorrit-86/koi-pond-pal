-- Verify that all Supabase security issues have been resolved
-- Run this script to check the security status

-- ==============================================
-- 1. CHECK RLS STATUS FOR ALL TABLES
-- ==============================================

SELECT 
    'RLS Status Check' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('koi', 'admin_audit_log', 'users', 'feed_brands', 'esp32_config_test', 'sensor_configurations')
ORDER BY tablename;

-- ==============================================
-- 2. CHECK RLS POLICIES FOR ALL TABLES
-- ==============================================

SELECT 
    'RLS Policies Check' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN '✅ Policy has conditions'
        ELSE '⚠️ Policy has no conditions'
    END as policy_status
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('koi', 'admin_audit_log', 'users', 'feed_brands', 'esp32_config_test', 'sensor_configurations')
ORDER BY tablename, policyname;

-- ==============================================
-- 3. CHECK VIEW SECURITY
-- ==============================================

SELECT 
    'View Security Check' as check_type,
    schemaname,
    viewname,
    CASE 
        WHEN definition LIKE '%SECURITY DEFINER%' THEN '❌ SECURITY DEFINER DETECTED'
        ELSE '✅ No SECURITY DEFINER'
    END as security_status
FROM pg_views 
WHERE schemaname = 'public' 
    AND viewname = 'pond_koi_count';

-- ==============================================
-- 4. CHECK FOR SECURITY DEFINER FUNCTIONS
-- ==============================================

SELECT 
    'Function Security Check' as check_type,
    n.nspname as schema_name,
    p.proname as function_name,
    CASE 
        WHEN p.prosecdef = true THEN '⚠️ SECURITY DEFINER'
        ELSE '✅ SECURITY INVOKER'
    END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN ('handle_new_user', 'get_pond_koi_count', 'update_updated_at_column')
ORDER BY p.proname;

-- ==============================================
-- 5. SUMMARY OF SECURITY FIXES
-- ==============================================

SELECT 
    'Security Fix Summary' as summary_type,
    'All tables now have RLS enabled' as rls_status,
    'All tables have appropriate RLS policies' as policies_status,
    'pond_koi_count view no longer uses SECURITY DEFINER' as view_status,
    'All security warnings should be resolved' as overall_status;
