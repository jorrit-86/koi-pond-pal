# AI Chat Assistant - Koi Sensei

## Overzicht

De AI Chat Assistant is een intelligente chatbot die op elke pagina van de Koi Pond Pal applicatie beschikbaar is. Deze assistant kan gebruikers helpen met vragen over vijveronderhoud, koi-verzorging, waterkwaliteit en meer.

## Functionaliteiten

### 🎯 **Context-Aware Responses**
- De assistant weet op welke pagina je bent (Dashboard, Waterparameters, Koi Beheer, etc.)
- Gebruikt je vijvergegevens voor gepersonaliseerde antwoorden
- Houdt rekening met je ervaringsniveau (beginner/gevorderd)

### 🌊 **Waterkwaliteit Expertise**
- Interpreteert je waterparameters (pH, nitriet, nitraat, etc.)
- Geeft specifieke adviezen op basis van je metingen
- Analyseert elke parameter en geeft concrete actiepunten
- Helpt bij probleemoplossing en onderhoud

### 🐟 **Koi-Verzorging**
- Advies over voeding, gezondheid en gedrag
- Analyseert je koi-aantal en vijverbezetting
- Geeft specifieke voeding adviezen per seizoen
- Probleemherkenning en preventie

### 🔧 **Vijveronderhoud**
- Filterbeheer en onderhoud
- Vijverinhoud analyse en adviezen
- Seizoensadviezen
- Technische vragen en oplossingen

## Interface

### Floating Chat Button
- **Positie**: Rechter onderhoek van het scherm
- **Design**: Witte achtergrond met grijze border en Koi Sensei logo
- **Logo**: Gebruikt het wijze Koi Sensei logo in originele kleuren (wijze man met koi-vis)
- **Altijd zichtbaar**: Op alle pagina's beschikbaar

### Chat Window
- **Responsive**: Past zich aan aan schermgrootte
- **Modern design**: Glasmorphism effect met backdrop blur
- **Smooth animations**: Vloeiende open/sluit animaties

### Features
- **Chat geschiedenis**: Bewaart gesprekken in de database
- **Quick suggestions**: Snelle vraag-suggesties
- **Typing indicator**: Toont wanneer de AI aan het "denken" is
- **Context display**: Toont huidige pagina en status
- **Koi Sensei branding**: Gebruikt het wijze Koi Sensei logo door de hele interface

## Technische Implementatie

### Bestanden
```
src/components/ai/ai-chat-assistant.tsx  # Hoofdcomponent
src/lib/ai-chat-service.ts               # AI logica en database integratie
ai-chat-database-setup.sql               # Database setup
```

### Database Schema
```sql
ai_chat_history (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    message_type TEXT ('user' | 'assistant'),
    content TEXT,
    context JSONB,
    created_at TIMESTAMP
)
```

### Integratie
- **Index.tsx**: AI Chat Assistant toegevoegd aan hoofdapplicatie
- **Context-aware**: Gebruikt huidige pagina en vijvergegevens
- **Database**: Slaat chat geschiedenis op per gebruiker

## AI Response Logic

### Intelligente Categorisatie
De AI herkent verschillende types vragen:

1. **Waterkwaliteit** - pH, nitriet, nitraat, etc.
2. **Koi-verzorging** - Voeding, gezondheid, gedrag
3. **Vijveronderhoud** - Filters, seizoenswerk
4. **Temperatuur** - Seizoensgebonden adviezen
5. **Gezondheid** - Probleemherkenning en preventie

### Contextuele Antwoorden
- **Beginner vs Gevorderd**: Aangepaste uitleg niveau
- **Seizoen**: Lente/zomer/herfst/winter specifieke tips
- **Vijvergrootte**: Aangepaste adviezen
- **Huidige parameters**: Gebruikt je laatste metingen

## Setup Instructies

### 1. Database Setup
```sql
-- Voer het SQL script uit in Supabase
\i ai-chat-database-setup.sql
```

### 2. Dependencies
Alle benodigde dependencies zijn al aanwezig:
- React hooks (useState, useEffect, useRef)
- UI components (Button, Card, Input, etc.)
- Supabase client
- Toast notifications

### 3. Gebruik
De AI Chat Assistant is automatisch beschikbaar op alle pagina's. Gebruikers hoeven niets te installeren of configureren.

## Voorbeelden van Gebruik

### Vijverinhoud Vragen
```
Gebruiker: "Hoeveel inhoud heeft mijn vijver?"
AI: "Je vijver heeft een inhoud van 12.500 liter en je hebt 1 koi.
Analyse van je vijver:
• Je hebt 12.500 liter per koi
• ✅ Uitstekende bezetting - Ruim voldoende ruimte per koi
Aanbevelingen voor je 12.500 liter vijver:
• Grote vijver: Zeer stabiel ecosysteem
• Maandelijkse controles voldoende
• Minimale waterverversing nodig..."
```

### Waterkwaliteit Vragen
```
Gebruiker: "Hoe is mijn waterkwaliteit?"
AI: "Analyse van je waterkwaliteit:
✅ PH: 7.2 - Perfecte waarde!
🚨 NITRIET: 0.5 mg/l - Gevaarlijk! Voer 50% waterverversing uit
⚠️ NITRAAT: 75 mg/l - Te hoog! Meer waterverversing nodig
🚨 Actie vereist:
• Directe waterverversing nodig
• Verhoog waterverversing naar 20% per week"
```

### Koi-Verzorging
```
Gebruiker: "Hoe vaak moet ik mijn koi voeren?"
AI: "Voeding advies voor de zomer:
In de zomer zijn koi het meest actief. Voer 2-3x per dag met hoogwaardig voer.
Specifiek voor je 8 koi:
• Dagelijkse hoeveelheid: 24 gram
• Voer 2-3x per dag
• Voer alleen wat ze in 5 minuten opeten"
```

### Seizoensadvies
```
Gebruiker: "Wat moet ik doen in de winter?"
AI: "In de winter zijn er specifieke taken voor je vijver:
Winter: Minimale voeding, ijsvrij houden, filter onderhoud, koi observeren
Specifiek voor je 8 koi:
• Geen voeding onder 10°C
• Voer niet
• Extra observatie voor gezondheid"
```

## Toekomstige Uitbreidingen

### Mogelijke Verbeteringen
1. **Echte AI Integration** - OpenAI GPT of vergelijkbaar
2. **Voice Input** - Spraak-naar-tekst functionaliteit
3. **Image Analysis** - Foto's van koi/vijver analyseren
4. **Predictive Analytics** - Voorspellingen op basis van data
5. **Multi-language** - Ondersteuning voor meerdere talen

### Performance Optimalisaties
1. **Caching** - Chat geschiedenis cachen
2. **Lazy Loading** - Componenten alleen laden wanneer nodig
3. **Debouncing** - Input debouncing voor betere performance

## Troubleshooting

### Veelvoorkomende Problemen

1. **Chat laadt niet**
   - Controleer of database setup is uitgevoerd
   - Controleer Supabase connectie

2. **Geen context data**
   - Controleer of gebruiker is ingelogd
   - Controleer of vijvergegevens bestaan

3. **AI antwoorden zijn generiek**
   - Controleer of pond context correct wordt geladen
   - Controleer database queries

## Conclusie

De AI Chat Assistant biedt een intuïtieve en intelligente manier voor gebruikers om hulp te krijgen bij hun vijveronderhoud. Door gebruik te maken van contextuele informatie en gepersonaliseerde antwoorden, wordt de gebruikerservaring aanzienlijk verbeterd.

De implementatie is modulair en uitbreidbaar, waardoor toekomstige verbeteringen eenvoudig kunnen worden toegevoegd.
