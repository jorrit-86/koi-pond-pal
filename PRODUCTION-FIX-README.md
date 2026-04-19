# Production Fix - SIGNED_OUT Event en 406 Errors

## Probleem
In de productie omgeving gebeurt het volgende:
1. Na `SIGNED_IN` wordt direct een `SIGNED_OUT` event getriggerd
2. 406 errors bij queries naar `user_preferences` en `water_changes`
3. Data wordt niet geladen (0 koi found)

## Oplossingen Geïmplementeerd

### 1. Betere SIGNED_OUT Handling
- **Fix**: Session expiry check toegevoegd
- **Wat**: Controleert of de session nog geldig is voordat we uitloggen
- **Resultaat**: Als de session nog geldig is, wordt deze hersteld in plaats van uitloggen

### 2. 406 Error Handling
- **Fix**: `maybeSingle()` gebruikt in plaats van `single()` voor queries
- **Wat**: Voorkomt crashes wanneer geen data gevonden wordt of RLS policies blokkeren
- **Resultaat**: Graceful fallback naar defaults bij 406 errors

### 3. Verbeterde Error Handling
- **Fix**: Specifieke 406 error handling in dashboard queries
- **Wat**: Detecteert 406 errors en gebruikt defaults in plaats van crashes
- **Resultaat**: Applicatie blijft werken zelfs met RLS policy issues

## Database Issues (Mogelijk)

De 406 errors suggereren mogelijk:
1. **Ontbrekende kolommen** in `user_preferences` of `water_changes` tabellen
2. **RLS policies** die queries blokkeren
3. **Schema mismatch** tussen development en production

### Controleer in Supabase:

1. **Check user_preferences tabel**:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public';
```

2. **Check RLS policies**:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'user_preferences';
```

3. **Check water_changes tabel**:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'water_changes' 
AND table_schema = 'public';
```

## Testen

Na deploy:
1. Log in op productie
2. Check console - zou geen crashes moeten geven bij 406 errors
3. Check of data wordt geladen (mogelijk met defaults)
4. Check of SIGNED_OUT event niet meer direct uitlogt

## Next Steps

Als 406 errors blijven:
1. Check of alle tabellen en kolommen bestaan in productie
2. Run RLS policy fixes in productie Supabase
3. Check of schema matches tussen dev en prod











