# 🌐 Website Update Guide - Koi Pond Pal

## 🚀 Hoe Update Je de Website

### ⚡ **Snelle Update (Aanbevolen)**

1. **Open Terminal/Command Prompt**
2. **Navigeer naar project directory:**
   ```bash
   cd "C:\Users\JorritAafjesHabitatD\Documents\Koi pond pal\koi-pond-pal-1"
   ```

3. **Voer automatische deployment uit:**
   ```bash
   # Windows
   deploy-live.bat
   
   # Linux/Mac
   ./deploy-live.sh
   ```

4. **Upload de `dist` directory** naar je hosting provider

### 🛡️ **Veilige Update (Met Extra Controles)**

#### Stap 1: Pre-Update Checklist
- [ ] Alle code wijzigingen zijn gecommit
- [ ] Database backup is beschikbaar
- [ ] Environment variabelen zijn correct
- [ ] Test op lokale development server

#### Stap 2: Database Backup
```bash
# Automatische backup
npm run deploy:backup

# OF handmatige backup via Supabase Dashboard
# Ga naar Project > Database > Backups > Create Backup
```

#### Stap 3: Build Proces
```bash
# Controleer dependencies
npm install

# Voer linting uit
npm run lint

# Maak productie build
npm run build:prod
```

#### Stap 4: Deployment
1. **Upload `dist` directory** naar hosting
2. **Configureer environment variabelen:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Test database connectie**
4. **Verifieer functionaliteit**

### 🔧 **Environment Variabelen**

Zorg dat deze variabelen correct zijn ingesteld op je hosting:

```env
VITE_SUPABASE_URL=https://pbpuvumeshaeplbwbwzv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4
```

### 📊 **Post-Update Monitoring**

Na de update, controleer:

1. **Functionele Tests:**
   - [ ] Login/logout werkt
   - [ ] Koi management werkt
   - [ ] Water parameters worden opgeslagen
   - [ ] Sensor data wordt weergegeven
   - [ ] User settings worden opgeslagen

2. **Database Verificatie:**
   ```sql
   -- Controleer data integriteit
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM koi;
   SELECT COUNT(*) FROM water_parameters;
   ```

3. **Performance Monitoring:**
   - [ ] Pagina laadt snel
   - [ ] Geen console errors
   - [ ] Database queries zijn snel

### 🚨 **Emergency Rollback**

Als er problemen zijn na de update:

1. **Stop** alle database operaties
2. **Herstel** van backup
3. **Test** alle functionaliteit
4. **Plan** nieuwe update

### 📝 **Update Log**

Houd bij wanneer je updates uitvoert:

| Datum | Versie | Wijzigingen | Status |
|-------|--------|-------------|--------|
| 2024-XX-XX | v1.0.0 | Eerste deployment | ✅ Success |
| | | | |

### 🔍 **Troubleshooting**

#### Build Faalt
```bash
# Clear cache en probeer opnieuw
rm -rf node_modules package-lock.json
npm install
npm run build:prod
```

#### Database Problemen
```bash
# Controleer Supabase status
supabase status

# Test database connectie
supabase db ping
```

#### Environment Problemen
```bash
# Controleer environment file
cat .env.production
```

### 📞 **Support**

Bij problemen:
1. Controleer `DEPLOYMENT-GUIDE.md`
2. Controleer backup status
3. Test op staging environment
4. Documenteer het probleem

---

**⚠️ BELANGRIJK: Database backup is KRITIEK - wordt automatisch gemaakt!**
