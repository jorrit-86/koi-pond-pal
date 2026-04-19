# App Icoon Instructies voor Mobiele Apparaten

## Overzicht
Om het app-icoon te personaliseren wanneer gebruikers de pagina opslaan op hun mobiele apparaat (iPhone/iPad), heb je PNG-bestanden nodig in verschillende formaten.

## Vereiste Icoon Formaten

Je moet de volgende PNG-bestanden aanmaken en in de `public/` folder plaatsen:

1. **apple-touch-icon-180x180.png** (180x180 pixels)
   - Voor moderne iPhones (iPhone 6 Plus en nieuwer)
   - Dit is het belangrijkste formaat voor iOS

2. **apple-touch-icon-152x152.png** (152x152 pixels)
   - Voor iPad apparaten

3. **apple-touch-icon-120x120.png** (120x120 pixels)
   - Voor oudere iPhone modellen

4. **icon-192x192.png** (192x192 pixels)
   - Voor Android apparaten en PWA

5. **icon-512x512.png** (512x512 pixels)
   - Voor Android apparaten en PWA (hoogste kwaliteit)

## Hoe Maak Je Deze Iconen?

### Optie 1: Online Tools (Aanbevolen)
1. Ga naar een online tool zoals:
   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator
   - https://favicon.io/favicon-converter/
2. Upload je `koi-sensei-logo.svg` bestand
3. Genereer alle benodigde formaten
4. Download de PNG-bestanden en plaats ze in de `public/` folder

### Optie 2: Grafisch Software (Photoshop, GIMP, Figma, etc.)
1. Open je logo in grafische software
2. Exporteer het logo als PNG in de volgende formaten:
   - 180x180 pixels → `apple-touch-icon-180x180.png`
   - 152x152 pixels → `apple-touch-icon-152x152.png`
   - 120x120 pixels → `apple-touch-icon-120x120.png`
   - 192x192 pixels → `icon-192x192.png`
   - 512x512 pixels → `icon-512x512.png`
3. Plaats alle bestanden in de `public/` folder

### Optie 3: Command Line (als je ImageMagick hebt)
```bash
# Converteer SVG naar PNG in verschillende formaten
convert src/assets/koi-sensei-logo.svg -resize 180x180 public/apple-touch-icon-180x180.png
convert src/assets/koi-sensei-logo.svg -resize 152x152 public/apple-touch-icon-152x152.png
convert src/assets/koi-sensei-logo.svg -resize 120x120 public/apple-touch-icon-120x120.png
convert src/assets/koi-sensei-logo.svg -resize 192x192 public/icon-192x192.png
convert src/assets/koi-sensei-logo.svg -resize 512x512 public/icon-512x512.png
```

## Belangrijke Tips

1. **Achtergrond**: iOS voegt automatisch een witte achtergrond toe aan app-iconen. Zorg ervoor dat je logo er goed uitziet op een witte achtergrond, of voeg zelf een achtergrond toe.

2. **Padding**: Laat wat ruimte rondom je logo (ongeveer 10-15% padding) zodat het niet tegen de randen aan zit wanneer iOS het icoon toont.

3. **Vierkant**: Alle iconen moeten vierkant zijn (bijvoorbeeld 180x180, niet 180x200).

4. **Testen**: Na het toevoegen van de iconen:
   - Bouw de app opnieuw: `npm run build`
   - Test op een iPhone door de pagina te openen in Safari
   - Kies "Deel" → "Voeg toe aan beginscherm"
   - Controleer of het icoon correct wordt weergegeven

## Huidige Status

⚠️ **Let op**: De iconen zijn nog niet aangemaakt. De HTML en manifest.json zijn al geconfigureerd, maar je moet nog de PNG-bestanden toevoegen aan de `public/` folder voordat het icoon correct wordt weergegeven op iOS apparaten.




