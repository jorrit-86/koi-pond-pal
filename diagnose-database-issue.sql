-- Database Diagnostics Script
-- Run this to check what's wrong with the database

-- Check if users table exists and is accessible
SELECT COUNT(*) as user_count FROM public.users;

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public' 
ORDER BY ordinal_position;

-- Check for any recent errors in the database
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Check if there are any locks on the users table
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'users' AND schemaname = 'public';

-- Simple test query
SELECT id, email, role, created_at FROM public.users LIMIT 5;
