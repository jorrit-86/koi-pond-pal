# Script om een FTP upload package te maken van een bestaande build
# Voer eerst uit: npm run build:prod
# Daarna: .\create-ftp-package-from-build.ps1

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$packageName = "koi-pond-pal-ftp-upload-$timestamp"

Write-Host "🚀 FTP Package Creator" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Controleer of dist folder bestaat
if (-not (Test-Path "dist\index.html")) {
    Write-Host "❌ Geen build gevonden in dist folder!" -ForegroundColor Red
    Write-Host "Voer eerst uit: npm run build:prod" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Build gevonden in dist folder" -ForegroundColor Green
Write-Host ""

# Maak nieuwe package map
if (Test-Path $packageName) {
    Write-Host "⚠️  Map bestaat al, wordt verwijderd..." -ForegroundColor Yellow
    Remove-Item $packageName -Recurse -Force
}

New-Item -ItemType Directory -Path $packageName -Force | Out-Null
Write-Host "📦 Map aangemaakt: $packageName" -ForegroundColor Green
Write-Host ""

# Kopieer bestanden uit dist
Write-Host "📋 Bestanden kopiëren..." -ForegroundColor Cyan
Copy-Item -Path "dist\*" -Destination $packageName -Recurse -Force
Write-Host "✅ Bestanden gekopieerd" -ForegroundColor Green
Write-Host ""

# Kopieer .htaccess
if (Test-Path "ftp-update-package\website\.htaccess") {
    Copy-Item -Path "ftp-update-package\website\.htaccess" -Destination "$packageName\.htaccess" -Force
    Write-Host "✅ .htaccess toegevoegd" -ForegroundColor Green
} else {
    Write-Host "⚠️  .htaccess niet gevonden, wordt overgeslagen" -ForegroundColor Yellow
}
Write-Host ""

# Maak README
$readmeContent = @"
# 🚀 Koi Pond Pal - FTP Upload Package

**Gemaakt op:** $(Get-Date -Format "yyyy-MM-dd HH:mm")

## 📦 Package Inhoud

Dit package bevat alle bestanden die nodig zijn om Koi Pond Pal naar je FTP server te uploaden.

### Bestanden:
- `index.html` - Hoofdpagina van de applicatie
- `assets/` - Alle JavaScript, CSS en afbeeldingen
- `.htaccess` - Apache server configuratie voor client-side routing
- `favicon.ico` - Website icoon
- `robots.txt` - Zoekmachine instructies

## 🚀 Upload Instructies

### 1. Verbind met je FTP server
   - Gebruik een FTP client zoals FileZilla, WinSCP of Cyberduck
   - Verbind met je hosting provider

### 2. Upload bestanden
   - Navigeer naar je `public_html/` of `www/` directory
   - Upload **ALLE** bestanden uit deze map
   - Behoud de mappenstructuur (met name de `assets/` folder)

### 3. Configureer environment variabelen
   **BELANGRIJK!** Je moet de volgende environment variabelen instellen op je hosting provider:

   ````
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ````

   **Waar te configureren:**
   - **cPanel**: Environment Variables sectie
   - **DirectAdmin**: Environment Variables
   - **Plesk**: Environment Variables
   - **Custom server**: .env bestand in root directory

### 4. Test de website
   - Open je website in een browser
   - Controleer of alle functionaliteit werkt
   - Test de login functionaliteit
   - Controleer of de print knop zichtbaar is op de koi detail pagina

## ✅ Succes!

Als alles correct is geconfigureerd, zou je website nu moeten werken!

**Veel succes met je deployment!** 🎉
"@

$readmeContent | Out-File -FilePath "$packageName\README.md" -Encoding UTF8
Write-Host "✅ README toegevoegd" -ForegroundColor Green
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🎉 Package succesvol aangemaakt!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Locatie: $packageName" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Volgende stappen:" -ForegroundColor Cyan
Write-Host "   1. Upload alle bestanden uit '$packageName' naar je FTP server"
Write-Host "   2. Configureer environment variabelen op je hosting provider"
Write-Host "   3. Test de website"
Write-Host ""

# Open de map
Start-Process explorer.exe -ArgumentList $packageName












