# 🚀 Live Deployment Guide - Koi Pond Pal

## ⚠️ KRITIEKE VEILIGHEIDSPROTOCOL

**BELANGRIJK: Volg deze stappen EXACT in deze volgorde om data verlies te voorkomen!**

## 📋 Pre-Deployment Checklist

### 1. Database Backup (KRITIEK!)
```bash
# Optie 1: Automatische backup
npm run deploy:backup

# Optie 2: Handmatige backup via Supabase CLI
supabase db dump --data-only --file backup-$(date +%Y%m%d_%H%M%S).sql

# Optie 3: Via Supabase Dashboard
# Ga naar Project > Database > Backups > Create Backup
```

### 2. Environment Check
- [ ] Controleer of alle environment variabelen correct zijn
- [ ] Test database connectie
- [ ] Verifieer Supabase project status

### 3. Code Quality Check
```bash
npm run lint
npm run build:prod
```

## 🚀 Deployment Stappen

### Stap 1: Voorbereiding
```bash
# 1. Zorg dat je in de project root bent
cd /path/to/koi-pond-pal-1

# 2. Controleer git status
git status

# 3. Commit alle wijzigingen
git add .
git commit -m "Pre-deployment commit"
```

### Stap 2: Database Backup
```bash
# Automatische backup
npm run deploy:backup

# OF handmatige backup
supabase db dump --data-only --file backup-$(date +%Y%m%d_%H%M%S).sql
```

### Stap 3: Build voor Productie
```bash
# Windows
deploy-live.bat

# Linux/Mac
chmod +x deploy-live.sh
./deploy-live.sh

# OF handmatig
npm run build:prod
```

### Stap 4: Deployment
1. **Upload `dist` directory** naar je hosting provider
2. **Configureer environment variabelen:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Test database connectie**
4. **Verifieer alle functionaliteit**

## 🛡️ Database Veiligheid

### Backup Protocol
```sql
-- VOOR ELKE DEPLOYMENT:
-- 1. Maak backup van alle tabellen
CREATE TABLE backup_users_$(date) AS SELECT * FROM public.users;
CREATE TABLE backup_water_parameters_$(date) AS SELECT * FROM public.water_parameters;
CREATE TABLE backup_koi_$(date) AS SELECT * FROM public.koi;
CREATE TABLE backup_user_settings_$(date) AS SELECT * FROM public.user_settings;

-- 2. Verifieer backup integriteit
SELECT COUNT(*) FROM backup_users_$(date);
SELECT COUNT(*) FROM public.users;
-- Beide counts moeten gelijk zijn!
```

### Rollback Procedure
```sql
-- Als er problemen zijn na deployment:
-- 1. Stop alle database operaties
-- 2. Herstel van backup
INSERT INTO public.users SELECT * FROM backup_users_$(date);
-- 3. Verifieer data integriteit
```

## 📊 Post-Deployment Monitoring

### 1. Functionele Tests
- [ ] Login/logout functionaliteit
- [ ] Koi management
- [ ] Water parameters
- [ ] Sensor data
- [ ] User settings

### 2. Performance Monitoring
- [ ] Page load times
- [ ] Database query performance
- [ ] Error rates
- [ ] User experience

### 3. Database Monitoring
```sql
-- Controleer data integriteit
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM koi;
SELECT COUNT(*) FROM water_parameters;

-- Controleer recente data
SELECT * FROM water_parameters ORDER BY created_at DESC LIMIT 10;
```

## 🚨 Emergency Procedures

### Als Deployment Faalt
1. **Stop** alle database operaties
2. **Herstel** van backup
3. **Test** alle functionaliteit
4. **Documenteer** het probleem
5. **Plan** nieuwe deployment

### Als Data Verloren Gaat
1. **Stop** onmiddellijk alle operaties
2. **Controleer** Supabase Recycle Bin
3. **Herstel** van backup
4. **Verifieer** data integriteit
5. **Test** alle functionaliteit

## 📝 Deployment Log

| Datum | Versie | Status | Notes |
|-------|--------|--------|-------|
| 2024-XX-XX | v1.0.0 | ✅ Success | Eerste deployment |
| | | | |

## 🔧 Troubleshooting

### Veelvoorkomende Problemen

#### Build Faalt
```bash
# Controleer Node.js versie
node --version

# Installeer dependencies opnieuw
rm -rf node_modules package-lock.json
npm install

# Clear cache
npm run build -- --force
```

#### Database Connectie Problemen
```bash
# Controleer Supabase status
supabase status

# Test connectie
supabase db ping
```

#### Environment Variabelen
```bash
# Controleer environment file
cat .env.production

# Test variabelen
echo $VITE_SUPABASE_URL
```

## 📞 Support

Bij problemen tijdens deployment:
1. **Stop** de deployment
2. **Controleer** backup status
3. **Documenteer** het probleem
4. **Plan** oplossing
5. **Test** op staging eerst

---

**⚠️ BELANGRIJK: Deze guide moet ALTIJD worden gevolgd om data verlies te voorkomen!**
