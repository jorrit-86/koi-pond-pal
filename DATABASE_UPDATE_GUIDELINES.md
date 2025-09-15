# Database Update Guidelines

## 🛡️ **Data Behoud Strategie**

Bij elke database update moeten we ervoor zorgen dat alle bestaande data behouden blijft:

### ✅ **Veilige Update Praktijken:**

1. **Gebruik ALWAYS `IF NOT EXISTS` of `IF EXISTS`:**
   ```sql
   ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE;
   CREATE INDEX IF NOT EXISTS index_name ON table_name(column);
   ```

2. **Test eerst op een kopie:**
   - Maak altijd een backup voordat je updates uitvoert
   - Test updates op een test database eerst

3. **Gebruik transacties:**
   ```sql
   BEGIN;
   -- Your update statements here
   COMMIT; -- or ROLLBACK if something goes wrong
   ```

4. **Verificeer data behoud:**
   ```sql
   -- Check row counts before and after
   SELECT COUNT(*) FROM table_name;
   
   -- Verify specific data
   SELECT * FROM table_name WHERE id = 'specific_id';
   ```

### 🔄 **Update Script Template:**

```sql
-- Safe Update Script Template
-- Date: [DATE]
-- Description: [WHAT THIS UPDATE DOES]

-- 1. Backup check (optional)
SELECT COUNT(*) as current_rows FROM table_name;

-- 2. Add new columns safely
ALTER TABLE table_name 
ADD COLUMN IF NOT EXISTS new_column TYPE;

-- 3. Add indexes safely
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);

-- 4. Update existing data if needed (be careful!)
-- UPDATE table_name SET new_column = 'default_value' WHERE new_column IS NULL;

-- 5. Verify the update
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'table_name' 
AND table_schema = 'public';

-- 6. Final verification
SELECT COUNT(*) as final_rows FROM table_name;
```

### 🚨 **Wat NOOIT te doen:**

- ❌ `DROP TABLE` zonder backup
- ❌ `ALTER TABLE ... DROP COLUMN` zonder backup
- ❌ Updates zonder `IF NOT EXISTS`
- ❌ Mass updates zonder WHERE clause
- ❌ Updates zonder transacties

### 📋 **Checklist voor Updates:**

- [ ] Backup gemaakt van de database
- [ ] Update script getest op test database
- [ ] `IF NOT EXISTS` gebruikt voor nieuwe kolommen/indexen
- [ ] Transactie gebruikt voor kritieke updates
- [ ] Data verificatie uitgevoerd na update
- [ ] Rollback plan voorbereid
- [ ] Team geïnformeerd over de update

### 🔍 **Data Verificatie Queries:**

```sql
-- Check user data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM koi;
SELECT COUNT(*) FROM water_parameters;

-- Check specific user data
SELECT u.email, COUNT(k.id) as koi_count, COUNT(w.id) as water_count
FROM users u
LEFT JOIN koi k ON u.id = k.user_id
LEFT JOIN water_parameters w ON u.id = w.user_id
GROUP BY u.id, u.email;

-- Check profile photos
SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'profile-photos';
```

### 📝 **Update Log:**

| Date | Update | Description | Data Preserved |
|------|--------|-------------|----------------|
| 2024-01-XX | Add last_login_at | Added last login tracking | ✅ Yes |
| | | | |
| | | | |

---

**Belangrijk:** Deze richtlijnen moeten altijd worden gevolgd om data verlies te voorkomen!
