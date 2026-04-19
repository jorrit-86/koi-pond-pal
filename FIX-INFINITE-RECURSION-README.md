# 🔧 Fix Infinite Recursion Error

## Probleem
Je ziet deze error in de console:
```
'infinite recursion detected in policy for relation "users"'
```

Dit wordt veroorzaakt door de "Admins can view all users" RLS policy die probeert de users tabel te lezen, wat op zijn beurt weer de policy triggert (oneindige lus).

## Oplossing

### Stap 1: Voer het Fix Script Uit

Open Supabase SQL Editor en voer **één** van deze scripts uit:

#### Optie A: Quick Fix (Aanbevolen)
```sql
-- Run: fix-infinite-recursion-users.sql
```
Dit script:
- Verwijdert alle recursieve policies
- Maakt een security definer functie voor admin checks
- Herstelt alle policies zonder recursie

#### Optie B: Complete Fix
```sql
-- Run: fix-localhost-data-access.sql (bijgewerkte versie)
```
Dit script heeft nu ook de infinite recursion fix.

### Stap 2: Verifieer

Na het uitvoeren van het script:
1. Check de browser console - de `500` error zou weg moeten zijn
2. Check dat data nog steeds zichtbaar is
3. Test inlog/uitlog functionaliteit

## Wat is er gefixed?

### Code Fixes
- ✅ `AuthContext.tsx` - Betere error handling voor 409 conflicts
- ✅ `fix-localhost-data-access.sql` - Admin policy gebruikt nu security definer functie

### Database Fixes
- ✅ Security definer functie `is_admin()` gemaakt
- ✅ Admin policy herschreven om recursie te voorkomen
- ✅ Alle policies zijn nu non-recursive

## Verificatie

Na het uitvoeren van het script zou je geen `500` errors meer moeten zien. De console zou alleen deze normale messages moeten tonen:
- ✅ `Loaded REAL koi count: 8`
- ✅ `Loaded koi data: 8 koi found`
- ✅ `User profile found in database` (geen errors)

## Als Problemen Blijven Bestaan

1. **Clear Browser Cache**
   - Hard refresh: Ctrl+Shift+R

2. **Check Supabase Logs**
   - Ga naar Dashboard > Logs
   - Check voor database errors

3. **Verifieer Policies**
   ```sql
   SELECT policyname, qual 
   FROM pg_policies 
   WHERE tablename = 'users';
   ```
   - Check dat geen policy direct `users` tabel referenceert

4. **Test Direct in Supabase**
   ```sql
   SELECT public.is_admin(auth.uid());
   ```
   - Dit zou moeten werken zonder errors

## Status

✅ Data is zichtbaar
✅ Koi data wordt correct geladen
⚠️ Infinite recursion error moet nog gefixed worden (zie bovenstaande stappen)












