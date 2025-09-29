#!/bin/bash

# 🚀 Live Deployment Script voor Koi Pond Pal
# Dit script zorgt voor een veilige deployment met database backup

set -e  # Stop bij eerste error

echo "🚀 Starting Live Deployment for Koi Pond Pal..."

# Kleuren voor output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functie voor gekleurde output
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Controleer of we in de juiste directory zijn
if [ ! -f "package.json" ]; then
    log_error "package.json niet gevonden. Zorg dat je in de project root bent."
    exit 1
fi

# Stap 1: Pre-deployment checks
log_info "Stap 1: Pre-deployment checks..."

# Controleer Node.js versie
if ! command -v node &> /dev/null; then
    log_error "Node.js is niet geïnstalleerd"
    exit 1
fi

NODE_VERSION=$(node --version)
log_info "Node.js versie: $NODE_VERSION"

# Controleer npm versie
if ! command -v npm &> /dev/null; then
    log_error "npm is niet geïnstalleerd"
    exit 1
fi

NPM_VERSION=$(npm --version)
log_info "npm versie: $NPM_VERSION"

# Stap 2: Database backup (kritiek!)
log_warning "Stap 2: Database backup maken..."
log_warning "⚠️  KRITIEK: Database backup wordt gemaakt voordat deployment!"

# Controleer of Supabase CLI beschikbaar is
if command -v supabase &> /dev/null; then
    log_info "Supabase CLI gevonden, backup wordt gemaakt..."
    
    # Maak backup van database
    supabase db dump --data-only --file backup-$(date +%Y%m%d_%H%M%S).sql
    
    if [ $? -eq 0 ]; then
        log_success "Database backup succesvol gemaakt"
    else
        log_error "Database backup gefaald!"
        exit 1
    fi
else
    log_warning "Supabase CLI niet gevonden. Zorg dat database backup handmatig wordt gemaakt!"
    read -p "Druk Enter om door te gaan (alleen als backup al is gemaakt)..." -n 1 -r
    echo
fi

# Stap 3: Dependencies installeren
log_info "Stap 3: Dependencies installeren..."
npm ci --production=false

if [ $? -eq 0 ]; then
    log_success "Dependencies succesvol geïnstalleerd"
else
    log_error "Dependencies installatie gefaald!"
    exit 1
fi

# Stap 4: Linting en type checking
log_info "Stap 4: Code kwaliteit checks..."
npm run lint

if [ $? -eq 0 ]; then
    log_success "Linting succesvol"
else
    log_warning "Linting warnings gevonden, maar deployment gaat door..."
fi

# Stap 5: Build voor productie
log_info "Stap 5: Productie build maken..."
npm run build

if [ $? -eq 0 ]; then
    log_success "Productie build succesvol gemaakt"
else
    log_error "Build gefaald!"
    exit 1
fi

# Stap 6: Build verificatie
log_info "Stap 6: Build verificatie..."
if [ -d "dist" ]; then
    BUILD_SIZE=$(du -sh dist | cut -f1)
    log_success "Build directory gevonden (grootte: $BUILD_SIZE)"
    
    # Controleer of index.html bestaat
    if [ -f "dist/index.html" ]; then
        log_success "index.html gevonden in build"
    else
        log_error "index.html niet gevonden in build!"
        exit 1
    fi
else
    log_error "Build directory niet gevonden!"
    exit 1
fi

# Stap 7: Environment variabelen check
log_info "Stap 7: Environment variabelen check..."
if [ -f ".env.production" ]; then
    log_success "Production environment file gevonden"
elif [ -f ".env" ]; then
    log_warning "Alleen .env file gevonden, zorg dat productie variabelen correct zijn"
else
    log_warning "Geen environment file gevonden, controleer Supabase configuratie"
fi

# Stap 8: Database schema verificatie
log_info "Stap 8: Database schema verificatie..."
log_warning "⚠️  Controleer of database schema up-to-date is voordat deployment!"

# Stap 9: Deployment instructies
log_success "🎉 Build succesvol voltooid!"
echo
log_info "📋 Volgende stappen voor live deployment:"
echo
echo "1. 📁 Upload de 'dist' directory naar je hosting provider"
echo "2. 🔧 Zorg dat environment variabelen correct zijn ingesteld:"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo "3. 🗄️  Controleer database connectie"
echo "4. 🧪 Test alle functionaliteit op live site"
echo "5. 📊 Monitor voor errors na deployment"
echo
log_warning "⚠️  Belangrijk: Test altijd eerst op staging environment!"
echo
log_success "✅ Deployment script voltooid. Veel succes met de live update!"

# Optioneel: Open build directory
if command -v explorer &> /dev/null; then
    log_info "Build directory wordt geopend..."
    explorer dist
elif command -v open &> /dev/null; then
    log_info "Build directory wordt geopend..."
    open dist
fi
