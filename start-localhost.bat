@echo off
echo ========================================
echo   Koi Pond Pal - Localhost Testomgeving
echo ========================================
echo.

REM Check if .env.local exists
if not exist ".env.local" (
    echo ⚠️  .env.local bestand niet gevonden!
    echo.
    echo 📝 Maak een .env.local bestand aan met:
    echo    VITE_SUPABASE_URL=your-supabase-url
    echo    VITE_SUPABASE_ANON_KEY=your-anon-key
    echo.
    echo 💡 Tip: Kopieer .env.local.example naar .env.local
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Dependencies installeren...
    call npm install
    echo.
)

echo 🚀 Development server starten...
echo.
echo 📍 De applicatie zal beschikbaar zijn op:
echo    http://localhost:8080
echo.
echo 💡 Druk Ctrl+C om de server te stoppen
echo.

call npm run dev

pause












