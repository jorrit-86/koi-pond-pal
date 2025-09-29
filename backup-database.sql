-- 🛡️ Database Backup Script voor Live Update
-- Datum: $(date)
-- Doel: Backup maken van alle kritieke data voordat live update wordt uitgevoerd

-- ⚠️ KRITIEK: Dit script moet ALTIJD worden uitgevoerd voordat een live update!

-- Stap 1: Maak backup van alle kritieke tabellen
-- Gebruik timestamp voor unieke backup namen
DO $$
DECLARE
    backup_suffix TEXT := '_backup_' || to_char(now(), 'YYYY_MM_DD_HH24_MI_SS');
BEGIN
    -- Backup users table
    EXECUTE format('CREATE TABLE IF NOT EXISTS backup_users%s AS SELECT * FROM public.users', backup_suffix);
    
    -- Backup water_parameters table
    EXECUTE format('CREATE TABLE IF NOT EXISTS backup_water_parameters%s AS SELECT * FROM public.water_parameters', backup_suffix);
    
    -- Backup koi table
    EXECUTE format('CREATE TABLE IF NOT EXISTS backup_koi%s AS SELECT * FROM public.koi', backup_suffix);
    
    -- Backup user_settings table
    EXECUTE format('CREATE TABLE IF NOT EXISTS backup_user_settings%s AS SELECT * FROM public.user_settings', backup_suffix);
    
    -- Backup koi_photos table (als deze bestaat)
    EXECUTE format('CREATE TABLE IF NOT EXISTS backup_koi_photos%s AS SELECT * FROM public.koi_photos', backup_suffix);
    
    -- Backup koi_log_entries table (als deze bestaat)
    EXECUTE format('CREATE TABLE IF NOT EXISTS backup_koi_log_entries%s AS SELECT * FROM public.koi_log_entries', backup_suffix);
    
    -- Backup sensor_data table (als deze bestaat)
    EXECUTE format('CREATE TABLE IF NOT EXISTS backup_sensor_data%s AS SELECT * FROM public.sensor_data', backup_suffix);
    
    -- Backup sensor_configurations table (als deze bestaat)
    EXECUTE format('CREATE TABLE IF NOT EXISTS backup_sensor_configurations%s AS SELECT * FROM public.sensor_configurations', backup_suffix);
    
    RAISE NOTICE 'Backup voltooid met suffix: %', backup_suffix;
END $$;

-- Stap 2: Verifieer backup integriteit
SELECT 
    'users' as table_name,
    COUNT(*) as backup_count,
    (SELECT COUNT(*) FROM public.users) as original_count
FROM backup_users_backup_$(date)
UNION ALL
SELECT 
    'water_parameters' as table_name,
    COUNT(*) as backup_count,
    (SELECT COUNT(*) FROM public.water_parameters) as original_count
FROM backup_water_parameters_backup_$(date)
UNION ALL
SELECT 
    'koi' as table_name,
    COUNT(*) as backup_count,
    (SELECT COUNT(*) FROM public.koi) as original_count
FROM backup_koi_backup_$(date)
UNION ALL
SELECT 
    'user_settings' as table_name,
    COUNT(*) as backup_count,
    (SELECT COUNT(*) FROM public.user_settings) as original_count
FROM backup_user_settings_backup_$(date);

-- Stap 3: Toon backup informatie
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE 'backup_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Stap 4: Log backup actie
INSERT INTO public.backup_log (backup_type, backup_tables, created_at)
VALUES (
    'pre_deployment',
    'users,water_parameters,koi,user_settings,koi_photos,koi_log_entries,sensor_data,sensor_configurations',
    NOW()
);

-- ✅ Backup voltooid - Veilig om door te gaan met deployment
