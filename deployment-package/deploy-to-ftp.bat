@echo off
REM 🚀 FTP Deployment Script voor Koi Pond Pal
REM Dit script helpt bij het uploaden naar FTP hosting

setlocal enabledelayedexpansion

echo 🚀 Koi Pond Pal - FTP Deployment Helper
echo ========================================

echo.
echo 📋 Stap-voor-stap FTP upload instructies:
echo.

echo 1. 📁 Open je FTP client (FileZilla, WinSCP, of browser-based)
echo.

echo 2. 🔗 Verbind met je hosting provider:
echo    - Host: [jouw-ftp-server]
echo    - Username: [jouw-username]
echo    - Password: [jouw-password]
echo    - Port: 21 (of 22 voor SFTP)
echo.

echo 3. 📤 Upload de volgende bestanden:
echo    ✅ Upload de HELE 'dist' directory
echo    ✅ Upload .htaccess bestand (voor Apache servers)
echo    ✅ Upload alle bestanden in de root van je website
echo.

echo 4. 🔧 Configureer environment variabelen:
echo    - Ga naar je hosting control panel
echo    - Zoek naar 'Environment Variables' of '.env' settings
echo    - Voeg toe: VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY
echo.

echo 5. 🧪 Test je website:
echo    - Ga naar je website URL
echo    - Test login functionaliteit
echo    - Controleer of alle features werken
echo.

echo ⚠️  BELANGRIJK:
echo - Zorg dat index.html in de root staat
echo - Alle bestanden in dist/assets/ moeten ook geüpload worden
echo - Test altijd eerst op een staging environment
echo.

echo 📞 Hulp nodig?
echo - Lees README-DEPLOYMENT.md voor gedetailleerde instructies
echo - Controleer ENVIRONMENT-SETUP.md voor configuratie
echo - Gebruik DEPLOYMENT-CHECKLIST.md voor verificatie
echo.

echo ✅ Deployment package is klaar voor upload!
echo.

pause
