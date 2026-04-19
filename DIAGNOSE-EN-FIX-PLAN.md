# Diagnose- en Fix Plan voor Data Toegangsproblemen

## 🔍 Geïdentificeerde Problemen

### Probleem 1: Row Level Security (RLS) Policies - 401/406 Errors
**Symptomen:**
- `401 (Unauthorized)` bij `maintenance_tasks` INSERT/upsert operaties
- `406 (Not Acceptable)` bij user queries
- Foutmelding: `new row violates row-level security policy`

**Oorzaak:** RLS policies blokkeren data toegang na authenticatie

**Impact:** Gebruikers kunnen geen data zien/creëren

### Probleem 2: Database Schema Mismatch - Variantie Kolom
**Symptomen:**
- `400 (Bad Request)` bij koi queries
- Foutmelding: `column koi.variety does not exist`
- Query probeert niet-bestaande kolom `variety` te selecteren

**Oorzaak:** Code verwijst naar kolom `variety` die niet bestaat (moet `species` zijn)

**Impact:** Koi data kan niet worden geladen

### Probleem 3: User Profile Sync Problemen
**Symptomen:**
- `406 (Not Acceptable)` bij user profile queries
- User sync werkt niet goed

**Oorzaak:** RLS policies of verkeerde kolom selectie

## 📋 Diagnose Stappen

### Stap 1: RLS Policies Controleren
- [ ] Check RLS policies voor `maintenance_tasks`
- [ ] Check RLS policies voor `users` tabel
- [ ] Check RLS policies voor `koi` tabel
- [ ] Check RLS policies voor `water_parameters` tabel

### Stap 2: Database Schema Verificatie
- [ ] Controleer welke kolommen daadwerkelijk bestaan in `koi` tabel
- [ ] Identificeer alle queries die `variety` gebruiken
- [ ] Bepaal of `variety` kolom moet worden toegevoegd of code moet worden aangepast

### Stap 3: Query Verificatie
- [ ] Controleer alle Supabase queries op correcte kolom namen
- [ ] Test queries met authentificatie

## 🔧 Fix Strategie

### Fix 1: RLS Policies Repareren
1. Identificeer ontbrekende of incorrecte RLS policies
2. Update policies zodat geauthenticeerde gebruikers hun eigen data kunnen:
   - SELECT: `auth.uid() = user_id`
   - INSERT: `auth.uid() = user_id`
   - UPDATE: `auth.uid() = user_id`
   - DELETE: `auth.uid() = user_id`

### Fix 2: Schema/Query Fixes
1. Verwijder of vervang alle verwijzingen naar `variety` kolom
2. Gebruik `species` in plaats van `variety`
3. Update TypeScript interfaces indien nodig

### Fix 3: Error Handling Verbeteren
1. Betere error logging
2. Fallback mechanismen voor ontbrekende data

## 🎯 Implementatie Volgorde

1. **Direct**: Fix `variety` kolom probleem (code aanpassen)
2. **Prioriteit 1**: Fix RLS policies voor `maintenance_tasks`
3. **Prioriteit 2**: Fix RLS policies voor andere tabellen
4. **Prioriteit 3**: User profile sync verbeteren
5. **Prioriteit 4**: Error handling verbeteren

## 👤 Jouw Rol

### Wat JIJ moet doen:
1. **Toegang tot Supabase Dashboard** - Voor RLS policy updates (indien nodig)
2. **Feedback geven** - Laat weten of fixes werken
3. **Testen** - Na elke fix testen of data zichtbaar is
4. **Informatie verstrekken** - Bij vragen over database structuur

### Wat IK ga doen:
1. ✅ Code fixes uitvoeren
2. ✅ SQL scripts genereren voor RLS fixes
3. ✅ Database queries repareren
4. ✅ Error handling verbeteren
5. ✅ Testen en verifiëren

## 📝 Notities

- Authenticatie werkt (gebruiker kan inloggen)
- Session wordt correct opgehaald
- Probleem zit in data toegang na authenticatie
- Query structuur lijkt correct (gebruikt `.eq('user_id', user.id)`)












