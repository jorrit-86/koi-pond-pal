@echo off
REM 🚀 FTP Package Creation Script voor Koi Pond Pal
REM Dit script maakt een compleet pakket klaar voor FTP upload

setlocal enabledelayedexpansion

echo 🚀 Koi Pond Pal - FTP Package Creator
echo =====================================
echo.

REM Controleer of we in de juiste directory zijn
if not exist "package.json" (
    echo ❌ package.json niet gevonden. Zorg dat je in de project root bent.
    exit /b 1
)

REM Genereer timestamp voor package naam
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%"
set "timestamp=%YYYY%%MM%%DD%-%HH%%Min%"
set "package_name=koi-pond-pal-ftp-package-%timestamp%"
set "zip_name=koi-pond-pal-ftp-package-%timestamp%.zip"

echo 📦 Package naam: %package_name%
echo.

REM Stap 1: Check of dependencies geïnstalleerd zijn
echo ℹ️  Stap 1: Controleren dependencies...
if not exist "node_modules" (
    echo    Dependencies niet gevonden, installeren...
    call npm install
    if errorlevel 1 (
        echo ❌ Dependencies installatie gefaald!
        exit /b 1
    )
    echo ✅ Dependencies geïnstalleerd
) else (
    echo ✅ Dependencies gevonden
)
echo.

REM Stap 2: Check of er al een build is
echo ℹ️  Stap 2: Controleren of build beschikbaar is...
if exist "dist\index.html" (
    echo ✅ Bestaande build gevonden, wordt gebruikt...
) else (
    echo    Geen build gevonden, nieuwe build maken...
    echo    Opschonen oude builds...
    if exist "dist" (
        rmdir /s /q dist 2>nul
    )
    echo ✅ Opschonen voltooid
    echo.
    echo    Productie build maken...
    npm run build:prod
    if errorlevel 1 (
        echo ❌ Build gefaald!
        exit /b 1
    )
    echo ✅ Productie build voltooid
    echo.
)

REM Stap 3: Controleer build output
echo ℹ️  Stap 3: Build output verifiëren...
if not exist "dist\index.html" (
    echo ❌ index.html niet gevonden in dist directory!
    exit /b 1
)
echo ✅ Build output geverifieerd
echo.

REM Stap 4: Maak FTP package directory
echo ℹ️  Stap 4: FTP package directory aanmaken...
if exist "%package_name%" (
    echo    Wist bestaande package directory...
    rmdir /s /q "%package_name%"
)
mkdir "%package_name%"
echo ✅ Package directory aangemaakt
echo.

REM Stap 5: Kopieer dist bestanden naar package
echo ℹ️  Stap 5: Bestanden kopiëren...
xcopy /E /I /Y dist "%package_name%" >nul
echo ✅ Bestanden gekopieerd
echo.

REM Stap 6: Kopieer .htaccess bestand
echo ℹ️  Stap 6: Server configuratie toevoegen...
if exist "ftp-update-package\website\.htaccess" (
    copy /Y "ftp-update-package\website\.htaccess" "%package_name%\.htaccess" >nul
    echo ✅ .htaccess toegevoegd
) else (
    echo ⚠️  .htaccess niet gevonden, wordt aangemaakt...
    REM Maak basis .htaccess
    (
        echo # Koi Pond Pal - Apache Configuration
        echo ^<IfModule mod_rewrite.c^>
        echo     RewriteEngine On
        echo     RewriteBase /
        echo     RewriteCond %%{REQUEST_FILENAME} !-f
        echo     RewriteCond %%{REQUEST_FILENAME} !-d
        echo     RewriteRule . /index.html [L]
        echo ^</IfModule^>
    ) > "%package_name%\.htaccess"
    echo ✅ .htaccess aangemaakt
)
echo.

REM Stap 7: Maak README bestand
echo ℹ️  Stap 7: Documentatie toevoegen...
(
    echo # 🚀 Koi Pond Pal - FTP Upload Package
    echo.
    echo **Gemaakt op:** %YYYY%-%MM%-%DD% %HH%:%Min%
    echo.
    echo ## 📦 Package Inhoud
    echo.
    echo Dit package bevat alle bestanden die nodig zijn om Koi Pond Pal naar je FTP server te uploaden.
    echo.
    echo ### Bestanden:
    echo - `index.html` - Hoofdpagina van de applicatie
    echo - `assets/` - Alle JavaScript, CSS en afbeeldingen
    echo - `.htaccess` - Apache server configuratie voor client-side routing
    echo.
    echo ## 🚀 Upload Instructies
    echo.
    echo ### 1. Verbind met je FTP server
    echo    - Gebruik een FTP client zoals FileZilla, WinSCP of Cyberduck
    echo    - Verbind met je hosting provider
    echo.
    echo ### 2. Upload bestanden
    echo    - Navigeer naar je `public_html/` of `www/` directory
    echo    - Upload ALLE bestanden uit dit package
    echo    - Behoud de mappenstructuur (met name de `assets/` folder)
    echo.
    echo ### 3. Configureer environment variabelen
    echo    **BELANGRIJK!** Je moet de volgende environment variabelen instellen op je hosting provider:
    echo.
    echo    ```
    echo    VITE_SUPABASE_URL=https://your-project.supabase.co
    echo    VITE_SUPABASE_ANON_KEY=your-anon-key-here
    echo    ```
    echo.
    echo    **Waar te configureren:**
    echo    - **cPanel**: Environment Variables sectie
    echo    - **DirectAdmin**: Environment Variables
    echo    - **Plesk**: Environment Variables
    echo    - **Custom server**: .env bestand in root directory
    echo.
    echo ### 4. Test de website
    echo    - Open je website in een browser
    echo    - Controleer of alle functionaliteit werkt
    echo    - Test de login functionaliteit
    echo.
    echo ## ⚙️ Server Vereisten
    echo.
    echo - Apache webserver met mod_rewrite enabled
    echo - Ondersteuning voor client-side routing (SPA)
    echo - Mogelijkheid om environment variabelen in te stellen
    echo.
    echo ## 📋 Troubleshooting
    echo.
    echo ### Website toont alleen witte pagina
    echo - Controleer of `.htaccess` bestand is geüpload
    echo - Controleer of `mod_rewrite` is enabled op Apache
    echo - Controleer browser console voor errors
    echo.
    echo ### Environment variabelen werken niet
    echo - Verifieer dat variabelen correct zijn ingesteld op hosting provider
    echo - Controleer of variabelen beschikbaar zijn via `import.meta.env` in browser console
    echo.
    echo ### Assets laden niet
    echo - Controleer of `assets/` folder correct is geüpload
    echo - Controleer of bestandspermissies correct zijn (755 voor folders, 644 voor bestanden)
    echo.
    echo ## ✅ Succes!
    echo.
    echo Als alles correct is geconfigureerd, zou je website nu moeten werken!
    echo.
    echo **Veel succes met je deployment!** 🎉
) > "%package_name%\README.md"
echo ✅ README toegevoegd
echo.

REM Stap 8: Maak zip bestand
echo ℹ️  Stap 8: ZIP bestand aanmaken...
REM Controleer of PowerShell beschikbaar is voor compressie
where powershell >nul 2>&1
if errorlevel 1 (
    echo ⚠️  PowerShell niet gevonden. Zip bestand wordt overgeslagen.
    echo    Je kunt handmatig een zip bestand maken van de package directory.
) else (
    echo    Comprimeren naar %zip_name%...
    powershell -Command "Compress-Archive -Path '%package_name%\*' -DestinationPath '%zip_name%' -Force" >nul
    if errorlevel 1 (
        echo ⚠️  Zip creatie gefaald, maar package directory is klaar voor gebruik.
    ) else (
        echo ✅ ZIP bestand aangemaakt: %zip_name%
    )
)
echo.

REM Stap 10: Toon samenvatting
echo =====================================
echo 🎉 FTP Package succesvol aangemaakt!
echo =====================================
echo.
echo 📦 Package directory: %package_name%
if exist "%zip_name%" (
    echo 📦 ZIP bestand: %zip_name%
)
echo.
echo 📋 Volgende stappen:
echo    1. Upload alle bestanden uit '%package_name%' naar je FTP server
echo    2. Configureer environment variabelen op je hosting provider
echo    3. Test de website
echo.
echo ✅ Klaar voor FTP upload!
echo.

REM Open package directory
if exist "%package_name%" (
    echo    Opent package directory...
    start explorer "%package_name%"
)

pause

