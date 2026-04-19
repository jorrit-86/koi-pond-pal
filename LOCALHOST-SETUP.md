# 🚀 Localhost Testomgeving Setup

Deze handleiding helpt je om de Koi Pond Pal applicatie lokaal te draaien voor testen en ontwikkeling.

## 📋 Vereisten

- Node.js (versie 18 of hoger)
- npm of yarn package manager
- Git (optioneel)

## 🔧 Installatie Stappen

### 1. Dependencies Installeren

```bash
npm install
```

Dit installeert alle benodigde packages uit `package.json`.

### 2. Environment Variabelen Configureren

Kopieer het voorbeeld bestand en pas aan naar je eigen configuratie:

```bash
# Windows
copy .env.local.example .env.local

# Mac/Linux
cp .env.local.example .env.local
```

Edit `.env.local` en zorg dat de Supabase credentials correct zijn:
- `VITE_SUPABASE_URL` - Je Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Je Supabase anon key

**Let op:** Het `.env.local` bestand bevat gevoelige informatie en staat al in `.gitignore`.

### 3. Development Server Starten

Start de development server met hot-reload:

```bash
npm run dev
```

De applicatie is nu beschikbaar op:
- **Localhost**: http://localhost:8080
- **Netwerk**: http://[jouw-ip]:8080 (voor testen op andere apparaten)

### 4. Browser Openen

Open je browser en ga naar:
```
http://localhost:8080
```

## 🛠️ Beschikbare Scripts

### Development
```bash
npm run dev          # Start development server op localhost:8080
```

### Build
```bash
npm run build        # Build voor productie
npm run build:dev    # Build voor development
npm run build:prod   # Build voor productie (geoptimaliseerd)
```

### Preview
```bash
npm run preview      # Preview productie build lokaal
```

### Linting
```bash
npm run lint         # Controleer code kwaliteit
```

## 🌐 Localhost Configuratie

De development server is geconfigureerd in `vite.config.ts`:
- **Poort**: 8080
- **Host**: `::` (accepteert verbindingen van alle netwerk interfaces)
- **Hot Reload**: Automatisch bij code wijzigingen

### Poort Wijzigen

Als poort 8080 al in gebruik is, kun je dit aanpassen in `vite.config.ts`:

```typescript
server: {
  host: "::",
  port: 3000,  // Of een andere beschikbare poort
},
```

Of via command line:
```bash
npm run dev -- --port 3000
```

## 🔍 Troubleshooting

### Poort al in gebruik
Als poort 8080 al bezet is:
1. Stop het proces dat poort 8080 gebruikt
2. Of wijzig de poort in `vite.config.ts`

### Dependencies installeren problemen
```bash
# Verwijder node_modules en package-lock.json
rm -rf node_modules package-lock.json

# Herinstalleer
npm install
```

### Environment variabelen niet geladen
- Controleer dat `.env.local` in de root directory staat
- Herstart de development server na wijzigingen
- Zorg dat variabelen beginnen met `VITE_`

### Supabase verbindingsproblemen
- Controleer je Supabase credentials in `.env.local`
- Controleer je internet verbinding
- Verifieer dat je Supabase project actief is

## 📝 Notes

- De development server heeft automatische hot-reload
- Wijzigingen worden direct weerspiegeld in de browser
- Source maps zijn beschikbaar voor debugging
- Alle console logs zijn zichtbaar in de browser developer tools

## 🔐 Security

- **Nooit commit** `.env.local` naar Git (staat al in `.gitignore`)
- Gebruik verschillende Supabase projecten voor development en productie
- Houd je credentials veilig en deel ze niet publiekelijk

## 📚 Meer Informatie

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Supabase Documentation](https://supabase.com/docs)












