# 🛡️ Veilig Database Update Protocol

## ⚠️ KRITIEKE REGELS - NOOIT OVERTREDEN

### 1. **NOOIT DROP TABLE zonder backup**
```sql
-- ❌ VERBODEN:
DROP TABLE IF EXISTS public.water_parameters CASCADE;

-- ✅ TOEGESTAAN:
-- Stap 1: Maak backup
CREATE TABLE backup_water_parameters_$(date) AS SELECT * FROM water_parameters;

-- Stap 2: Test wijzigingen
-- Stap 3: Pas toe op originele tabel
```

### 2. **Altijd ALTER TABLE in plaats van DROP**
```sql
-- ❌ VERBODEN:
DROP TABLE IF EXISTS public.user_preferences CASCADE;
CREATE TABLE public.user_preferences (...);

-- ✅ TOEGESTAAN:
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS new_column TEXT DEFAULT 'default_value';
```

### 3. **Backup Protocol voor elke update**
```sql
-- VOOR ELKE DATABASE UPDATE:
-- 1. Maak backup
CREATE TABLE backup_table_name_$(date) AS SELECT * FROM table_name;

-- 2. Test de update op een kopie
-- 3. Pas toe op originele tabel
-- 4. Verifieer data integriteit
SELECT COUNT(*) FROM table_name; -- Moet gelijk zijn aan backup
```

## 📋 Update Checklist

### Voor elke database wijziging:
- [ ] **Backup gemaakt** van alle betrokken tabellen
- [ ] **ALTER TABLE** gebruikt in plaats van DROP
- [ ] **IF NOT EXISTS** gebruikt voor nieuwe kolommen
- [ ] **DEFAULT waarden** ingesteld voor nieuwe kolommen
- [ ] **Data integriteit** geverifieerd na update
- [ ] **RLS policies** behouden of aangepast
- [ ] **Indexes** behouden of aangepast

### Na elke database wijziging:
- [ ] **Test** alle functionaliteit
- [ ] **Controleer** console voor errors
- [ ] **Verifieer** data is intact
- [ ] **Documenteer** wijzigingen

## 🚨 Emergency Recovery

### Als data verloren gaat:
1. **Stop** alle database operaties
2. **Controleer** Supabase Recycle Bin
3. **Herstel** van backup tabellen
4. **Verifieer** data integriteit
5. **Test** alle functionaliteit

### Backup Commands:
```sql
-- Maak backup van alle belangrijke tabellen
CREATE TABLE backup_water_parameters_$(date) AS SELECT * FROM water_parameters;
CREATE TABLE backup_user_preferences_$(date) AS SELECT * FROM user_preferences;
CREATE TABLE backup_koi_$(date) AS SELECT * FROM koi;
CREATE TABLE backup_koi_photos_$(date) AS SELECT * FROM koi_photos;
CREATE TABLE backup_koi_log_entries_$(date) AS SELECT * FROM koi_log_entries;
```

## 📝 Template voor Veilige Updates

```sql
-- Veilige Database Update Template
-- Datum: [DATUM]
-- Beschrijving: [BESCHRIJVING VAN WIJZIGING]

-- Stap 1: Maak backups
CREATE TABLE backup_water_parameters_$(date) AS SELECT * FROM water_parameters;
CREATE TABLE backup_user_preferences_$(date) AS SELECT * FROM user_preferences;

-- Stap 2: Voer wijzigingen uit (ALLEEN ALTER TABLE)
ALTER TABLE public.water_parameters 
ADD COLUMN IF NOT EXISTS new_column TEXT DEFAULT 'default_value';

-- Stap 3: Verifieer data integriteit
SELECT COUNT(*) as original_count FROM backup_water_parameters_$(date);
SELECT COUNT(*) as new_count FROM water_parameters;
-- Beide counts moeten gelijk zijn!

-- Stap 4: Test functionaliteit
-- [Test queries hier]

-- Stap 5: Cleanup (optioneel na verificatie)
-- DROP TABLE backup_water_parameters_$(date);
-- DROP TABLE backup_user_preferences_$(date);
```

## ⚠️ Waarschuwingen

- **NOOIT** DROP TABLE gebruiken zonder expliciete toestemming
- **ALTIJD** backup maken voor belangrijke tabellen
- **ALTIJD** ALTER TABLE gebruiken voor schema wijzigingen
- **ALTIJD** IF NOT EXISTS gebruiken voor nieuwe kolommen
- **ALTIJD** DEFAULT waarden instellen voor nieuwe kolommen

## 📞 Contact bij Problemen

Bij twijfel over database wijzigingen:
1. **Stop** de operatie
2. **Vraag** om bevestiging
3. **Maak** eerst backup
4. **Test** op kopie
5. **Pas toe** op origineel

---

**Dit protocol moet ALTIJD gevolgd worden om data verlies te voorkomen!**


