# Fix Infinite Recursion Error - Actie Vereist

## 🔴 Probleem

Je ziet deze error in de console:
```
infinite recursion detected in policy for relation "users"
```

Dit wordt veroorzaakt door RLS policies op de `users` tabel die zelf weer een query naar de `users` tabel doen, waardoor er een infinite loop ontstaat.

## ✅ Oplossing

### Stap 1: Voer SQL Script Uit

1. **Open Supabase Dashboard**
   - Ga naar: https://supabase.com/dashboard/project/pbpuvumeshaeplbwbwzv
   - Klik op "SQL Editor" in het linkermenu

2. **Voer het script uit**
   - Open het bestand: `fix-users-infinite-recursion.sql`
   - Kopieer de hele inhoud
   - Plak in Supabase SQL Editor
   - Klik op "Run" of druk Ctrl+Enter

3. **Verifieer**
   - Controleer of er geen errors zijn
   - Je zou moeten zien dat 3 policies zijn aangemaakt

### Stap 2: Test de Applicatie

1. **Refresh de browser** (Ctrl+Shift+R om cache te clearen)
2. **Log opnieuw in**
3. **Check de console** - de infinite recursion error zou weg moeten zijn

## 📝 Wat het Script Doet

- Verwijdert alle bestaande policies op de `users` tabel
- Schakelt RLS tijdelijk uit en weer in (om recursie te doorbreken)
- Creëert simpele, niet-recursieve policies:
  - Users kunnen hun eigen profiel bekijken (`auth.uid() = id`)
  - Users kunnen hun eigen profiel updaten
  - Users kunnen hun eigen profiel aanmaken

## ⚠️ Belangrijk

- Het script verwijdert **alle** policies op de users tabel
- Er worden alleen basis policies aangemaakt (geen admin policies)
- Als je admin functionaliteit nodig hebt, laat het weten en dan maak ik een uitgebreidere versie

## 🔍 Verificatie

Na het uitvoeren van het script, test of:
- ✅ De infinite recursion error weg is
- ✅ Je kunt inloggen zonder errors
- ✅ User data wordt correct geladen
- ✅ Geen 500 errors meer in de console

## 💡 Als het Niet Werkt

Als je na het uitvoeren van het script nog steeds errors ziet:

1. **Deel de error message** uit de console
2. **Check Supabase logs** - ga naar Database → Logs in Supabase dashboard
3. **Laat me weten** en ik help verder

---

**Deze fix is essentieel** - zonder dit blijft de infinite recursion error voorkomen en kan de user sync niet werken.












