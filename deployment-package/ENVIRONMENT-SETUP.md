# 🔧 Environment Setup - Koi Pond Pal

## 📋 Vereiste Environment Variabelen

Deze variabelen moeten worden ingesteld op je hosting provider:

### 🗄️ Supabase Database Configuratie
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 🔐 Security Settings (Optioneel)
```bash
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
```

## 🛠️ Hoe te configureren per hosting provider:

### 1. **Netlify**
1. Ga naar Site Settings > Environment Variables
2. Voeg de variabelen toe:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Herbuild de site

### 2. **Vercel**
1. Ga naar Project Settings > Environment Variables
2. Voeg de variabelen toe voor Production environment
3. Redeploy de applicatie

### 3. **Shared Hosting (cPanel)**
1. Maak een `.env` bestand in de root directory
2. Voeg de variabelen toe:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 4. **VPS/Dedicated Server**
1. Voeg variabelen toe aan je server environment
2. Of maak een `.env` bestand in de applicatie root

## 🔍 Waar vind je je Supabase credentials?

1. **Ga naar je Supabase Dashboard**
2. **Selecteer je project**
3. **Ga naar Settings > API**
4. **Kopieer:**
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## ✅ Verificatie

Na het instellen van de environment variabelen:

1. **Test de applicatie** - ga naar je website
2. **Controleer browser console** - geen errors over missing environment variables
3. **Test login** - probeer in te loggen
4. **Test database connectie** - voeg een koi toe of water parameter

## 🚨 Veelvoorkomende Problemen

### "Supabase client not initialized"
- Controleer of `VITE_SUPABASE_URL` correct is ingesteld
- Zorg dat de URL begint met `https://`

### "Invalid API key"
- Controleer of `VITE_SUPABASE_ANON_KEY` correct is gekopieerd
- Zorg dat er geen extra spaties zijn

### "CORS error"
- Controleer of je Supabase project de juiste domain heeft toegevoegd
- Ga naar Supabase Dashboard > Settings > API > Site URL

## 📞 Support

Als je problemen hebt met environment setup:
1. Controleer Supabase Dashboard voor project status
2. Test de credentials in een nieuwe browser tab
3. Controleer hosting provider documentatie
