# Session Fix - Data Niet Zichtbaar Probleem

## 🔍 Probleem

Na het herstarten van de testomgeving:
- Inloggen werkt
- Maar `SIGNED_OUT` event wordt getriggerd kort na `SIGNED_IN`
- Session wordt op `null` gezet
- Queries hebben geen session → geen data

## ✅ Fixes Uitgevoerd

### Fix 1: SIGNED_OUT Event Handler
**Probleem**: Bij `SIGNED_OUT` werd de session op `null` gezet, ook al negeerden we het event.

**Oplossing**: 
- Session wordt nu **niet** meer gezet op `null` bij `SIGNED_OUT` events
- We blijven de bestaande session behouden
- Alleen bij echte `SIGNED_IN`, `TOKEN_REFRESHED`, of `INITIAL_SESSION` wordt de session geupdate

### Fix 2: Session Retry Logic
**Probleem**: Als de sync wordt aangeroepen en er is geen session, wordt er maar 1x geprobeerd.

**Oplossing**:
- Retry mechanisme: probeer 3x de session op te halen
- Wacht 500ms tussen retries
- Update session state als die wordt gevonden

## 🧪 Testen

1. **Herstart de development server**
   ```bash
   # Stop de server (Ctrl+C)
   # Start opnieuw
   npm run dev
   ```

2. **Clear browser cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows) of `Cmd+Shift+R` (Mac)
   - Of: Clear localStorage in DevTools > Application > Local Storage

3. **Test inloggen**
   - Log in met je account
   - Check console - er zou geen `SIGNED_OUT` moeten zijn direct na `SIGNED_IN`
   - Check of data wordt geladen

4. **Verifieer**
   - ✅ Geen "No active session during sync" warnings
   - ✅ Session blijft actief na inloggen
   - ✅ Data wordt geladen (koi count, water parameters, etc.)

## 🔍 Als Het Nog Steeds Niet Werkt

### Check 1: Console Output
Kijk of je deze log ziet:
```
Auth state change: SIGNED_OUT
SIGNED_OUT event - ignoring to prevent logout issues
```

Als je dit ziet, is de fix actief. Maar als er daarna nog steeds "No active session" is, dan is er een ander probleem.

### Check 2: Session in Browser
Open browser console en run:
```javascript
const { data: { session } } = await supabase.auth.getSession()
console.log('Current session:', session)
```

Als dit `null` is na inloggen, dan is er een Supabase configuratie probleem.

### Check 3: Supabase Config
Check `src/lib/supabase.ts`:
```typescript
auth: {
  autoRefreshToken: true,
  persistSession: true,  // ← Dit moet true zijn!
  detectSessionInUrl: true,
  flowType: 'pkce'
}
```

## 💡 Mogelijke Oorzaken Als Het Nog Niet Werkt

1. **Supabase Auth Settings**
   - Check Supabase Dashboard > Authentication > Settings
   - Verify dat "Enable email confirmations" niet te strikt is ingesteld

2. **Browser Storage**
   - Sommige browsers blokkeren localStorage in bepaalde modi
   - Probeer een andere browser of incognito mode

3. **Multiple Tabs**
   - Als je meerdere tabs open hebt, kan dit conflicten veroorzaken
   - Sluit alle tabs en open alleen 1

## 📝 Wat Is Er Aangepast?

**Bestand**: `src/contexts/AuthContext.tsx`

- Regel 65-94: `onAuthStateChange` handler aangepast
  - Session wordt niet meer op null gezet bij SIGNED_OUT
  - Betere handling van verschillende auth events
  
- Regel 145-166: `syncUserWithDatabase` verbeterd
  - Retry logic voor session retrieval
  - Session state wordt geupdate als die wordt gevonden

---

**Test het nu en laat me weten of het werkt!** 🚀











