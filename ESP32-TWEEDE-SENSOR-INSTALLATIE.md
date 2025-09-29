# ESP32 Tweede Temperatuursensor Installatie Gids

## 📋 Overzicht

Deze gids helpt je bij het installeren van een tweede DS18B20 temperatuursensor op je ESP32 met ID KOIoT-A1b2C3. De tweede sensor wordt gebruikt voor het meten van de filter inlaat temperatuur.

## 🔧 Benodigde Materialen

### Hardware
- **ESP32 Development Board** (al geïnstalleerd)
- **DS18B20 Temperatuursensor** (nieuwe sensor)
- **4.7kΩ Pull-up weerstand** (voor de nieuwe sensor)
- **Dupont kabels** (3 stuks: VCC, GND, Data)
- **Waterdichte behuizing** (optioneel, voor buiten installatie)
- **Soldeer materiaal** (indien nodig)

### Tools
- Soldeerbout en soldeer
- Multimeter (voor testen)
- Schroevendraaier set
- Kabel stripper

## 🔌 Pinout Configuratie

### ESP32 Pin Mapping
```
Eerste Sensor (Vijver Water):
- VCC  → 3.3V
- GND  → GND  
- Data → GPIO 14

Tweede Sensor (Filter Inlaat):
- VCC  → 3.3V
- GND  → GND
- Data → GPIO 15
```

### Pull-up Weerstanden
- **GPIO 14**: 4.7kΩ tussen Data en 3.3V (al geïnstalleerd)
- **GPIO 15**: 4.7kΩ tussen Data en 3.3V (nieuw toe te voegen)

## 📐 Stap-voor-Stap Installatie

### Stap 1: Voorbereiding
1. **Schakel de ESP32 uit** en verwijder de stroom
2. **Open de behuizing** van je ESP32 setup
3. **Identificeer de bestaande sensor** op GPIO 14
4. **Bereid de nieuwe sensor voor** met waterdichte behuizing

### Stap 2: Hardware Aansluiting
1. **Sluit de VCC aan**:
   - Verbind de rode kabel van de nieuwe sensor met 3.3V op de ESP32
   - Gebruik een bestaande 3.3V verbinding of maak een nieuwe

2. **Sluit de GND aan**:
   - Verbind de zwarte kabel van de nieuwe sensor met GND op de ESP32
   - Gebruik een bestaande GND verbinding

3. **Sluit de Data lijn aan**:
   - Verbind de gele/witte kabel van de nieuwe sensor met **GPIO 15**
   - **BELANGRIJK**: Dit is een nieuwe pin, niet GPIO 14!

4. **Installeer de pull-up weerstand**:
   - Plaats een 4.7kΩ weerstand tussen de Data lijn (GPIO 15) en 3.3V
   - Dit is essentieel voor correcte communicatie

### Stap 3: Waterdichte Behuizing
1. **Plaats de sensor** in een waterdichte behuizing
2. **Voeg siliconen toe** rond de kabel ingangen
3. **Test de waterdichtheid** voordat je de sensor in het water plaatst

### Stap 4: Sensor Plaatsing
1. **Vijver Water Sensor** (bestaand):
   - Plaats in het midden van de vijver
   - Op een diepte van 30-50cm
   - Uit de buurt van de filter inlaat

2. **Filter Inlaat Sensor** (nieuw):
   - Plaats bij de filter inlaat
   - In de waterstroom naar de filter
   - Op een diepte waar het water actief stroomt

## 💻 Software Configuratie

### Stap 1: Code Upload
1. **Open Arduino IDE**
2. **Upload de nieuwe code** (`esp32-sensor-code-remote-config.ino`)
3. **Open de Serial Monitor** (115200 baud)
4. **Controleer de output** voor beide sensoren

### Stap 2: Sensor Detectie Test
```
Verwachte output:
Gevonden sensoren op pin 14: 1
Gevonden sensoren op pin 15: 1
```

### Stap 3: Database Configuratie
1. **Voer de SQL scripts uit** in Supabase:
   - `sensor-configurations-table.sql`
   - `update-sensor-data-for-multiple-sensors.sql`

2. **Controleer de configuratie** in de Supabase dashboard

## 🧪 Testen en Validatie

### Stap 1: Hardware Test
1. **Controleer alle verbindingen** met een multimeter
2. **Test de pull-up weerstanden** (4.7kΩ tussen Data en 3.3V)
3. **Controleer de voeding** (3.3V op beide sensoren)

### Stap 2: Software Test
1. **Monitor de Serial output**:
   ```
   🌡️  Sensor 1 (Vijver Water) - Raw: 20.50°C
   🌡️  Sensor 1 (Vijver Water) - Gecalibreerd: 20.50°C
   🌡️  Sensor 2 (Filter Inlaat) - Raw: 19.75°C
   🌡️  Sensor 2 (Filter Inlaat) - Gecalibreerd: 19.75°C
   ```

2. **Controleer de Supabase data**:
   - Beide sensoren moeten data verzenden
   - Sensor types moeten correct zijn: `vijver_water` en `filter_inlaat`

### Stap 3: Frontend Test
1. **Open de Koi Pond Pal app**
2. **Ga naar het Dashboard**
3. **Controleer de Multiple Sensor Display**
4. **Verificeer beide temperatuurmetingen**

## 🔧 Troubleshooting

### Probleem: Sensor wordt niet gedetecteerd
**Oplossingen:**
- Controleer de pull-up weerstand (4.7kΩ)
- Verificeer de pin aansluiting (GPIO 15)
- Test de voeding (3.3V)
- Controleer de kabel verbindingen

### Probleem: Onjuiste temperatuurmetingen
**Oplossingen:**
- Controleer de sensor kalibratie
- Verificeer de sensor plaatsing
- Test met een referentie thermometer
- Controleer de waterstroom bij de filter inlaat

### Probleem: Geen data in Supabase
**Oplossingen:**
- Controleer de WiFi verbinding
- Verificeer de sensor_id configuratie
- Controleer de API endpoints
- Test de database verbinding

## 📊 Verwachte Resultaten

### Dashboard Weergave
- **Vijver Water Temperatuur**: Geeft de temperatuur van het vijver water weer
- **Filter Inlaat Temperatuur**: Geeft de temperatuur van het water bij de filter inlaat weer
- **Status indicatoren**: Toont of de temperaturen ideaal zijn voor koi

### Data Logging
- Beide sensoren loggen elke 5 minuten (300 seconden)
- Data wordt opgeslagen in Supabase met sensor type identificatie
- Historische data is beschikbaar voor analyse

## 🔄 Onderhoud

### Maandelijks
- Controleer de sensor behuizing op lekkage
- Verificeer de kabel verbindingen
- Test de sensor nauwkeurigheid

### Seizoensgebonden
- Reinig de sensoren
- Controleer de waterdichte behuizing
- Update de sensor kalibratie indien nodig

## 📞 Support

Bij problemen:
1. Controleer de Serial Monitor output
2. Verificeer de hardware verbindingen
3. Test de database configuratie
4. Raadpleeg de troubleshooting sectie

---

**Succes met de installatie van je tweede temperatuursensor! 🐟🌡️**
