@echo off
REM 🚀 Live Deployment Script voor Koi Pond Pal (Windows)
REM Dit script zorgt voor een veilige deployment met database backup

setlocal enabledelayedexpansion

echo 🚀 Starting Live Deployment for Koi Pond Pal...

REM Controleer of we in de juiste directory zijn
if not exist "package.json" (
    echo ❌ package.json niet gevonden. Zorg dat je in de project root bent.
    exit /b 1
)

REM Stap 1: Pre-deployment checks
echo ℹ️  Stap 1: Pre-deployment checks...

REM Controleer Node.js versie
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is niet geïnstalleerd
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ℹ️  Node.js versie: !NODE_VERSION!

REM Controleer npm versie
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is niet geïnstalleerd
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ℹ️  npm versie: !NPM_VERSION!

REM Stap 2: Database backup (kritiek!)
echo ⚠️  Stap 2: Database backup maken...
echo ⚠️  KRITIEK: Database backup wordt gemaakt voordat deployment!

REM Controleer of Supabase CLI beschikbaar is
supabase --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Supabase CLI niet gevonden. Zorg dat database backup handmatig wordt gemaakt!
    pause
) else (
    echo ℹ️  Supabase CLI gevonden, backup wordt gemaakt...
    
    REM Maak backup van database
    for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
    set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
    set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
    set "timestamp=%YYYY%%MM%%DD%_%HH%%Min%%Sec%"
    
    supabase db dump --data-only --file backup-%timestamp%.sql
    
    if errorlevel 1 (
        echo ❌ Database backup gefaald!
        exit /b 1
    ) else (
        echo ✅ Database backup succesvol gemaakt
    )
)

REM Stap 3: Dependencies installeren
echo ℹ️  Stap 3: Dependencies installeren...
npm ci --production=false

if errorlevel 1 (
    echo ❌ Dependencies installatie gefaald!
    exit /b 1
) else (
    echo ✅ Dependencies succesvol geïnstalleerd
)

REM Stap 4: Linting en type checking
echo ℹ️  Stap 4: Code kwaliteit checks...
npm run lint

if errorlevel 1 (
    echo ⚠️  Linting warnings gevonden, maar deployment gaat door...
) else (
    echo ✅ Linting succesvol
)

REM Stap 5: Build voor productie
echo ℹ️  Stap 5: Productie build maken...
npm run build

if errorlevel 1 (
    echo ❌ Build gefaald!
    exit /b 1
) else (
    echo ✅ Productie build succesvol gemaakt
)

REM Stap 6: Build verificatie
echo ℹ️  Stap 6: Build verificatie...
if exist "dist" (
    echo ✅ Build directory gevonden
    
    REM Controleer of index.html bestaat
    if exist "dist\index.html" (
        echo ✅ index.html gevonden in build
    ) else (
        echo ❌ index.html niet gevonden in build!
        exit /b 1
    )
) else (
    echo ❌ Build directory niet gevonden!
    exit /b 1
)

REM Stap 7: Environment variabelen check
echo ℹ️  Stap 7: Environment variabelen check...
if exist ".env.production" (
    echo ✅ Production environment file gevonden
) else if exist ".env" (
    echo ⚠️  Alleen .env file gevonden, zorg dat productie variabelen correct zijn
) else (
    echo ⚠️  Geen environment file gevonden, controleer Supabase configuratie
)

REM Stap 8: Database schema verificatie
echo ℹ️  Stap 8: Database schema verificatie...
echo ⚠️  Controleer of database schema up-to-date is voordat deployment!

REM Stap 9: Deployment instructies
echo.
echo 🎉 Build succesvol voltooid!
echo.
echo 📋 Volgende stappen voor live deployment:
echo.
echo 1. 📁 Upload de 'dist' directory naar je hosting provider
echo 2. 🔧 Zorg dat environment variabelen correct zijn ingesteld:
echo    - VITE_SUPABASE_URL
echo    - VITE_SUPABASE_ANON_KEY
echo 3. 🗄️  Controleer database connectie
echo 4. 🧪 Test alle functionaliteit op live site
echo 5. 📊 Monitor voor errors na deployment
echo.
echo ⚠️  Belangrijk: Test altijd eerst op staging environment!
echo.
echo ✅ Deployment script voltooid. Veel succes met de live update!

REM Open build directory
if exist "dist" (
    echo ℹ️  Build directory wordt geopend...
    start explorer dist
)

pause
