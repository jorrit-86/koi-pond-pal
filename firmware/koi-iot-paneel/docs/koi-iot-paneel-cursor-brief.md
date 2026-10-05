# KOIoT Paneel — bouwinstructie voor Cursor

*Versie 2.0 — 28 september 2026. Opgesteld in het Koi IoT-project voor gebruik in Cursor.*
*Wijzigingen: v1.1 — lekdetectie (`flow_leak`) wordt niet gebruikt en is geschrapt. v1.2 — nieuwe
mijlpaal M1.5: open onderhoudstaken, seizoen en voeradvies uit de app tonen via `ha-status`
(§6.4, §7.1, §7.5, §10, §11, Bijlage A/B). v1.3 — startwaarden uit de database: bij verbinding
haalt het paneel de laatst opgeslagen sensorwaarden op, zodat het niet op de eerstvolgende
MQTT-meting hoeft te wachten (§5, §6.3, §6.4, M1.5, Bijlage A8). v1.4 — de 3-standenschakelaar van
de ventilatie tonen en bedienen via de Home Assistant REST API (§6.5, §7.1, §10, M1.6, §12,
Bijlage B7). v1.5 — de entiteitsgegevens van de ventilatie en `HA_TOKEN` levert Jorrit tijdens het
bouwen van M1.6 in Cursor aan (§6.5, §10, M1.6, B7). v1.6 — taken kunnen op het paneel worden
afgerond, net als in de app (§6.4, §7.5, M1.5, §13, Bijlage A6/A7). v1.7 — pop-up als een taak
niet kan worden afgerond omdat er geen verbinding is (§6.4, §7.5, M1.5). v1.8 — energiestand met
rustscherm als eigen mijlpaal M1.7, plus een schermschakelaar in Home Assistant voor een eventuele
latere aanwezigheids- of deursensor (§6.2, §7.4, §7.6, R7, M1.7, B8). v1.9 — tik op een meetwaarde
opent een pop-up met meetgegevens (§7.1, §7.3, §7.6, §7.7, M1.8, M2, Bijlage A6). v2.0 — `ha-status`
bestond nog niet; de eerste versie wordt minimaal gebouwd op het bestaande takenmodel van de app, met
een token per apparaat. Seizoen en voeradvies volgen later. De knoppen per taak komen uit `actions`
(§6.4, §7.1, §7.5, M1.5, Bijlage A6, A7, A9, B9).*

Plaats dit bestand in een nieuwe, lege repository `koi-iot-paneel/` onder `docs/` en laat Cursor
(Agent-modus) eerst dit document volledig lezen. Werk daarna strikt per mijlpaal (§11).

---

## 0. Werkafspraken voor Cursor

| # | Afspraak |
|---|---|
| W1 | Werk strikt per mijlpaal (M0 → M4, §11). Na elke mijlpaal: stoppen, samenvatten wat er gebouwd is, wat Jorrit op de hardware moet testen, en wachten op akkoord. Begin **nooit** aan M4 zonder expliciete opdracht. |
| W2 | Draai na elke wezenlijke wijziging `idf.py build` en los compile-fouten zelf op tot de build schoon is. Flashen en testen op de echte hardware doet Jorrit (`idf.py -p COMx flash monitor`); hij plakt de seriële log terug. |
| W3 | Verzin geen API-contracten, MQTT-topics of pinnummers. Alles wat hieronder "te verifiëren" heet: eerst verifiëren (Elecrow-voorbeeldcode, seriële log, of vragen). Onbekend = configureerbaar maken, TODO in de code, en melden in `STATUS.md`. |
| W4 | Board-specifieke initialisatie (display, touch, backlight, wifi-transport naar de C6) komt uit de Elecrow-voorbeeldcode, niet uit eigen reconstructie. Pas die code zo min mogelijk aan. |
| W5 | Houd in de repo `ARCHITECTUUR.md` (ontwerp, interfaces, beslissingen) en `STATUS.md` (per mijlpaal: gedaan / getest op hardware / open) bij. |
| W6 | Geen secrets in git: `main/secrets.h` staat in `.gitignore`; `main/secrets.example.h` wordt wél gecommit. |
| W7 | UI-teksten Nederlands; code-identifiers Engels; logregels en commentaar Nederlands (zelfde conventie als de sensormodule). Log elke netwerkactie expliciet bij poging, succes én falen, met reden/foutcode. In de sensormodule gingen eerder MQTT-verbindingen en discovery-berichten stil mis omdat alleen fouten (of niets) gelogd werden — dat moet hier vanaf dag één uit de log te herleiden zijn. |

---

## 1. Context: wat is Koi IoT

Koi IoT is een platform om een koivijver datagedreven te onderhouden: sensoren, relais en
automatisering nemen routinetaken over en geven de hobbyist inzicht. Alle data moet zichtbaar zijn
in de bestaande app (Koi Pond Pal: React/Vite + Supabase) **én** in Home Assistant.

Bestaande onderdelen — deze worden vanuit dit project **niet** aangepast:

| Onderdeel | Wat het doet | Relevantie voor het paneel |
|---|---|---|
| Sensormodule `KOIoT-57226C` (losse ESP32, Arduino-C++) | Meet watertemperatuur (DS18B20), luchttemperatuur + luchtvochtigheid (SHT30), pH (nog niet aangesloten) en bijvulwaterdebiet (YF-S201). | Publiceert alle metingen naar MQTT met Home Assistant Discovery (debiet realtime, ~1 s) en post ze naar Supabase (`sensor-data`). **Het paneel leest deze metingen via MQTT.** |
| Supabase-backend (project-URL `https://pbpuvumeshaeplbwbwzv.supabase.co`) | Bron van waarheid voor de app. | Het paneel schrijft handmatige metingen hierheen. |
| Home Assistant (HA Green) met Mosquitto-add-on op `192.168.178.58:1883` | Smart home; schakelbare Zigbee-relais in het pomphuis (verschijnen als `switch.*`). | Het paneel publiceert eigen entiteiten via MQTT Discovery; in M4 mogelijk ook bediening van actuatoren. |

Vijver: 13.500 L inhoud, filterdebiet ca. 8.000 L/u. Het paneel hangt in het pomphuis: onverwarmd,
vochtig, weinig licht, 230 V aanwezig.

---

## 2. Doel van dit apparaat

Het paneel heeft drie taken, in volgorde van prioriteit. Ten eerste **overzicht**: de actuele
vijverdata, plus de open onderhoudstaken, het seizoen en het voeradvies zoals de app ze toont, in
één oogopslag, plus de bediening van de ventilatie (3 standen) via Home Assistant. Ten tweede **invoer**: handmatige testresultaten (Hanna-testers voor
o.a. KH, nitriet en nitraat — parameters die bewust géén sensor krijgen) ter plekke invoeren, zodat
ze in de app (Supabase) én in Home Assistant terechtkomen. Ten derde, later: **automatiseringen**
starten en bewaken, te beginnen met water verversen/bijvullen (M4, §12).

Nadrukkelijk **niet**: het paneel meet zelf geen sensoren (die blijven op de sensormodule), neemt
geen taken van de sensormodule over, en bevat geen advies-/regellogica over waterkwaliteit (die
draait server-side). Supabase is de bron van waarheid voor handmatige metingen; Home Assistant
krijgt een spiegel.

---

## 3. Hardware

**Elecrow CrowPanel Advanced 10.1" ESP32-P4 HMI** (model DHE04310D).
Wiki: https://www.elecrow.com/wiki/CrowPanel_Advanced_10.1inch_ESP32-P4_HMI_AI_Display_1024x600_IPS.html
GitHub (voorbeelden, schema's, BSP): https://github.com/Elecrow-RD/CrowPanel-Advanced-10.1inch-ESP32-P4-HMI-AI-Display-1024x600-IPS-Touch-Screen

| Onderdeel | Specificatie |
|---|---|
| SoC | ESP32-P4, dual-core RISC-V 400 MHz, 16 MB flash, 32 MB PSRAM |
| Draadloos | ESP32-C6-MINI-1 als co-processor (wifi 6, BLE 5.3), via SDIO. **De P4 heeft zelf geen radio**: wifi loopt via `esp_hosted` + `esp_wifi_remote`. |
| Scherm | 10,1" IPS, 1024×600, MIPI-DSI, driver-IC EK79007 |
| Touch | GT911 capacitief (5-punts), I2C (SDA IO45, SCL IO46), INT IO42; adres 0x5D of 0x14 afhankelijk van INT bij reset |
| Backlight | PWM via LEDC — pinnen uit de BSP-Kconfig halen |
| Uitbreiding | Externe I2C-poort (IO45/46, **gedeeld met de touch**), UART1 (IO47/48), 11-pins GPIO-header, microSD, luidspreker (I2S-versterker), microfoon, camera-aansluiting |
| Voeding | 5 V via USB-C of UART3-IN (XH2.54), max. 2 A; met scherm aan 8–10 W |
| Hardwareversies | V1.0, V1.1, V1.2 — verschillen o.a. in de SDIO-pinvolgorde naar de C6 en in pinnen van het draadloze-moduleslot |

Bekende valkuilen:

| Valkuil | Wat te doen |
|---|---|
| Verkeerde hardwareversie | De versie staat op de print. Gebruik de voorbeeldcode van exact die versie (`example/V1.x/`). Verkeerde versie betekent vrijwel zeker geen wifi (andere SDIO-pinvolgorde). Jorrit bevestigt de versie in M0. |
| `esp_hosted`-versie vs. C6-firmware | De C6 is in de fabriek geflasht en kan niet direct via de P4 geherprogrammeerd worden. Pin `esp_hosted` op de versie uit het Elecrow-voorbeeld en upgrade niet, tenzij de C6-firmware eerst bijgewerkt wordt via Elecrow's handleiding "Upgrade P4 to C6 firmware" (in dezelfde repo). |
| Chiprevisie | De Elecrow-`sdkconfig.defaults` bevat o.a. `CONFIG_ESP32P4_SELECTS_REV_LESS_V3=y`. Overnemen, niet "opschonen". |
| Voeding tijdens flashen | Alleen de USB-poort van een pc kan te weinig stroom leveren (zwart scherm). Tweede USB-C-poort als extra voeding aansluiten. |
| Gedeelde I2C-bus | Eventuele toekomstige I2C-randapparatuur op de externe poort deelt de bus met de GT911. Gebruik de bestaande bus-handle uit `bsp_i2c`, geen tweede driver-instantie op dezelfde pinnen. |
| PlatformIO | Ondersteunt de ESP32-P4 niet officieel. Gebruik ESP-IDF. |

---

## 4. Toolchain en projectbasis

**ESP-IDF v5.5.x**, target `esp32p4` (de Elecrow V1.2-voorbeelden pinnen 5.5.4; minimaal 5.4.2).
Builden via `idf.py` in de Cursor-terminal. Jorrit werkt op Windows.

**Basis:** `example/V1.2/idf-code/Lesson16_Get_weather_via_WiFi` uit de Elecrow-repo (of de map van
de versie op de print). Dit voorbeeld combineert al display + touch + LVGL + wifi + HTTP. Neem
daaruit over: `components/bsp_display`, `components/bsp_i2c`, `components/bsp_wifi` (inclusief
hun Kconfig), `main/idf_component.yml`, `dependencies.lock`, `sdkconfig.defaults` en
`partitions.csv`. `Lesson17-Wi-Fi_function` dient als referentie voor wifi (station/softAP).

Componentversies zoals in dat voorbeeld: `esp_hosted` 2.7.0, `esp_wifi_remote` 0.16.1,
`esp_lcd_ek79007` 1.0.2, `esp_lcd_touch_gt911` 1.1.3, `lvgl` 9.1.0, `esp_lvgl_port` 2.6.0. (De
README van de repo noemt LVGL 9.2; het voorbeeld gebruikt 9.1.0 — volg het voorbeeld.) Alleen
bewust en gedocumenteerd upgraden.

Verder uit ESP-IDF zelf: `mqtt` (esp-mqtt), `esp_http_client` met `esp_crt_bundle` (HTTPS naar
Supabase), `nvs_flash`, `esp_netif` + SNTP, `json` (cJSON), `app_update` + `esp_https_ota` (M3).

Applicatielaag in C++17 is toegestaan en aanbevolen voor structuur; de Elecrow-BSP-componenten
blijven C.

Voorgestelde structuur:

```
koi-iot-paneel/
  CMakeLists.txt
  sdkconfig.defaults
  partitions.csv
  components/
    bsp_display/  bsp_i2c/  bsp_wifi/        (Elecrow, minimaal aangepast)
  main/
    main.cpp
    app_config.h                              compile-time defaults
    secrets.example.h                         template; secrets.h staat in .gitignore
    core/        net_manager, time_sync, settings_store (NVS), event_bus
    data/        live_store, param_catalog, measurement_queue
    io/          mqtt_link (sub + HA discovery), backend_client (Supabase)
    ui/          ui_root, screen_dashboard, screen_entry, screen_history,
                 screen_settings, widgets/, fonts/
    automation/  (pas in M4)
  docs/
    koi-iot-paneel-cursor-brief.md            dit document
  ARCHITECTUUR.md
  STATUS.md
```

---

## 5. Architectuur

```
Sensormodule KOIoT-57226C ──MQTT koiiot/KOIoT-57226C/…──► Mosquitto (HA) ──► PANEEL live_store ──► dashboard

PANEEL invoer ──► measurement_queue (NVS) ──HTTPS──► Supabase manual-measurement ──► app
                          │
                          └──MQTT koiiot/<panel_id>/… (retained, Discovery)──► Home Assistant
```

**Live-waarden via MQTT.** De sensormodule publiceert al alles naar de broker, debiet zelfs
realtime. Het paneel abonneert zich daarop: werkt lokaal, is realtime en vraagt geen nieuw
backend-endpoint.

**Startwaarden en terugval uit de database.** Zodra er verbinding is, haalt het paneel de laatst
opgeslagen sensorwaarden uit Supabase op (via `ha-status`, §6.4). Zo staat het dashboard direct
gevuld, ook als de sensormodule niet retained publiceert of de broker even weg is. Elke
MQTT-waarde die daarna binnenkomt en nieuwer is, vervangt de databasewaarde. Rangorde per veld:
de waarde met het nieuwste meettijdstip wint, ongeacht de bron.

**Status uit de app via `ha-status`.** Seizoen, voeradvies en onderhoudstaken worden server-side
berekend (edge function `evaluate-pond-rules`, elk uur). Het paneel rekent die niet zelf na, maar
haalt ze op via hetzelfde endpoint dat Home Assistant gebruikt (§6.4). Zo tonen app, HA en paneel
altijd hetzelfde.

**Handmatige metingen: Supabase is de bron van waarheid, MQTT is de spiegel.** Volgorde bij
opslaan: eerst in de lokale wachtrij (NVS), dan direct retained naar MQTT, daarna uploaden naar
Supabase met retry. Het paneel toont per meting de uploadstatus.

**Threading.** LVGL-aanroepen alleen vanuit de LVGL-taak of binnen
`lvgl_port_lock()` / `lvgl_port_unlock()`. Netwerk (MQTT/HTTP) **nooit** in een LVGL-event-callback:
de UI plaatst een opdracht in een FreeRTOS-queue, een netwerktaak voert die uit en meldt het
resultaat terug; de UI ververst via een LVGL-timer (bv. elke 250 ms) die `live_store` leest.
Grote buffers (LVGL, JSON) in PSRAM; HTTP-responses begrensd.

| Taak | Verantwoordelijkheid |
|---|---|
| LVGL (via `esp_lvgl_port`) | Rendering en touch |
| `net_manager` | Wifi-verbinding, reconnect, status |
| `mqtt_link` | esp-mqtt-client: abonneren op de sensormodule, discovery en states publiceren, LWT |
| `uploader` | `measurement_queue` naar Supabase uploaden met backoff |
| `automation_runner` (M4) | State machine, eigen taak met hogere prioriteit, onafhankelijk van de UI |

---

## 6. Externe interfaces

### 6.1 MQTT — lezen van de sensormodule

Broker `192.168.178.58:1883` met gebruikersnaam/wachtwoord (bij voorkeur een eigen, niet-admin
HA-gebruiker voor het paneel; credentials in `secrets.h`). Topic-prefix `koiiot`. Abonneer op
`koiiot/<gekoppeld_device_id>/#`, default `KOIoT-57226C`, instelbaar.

Bekende state-topics onder dat prefix: `flow_rate` (L/min), `flow_total` (L, cumulatief sinds
ingebruikname), `humidity` (%). De sensormodule publiceert ook `flow_leak`; dat topic wordt **niet
gebruikt** — negeren, geen functie aan koppelen. **Te verifiëren:** de exacte topicnamen voor
watertemperatuur, luchttemperatuur en pH, en het payload-formaat (kale getalstring of JSON). Eerste
taak in M1: alle binnenkomende topics op `koiiot/#` loggen en de mapping vastleggen in
`ARCHITECTUUR.md`. De mapping topic → veld staat als één tabel in `live_store`, niet verspreid door
de code.

**Retained?** Onbekend of de sensormodule retained publiceert. Zo niet, dan krijgt het paneel na
een herstart pas waarden bij de volgende publicatie — en het meetinterval kan via de app tot 900 s
staan. Meld dit in `STATUS.md`; een eventuele aanpassing gebeurt in de sensormodule, buiten dit
project.

**Verouderd.** Houd per waarde `last_update` bij. Tegel grijs met "verouderd (xx min)" zodra de
waarde ouder is dan een drempel (instelbaar; default 30 min voor temperatuur/RV/pH, 60 s voor
debiet).

### 6.2 MQTT — publiceren naar Home Assistant

Het paneel is een eigen HA-apparaat via MQTT Discovery (discovery-prefix `homeassistant`).

| Onderdeel | Invulling |
|---|---|
| `panel_id` | `KOIoT-P-XXXXXX`, stabiel afgeleid van een fabrieks-MAC (eFuse base-MAC van de P4, of de wifi-MAC van de C6 via `esp_wifi_remote`; leg vast welke). |
| Topics | `koiiot/<panel_id>/…`, zelfde stijl als de sensormodule. |
| Device-object | Naam "Koi IoT Paneel", manufacturer "KOIoT", model "CrowPanel Advanced 10.1 ESP32-P4", `sw_version` = firmwareversie. |
| Beschikbaarheid | `koiiot/<panel_id>/status` = `online`/`offline` via LWT, retained. |
| Entiteiten | Per parameter uit de catalogus (§8) één `sensor`: state = laatste waarde, `unit_of_measurement`, `state_class: measurement`, plus een attributes-topic met `measured_at`, `bron: paneel` en uploadstatus. Diagnostiek: wifi-RSSI, uptime, aantal nog niet geüploade metingen, firmwareversie. Vanaf M1.7 ook de `switch` "Paneelscherm" (§7.6). |
| Retain | Discovery-config én states retained, zodat HA na een herstart direct de laatste waarde toont. |
| Niet doen | Metingen van de sensormodule **niet** opnieuw publiceren — die staan al in HA; anders ontstaan dubbele entiteiten. |

Zet de esp-mqtt-buffer ruim (≥ 2048 bytes) en log elke mislukte publish met topic en
payloadgrootte. In de sensormodule verdwenen discovery-berichten eerder stil door een te kleine
buffer.

### 6.3 Backend (Supabase)

Base-URL `https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/`, header
`Authorization: Bearer <SUPABASE_ANON_KEY>` (dezelfde publieke anon-key als de sensormodule; in
`secrets.h`). HTTPS met `esp_crt_bundle_attach`, timeout 10 s.

**Status: deze endpoints bestaan mogelijk nog niet.** Ze zijn voorgesteld in het aparte document
`koi-iot-paneel-backend-brief.md` (aanvullingen in Bijlage A). Heb je toegang tot de
app-/backend-code, verifieer dan het echte contract. Zo niet: implementeer tegen onderstaand
contract achter een `BackendClient`-interface met een **MOCK-modus** (logt het request, geeft
succes terug), schakelbaar via de instellingen — zodat M2 volledig testbaar is vóór de backend
klaar is.

`POST manual-measurement`

```json
{
  "device_id": "KOIoT-57226C",
  "parameter": "nitriet",
  "value": 0.15,
  "unit": "mg/l NO2",
  "measured_at": "2026-09-25T08:12:00Z",
  "client_id": "3f1c2a9e-5b7d-4e2a-9c1f-0d8e6b4a7c21",
  "source": "panel"
}
```

`device_id` is het kale ID van de gekoppelde sensormodule (de vijver), niet het `panel_id`.
`measured_at` en `client_id` zijn nieuwe velden (Bijlage A). Afhandeling: 2xx = geüpload en uit de
wachtrij; 4xx = definitief afgewezen (niet eindeloos herhalen; markeren als fout met reden, tonen
in Historie); 5xx, timeout of geen netwerk = opnieuw proberen met exponentiële backoff (10 s
oplopend tot max. 10 min).

Het eerder voorgestelde leesendpoint `sensor-latest?device_id=…` vervalt: de laatste sensorwaarden
komen mee in `ha-status` (§6.4, Bijlage A8). Dat is beter afgeschermd (token per vijver in plaats
van alleen een device-ID) en vraagt maar één endpoint.

Ondersteun een optionele extra header `x-koiiot-device-token` (waarde uit de instellingen; leeg =
niet meesturen), zodat de backend later een geheim per apparaat kan eisen zonder
firmware-herschrijving.

### 6.4 Backend — status lezen (`ha-status`)

Het paneel haalt de open taken uit de app (en later het seizoen en voeradvies) via de edge function
`ha-status`. Home Assistant kan hetzelfde endpoint gebruiken.

**Stand van zaken (28 september).** `ha-status` bestond nog niet. De app-kant bouwt nu een eerste,
minimale versie op het bestaande takenmodel van de app (tabel `maintenance_tasks`: taken met een
vervaldatum en status). Het seizoen, het voeradvies en het nieuwe takenmodel volgen later in een
apart project (B9). Het paneel bouwt daarom op de velden die er zijn, en toont ontbrekende
onderdelen gewoon niet.

`GET https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/ha-status` met header
`X-HA-Token: <KOISENSEI_HA_TOKEN>`. Het endpoint is gedeployed zonder JWT-controle; de token-header
is de authenticatie. Geen, een onbekend of een ingetrokken token geeft `401`.

**Token per apparaat.** In de app maakt Jorrit per apparaat een eigen token aan, met een label
(voor het paneel: "KoiIoT touchpaneel"; eventueel een tweede voor Home Assistant). Elk token is apart in te trekken; een nieuw
token voor HA maakt dat van het paneel dus niet ongeldig. Het token van het paneel staat in
`secrets.h` (§10).

Verwacht antwoord van de eerste versie (**te verifiëren** — Jorrit levert het echte antwoord aan;
bouw op dat antwoord, niet op dit voorbeeld):

```json
{
  "api_version": 1,
  "open_tasks": 2,
  "tasks": [
    { "id": "…", "title": "Filter spoelen", "type": "…", "due_date": "2026-09-30",
      "overdue": true, "description": "…", "actions": ["done"] }
  ],
  "latest_readings": [
    { "sensor_id": "KOIoT-57226C-01", "key": "water_temp", "value": 17.4, "unit": "°C",
      "measured_at": "2026-09-28T09:15:00Z" }
  ],
  "generated_at": "2026-09-28T09:20:00Z"
}
```

`tasks` bevat de open taken, al gesorteerd (achterstallig eerst, daarna op vervaldatum); het paneel
houdt die volgorde aan. Parseer tolerant: onbekende velden negeren, ontbrekende velden weglaten in
de weergave. Later kan hetzelfde antwoord de velden uit het nieuwe takenmodel krijgen (`season`,
`season_since`, `feed_band`, `water_temp_24h`, `water_temp_week`, `trend`, `data_ok`, en per taak
`kind` en `severity`); het paneel toont die zodra ze er zijn, zonder nieuwe firmware:

| Veld | Als het er is | Als het ontbreekt |
|---|---|---|
| `season`, `feed_band` | Tegel Seizoen/voeradvies en kop in de tab Taken | Tegel en kop niet tonen |
| `water_temp_24h`, `water_temp_week`, `trend` | Extra regels in de meetgegevens-pop-up (§7.7) | Regels weglaten |
| `data_ok` = `false` | Neutrale regel "Te weinig recente temperatuurdata; adviezen staan even stil." | — |
| `overdue` of `severity` | Kleuraccent per taak (achterstallig = waarschuwingskleur) | Neutraal |

**Ophalen.** Bij opstart zodra wifi er is, daarna elke 15 minuten, en direct na een tik op
"Vernieuwen". Bewaar het laatste geldige antwoord in RAM. Bij een fout blijft de laatste lijst staan
met "bijgewerkt om hh:mm"; is de laatste update ouder dan 1 uur, dan krijgt die regel een
waarschuwingskleur. Een `401` geeft de duidelijke melding "Token ongeldig — controleer
KOISENSEI_HA_TOKEN", nooit stilletjes een lege lijst.

**Laatste sensorwaarden (`latest_readings`, Bijlage A8).** Zodra dit veld in het antwoord zit:
per sensorwaarde de laatst opgeslagen meting met `measured_at`. Het paneel gebruikt die als
startwaarde in `live_store` en als terugval:

| Situatie | Gedrag |
|---|---|
| Opstart / wifi net verbonden | Direct `ha-status` ophalen en de tegels vullen met `latest_readings`. |
| MQTT-waarde komt binnen | Vervangt de databasewaarde als hij nieuwer is (vergelijk meettijdstippen; een MQTT-bericht zonder tijdstempel krijgt het ontvangstmoment). |
| MQTT langer dan 5 min niet verbonden | Bij elke 15-minutenpoll nieuwere databasewaarden overnemen. |

De leeftijd van een waarde wordt altijd berekend vanaf `measured_at`, nooit vanaf het moment van
ophalen, zodat een oude databasewaarde niet als vers oogt; de verouderd-logica uit §6.1 geldt
gewoon. Zolang een tegel een databasewaarde toont, staat er klein "laatst opgeslagen" bij; bij een
live MQTT-waarde verdwijnt dat. Ontbreekt `latest_readings` nog in het antwoord, dan werkt alles
zoals in M1 (wachten op MQTT).

**Taken afronden.** Taken zijn op het paneel af te ronden, net als in de app, via het endpoint
`task-close` (Bijlage A7):

`POST https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/task-close` met header
`X-HA-Token: <KOISENSEI_HA_TOKEN>` en body:

```json
{ "task_id": "…", "status": "done" }
```

Welke knoppen een taak krijgt, bepaalt de backend via `actions`; het paneel verzint dat niet zelf:

| Waarde in `actions` | Knop op het paneel | `status` in het verzoek |
|---|---|---|
| `done` | Gedaan | `done` |
| `seen` | Gezien | `seen` |
| `dismissed` | Niet van toepassing | `dismissed` |

De eerste versie geeft alleen `["done"]`. Onbekende waarden in `actions` negeren. Ontbreekt `actions`
helemaal, dan geen knoppen (alleen weergave).

Afhandeling: 2xx = taak direct uit de lijst halen en daarna `ha-status` opnieuw ophalen; `404` met
`"error": "task_not_found"` of `409` (taak bestaat niet of is al afgesloten, bv. in de app) = melding "Taak was al afgesloten" en
de lijst vernieuwen; `401` = de tokenmelding hierboven.

**Geen verbinding: pop-up.** Kan een taak niet worden afgerond omdat er geen verbinding is, dan
verschijnt een pop-up (modaal venster met één knop **OK**): "Deze taak kan niet worden afgerond,
omdat er geen verbinding is. Probeer het opnieuw zodra de verbinding hersteld is." Dat geldt in twee
gevallen:

| Moment | Gedrag |
|---|---|
| Bij de tik op een knop is al bekend dat er geen wifi-verbinding is | Direct de pop-up, zonder eerst om bevestiging te vragen. |
| Het verzoek mislukt door een netwerkfout (geen verbinding, DNS-fout, time-out) | Dezelfde pop-up. |

Bij een serverfout (5xx) verschijnt een pop-up in dezelfde vorm met "De taak kon niet worden
afgerond door een fout op de server. Probeer het later opnieuw." In alle gevallen blijft de taak
open in de lijst staan. Geen offline-wachtrij voor afronden: de takenlijst kan intussen in de app
veranderd zijn, dus afronden gebeurt alleen online.

**Werkt terug zonder backend-uitbreiding.** Heeft een taak in het antwoord geen `id`, of geeft
`task-close` een `404` zonder JSON-veld `"error": "task_not_found"` (het endpoint zelf bestaat dan
nog niet), dan blijven de knoppen verborgen of
uitgeschakeld en werkt de lijst zoals alleen-lezen.

### 6.5 Home Assistant REST API — ventilatie bedienen

Het paneel toont en bedient de 3-standenschakelaar van de ventilatie. Die bestaat al als entiteit in
Home Assistant; het paneel praat daarvoor met de REST API van HA. Bouw dit als een generieke
`ha_client` (status lezen, service aanroepen), want dezelfde client wordt in M4 gebruikt voor
`HaSwitchActuator` (§12).

| Onderdeel | Invulling |
|---|---|
| Basis-URL | `http://192.168.178.58:8123` (instelbaar; lokaal netwerk, dus HTTP) |
| Authenticatie | `Authorization: Bearer <HA_TOKEN>`, een long-lived access token van de HA-gebruiker `koiiot_paneel` (§10) |
| Status lezen | `GET /api/states/<entity_id>` → `state` en `attributes` |
| Stand zetten | `POST /api/services/<domein>/<service>` met `{"entity_id": "…", …}` |
| Pollen | Elke 10 s zolang het Overzicht in beeld is, anders elke 60 s, en direct na elke bediening |

**Entiteit en type: levert Jorrit tijdens het bouwen aan (Bijlage B7).** Twee gegevens ontbreken nog
bij de start van M1.6; Jorrit voegt ze tijdens het bouwen in Cursor toe:

| Gegeven | Hoe Jorrit het aanlevert |
|---|---|
| Entiteitsgegevens van de ventilatie | Hij plakt `entity_id`, toestand en attributen uit HA (Ontwikkelhulpmiddelen → Toestanden) in de Cursor-chat. |
| `HA_TOKEN` | Hij vult het token zelf in `main/secrets.h` in en meldt dat het erin staat; het token komt niet in de chat. |

Werkwijze voor Cursor: begin M1.6 met wat zonder deze gegevens kan (de generieke `ha_client`, de
tegel, `HA_TOKEN` als placeholder in `secrets.example.h` en `secrets.h`). Vraag Jorrit om de
entiteitsgegevens zodra de koppeling met de ventilatie nodig is, en wacht daarop; ga niet uit van een
entiteitstype of optienamen. Afhankelijk van het type:

| Type entiteit | Stand lezen | Stand zetten |
|---|---|---|
| `fan` met preset modes | `attributes.preset_mode` (opties in `attributes.preset_modes`) | `fan.set_preset_mode` met `preset_mode` |
| `fan` met snelheid in procenten | `attributes.percentage` (33 / 66 / 100) | `fan.set_percentage` met `percentage` |
| `select` of `input_select` | `state` (opties in `attributes.options`) | `select.select_option` resp. `input_select.select_option` met `option` |

Leg de koppeling stand 1/2/3 ↔ waarde van de entiteit vast in `app_config.h`, niet verspreid door de
code.

**Gedrag.** De huidige stand is duidelijk gemarkeerd. Na een tik toont de knop "bezig…"; pas als de
volgende statusopvraag de nieuwe stand bevestigt, wordt hij definitief gemarkeerd. Blijft bevestiging
na 10 s uit, of geeft de API een fout, dan terug naar de werkelijke stand met een korte melding. Kent
de entiteit een stand die niet 1, 2 of 3 is (bijv. "auto" of een timer), toon dan die tekst en markeer
geen knop. Een `401` geeft "HA-token ongeldig — controleer HA_TOKEN". Is HA onbereikbaar, dan is de
tegel grijs met "Home Assistant niet bereikbaar".

---

## 7. UI-specificatie

**Algemeen.** 1024×600 landschap, donker thema, hoog contrast (weinig licht in het pomphuis, soms
natte handen). Touch-targets minimaal 64×64 px, primaire knoppen minimaal 80 px hoog; geen
bediening die alleen met swipen werkt. Vaste layout: statusbalk boven (±48 px) met klok, datum,
wifi-signaal, MQTT-status en backend-status inclusief het aantal wachtende uploads; navigatiebalk
onder (±72 px) met grote tabs **Overzicht · Taken · Meting invoeren · Historie · Instellingen** (in M4 komt
**Automatisering** erbij). De tab Taken krijgt een badge met het aantal open taken, net als het
menu-item in de app.

**Fonts.** De ingebouwde Montserrat-fonts van LVGL bevatten alleen ASCII, het graden-teken en de
LVGL-symbolen — geen ë, é, ³ of µ. Genereer met `lv_font_conv` eigen fonts (Montserrat of Inter)
met bereik 0x20–0x7E + 0xA0–0xFF (Latin-1) plus de pijlen U+2190–U+2193, in drie maten (±20, 28
en 56 px). Stel de ingebouwde Montserrat in als fallback-font, zodat `LV_SYMBOL_*` (wifi, ok,
waarschuwing) blijft werken.

### 7.1 Overzicht

| Tegel | Inhoud |
|---|---|
| Watertemperatuur (dubbele breedte) | Waarde met 1 decimaal, trendpijl (verschil t.o.v. 60 min geleden, uit een lokale ringbuffer), leeftijd van de meting. |
| Lucht | Temperatuur + luchtvochtigheid. |
| pH | Waarde, of "geen sensor" als er nog nooit een waarde binnenkwam. |
| Bijvulwater | Debiet nu (L/min) en "vandaag: X L" (= `flow_total` minus de stand om 00:00 lokale tijd; die stand in NVS bewaren zodat een herstart hem niet wist). |
| Seizoen en voeradvies (zodra `ha-status` ze levert) | Seizoen (bv. "Najaar sinds 8 okt") en het voeradvies uit `feed_band` (label, voertype). Bij `data_ok` = `false` de neutrale regel uit §6.4. Ontbreken de velden, dan geen tegel. |
| Ventilatie (vanaf M1.6) | Drie grote knoppen **1 · 2 · 3** met de huidige stand gemarkeerd, gedrag volgens §6.5. |
| Open taken (vanaf M1.5) | Aantal open taken en de titel van de bovenste taak. Tik → tab Taken. |
| Handmatige metingen (vanaf M2) | Per parameter: laatste waarde + eenheid + leeftijd + houdbaarheidsbadge (groen = vers; oranje = bijna verlopen; grijs = verouderd). Bron bij voorkeur `latest_measurements` uit `ha-status` (Bijlage A6), zodat ook in de app ingevoerde metingen verschijnen en de houdbaarheid server-side (seizoensafhankelijk) bepaald wordt; zolang dat veld ontbreekt: de eigen invoer van het paneel met de houdbaarheid uit §8. Tik op een parameter → pop-up met meetgegevens (§7.7), met daarin de knop "Nieuwe meting invoeren" naar het invoerscherm voor die parameter. |

### 7.2 Meting invoeren

Stap 1: raster met grote parameterknoppen (label, laatst gemeten waarde, leeftijd). Stap 2:
invoerscherm met een groot numeriek toetsenblok (0–9, komma, backspace) — geen spinbox. Heeft een
parameter meerdere eenheden, dan een segmentknop voor de eenheid (laatst gebruikte onthouden per
parameter). Validatie tijdens het typen: buiten het fysieke bereik = opslaan geblokkeerd; buiten
het optionele waarschuwingsbereik = extra bevestiging ("Weet je het zeker?") als bescherming tegen
tikfouten. Meetmoment: standaard "nu", met snelkeuzes "1 uur geleden", "2 uur geleden", "4 uur
geleden" en "gisteren". Stap 3: bevestigingsscherm met de waarde groot in beeld, bv.
"Nitriet 0,15 mg/l NO2 — opslaan?". Na opslaan: melding "Opgeslagen — wordt geüpload" en terug naar
Overzicht.

Komma als decimaalteken in de UI, punt in JSON.

### 7.3 Historie

Lijst van de laatste 50 invoeren vanaf dit paneel (lokaal bewaard), per regel: tijd, parameter,
waarde + eenheid en uploadstatus (geüpload / in wachtrij / afgewezen + reden). Tik op een regel →
pop-up met meetgegevens van die invoer (§7.7). Corrigeren of
verwijderen valt buiten scope tot er een backend-endpoint voor is.

### 7.4 Instellingen

Wifi (scanlijst + LVGL-toetsenbord voor het wachtwoord, opslaan in NVS), gekoppelde sensormodule
(`device_id`), MQTT (host, poort, gebruiker, wachtwoord), backend (MOCK aan/uit, device-token),
helderheid en de schermtijden (sectie Scherm, al vanaf M1.7; §7.6), vijverinhoud in liters (default 13.500, nodig voor M4), een Info-sectie
(`panel_id`, firmwareversie, IP, RSSI, uptime, vrij heap/PSRAM) en een herstartknop.

### 7.5 Taken (vanaf M1.5)

Bovenaan, alleen als `ha-status` ze levert: het seizoen (met sinds wanneer) en het voeradvies.
Daaronder de open taken in de volgorde van `ha-status`. Per taak: titel, vervaldatum ("vandaag",
"morgen", "3 dagen te laat"), een waarschuwingskleur bij achterstallig (`overdue`, of later
`severity`) en, als `type` of `kind` er is, een klein label met de soort. Bevat een taak een
`description`, dan klapt een tik de uitleg uit.

Per taak de knoppen uit `actions` (§6.4). Minimaal 64 px hoog en ruim uit elkaar, want in het
pomphuis zijn handen soms nat. Elke keuze eerst bevestigen: "'<titel>' afronden als Gedaan?" met
**Ja** en **Annuleren**. Is er op dat moment geen verbinding, dan verschijnt in plaats daarvan direct
de pop-up "geen verbinding" uit §6.4. Tijdens het versturen toont de taak "bezig…" en zijn de knoppen
van die taak uitgeschakeld. Onderaan "bijgewerkt om hh:mm" en een grote knop "Vernieuwen". Geen
lijst = "Geen open taken", niet een leeg scherm.

### 7.6 Energiestand en rustscherm (vanaf M1.7)

Het scherm kent drie standen, beheerd door één `screen_manager`:

| Stand | Wat je ziet | Helderheid |
|---|---|---|
| Actief | De normale schermen | Instelbaar, default 80% |
| Rust | Het rustscherm (zie hieronder) | Instelbaar, default 15% |
| Uit | Niets; backlight uit (PWM op 0 en, als de BSP dat biedt, de backlight-voeding uit) | 0 |

**Overgangen.** Actief → Rust na T1 zonder aanraking (default 5 min). Rust → Uit na T2 (default 30
min, gerekend vanaf het begin van Rust). Elke aanraking in Actief zet T1 opnieuw. Een aanraking in
Rust of Uit wekt alleen: terug naar Actief op het Overzicht, en die aanraking bedient niets
onderliggends (dus ook geen knop die toevallig onder je vinger ligt). T1 en T2 zijn instelbaar;
T2 = "nooit" laat het scherm in Rust staan. Staat het rustscherm uit, dan gaat Actief na T1 direct
naar Uit.

**Uitzonderingen en pop-ups.** Zolang een verzoek loopt (bv. een taak wordt afgerond) gaat het
scherm niet naar Rust. Een open pop-up telt níet als uitzondering, anders houdt een vergeten pop-up
het scherm eindeloos aan: na T1 zonder aanraking sluit elke pop-up automatisch (een
bevestigingsvraag geldt dan als "Annuleren") en gaat het scherm naar Rust. Tijdens een lopende
automatisering (M4) blijft het scherm Actief (V7).

**Rustscherm.** Donkere achtergrond met groot en goed leesbaar: de tijd, de watertemperatuur (met
"verouderd" volgens §6.1 als de waarde oud is) en het aantal open taken. Het blok verschuift elke 2
minuten een stukje naar een willekeurige plek binnen het scherm (maximaal ±60 px), zodat er nooit
lang hetzelfde beeld op dezelfde plek staat. Geen animaties, want die kosten stroom en rekenkracht.

**Instellingen, sectie Scherm.** Helderheid Actief en Rust, T1, T2 (inclusief "nooit") en
rustscherm aan/uit, opgeslagen in NVS. Deze sectie komt al in M1.7 in het bestaande
instellingenscherm, niet pas in M3.

**Schermschakelaar voor Home Assistant (voorbereiding).** Jorrit overweegt een aanwezigheids- of
deursensor in het pomphuis; dat is nog niet definitief (B8). Het paneel biedt daarom nu al een
`switch` "Paneelscherm" in HA via MQTT Discovery (§6.2):

| Onderdeel | Invulling |
|---|---|
| Commandotopic | `koiiot/<panel_id>/scherm/set` met `ON` of `OFF` |
| Statustopic | `koiiot/<panel_id>/scherm/state`, retained: `ON` bij Actief of Rust, `OFF` bij Uit |
| `ON` | Wekt het scherm naar Actief, alsof er is aangeraakt, en start T1 opnieuw |
| `OFF` | Direct naar Uit, behalve tijdens de uitzonderingen hierboven |

Een HA-automatisering kan het scherm dan straks aanzetten als de deur opengaat of er iemand
aanwezig is, en uitzetten als de ruimte leeg is. Lever in `docs/` een voorbeeld van zo'n
automatisering (YAML) met een placeholder voor de sensor-entiteit. Het paneel zelf hoeft niets van
de sensor te weten.

### 7.7 Meetgegevens-pop-up (vanaf M1.8)

Overal waar een meetwaarde staat (tegels op Overzicht, regels in Historie), opent een tik op die
waarde een pop-up met de meetgegevens. Uitzondering: het rustscherm, waar een tik alleen wekt
(§7.6).

**Vorm.** Modaal venster, ongeveer 70% van de schermbreedte, met bovenaan de naam en de waarde groot
in beeld. Sluiten met een grote knop **Sluiten** (minimaal 64 px hoog) of door naast de pop-up te
tikken. Terwijl de pop-up open is, worden de gegevens live bijgewerkt. Na T1 zonder aanraking sluit
hij vanzelf (§7.6).

**Sensorwaarden** (watertemperatuur, luchttemperatuur, luchtvochtigheid, pH, bijvulwater):

| Gegeven | Invulling |
|---|---|
| Waarde | Huidige waarde met eenheid, en de status: vers of verouderd (§6.1) |
| Gemeten | Datum en tijd van de meting (lokale tijd) en de leeftijd ("3 min geleden") |
| Bron | "Live (MQTT)" of "Laatst opgeslagen (database)" (§6.4) |
| Sensor | Sensor-ID, bv. `KOIoT-57226C-01`, en de naam van de sensormodule |
| Verloop | Kleine lijngrafiek plus minimum, maximum en gemiddelde over de laatste 24 uur, uit een lokale ringbuffer in PSRAM (één punt per 5 minuten per sensorwaarde). De buffer begint bij opstart leeg; toon dan eerlijk "sinds opstart hh:mm". |
| Alleen watertemperatuur | Gemiddelde 24 uur, gemiddelde week, trend en seizoen uit `ha-status` (§6.4), met "berekend door de app". |
| Alleen bijvulwater | Debiet nu, verbruik vandaag en de totale meterstand (`flow_total`). |

**Handmatige metingen** (vanaf M2):

| Gegeven | Invulling |
|---|---|
| Waarde | Waarde in standaard-eenheid, en daaronder de waarde zoals afgelezen als die anders was (met het instrument, als bekend) |
| Gemeten | Datum, tijd en leeftijd |
| Bron | Ingevoerd op het paneel of in de app |
| Houdbaarheid | Status (vers / bijna verlopen / verlopen) en de datum waarop de meting verloopt, bij voorkeur uit `ha-status` (Bijlage A6) |
| Uploadstatus | Alleen bij invoer van dit paneel: geüpload / in wachtrij / afgewezen + reden |
| Actie | Knop **Nieuwe meting invoeren** → het invoerscherm voor deze parameter |

Ontbreekt een gegeven (bv. nog geen `ha-status` of geen instrument bekend), laat die regel dan weg.
Toon nooit een lege of verzonnen waarde.

---

## 8. Parametercatalogus handmatige metingen

Eén tabel in de code (`param_catalog`), zodat eenheden, bereiken en houdbaarheid op één plek staan
en later zonder zoekwerk aan te passen zijn. Onderstaande waarden zijn **startwaarden**: Jorrit
bevestigt ze zodra vaststaat welke Hanna-testers hij gebruikt. Testers rapporteren niet allemaal in
dezelfde eenheid (bijvoorbeeld nitriet als ppb NO2-N of als mg/l NO2), vandaar de eenheidskeuze.

| `key` (API) | Label in UI | Eenheden (eerste = standaard) | Fysiek bereik | Stap | Houdbaarheid |
|---|---|---|---|---|---|
| `kh` | KH | °dH · mg/l CaCO3 | 0–30 °dH · 0–535 mg/l | 0,1 · 1 | 14 dagen |
| `gh` | GH | °dH · mg/l CaCO3 | 0–40 °dH · 0–715 mg/l | 0,1 · 1 | 14 dagen |
| `tan` | Ammoniak/ammonium (TAN) | mg/l NH3-N · mg/l NH4 | 0–10 | 0,01 | 7 dagen |
| `nitriet` | Nitriet | mg/l NO2 · ppb NO2-N | 0–5 mg/l · 0–1000 ppb | 0,01 · 1 | 7 dagen |
| `nitraat` | Nitraat | mg/l NO3 | 0–200 | 1 | 14 dagen |
| `fosfaat` | Fosfaat | mg/l PO4 · ppb P | 0–10 mg/l · 0–2000 ppb | 0,01 · 1 | 14 dagen |
| `ph` | pH (handmatig) | pH | 4–10 | 0,1 | 7 dagen |
| `zout` | Zout | % | 0–1,0 | 0,01 | geen (tot een nieuwe dosering) |

Het paneel stuurt waarde en eenheid precies zoals ingevoerd. Omrekenen naar een vaste eenheid en
alle adviezen ("nitriet te hoog") horen server-side thuis, niet op het paneel. De sleutels `kh`,
`nitriet` en `nitraat` komen uit de bestaande backend-brief; de overige zijn uitbreidingen
(Bijlage A).

---

## 9. Robuustheid

| # | Eis |
|---|---|
| R1 | Wifi-reconnect: bij verbindingsverlies elke 15 s opnieuw proberen; na 10 min onafgebroken zonder verbinding `esp_restart()`. De status is altijd zichtbaar in de statusbalk. (Een ontbrekende reconnect liet de sensormodule eerder permanent stilvallen.) |
| R2 | MQTT: auto-reconnect van esp-mqtt; na elke reconnect opnieuw abonneren en discovery + retained states opnieuw publiceren. |
| R3 | Handmatige metingen gaan nooit verloren: eerst naar de NVS-wachtrij (max. 200 items; bij vol eerst de oudste geüploade verwijderen, nooit een niet-geüploade), pas verwijderen na een 2xx. Overleeft herstart en stroomuitval. |
| R4 | Geen dubbele metingen bij retries: elke meting krijgt bij invoer een `client_id` (UUID v4) die bij elke retry gelijk blijft. |
| R5 | Tijd via SNTP (`pool.ntp.org`), tijdzone `CET-1CEST,M3.5.0,M10.5.0/3`. Zolang de tijd niet gesynchroniseerd is: klok als "--:--" en metingen zónder `measured_at` versturen (dan zet de backend de tijd) — nooit een tijdstempel uit 1970. |
| R6 | Task-watchdog aan; geen blokkerende netwerkaanroepen in de LVGL-taak. |
| R7 | Energiestand volgens §7.6 (8–10 W stroomverbruik met scherm aan, levensduur backlight). Met het scherm uit blijven wifi, MQTT en het ophalen van gegevens gewoon doorlopen, zodat het paneel bij wekken meteen actuele gegevens toont. |
| R8 | OTA (M3): `esp_https_ota` vanaf een instelbare URL; lokaal flashen via USB blijft mogelijk. Partitietabel uit het Elecrow-voorbeeld (factory + ota_0 + ota_1), rollback aan (`CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`). |

---

## 10. Configuratie en secrets

`main/secrets.h` (in `.gitignore`): `WIFI_SSID`/`WIFI_PASS` (alleen als ontwikkel-fallback),
`MQTT_USER`/`MQTT_PASS`, `SUPABASE_ANON_KEY`, `KOISENSEI_HA_TOKEN` (het apparaat-token van het paneel,
aangemaakt in de app; §6.4), `HA_TOKEN` (long-lived access token van `koiiot_paneel` voor de HA REST API;
§6.5; vult Jorrit tijdens M1.6 zelf in). `main/app_config.h`: compile-time defaults (broker,
gekoppelde `device_id`, drempels, houdbaarheid). Runtime-instellingen in NVS (`settings_store`)
overschrijven de defaults en zijn aanpasbaar via het Instellingen-scherm. Volgorde: NVS gaat vóór
`app_config.h`. De anon-key haalt Jorrit uit `config.h` van de sensormodule.

---

## 11. Mijlpalen

### M0 — Bring-up

**Werk.** Project opzetten vanuit Lesson16 (V1.2, of de versie op de print) en terugbrengen tot een
"KOIoT Paneel"-startscherm met `panel_id`, een touch-test (tik-feedback met coördinaten), wifi via
de secrets-fallback, SNTP-klok en het IP-adres op het scherm.

**Klaar als:** `idf.py build` is schoon; na flashen werken scherm en touch; wifi verbindt en IP en
de juiste lokale tijd zijn zichtbaar; na het uit- en aanzetten van de router komt de verbinding
vanzelf terug.

### M1 — Live dashboard via MQTT

**Werk.** `net_manager`, `mqtt_link` (abonneren), `live_store` met de topic-mapping (eerst alle
topics loggen, dan mapping vastleggen), dashboardtegels, statusbalk, verouderd-logica en
"vandaag bijgevuld".

**Klaar als:** de waarden komen binnen enkele seconden overeen met HA (debiet binnen ~1 s); met de
sensormodule uit worden de tegels na de drempel "verouderd".

### M1.5 — Takenlijst uit de app

**Werk.** `ha-status` ophalen (§6.4) in een eigen `status_store`, tab Taken met badge (§7.5),
tegels Seizoen/voeradvies en Open taken op Overzicht (§7.1), vernieuwlogica en foutweergave.
Taken afronden via `task-close` (§6.4, §7.5). Startwaarden en terugval uit `latest_readings`
(§6.4), zodra dat veld in het antwoord zit.

**Klaar als:** de open taken op het paneel komen overeen met het Taken-scherm in de app (titels,
volgorde, aantal); seizoen en voeradvies verschijnen niet zolang `ha-status` ze niet levert; een taak die in de app wordt
afgevinkt verdwijnt binnen 15 minuten van het paneel, of direct na "Vernieuwen"; een taak die op het
paneel wordt afgerond verdwijnt direct van het paneel en staat in de app in de geschiedenis met de
juiste status en "via paneel"; met wifi uit verschijnt bij een tik op een
afrondknop direct de pop-up "geen verbinding" en blijft de taak staan; een taak die intussen al in de app was
afgesloten geeft de melding "Taak was al afgesloten"; een fout token geeft
de melding uit §6.4 in plaats van een lege lijst; zonder wifi blijft de laatste lijst staan met
"bijgewerkt om …". Met `latest_readings`: direct na een herstart staan de sensortegels gevuld (met
"laatst opgeslagen" en de juiste leeftijd), en de eerste live MQTT-waarde neemt het over.

### M1.6 — Ventilatie bedienen via Home Assistant

**Werk.** Generieke `ha_client` (§6.5), tegel Ventilatie op Overzicht (§7.1), pollen, bevestiging
en foutafhandeling. De entiteitsgegevens en `HA_TOKEN` levert Jorrit tijdens deze mijlpaal aan
(§6.5); vraag erom zodra ze nodig zijn.

**Klaar als:** de gemarkeerde stand op het paneel komt overeen met HA; een tik op 1, 2 of 3 zet de
ventilatie binnen enkele seconden in die stand, en HA toont dezelfde stand; een stand die in HA of
met de fysieke schakelaar wordt veranderd, verschijnt binnen 10 s op het paneel; met een fout token
of een onbereikbare HA verschijnt de melding uit §6.5 en blijft het paneel verder gewoon werken.

### M1.7 — Energiestand en rustscherm

**Werk.** `screen_manager` met de standen Actief, Rust en Uit (§7.6), het rustscherm, de sectie
Scherm in het instellingenscherm, de `switch` "Paneelscherm" via MQTT Discovery en een voorbeeld
van een HA-automatisering in `docs/`.

**Klaar als:** met korte testtijden (bv. T1 = 30 s, T2 = 60 s) gaat het scherm van Actief naar Rust
en daarna naar Uit; een aanraking in Rust of Uit wekt het scherm zonder iets te bedienen; het
rustscherm verschuift en toont de juiste tijd, watertemperatuur en het juiste aantal open taken;
een open pop-up sluit na T1 vanzelf en daarna gaat het scherm naar Rust; tijdens het afronden
van een taak gaat het scherm niet naar Rust; de ingestelde tijden blijven na een herstart
bewaard; de schakelaar "Paneelscherm" in HA zet het scherm aan en uit en toont de juiste stand; met
het scherm uit blijven de gegevens op de achtergrond bijgewerkt.

### M1.8 — Meetgegevens-pop-up

**Werk.** Een herbruikbare pop-up voor meetgegevens (§7.7), gekoppeld aan alle sensortegels op
Overzicht; de lokale ringbuffer (24 uur, één punt per 5 minuten) met lijngrafiek en min/max/gemiddelde;
de extra gegevens uit `ha-status` bij de watertemperatuur.

**Klaar als:** een tik op elke sensortegel opent de pop-up met de juiste waarde, meettijd, leeftijd,
bron en sensor-ID; de bron wisselt van "Laatst opgeslagen" naar "Live" zodra er een MQTT-waarde
binnenkomt; de grafiek groeit mee sinds opstart; de pop-up sluit met Sluiten, met een tik ernaast
en vanzelf na T1; op het rustscherm opent een tik geen pop-up.

### M2 — Handmatige metingen

**Eerst afstemmen (B6).** Vóór M2 wordt §8 afgestemd op het meetinstrumentenmodel van de app
(instrumentkeuze, omrekening naar standaard-eenheden). Begin niet aan M2 voordat die afstemming in
deze brief staat.

**Werk.** `param_catalog`, invoerflow (§7.2), `measurement_queue` (NVS), `uploader` + MOCK-modus,
MQTT Discovery + retained states, Historie-scherm.

**Klaar als:** een invoer verschijnt in Supabase (of in de MOCK-log zolang het endpoint nog niet
bestaat) én als entiteit in HA onder het apparaat "Koi IoT Paneel"; een invoer met wifi uit wordt
na reconnect precies één keer geüpload; na een herstart staat de wachtrij er nog; na een herstart
van HA toont HA direct de laatste waarde.

### M3 — Instellingen en onderhoud

**Werk.** Instellingen-scherm volledig (§7.4), Info-sectie, OTA met rollback.

**Klaar als:** van wifi-netwerk wisselen kan zonder herflashen; een OTA-update vanaf een URL werkt;
een bewust kapotte image rolt automatisch terug naar de vorige.

### M4 — Automatiseringen

**Alleen op expliciete opdracht van Jorrit.** Ontwerp en eisen in §12.

---

## 12. M4 — Automatiseringen: ontwerp en veiligheidseisen

**Principe.** Een automatisering is een state machine in een eigen taak, los van de UI; de UI
start en stopt alleen en toont de voortgang. Actuatoren lopen via een abstractie `Actuator`
(`on()`, `off()`, `state()`) met verwisselbare backends:

| Backend | Gebruik |
|---|---|
| `HaSwitchActuator` | Bestaande Zigbee-relais in het pomphuis via de `ha_client` uit M1.6 (§6.5): `POST /api/services/switch/turn_on` resp. `turn_off` met `{"entity_id": "switch.…"}` en een long-lived access token; terugkoppeling via `GET /api/states/<entity_id>`. Entity-id's instelbaar. |
| `GpioRelayActuator` | Relaismodule op de GPIO-header van het paneel. |
| `SimActuator` | Simulatie/dry-run: logt alleen, met gesimuleerd debiet. **Verplicht aanwezig.** |

Welke backend gebruikt wordt, is nog niet besloten (Bijlage B).

**Eerste automatisering: water bijvullen na verversen.** De gebruiker tapt eerst zelf af, kiest
dan het aantal liters (of een percentage van de vijverinhoud); het paneel opent de inlaatklep,
telt via `flow_total` (MQTT) het toegevoegde volume en sluit bij het doel.

Toestanden: `IDLE → PRECHECK → FILLING → STOPPING → DONE | ABORTED(reden)`. In `PRECHECK`: verse
debietdata (< 5 s oud), actuator bereikbaar en uit, doel binnen de limieten, en de
gebruiker bevestigt dat er eerst is afgetapt.

| # | Veiligheidseis |
|---|---|
| V1 | Fail-safe als standaard: bij opstart, na elke herstart en bij elke onverwachte fout eerst een "uit/dicht"-commando naar alle automatiserings-actuatoren. |
| V2 | Harde limieten, tijdens een run niet aanpasbaar vanuit de UI: max. liters per run (default 10% van de vijverinhoud = 1.350 L) en max. looptijd (liters ÷ minimaal verwacht debiet × 1,5, met een instelbaar absoluut plafond). |
| V3 | Debietbewaking: klep open en na 30 s debiet onder minimum (default 2 L/min) → afbreken ("geen toevoer: kraan dicht of sensor defect"); debiet boven maximum (default 25 L/min) → afbreken. |
| V4 | Dataverlies: tijdens een run meer dan 10 s geen nieuwe debietwaarde → afbreken en klep dicht. |
| V5 | Onafhankelijke fail-safe buiten het paneel: een HA-automatisering die de klep na max. looptijd + marge altijd uitschakelt, ook als het paneel crasht of offline is. Lever hiervan een voorbeeld-YAML in `docs/`. |
| V6 | Verlies van verbinding met HA/actuator tijdens een run: blijven proberen uit te schakelen; de UI toont rood "Klep mogelijk nog open — controleer handmatig". |
| V7 | Bediening: starten alleen via een bevestigingsscherm met samenvatting (liters, geschatte duur, limieten). Tijdens een run staat een grote STOP-knop altijd in beeld, ook bovenop andere schermen, en dimt het scherm niet. |
| V8 | Logging: elke run (start, eind, reden, liters, duur) lokaal en naar HA via MQTT; logging naar de backend volgt later (Bijlage A). |
| V9 | Automatisch aftappen valt buiten deze eerste versie: zonder niveausensor is er geen veilige stopconditie. |

---

## 13. Buiten scope (nu)

Trendgrafieken (wachten op een leesendpoint met historie), corrigeren/verwijderen van metingen
(wacht op backend), spraak/camera/audio, bediening van
beluchting of voerautomaat vanaf het paneel (kan later via dezelfde `Actuator`-abstractie), en
eigen sensoren op het paneel.

---

## Bijlage A — Backend-aanvullingen

Voor de Cursor-sessie die aan de app/backend werkt; aanvulling op `koi-iot-paneel-backend-brief.md`
(Deel A `sensor-latest`, Deel B `manual-measurement`).

| # | Aanvulling |
|---|---|
| A1 | `manual-measurement` accepteert optioneel `measured_at` (ISO 8601, UTC) van de client — nodig voor de offline-wachtrij en voor "eerder gemeten". Server valideert: niet in de toekomst, niet ouder dan bv. 7 dagen. Zonder veld zet de server de tijd. |
| A2 | Optioneel `client_id` (UUID) met een unieke index op (`device_id`, `client_id`). Een tweede insert met dezelfde `client_id` geeft 200 met de bestaande rij terug (idempotent), geen duplicaat. |
| A3 | Parametersleutels uitbreiden met `gh`, `tan`, `fosfaat`, `ph` en `zout` naast `kh`, `nitriet` en `nitraat`; `unit` blijft tekst, maar met een toegestane lijst per parameter (§8). Nieuwe kolom `source` (`panel` of `app`). |
| A4 | Optionele header `x-koiiot-device-token`, zodat later per apparaat een geheim geëist kan worden; herbevestig de RLS-eis uit de backend-brief (lezen minstens zo streng afgeschermd als schrijven). |
| A5 | Later, bij M4: tabel `automation_runs` (`device_id`, `type`, `started_at`, `ended_at`, `liters`, `result`, `reason`). |
| A6 | **Nodig voor M1.5 (eerste versie).** Edge function `ha-status` (GET, gedeployed met `--no-verify-jwt`) op het bestaande takenmodel (`maintenance_tasks`), met het antwoord uit §6.4: `api_version`, `open_tasks`, `tasks` (open taken, achterstallig eerst en dan op vervaldatum, met `id`, `title`, `type`, `due_date`, `overdue`, `description` als die bestaat, en `actions`), `latest_readings` (A8) en `generated_at`. Velden die nog niet bestaan (seizoen, voeradvies) weglaten, niet `null` meesturen. Later, bij het nieuwe takenmodel (B9): `season`, `feed_band`, temperatuurgemiddelden, `data_ok`, per taak `kind`/`severity`, en `latest_measurements` voor handmatige metingen (met houdbaarheidsstatus, `expires_at`, instrument en ruwe afgelezen waarde; §7.7). |
| A8 | `ha-status` uitbreiden met `latest_readings`: per sensorwaarde van de gekoppelde sensormodule de laatst opgeslagen niet-lege waarde uit de tabel `sensor_data` (die heeft naast `temperature` ook `humidity`, `ph`, `flow_rate` en `flow_total`), met `sensor_id` (bv. `KOIoT-57226C-01`), een leesbare sleutel (`water_temp`, `air_temp`, `humidity`, `ph`, `flow_rate`, `flow_total`), `value`, `unit` en `measured_at`. Alleen sensorwaarden die daadwerkelijk bestaan; geen rij = veld weglaten. Vervangt Deel A (`sensor-latest`) uit `koi-iot-paneel-backend-brief.md`. |
| A7 | **Nodig voor M1.5.** Edge function `task-close` (POST, gedeployed met `--no-verify-jwt`), zelfde token-authenticatie als `ha-status`. Body: `task_id`, `status` (een waarde uit `actions` van die taak), optioneel `note`. Rond de taak af met **exact dezelfde logica als de app** (inclusief een eventuele volgende herhaling van de taak); zet die logica bij voorkeur in één RPC die de app en `task-close` allebei aanroepen. Leg vast dat het via het paneel ging en toon dat in de geschiedenis als "via paneel". Antwoorden: `200`; `401` bij geen/onbekend/ingetrokken token; `404` met body `{"error": "task_not_found"}` als de taak niet bij de eigenaar van het token hoort (zo kan het paneel dit onderscheiden van een endpoint dat nog niet bestaat); `409` als de taak al is afgerond. |
| A9 | **Nodig voor M1.5.** Tokens per apparaat: tabel `device_tokens` (eigenaar, label, alleen de hash van het token, aangemaakt, laatst gebruikt, ingetrokken), een RPC die een willekeurig token aanmaakt en dat één keer teruggeeft, een RPC om een token in te trekken, en in de instellingen van de app een sectie om tokens met een label aan te maken (token één keer tonen met kopieerknop), te bekijken en in te trekken. `ha-status` en `task-close` werken `laatst gebruikt` bij. |

## Bijlage B — Openstaande beslissingen (Jorrit)

| # | Beslissing | Nodig vóór |
|---|---|---|
| B1 | Hardwareversie op de print — **besloten: V1.2.** | M0 |
| B2 | Eigen HA-gebruiker voor het paneel — **besloten: `koiiot_paneel`.** | M1 |
| B3 | Welke Hanna-testers → eenheden en bereiken in §8 bevestigen. | M2 |
| B4 | Actuatoren voor verversen: Zigbee-relais via HA of een relais op het paneel; welke magneetklep (normaal gesloten; 230 V AC of 12/24 V); later een niveausensor voor aftappen. | M4 |
| B5 | Retained MQTT-publicatie in de sensormodule (buiten dit project). | M1 (wenselijk) |
| B6 | Afstemming van de parametercatalogus (§8) op het meetinstrumentenmodel van de app (Hanna/Colombo, omrekening naar standaard-eenheden). | M2 |
| B7 | `entity_id`, toestand en attributen van de ventilatie-entiteit, en `HA_TOKEN` — **levert Jorrit tijdens het bouwen van M1.6 in Cursor aan.** | Tijdens M1.6 |
| B8 | Aanwezigheids- of deursensor in het pomphuis om het scherm te schakelen — **nog niet definitief**; het paneel is voorbereid via de schakelaar "Paneelscherm" (§7.6). | Geen (optioneel) |
| B9 | Het nieuwe takenmodel met seizoen, voeradvies en regelmotor (onderhoudstaken-brief uit het project "Koisensei platform doorontwikkeling") is nog niet gebouwd; dat wordt een apart project. Tot die tijd levert `ha-status` alleen taken uit het bestaande model en sensorwaarden. | Later |
