# 🔧 Localhost Troubleshooting - Data Onzichtbaar

## Probleem
Na het uploaden van SQL en testen via localhost:8080 blijft data onzichtbaar. Je ziet errors zoals:
- `406` error bij het ophalen van user data
- `401` error bij het aanmaken van user profile
- Data wordt wel gevonden maar blijft onzichtbaar

## Oplossing

### Stap 1: Fix RLS Policies in Supabase

1. Open je Supabase dashboard
2. Ga naar **SQL Editor**
3. Voer het script `fix-localhost-data-access.sql` uit
   - Dit script fixt alle RLS policies
   - Maakt een automatische trigger voor user creation
   - Zorgt ervoor dat data toegankelijk is

### Stap 2: Verifieer Environment Variabelen

Controleer dat `.env.local` de juiste Supabase credentials bevat:
```bash
VITE_SUPABASE_URL=https://pbpuvumeshaeplbwbwzv.supabase.co
VITE_SUPABASE_ANON_KEY=je-anon-key-hier
```

### Stap 3: Herstart Development Server

```bash
# Stop de server (Ctrl+C)
# Start opnieuw
npm run dev
```

### Stap 4: Test Authenticatie

1. Log uit en log opnieuw in
2. Check de browser console voor errors
3. Controleer dat de session actief blijft

## Veelvoorkomende Problemen

### 401 Error (Unauthorized)
**Oorzaak**: RLS policies blokkeren toegang of session is verlopen
**Oplossing**: 
- Run `fix-localhost-data-access.sql` in Supabase
- Check dat je ingelogd bent
- Refresh de pagina

### 406 Error (Not Acceptable)
**Oorzaak**: Select query format niet geaccepteerd
**Oplossing**: 
- Code is al gefixed in `AuthContext.tsx`
- Zorg dat RLS policies correct zijn ingesteld

### Data Vindt Niet (0 results)
**Oorzaak**: RLS policies te strikt of user_id mismatch
**Oplossing**:
- Check dat `user_id` in database matches met `auth.uid()`
- Verify RLS policies in Supabase dashboard
- Check browser console voor specifieke errors

### Session Verloren (SIGNED_OUT event)
**Oorzaak**: Session wordt niet correct bewaard of refreshed
**Oplossing**:
- Code is al gefixed in `AuthContext.tsx` om SIGNED_OUT events te negeren
- Check Supabase auth settings
- Verifieer dat `persistSession: true` is ingesteld

## Verificatie Checklist

- [ ] `fix-localhost-data-access.sql` is uitgevoerd in Supabase
- [ ] `.env.local` bevat correcte Supabase credentials
- [ ] Development server is herstart na code changes
- [ ] Browser console toont geen 401/406 errors
- [ ] Session blijft actief na login
- [ ] Data wordt correct opgehaald (check Network tab in DevTools)

## Debug Steps

### 1. Check Session in Browser Console
```javascript
// Open browser console en run:
const { data: { session } } = await supabase.auth.getSession()
console.log('Current session:', session)
```

### 2. Test Database Query Direct
```javascript
const { data, error } = await supabase
  .from('koi')
  .select('*')
  .limit(5)
console.log('Query result:', { data, error })
```

### 3. Check RLS Policies in Supabase
- Ga naar **Authentication** > **Policies**
- Verify dat policies bestaan voor `users`, `koi`, `water_parameters`
- Check dat policies gebruik maken van `auth.uid()`

## Als Problemen Blijven Bestaan

1. **Clear Browser Cache**
   - Hard refresh: Ctrl+Shift+R (Windows) of Cmd+Shift+R (Mac)
   - Clear localStorage: DevTools > Application > Local Storage > Clear

2. **Check Supabase Logs**
   - Ga naar Supabase Dashboard > Logs
   - Check voor database errors of auth errors

3. **Verify Database Schema**
   - Check dat alle tabellen bestaan
   - Verify dat RLS enabled is op alle tabellen
   - Check dat `user_id` kolommen bestaan en juist getypeerd zijn

4. **Test met Nieuw Account**
   - Maak een nieuw test account aan
   - Check of data toegankelijk is voor nieuw account

## Contact

Als problemen blijven bestaan na deze stappen:
- Check Supabase dashboard voor specifieke errors
- Review browser console voor gedetailleerde error messages
- Verify dat alle SQL scripts correct zijn uitgevoerd












