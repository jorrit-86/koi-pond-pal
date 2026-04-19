# 🔨 Nieuwe Build Maken

Om een nieuwe build te maken met de laatste wijzigingen (inclusief de print knop op de koi detail pagina), voer het volgende uit:

## Stappen:

1. **Open een terminal/command prompt** in de projectmap

2. **Maak een nieuwe productie build:**
   ```bash
   npm run build:prod
   ```
   
   Of als dat niet werkt:
   ```bash
   npx vite build --mode production
   ```

3. **Maak een nieuwe FTP upload map:**
   ```powershell
   $timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
   $packageName = "koi-pond-pal-ftp-upload-$timestamp"
   New-Item -ItemType Directory -Path $packageName -Force
   Copy-Item -Path "dist\*" -Destination $packageName -Recurse -Force
   Copy-Item -Path "ftp-update-package\website\.htaccess" -Destination "$packageName\.htaccess" -Force
   ```

4. **De map `$packageName` staat nu klaar voor FTP upload!**

## Let op:
- Zorg dat `node_modules` volledig is geïnstalleerd (run `npm install` als dat nodig is)
- Na de build staat alles in de `dist/` folder
- Kopieer alle bestanden uit `dist/` naar je nieuwe FTP upload map
- Voeg `.htaccess` toe uit `ftp-update-package/website/.htaccess`












