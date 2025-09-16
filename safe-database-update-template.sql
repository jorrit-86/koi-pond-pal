-- 🛡️ VEILIG DATABASE UPDATE TEMPLATE
-- Gebruik dit template voor ALLE toekomstige database wijzigingen
-- Datum: [VUL DATUM IN]
-- Beschrijving: [VUL BESCHRIJVING IN]

-- ⚠️ STAP 1: MAAK ALTIJD BACKUPS VOORAF
-- Backup van alle belangrijke tabellen
CREATE TABLE IF NOT EXISTS backup_water_parameters_$(date) AS SELECT * FROM water_parameters;
CREATE TABLE IF NOT EXISTS backup_user_preferences_$(date) AS SELECT * FROM user_preferences;
CREATE TABLE IF NOT EXISTS backup_koi_$(date) AS SELECT * FROM koi;
CREATE TABLE IF NOT EXISTS backup_koi_photos_$(date) AS SELECT * FROM koi_photos;
CREATE TABLE IF NOT EXISTS backup_koi_log_entries_$(date) AS SELECT * FROM koi_log_entries;
CREATE TABLE IF NOT EXISTS backup_ai_chat_history_$(date) AS SELECT * FROM ai_chat_history;

-- ⚠️ STAP 2: VOER WIJZIGINGEN UIT (ALLEEN ALTER TABLE)
-- VOORBEELD: Nieuwe kolom toevoegen
-- ALTER TABLE public.water_parameters 
-- ADD COLUMN IF NOT EXISTS new_column TEXT DEFAULT 'default_value';

-- VOORBEELD: Bestaande kolom wijzigen
-- ALTER TABLE public.water_parameters 
-- ALTER COLUMN existing_column SET DEFAULT 'new_default';

-- VOORBEELD: Index toevoegen
-- CREATE INDEX IF NOT EXISTS idx_new_index ON public.water_parameters(new_column);

-- ⚠️ STAP 3: VERIFIEER DATA INTEGRITEIT
-- Controleer dat alle data intact is
SELECT 'Water Parameters' as table_name, COUNT(*) as count FROM backup_water_parameters_$(date)
UNION ALL
SELECT 'Water Parameters (New)' as table_name, COUNT(*) as count FROM water_parameters
UNION ALL
SELECT 'User Preferences' as table_name, COUNT(*) as count FROM backup_user_preferences_$(date)
UNION ALL
SELECT 'User Preferences (New)' as table_name, COUNT(*) as count FROM user_preferences;

-- ⚠️ STAP 4: TEST FUNCTIONALITEIT
-- Voeg hier test queries toe om te controleren of alles werkt
-- SELECT * FROM water_parameters LIMIT 5;
-- SELECT * FROM user_preferences LIMIT 5;

-- ⚠️ STAP 5: CLEANUP (ALLEEN NA VERIFICATIE)
-- Verwijder backups alleen als alles correct werkt
-- DROP TABLE backup_water_parameters_$(date);
-- DROP TABLE backup_user_preferences_$(date);
-- DROP TABLE backup_koi_$(date);
-- DROP TABLE backup_koi_photos_$(date);
-- DROP TABLE backup_koi_log_entries_$(date);
-- DROP TABLE backup_ai_chat_history_$(date);

SELECT 'Veilige database update voltooid' as status;
