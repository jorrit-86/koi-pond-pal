# KOIoT Paneel — Status per mijlpaal

*Bijgehouden volgens W5. Laatste update: M3f OTA + rollback (0.3.0-m3f, 5 okt 2026).*

Legenda: **Gedaan** = gebouwd en `idf.py build` schoon · **Getest op hardware** = door Jorrit bevestigd
met seriële log · **Open** = te testen, onbekend of TODO.

---

## M0 — Bring-up

### Gedaan
- ESP-IDF-project in de repo-root, gebaseerd op Elecrow Lesson16 V1.2: `CMakeLists.txt`,
  `sdkconfig.defaults`, `partitions.csv`, `dependencies.lock`, `main/idf_component.yml`,
  `components/bsp_display|bsp_i2c|bsp_wifi` (minimaal aangepast, zie ARCHITECTUUR.md §4).
- Build met ESP-IDF v5.5.4, target esp32p4: **schoon**, 0 waarschuwingen in eigen code.
- Startscherm "KOIoT Paneel" met `panel_id` (eFuse-MAC P4), wifi-status/SSID/IP/RSSI,
  SNTP-klok, touch-test, uptime/heap.
- `net_manager` met R1-beleid, `time_sync` (CET/CEST), logging (W7), TWDT (R6).
- **Weergavebug:** `swap_bytes = false` in `bsp_display.c` (`lvgl_init`). Donkere kleuren en
  gedeeltelijke redraws waren stuk door Elecrow's RGB565 in-place swap.

### Getest op hardware
- Scherm, touch, wifi, SNTP en de weergavefix (`swap_bytes = false`) zijn door Jorrit bevestigd.
  Gecommit als `M0 bring-up`.

### Open — restpunten M0
- Optioneel: reconnect 10+ min → `esp_restart()`, lange-duur stabiliteit, C6-firmwareversie uit
  de esp_hosted-log, touch-oriëntatie fine-tuning. Fonts blijven ASCII tot eigen Latin-1-fonts.

---

## M1a — MQTT-diagnose (geen dashboard)

### Gedaan
- `io/mqtt_link`: esp-mqtt-client, buffer 2048, auto-reconnect, start pas bij wifi-IP, stop bij
  wifi-verlies, subscribe `koiiot/KOIoT-57226C/#` bij elke MQTT-connect, W7-logging van connect /
  subscribe / disconnect / elke inkomende publish (topic + payload + len).
- `data/diag_store`: ringbuffer van 10 recente berichten.
- Init-volgorde-fix: wifi/esp_hosted vóór de applicatie-UI (SDIO-assert `sdio_rx_get_buffer`).

### Getest op hardware (27 sep 2026 ~21:09 CEST)
- Wifi OK: 192.168.178.192, poging 1.
- MQTT OK als `koiiot_paneel`. Subscribe `koiiot/KOIoT-57226C/#` bevestigd.
- Geziene topics (kale getalstring of ON/OFF, geen JSON):

| topic | retain | payload | interval |
|---|---|---|---|
| `koiiot/KOIoT-57226C/status` | 1 | online | 1x bij subscribe |
| `koiiot/KOIoT-57226C/flow_rate` | 0 | 0.00 | ~1 s |
| `koiiot/KOIoT-57226C/flow_total` | 0 | 37.18 | ~1 s |
| `koiiot/KOIoT-57226C/flow_leak` | 0 | OFF | ~1 s |

- **Niet gezien** in die ~27 s: humidity, watertemperatuur, luchttemperatuur, pH (meetinterval
  tot 900 s). Latere M1-log (zelfde avond) zag `water_temp`, `air_temp` en `humidity`; pH nog
  niet. Zie M1b.
- Niet-blokkerend in dezelfde log: Hosted Host 2.7.0 < C6 2.12.0; korte wifi-leave (reden 8),
  daarna alsnog poging 1 + IP. **Hosted niet upgraden** (W4) tot de C6-firmware meegaat.

### B5 (vastgelegd)
- `status` is retained; `flow_*`, `water_temp`, `air_temp` en `humidity` niet (retain=0).
- Na herstart van het paneel: geen flow tot de volgende publicatie (~1 s). Temp/RV mogelijk
  pas na het meetinterval (tot 900 s). pH nog niet gezien. UI: "wacht op data" tot de eerste
  waarde per veld (pH: "geen sensor").
- Retain in de sensormodule aanpassen valt buiten dit project.

---

## M1b — Live dashboard

### Gedaan
- `data/live_store`: één mappingtabel suffix → veld. Bevestigd: `status`, `flow_rate`,
  `flow_total`, `flow_leak`, `water_temp` (1 decimaal, stale 30 min), `air_temp` (1 decimaal,
  stale 30 min), `humidity` (RV %, stale 30 min). pH niet verzonnen; onbekende suffix →
  eenmalige log `ongemapped topic`. `last_update` per veld; stale 30 min (temp/RV/pH) /
  60 s (debiet).
- `mqtt_link` blijft alles loggen en schrijft gemapte payloads naar `live_store`. Geen LVGL
  in MQTT-callbacks.
- Dashboard (§7.1): donker, Nederlands, ASCII. Statusbalk (klok, datum, wifi, MQTT, backend -),
  navigatie (alleen Overzicht actief), tegels watertemp / lucht / pH / bijvulwater.
- "vandaag: X L" = `flow_total` minus middernachtstand in NVS. Eerste geldige `flow_total` van
  de lokale dag zet de baseline (niet de lifetime-total). Zie ARCHITECTUUR.md §3.12.
- Lekbanner volle breedte op het dashboard (niet `lv_layer_top`) bij `flow_leak=ON`, weg bij
  OFF; nooit klikbaar. Dimmen bestaat nog niet (TODO R7).
- Touch-fix: labels niet klikbaar (anders slokken ze tab-tikken op); rode marker +
  coördinaten zoals M0; indev blijft gekoppeld na `lv_screen_load`.
- Init-volgorde ongewijzigd: display → wifi/hosted → dashboard. `live_store_init` + NVS
  middernachtstand staan vóór I2C/display (mutex + één NVS-read); dat raakt SDIO/DMA niet.
- Doodlus-mitigatie (0.1.0-m1b2): als hosted de P4 herstart tijdens C6/SDIO-init
  (`SW_CPU_RESET` + RTC-guard), geen nieuwe `bsp_wifi_init`. Log: beide USB-C eraf,
  5 s wachten. GPIO54-reset wekt een zieke C6 niet; hosted 2.7.0 doet bij 0x107 zelf
  `esp_restart()`. Hosted niet upgraden (C6 2.12.0, host 2.7.0, W4).
- `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.

### Getest op hardware
- Touch: tik op tegel → rode stip + `touch x,y`; navigatie-tabs loggen
  `navigatie '...' is nog niet beschikbaar`. Bevestigd (screen_dash).
- Nieuwe topics (kale getalstring, retain=0), eerst als ongemapped/kandidaat:
  `water_temp` payload `16.50`, `air_temp` payload `16.28`, `humidity` payload `83.55`.
- pH nog niet gezien; tegel blijft "geen sensor".
- **Open:** de drie tegels watertemp / lucht / RV na mapping + power-cycle.

### Hardware — hosted-rebootlus (0.1.0-m1b, SHA 5bc64cfa4)
Geen `sdio_rx_get_buffer`-assert. Heap vóór wifi gezond (intern 412 KB, DMA 374 KB,
grootste 304 KB). Toch lus: SDIO card init OK → 10 s geen INIT-event van de C6 →
GPIO54-reset → `sdmmc_io_rw_extended` 0x107 → `Host is reseting itself` (`SW_CPU_RESET`).
Alle starts in die log waren `SW_CPU_RESET`, geen `POWERON`. Zelfde mismatch Hosted
2.7.0 / C6 2.12.0 werkte in M1a wél na `POWERON`. **Oorzaak: C6-state na flash/self-reset,
niet code/heap.** Groter DROM (~548 KB vs ~455 KB) is dashboard/live_store, niet hosted-DMA.

### Open — te doen door Jorrit
0. **Eerst stroom eraf** (ook op 0.1.0-m1b): beide USB-C eraf, 5 s wachten, aansluiten,
   monitor. Verwacht: `Received INIT event from ESP32 peripheral`, daarna wifi zoals M1a.
   GPIO54-reset is niet genoeg. Daarna eventueel `0.1.0-m1b2` flashen (doodlus-guard).
1. Flashen (als je m1b2 wilt): `idf.py -p COM5 flash monitor` (niet door Cursor).
   Na flash opnieuw beide USB-C eraf als de C6 weer geen INIT geeft.
2. Touch: tik op een tegel → rode stip + `touch x,y` in de bannerstrook en seriële log;
   tik **Meting invoeren** / **Historie** / **Instellingen** → tab kleurt kort, log
   `navigatie '...' is nog niet beschikbaar`. Overzicht is expres niet klikbaar.
3. Debiet (L/min en lifetime-total) binnen ~1 s gelijk aan Home Assistant.
4. "vandaag" start rond 0 L (niet 37 L), groeit alleen met nieuwe liters; na herstart dezelfde dag
   blijft de baseline (NVS).
5. Watertemp / lucht / RV: waarden i.p.v. "wacht op data" — verwacht `16,5 C` / `16,3 C` /
   `RV  83,6 %` (of gelijk aan HA). Geen `ongemapped topic` meer voor die drie suffixes.
   pH blijft "geen sensor" tot een topic in de log verschijnt (niet verzonnen).
6. Sensormodule even uit of MQTT stoppen: debiettegels na 60 s "verouderd"; temp/RV na 30 min.
7. Via MQTT Explorer `koiiot/KOIoT-57226C/flow_leak` = `ON` → rode banner; `OFF` → weg.
8. Na herstart: status meteen (retained); flow ~1 s; temp/RV pas bij volgende publicatie
   (niet retained; meetinterval tot 900 s).

### Open — TODO
- Topicnaam pH (nog niet gezien; niet verzonnen).
- Dimmen / scherm wekken bij lekalarm (R7); nu alleen banner + log.
- Trendpijl watertemp (geen lokale historie).
- Handmatige-metingtegels (M2, uitgesteld tot B6).

---

## M1.5 — Takenlijst en voeradvies

### Gedaan
- `data/status_store`: laatste geldige `ha-status` in RAM. Parse strikt tegen brief v2.0 A6/A8:
  `api_version`, `open_tasks`, `tasks[]` (`id`, `title`, `type`, `due_date`, `overdue`,
  `description`, `actions`), `latest_readings[]` (`sensor_id`, `key`, `value`, `unit`,
  `measured_at`), `generated_at`. Optioneel later: `season`/`season_since`/`feed_band`/`data_ok`,
  per taak `kind`/`severity`. Onbekende velden negeren; geen extra velden verzinnen (W3).
- Eerste parse logt één keer de ruwe JSON-vorm (object vs array, aanwezige keys, vorm van
  `latest_readings` en `tasks[0].actions`) zodat een mismatch in de seriële log zichtbaar is.
  Live 200-body ontbrak in de bouwsessie (placeholder niet ingevuld).
- `io/backend_client`: eigen taak, HTTPS `esp_crt_bundle`, timeout 10 s. GET
  `https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/ha-status` met header **`X-HA-Token`**
  (geen Bearer-anon). Poll bij wifi-IP, elke 15 min, en na Vernieuwen. POST
  `…/task-close` met `{task_id, status}` en optioneel `note` (A7). Extra JSON-sleutels alleen
  als ha-status een veldschema levert. W7-logging. Geen HTTP in LVGL (FreeRTOS-queue).
- Tab **Taken** met badge = aantal open taken die **vandaag due** zijn of **overdue** (niet
  toekomstige). Kop seizoen/voer alleen als die velden er zijn.
  Per taak: titel, vervaldatum (vandaag/morgen/N dagen te laat), waarschuwingskleur bij
  `overdue`/`severity`, label `type` of `kind`. Lijst in twee groepen: **Vandaag / te laat**
  vs **Later** (toekomst blijft zichtbaar). Knoppen **alleen uit `actions`** (eerste versie:
  `["done"]` → Gedaan). Geen `actions` of geen `id`: alleen weergave. Bevestiging, pop-up geen
  verbinding / serverfout / al afgesloten, Vernieuwen, "bijgewerkt om hh:mm" (oranje na 1 uur).
  **Invoer bij afronden (0.1.5-m15c/d):** brief §6.4 POST is `{task_id, status}`; A7 voegt optioneel
  `note` toe. De brief noemt **geen** liters, %, vijverinhoud of waterwissel-formulier bij
  task-close (13.500 L is context/M4). Daarom geen verzonnen waterwissel-velden (W3). Als een taak
  in ha-status `fields` / `form` / `extra` / `payload` heeft als array van objecten met `key`+`type`
  (`number` of `text`), toont het paneel die invoer (numeriek toetsenblok, komma UI) vóór de
  bevestiging en stuurt de waarden mee. Elke ha-status-parse logt per taak `keys=`, `type=`,
  `extra=`/`payload=`/`fields=`/`form=` en `invoervelden=`. Zonder zo'n schema blijft alleen
  bevestigen.
  **Bevestigd uit Jorrits log:** live taken hebben alleen `id,title,type,due_date,overdue,actions`.
  `fields`/`form`/`extra`/`payload` ontbreken, `invoervelden=0`. Types o.a. `water_change` en
  `water_parameters`. Type-check is exact `water_change` (niet substring `water_`);
  `water_parameters` is geen waterwissel. Waterwissel-invoer wacht op een veldschema van de backend.
- Overzicht: tegel Seizoen/voer alleen als de velden er zijn; tegel Open taken (zelfde aantal
  als de badge + titel van de eerste due-nu-taak; tik → tab Taken). Statusbalk `app OK/token/fout`.
- Telregel: `overdue` uit ha-status, of `due_date` ≤ lokale kalenderdag via SNTP (CET/CEST).
  **Fallback zonder tijd-sync:** alleen `overdue` telt als "nu"; `due_date` wordt niet tegen
  1970 vergeleken. Relatieve labels ("vandaag") ontbreken dan; kale datum blijft. Log:
  `due_nu=` / `later=` / `tijd_sync=`. Eerste ha-status kan `tijd_sync=0` zijn (SNTP nog
  niet klaar); `due_nu`/`later` via `overdue`/`due_date` blijft geldig. Badge-fix behouden.
- Buffer tot 24 taken (was 10), zodat toekomstige taken in "Later" blijven staan.
- `latest_readings`: alleen A8-array; startwaarde in `live_store` met "laatst opgeslagen";
  MQTT nieuwer wint; MQTT >5 min weg: nieuwere DB bij poll. Leeftijd vanaf `measured_at`.
  Ontbreekt het veld: gedrag zoals M1.
- Init-volgorde: display → **direct** wifi/hosted → daarna `status_store` (PSRAM) + UI.
  Labels niet klikbaar. Hosted niet upgraden. Fonts: ASCII + transliteratie.
- **Crashfix (0.1.5-m15b):** tik op Gedaan gaf lichtblauw scherm / `Guru Meditation Error:
  Core 0 panic'ed (Stack protection fault)` in `taskLVGL` bij `screen_tasks.cpp` /
  `task_from_event`. `StatusSnapshot` (~10 KB, 24 taken) werd by-value op de LVGL-stack
  gekopieerd (Elecrow-default 16 KB). `snap` lag in de LVGL-stackbounds. Fix: geen
  `StatusSnapshot` op de LVGL-stack (event-callback gebruikt rij-index/`TaskRow`; timer
  vult een static buffer). Gedaan: alleen `task_id` + action op de FreeRTOS-queue; POST
  in de `backend`-taak; UI via de 250 ms-timer. LVGL-stack niet vergroot.
- **WDT-fix (0.1.5-m15d, onvoldoende):** na parse van 15 taken triggert `task_wdt`: IDLE0
  reset niet. m15d bouwde max 1 kaart/tick, maar (1) de 250 ms-timer startte de opbouw al
  op Overzicht, (2) SNTP zette `due_now` in de hash → tweede `opbouw starten` terwijl de
  eerste nog liep (nooit `opbouw klaar`), (3) due-labels van alle kaarten in één tick
  (`draw_letter`). Geen `esp_task_wdt_reset`.
- **0.1.5-m15e:** Takenkaarten alleen als tab Taken zichtbaar is; bij verlaten incrementeel
  opruimen. Geen tweede opbouw zolang de eerste loopt. SNTP: bestaande kaarten, max 1
  due-label per tick (hash zonder `due_now`). Numpad/keyboard pas bij invoerveld (live
  `invoervelden=0`). `StatusSnapshot` + `TaskRow[]` in PSRAM (~18 KB × 2 + rijen); LVGL-
  objecten blijven intern (Elecrow: alleen framebuffers in SPIRAM). Labels niet klikbaar,
  geen snapshot by-value, geen HTTP in LVGL. TWDT 10 s ongewijzigd.
- **0.1.5-m15f (hosted-retry, DMA):** m15e sloeg na hosted-assert/0x107 wifi/MQTT **blijvend**
  over tot stroom eraf. POWERON met ruime DMA (intern 408 KB, DMA 369 KB) gaf tóch
  `sdio_rx_get_buffer` assert; daarna PANIC → skip → leeg Overzicht, Taken `0 taken`.
  Fix: geen eeuwige skip. Na SW_CPU_RESET of PANIC tijdens hosted-init: lichte tekst
  "Wifi start opnieuw…", pauze 8 s, daarna opnieuw `bsp_wifi_init` + MQTT. `status_store`
  en UI-snapshots alleen PSRAM (geen INTERNAL-fallback vóór/naast hosted-RX). DMA-reserve
  32 KB → 96 KB (`CONFIG_SPIRAM_MALLOC_RESERVE_INTERNAL`, Elecrow-Kconfig, hosted 2.7.0).
  Takenkaarten blijven alleen op tab Taken. Labels niet klikbaar; geen snapshot op
  LVGL-stack; geen HTTP in LVGL.
- **0.1.5-m15g (waterwissel-afronding):** pal-app `WaterChangePopup` als bron van waarheid.
  Taken `type`/`kind` `water_change` (titel-vangnet: waterwissel / water change / water ververs;
  niet `water_parameters`) vragen vóór POST: liters (>0, L, numpad), type water, reden, optionele
  opmerkingen. Payload: `{task_id, status, note, liters_added, water_type, reason, parameters:{…}}`.
  `note` = samenvatting (RPC bewaart alleen note). Andere taken: ha-status-schema of alleen
  bevestiging.   Hosted 2.7.0: eerste STA-leave (reden 8) is handshake-log (INFO) + 2 s retry i.p.v.
  15 s; geen hosted-upgrade, geen grotere SDIO-RX-queue (DMA).
- **0.1.5-m15h (hosted-lus stop + DMA):** m15f “altijd retry” (8 s + `bsp_wifi_init` na
  PANIC/SW_CPU_RESET) bevriest de UI op “Wifi start opnieuw…”: GPIO54 wekt een zieke C6 niet,
  retry triggert hosted-self-reset (0x107). Terug naar skip tot **POWERON** (beide USB-C), maar
  met **volledig dashboard** + oranje banner “Wifi wacht op stroom-eraf (C6)” — geen leeg
  Overzicht zoals m15e. Verse POWERON start hosted direct. DMA: `SPIRAM_MALLOC_RESERVE_INTERNAL`
  96 KB → 32 KB (Elecrow); 96 KB sneed het grootste intern+DMA-blok (m15g: 212 KB, m15f: ~304 KB).
  live_store/diag_store-buffers en taken-hash in PSRAM; waterwissel-UI (modal/numpad/keuze)
  pas bij Gedaan. Hosted 2.7.0, niet geüpgraded.
- **0.1.5-m15i (watermeting Store-fault):** Jorrit vulde watermeting in op `Test taak 2`
  (`invoervelden=4`, type `water_parameters`, niet waterwissel). Na stap 4 (touch ~420,543 =
  numpad-OK / toetsenbord onderaan 1024×600) paniek `Store access fault` in
  `lv_obj_class_create_obj` regel 90, `MTVAL=0x1c` (`children[7]` van een NULL/dode parent —
  klassiek 8e child of realloc tijdens nested click). Oorzaak: bevestigingsdialog/keyboard
  werd in dezelfde LVGL-click als “Volgende/OK” aangemaakt, als sibling van chrome op `s_scr`
  (~7 kinderen; 8e child = offset 0x1c). `screen_dash: touch` was de globale indev-hook, geen
  tab-wissel. Fix: overlays aan **één host**; volgende wizardstap via `lv_async_call` (geen
  create in de click); geen `lv_obj_create` zonder `lv_obj_is_valid(parent)`; keyboard unlink
  bij hide; indev-touch alleen op Overzicht. Pal-app watermeting: `ParameterForm` (ph, kh,
  nitrite, nitrate; ph verplicht) als ha-status geen schema heeft; POST `parameters` + note
  `Watermeting: …`. Waterwissel-flow ongewijzigd. C6-skip/dashboard-banner m15h blijft.
  Takenkaarten 1/tick alleen op tab Taken; geen HTTP in LVGL; wizard-state static.
- **0.1.5-m15j (waterwissel water_type TWDT):** na liters (stap 1) logde `wizard stap 2/4
  key='water_type'`; ~11 s later `task_wdt: IDLE0 did not reset; CPU 0: taskLVGL` in
  `lv_obj_allocate_spec_attr` (MCAUSE/MTVAL `deadc0de` = TWDT-dump, geen Store-fault).
  Zelfde patroon als 15 taakkaarten in één tick: `create_choice_overlay` maakte overlay +
  flex-grid + **8 grote knoppen** (elk `lv_obj_create` + label) + OK/Annuleren in één
  `lv_async_call`. `taskLVGL` hield CPU0 bezet tot de 10 s-TWDT. Fix: keuze-UI opbouwen
  over ticks (max 1 knop/tick, chrome 1 object/tick); knoppen hergebruiken (water_type 5,
  daarna reden +1); overlay verborgen tot klaar. Geen herbouw van een bestaande overlay
  (async-keten stopt bij klaar; 250 ms-timer plant alleen verder als `lv_async_call` weigert).
  Overlay-host m15i, C6-skip m15h, watermeting-numpad en liters ongewijzigd. TWDT blijft 10 s.
- **0.1.5-m15k (keuze-builder, geen TWDT):** m15j logde `keuze-overlay: opbouw starten` maar
  nooit `opbouw klaar`; ~11 s later IDLE0/TWDT in `lv_obj_allocate_spec_attr`. Oorzaak: stagger
  via `lv_async_call` (LVGL-timer **periode 0**). Elke knop zette meteen de volgende async klaar;
  `lv_timer_handler` vuurde die keten in **één pass** (geen yield naar IDLE0). Bovendien
  `make_btn` = 2 creates (obj+label) in een **flex-grid**, als sibling van de 15-kaarten-lijst
  die de 250 ms-refresh bleef hertekenen. Fix: **cyclus-knop** (tik = Kraanwater/Bronwater/
  Regenwater/RO/Gemengd of reden-lijst) + OK, vaste coords, overlay `HIDDEN` tot klaar;
  opbouw met `lv_timer` 50 ms, max 1 `lv_obj_create` per expire; log `object n/10` + intern
  heap/grootste blok, daarna `opbouw klaar`. Tijdens wizard: takenlijst `HIDDEN`, geen
  rebuild/`layout_tasks`. **Watermeting** = titel Water controleren / type `water_parameters`
  / 4× numpad (ph/kh/nitrite/nitrate). **Test taak 2** = `water_change` (liters → type →
  reden → notes). Overlay-host m15i, C6-skip m15h. TWDT blijft 10 s.
- **0.1.5-m15l (POST ok, UI bleef Bezig + TWDT draw_letter):** waterwissel (Test taak 2) was
  invulbaar; POST task-close HTTP 200, maar de taak bleef **Bezig**. Log: `hervat tijdens wizard`,
  daarna GET ha-status, `opbouw al bezig; herbouw uitgesteld`, ~10 s later TWDT IDLE0 / `taskLVGL`
  in `draw_letter`. Oorzaak: wizard-pauze hid de 15 kaarten; “hervat” unhidde ze in één tick
  (zelfde draw_letter-piek als vroeger 15 creates) terwijl de tab-opbouw doorliep en de
  ha-status-herbouw werd uitgesteld. Lokale `close_ok` kwam daardoor niet op het scherm.
  Fix: na POST 200 taak meteen lokaal weg (niet wachten op GET voor niet-Bezig); bij POST-fout
  Bezig weg + foutmelding, taak blijft. Na wizard: geen show-all; in-flight opbouw **annuleren**;
  lijst `HIDDEN` tot POST/GET klaar; daarna staggered clear+opbouw (max 1 kaart/tick). Geen
  `layout_tasks` van 15 kaarten in één tick. Overlay m15k cyclus-knop, C6-skip m15h, geen
  snapshot op LVGL-stack, geen HTTP in LVGL, labels niet klikbaar.
- **0.1.5-m15m (notes-stap TWDT, geen keyboard):** na waterwissel stappen 1–3 (liters, water_type
  overlay 10 objecten klaar, reason) logde `wizard stap 4/4 key='notes'`; ~11 s later
  `task_wdt: IDLE0` / `taskLVGL` in `allocate_button_areas_and_controls` (`lv_buttonmatrix.c`).
  Oorzaak: optionele notes toonde `lv_keyboard` (tientallen toetsen = één buttonmatrix-create
  op 1024×600 + takenboom). Zelfde TWDT-patroon als 15 kaarten / 8 keuze-knoppen, nu in
  buttonmatrix i.p.v. draw_letter. Fix: **geen** `lv_keyboard` en geen grote `lv_buttonmatrix`
  in de wizard. Notes = titel “Opmerkingen (optioneel)”, cyclus-knop (leeg / Geen
  bijzonderheden / Algen) + **Overslaan** (lege notes geldig, required=0). Andere ha-status
  text-velden dezelfde lichte UI. Lege `notes` weglaten in JSON (zoals pal-app). Overlay
  hergebruikt de bestaande cyclus-UI (na type/reden: geen extra creates). Watermeting blijft
  4× numpad; liters/type/reden ongewijzigd. POST 200: lokale done + staggered lijst (m15l).
  `CONFIG_LV_USE_KEYBOARD` uit (textarea/buttonmatrix blijven voor LVGL-msgbox). Hosted 2.7.0, C6-skip m15h.
- **0.1.5-m15n (NULL draw-buf na 14 kaarten + water_changes):** na wizard/POST logde m15m
  `opbouw klaar (14 kaarten)` en crashte met `lv_draw_sw_fill` / `lv_memset dst=0` (len 990).
  Geen TWDT: alle kaarten in één invalidate terwijl de SW-drawbuf NULL was. Fix: kaarten
  blijven HIDDEN tot hun eigen tick; na opbouw eerst **overlay/host weg** (eigen tick, lijst
  blijft HIDDEN); daarna lijst tonen; daarna 1 kind/tick. Draw-buf NULL → skip + log, niet
  tekenen. Labels niet klikbaar; geen HTTP in LVGL. **Data:** waterwissel volgt pal-app
  `WaterChangePopup`: eerst HTTPS POST `water-change` → insert `water_changes`
  (`liters_added`, `water_type`, `reason`, `notes`, `changed_at`; `user_id` via token).
  Daarna task-close met note `via paneel` — **geen liters** in `maintenance_tasks.notes`.
  `water_parameters` gaat niet naar `water_changes` (alleen task-close + `parameters`).
  Insert-fout: taak blijft open. Hosted 2.7.0, C6-skip m15h, cyclus-wizard m15m.
- **0.1.5-m15o (REST water_changes, geen verzonnen Edge Function):** m15n POST naar
  `functions/v1/water-change` → HTTP 404 (bestond niet). Pal-app `WaterChangePopup`
  insert via REST `POST /rest/v1/water_changes` (kolommen `user_id`, `liters_added`,
  `water_type`, `reason`, `notes`, `changed_at`; geen pond/task_id). Headers:
  `apikey`, `Authorization: Bearer …`, `Content-Type: application/json`,
  `Prefer: return=representation`. RLS: `auth.uid() = user_id` (user-JWT). Paneel
  heeft geen user-JWT: REST 400/401/403 → log status+body; daarna task-close met
  liters in de JSON (niet in `maintenance_tasks.notes`) zodat de bestaande
  `task-close` de rij zet (`user_id` uit device-token). REST 201/200: task-close
  zonder liters, note `via paneel`. Overige REST-fout: taak blijft open, geen
  task-close. `water_parameters` gaat niet naar `water_changes`. Crash-pad m15n
  (HIDDEN, overlay weg, reveal 1/tick) ongewijzigd. Geen `water-change` function
  te deployen. Hosted 2.7.0, C6-skip m15h.
- **0.1.5-m15p:** POST `/rest/v1/water_changes` met alleen `apikey` → HTTP 401 RLS (`auth.uid() = user_id`). Dat is geen bug: pal-app insert met **user-JWT**. Paneel heeft geen user-sessie. `esp_http_client` weigert `Authorization: Bearer` (0x106). Fallback POST task-close met liters in JSON.
- **0.1.5-m15q:** geen REST meer. Waterwissel = één POST `functions/v1/task-close` met header **`X-HA-Token`** (paneel-device-token / `device_tokens`; **geen Home Assistant**, geen user-JWT). Body: `task_id`, `status:done`, `note:"via paneel"`, `liters_added`, `water_type`, `reason`, optioneel `notes`/`changed_at`. Function (service role) insert `water_changes` (`user_id` uit het device-token) en sluit daarna de taak. Geen liters in `maintenance_tasks.notes`. `water_parameters` niet in `water_changes`. HTTP: geen `Authorization: Bearer`. Queue, geen LVGL. Crash-pad 1/tick ongewijzigd. Hosted 2.7.0, niet geüpgraded.
- `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon** (0.1.5-m15q). Hosted 2.7.0, niet geüpgraded. Niet geflasht.

### Getest op hardware
Parse/ha-status-vorm: **bevestigd** (Jorrits log, 29 sep 2026). Taken hebben alleen
`id,title,type,due_date,overdue,actions`; `fields`/`form`/`extra`/`payload` ontbreken;
`invoervelden=0`. `water_change` en `water_parameters` komen beide voor.
**Waterwissel / task-close (0.1.5-m15q): bevestigd 30 sep 2026.** Taak wordt
geregistreerd, rij in `water_changes`, geen logfouten. M1.5-afronden via het paneel is
daarmee af voor waterwissel.

### Open — te doen door Jorrit
0. **Nu al, vóór flash:** beide USB-C eraf om de huidige m15g-lus te stoppen. 5 s wachten.
   GPIO54 is niet genoeg. Hosted niet upgraden.
1. **Eerst `task-close` her-deployen** (pal-app, zoals destijds ha-status), daarna flashen:
   `idf.py -p COM6 flash monitor` (poort controleren). Firmware `0.1.5-m15q`.
   **Deploy (vóór of direct na flash, anders geen rij in water_changes):**
   `cd C:\Users\Jorrit\Documents\GitHub\koi-pond-pal`
   `npx supabase functions deploy task-close --project-ref pbpuvumeshaeplbwbwzv`
   (zelfde als destijds ha-status). `X-HA-Token` = paneel-auth voor Supabase, **niet** Home Assistant.
   Daarna opnieuw **beide USB-C eraf**, 5 s, aansluiten (verse POWERON).
2. **Verwacht na schone POWERON:** dashboard met tegels (niet alleen retry-tekst). Log:
   `hosted-DMA: grootste intern+DMA-blok … KB (doel ~300 KB; SPIRAM_MALLOC_RESERVE_INTERNAL 32 KB)`,
   daarna INIT van de C6, wifi-IP, MQTT OK. Tegels vullen (flow ~1 s; temp/RV bij MQTT of
   `latest_readings`). Geen `wifi/MQTT overgeslagen tot stroom eraf`.
3. **Als de C6 toch ziek is** (0x107 / PANIC / `Host is reseting itself`): **geen** oneindige
   “Wifi start opnieuw…”. Na de hosted-reset: **volledig dashboard** + oranje banner
   “Wifi wacht op stroom-eraf (C6)”. Log: `wifi/MQTT overgeslagen tot stroom eraf`.
   Tegels blijven (wacht op data tot POWERON). Geen 8 s pauze + `bsp_wifi_init`.
4. **15 taken, geen WDT, Overzicht blijft licht:** na `ha-status verwerkt: … taken=15` **geen**
   `takenlijst: opbouw starten` zolang tab Overzicht actief is. Tab Taken: één
   `opbouw starten` daarna `opbouw klaar` over meerdere ticks; SNTP → `due-labels bijwerken
   (geen herbouw)`, geen tweede `opbouw starten`. Geen `task_wdt` / IDLE0.
   **Waterwissel (Test taak 2, type `water_change`):** tik Gedaan → numpad liters → type water
   (cyclus-knop, geen `task_wdt`; log `keuze-overlay: opbouw starten`, `object n/10 … intern=…
   grootste=…`, daarna `opbouw klaar`) → reden (zelfde UI) → **opmerkingen** (cyclus-presets,
   default leeg, knop **Overslaan**; log `wizard stap 4/4 key='notes'`,
   `tekst-stap key='notes': cyclus-presets, geen keyboard`,
   `keuze-overlay: bestaande overlay hergebruikt`; **geen** `lv_keyboard` /
   `allocate_button_areas`; **geen** `task_wdt`) → bevestiging → POST. **Na afronden:** taak
   verdwijnt of is niet-Bezig. Log: `POST task-close HTTP 200`, `taak lokaal verwijderd na POST ok`, `GET … ha-status` HTTP 200, `takenlijst:
   POST klaar; staggered opbouw`, `opbouw starten` daarna `opbouw klaar (… nog HIDDEN;
   overlay eerst weg)`, `overlay weg; reveal 1/tick`, `kaarten zichtbaar (… 1/tick, geen
   unhide-all)`, **geen** panic in `lv_draw_sw_fill` / `lv_memset dst=0`, **geen** `hervat
   tijdens wizard` als unhide-all, **geen** `herbouw uitgesteld`, **geen** `task_wdt`.
   Waterwissel-log: **geen** `POST …/rest/v1/water_changes` (401 RLS hoort zo; niet
   “fixen” met Bearer). Wel `waterwissel: geen REST … insert via task-close` en
   `POST …/functions/v1/task-close` HTTP 200 met `"note":"via paneel"`,
   `liters_added`, `water_type`, `reason`. Rij in `water_changes` (user_id van het
   paneel-token). `maintenance_tasks.notes` = `via paneel`, **niet** vol liters.
   **Watermeting (Water controleren, type `water_parameters`):** 4× numpad (ph/kh/nitrite/nitrate,
   ha-status-schema of pal-app), **geen** water_type-overlay, geen liters, geen panic, daarna
   POST met `parameters`. Log: `eerste='ph'`, `wizard stap 1/4 key='ph'`. Andere taken zonder
   schema: alleen bevestiging.
5. Seriële log: `GET …/ha-status` HTTP 200; per taak
   `taak[n] … keys=[…] type='…' extra=… payload=… fields=… form=… invoervelden=`.
   Verwacht: `invoervelden=4` bij waterwissel (pal-app) en watermeting (pal-app of ha-status);
   overige taken `invoervelden=0` tot er een schema is. extra/payload/fields/form mogen ontbreken.
6. Taken op het paneel vs app: titels, volgorde binnen groepen. Seizoen/voer verschijnen niet tot
   `ha-status` ze levert. **Badge = aantal vandaag due of overdue, niet het totaal** (bv. 1 i.p.v.
   12 als er één taak vandaag is). Tab Taken: sectie "Vandaag / te laat" vs "Later".
7. Taak in de app afvinken → binnen 15 min weg of direct na Vernieuwen.
8. **Afronden:** tik Gedaan. **(A) Watermeting / Water controleren:** 4 getallen (pH verplicht;
   KH/nitriet/nitraat optioneel of volgens ha-status), bevestigen, POST zonder panic of
   water_type-overlay. **(B) Waterwissel / Test taak 2:** liters → cyclus type-water → reden →
   opmerkingen (Overslaan of preset, **geen toetsenbord**), zonder watchdog. Overige taken zonder schema: alleen bevestiging (Ja/Annuleren).
   Met `fields`/`form` (key+type): eerst invoer, daarna bevestiging.
   **Geen panic / geen lichtblauw scherm / geen task_wdt**; POST via backend-queue; log `poging: POST … body=`
   en `wizard stap N/4`. Waterwissel: rij in `water_changes` (liters/type/reden); taak-historie
   met "via paneel" **zonder** liters in `maintenance_tasks.notes`. Watermeting: geen
   `water_changes`-rij; meting in task-close `parameters` / note.
9. Wifi uit + tik afronden → pop-up geen verbinding, taak blijft. Wifi terug + Vernieuwen OK.
10. Fout token → "Token ongeldig - controleer KOISENSEI_HA_TOKEN", geen stille lege lijst.
11. Zonder wifi blijft de laatste lijst met "bijgewerkt om …".
12. Als `latest_readings` een A8-array is: na herstart tegels gevuld met "laatst opgeslagen"
    en juiste leeftijd; eerste live MQTT neemt over.

### Open — TODO
- Watermeting schrijft via `task-close` naar `parameters`. ha-status heeft nog geen
  `fields`-array (paneel vult pal-app-schema).
- `task-close` 404 zonder `error: task_not_found`: knoppen blijven, lijst alleen-lezen.

---

## M1.6 — Ventilatie via Home Assistant

### Gedaan
- Generieke `io/ha_client` (eigen taak, FreeRTOS-queue, geen HTTP in LVGL):
  `GET /api/states/<entity_id>`, `POST /api/services/<domein>/<service>`.
  Auth `Authorization: Bearer <HA_TOKEN>`. `max_authorization_retries = -1` zodat
  401 + `WWW-Authenticate: Bearer` geen ESP_ERR_NOT_SUPPORTED 0x106 geeft.
  HTTP-buffers in PSRAM. W7-logging (poging/succes/falen, zonder token).
- Tegel **Ventilatie** op Overzicht: titel **Ventilatie** bovenaan, daarna knoppen
  **0 · 1 · 2** (80 px hoog), daarna knop **Auto aan/uit**.
  Huidige stand gemarkeerd; tik → "bezig"; pas na GET-bevestiging definitief.
  Timeout 10 s of API-fout → terug naar werkelijke stand + korte melding.
  Stand buiten 0/1/2 → tekst, geen knop. 401: "HA-token ongeldig - controleer
  HA_TOKEN". HA weg: tegel grijs, "Home Assistant niet bereikbaar" of
  `HA fout HTTP n`. Labels niet klikbaar.
- **m16c wacht-op-HA:** na HTTP 200 wist `ha_client` de init-tekst "wacht op HA"
  (die bleef in `message` hangen en overschreef de statusregel). UI toont bij
  `Ok` de groene knop (50% → knop 1), geen wachttekst. GET logt HTTP-status +
  `state`/`percentage`. Na 15 s Idle met wifi: "geen antwoord van HA".
- **m16d layout:** titel **Ventilatie** bovenaan; knoppen 0/1/2 en Auto daaronder.
  Gedrag, HTTP, auto-entity en M1.5 ongewijzigd.
- Pollen: 10 s op Overzicht, 60 s anders, 1 s tijdens bevestiging, direct na tik.
- **B7 mapping vastgelegd** (`app_config.h`): `fan.ventilatie`, KIND=2 (fan %),
  knop **0 / 1 / 2** = percentage **0 / 50 / 100** (interne stand 1/2/3 ongewijzigd).
  HA-toestand: `preset_modes` null, `percentage_step` 50, `supported_features` 49
  = SET_SPEED + TURN_ON + TURN_OFF (geen PRESET_MODE). GET: `state` (off → 0%) +
  `attributes.percentage` (exacte match; ander % als tekst, geen valse knop).
  Zetten: `fan.set_percentage` voor 50/100; 0% via `fan.turn_off` (HA houdt %
  vaak op de laatste snelheid als de fan uit staat). Geen `fan.set_preset_mode`.
- **Auto:** `input_boolean.ventilatie_automatisch` (Jorrit). GET
  `/api/states/input_boolean.ventilatie_automatisch` (on/off); POST
  `input_boolean/turn_on` of `turn_off`. HTTP in de ha-taak. Knop groen = aan.
- `HA_TOKEN` in `secrets.h` (Jorrit, lokaal). Template: `secrets.example.h`.
  **Geen secrets.h committen.** Token niet in de chat.
- M1.5 (taken, waterwissel, C6-skip, DMA, labels, geen snapshot op LVGL-stack)
  ongewijzigd. Hosted 2.7.0, niet geüpgraded.
- `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon** (0.1.6-m16d). Hosted 2.7.0,
  niet geüpgraded. Niet geflasht.

### Getest op hardware (0.1.6-m16a, 30 sep 2026)
- Ventilatie GET/POST zonder foutmeldingen (Jorrit). `fan.ventilatie` 0/50/100 %
  werkt. UI-labels waren toen nog 1/2/3 (knop 1 = uit); titel stond boven de knoppen.

### Getest op hardware (0.1.6-m16b)
- Layout 0/1/2 + label Ventilatie eronder: **OK** (Jorrit). Statusregel bleef
  **"wacht op HA"** (bug, gefixt in m16c). Auto-knop ontbrak (entity toen onbekend).

### Getest op hardware (0.1.6-m16d, 30 sep 2026)
- Ventilatie 0/1/2, titel bovenaan, Auto (`input_boolean.ventilatie_automatisch`): **OK** (Jorrit).

### Open — restpunten M1.6
Geen. Verder testen (tokenfout, HA uit, fysieke schakelaar) mag meelopen met M1.7.

## M1.7 — Energiestand en rustscherm

### Gedaan
- `core/screen_manager`: standen Actief / Rust / Uit. T1 (default 5 min) zonder tik →
  Rust; T2 (default 30 min, vanaf begin Rust) → Uit; T2=0 = nooit. Rustscherm uit:
  Actief na T1 direct naar Uit. Backlight via bestaande BSP-PWM (`set_lcd_blight`);
  geen extra backlight-voeding in de Elecrow-BSP.
- Wekken: tik in Rust/Uit → Actief op Overzicht; `lv_indev_wait_release` zodat die
  tik niets bedient. HA-switch ON hetzelfde (T1 opnieuw). OFF → Uit, behalve tijdens
  een lopend verzoek (`task-close` of ventilatie-POST).
- Pop-up/wizard na T1: sluiten als Annuleren, daarna Rust. Lek tijdens Rust/Uit wekt.
- `ui/screen_idle`: tijd, watertemp (verouderd volgens §6.1), aantal open taken
  (badge-telregel). Blok verschuift bij binnenkomst en elke 2 min max ±60 px, geen
  animatie.
- Tab **Instellingen**, sectie Scherm: helderheid actief/rust, T1, T2 (incl. nooit),
  rustscherm aan/uit. Cyclus-knoppen (testwaarden T1=30 s, T2=1 min). NVS
  (`settings_store`, namespace `scr`); blijft na herstart.
- MQTT: LWT `koiiot/<panel_id>/status` online/offline; discovery switch
  **Paneelscherm**; command `…/scherm/set`, state `…/scherm/state` (ON bij
  Actief/Rust). Voorbeeldautomatisering: `docs/ha-paneelscherm.yaml`.
- M1.5+M1.6 ongewijzigd: taken stagger, task-close/water_changes, C6-skip, DMA,
  ventilatie 0/1/2/auto, labels niet klikbaar, geen HTTP in LVGL, geen snapshot op
  LVGL-stack. Hosted 2.7.0, niet geüpgraded.
- Firmware `0.1.7-m17b`. M0-touchdiagnostiek (label "tik ergens" + rode stip) verwijderd; touch, wekken in Rust/Uit en seriële `touch x,y` blijven. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. Niet geflasht.

### Getest op hardware
Nog niet (Jorrit flasht zelf; mag meelopen met M1.8).

### Open — te doen door Jorrit
Hardwaretest M1.7 (korte T1/T2, wekken, HA-schakelaar Paneelscherm) **meenemen bij het flashen van 0.1.8-m18b**. Zie M1.8.

## M1.8 — Meetgegevens-pop-up

### Gedaan
- Herbruikbare pop-up `ui/screen_measure` (§7.7): modaal, 70% schermbreedte, waarde groot,
  knop **Sluiten** (64 px) of tik naast de pop-up. Gegevens live via de 250 ms-timer.
  Objecten eenmalig bij Overzicht-create (geen create in de tik). Labels niet klikbaar.
- Gekoppeld aan sensortegels op Overzicht: watertemp, lucht (tegel = luchttemp; RV-regel
  apart), pH, bijvulwater. Ventilatie en Open taken openen geen meet-pop-up. Rustscherm
  opent er geen (andere screen; tik wekt alleen).
- Per sensor: waarde + vers/verouderd, gemeten (lokale datum/tijd + leeftijd), bron
  Live (MQTT) of Laatst opgeslagen (database), sensor-ID + module (`KOIoT-57226C`).
  Ontbrekende regels weggelaten, niets verzonnen. pH zonder data: "geen sensor".
- Lokale ringbuffer in PSRAM (24 u, 1 punt / 5 min, 288 punten per reeks: watertemp,
  luchttemp, RV, pH, debiet). Lijngrafiek + min/max/gemiddelde; leeg: "sinds opstart
  (buffer nog leeg)". Eerste punt zet "sinds opstart hh:mm" als SNTP synchroon is.
- Watertemp extra uit `ha-status` indien aanwezig: gem. 24 u, gem. week, trend, seizoen,
  met "berekend door de app". Bijvulwater extra: debiet nu, vandaag, meterstand.
- T1 zonder tik sluit de pop-up (als Annuleren) en gaat naar Rust; tabwissel sluit hem ook.
- **Tegelraster Overzicht:** 4 gelijke kolommen × 2 rijen. Marge 12 px rond het tegelvlak
  (statusbalk 48 + banner 36 + nav 72 meegerekend), gap 12 px horizontaal én verticaal.
  Kolom 241 px, dubbele tegel 494 px (= 2×241+12), rijhoogte 204 px. Ventilatie-tegel
  zit in dezelfde cel als de andere smalle tegels (niet meer 470 vs 255).
- M1.5–M1.7 ongewijzigd: taken stagger, task-close/water_changes, C6-skip, DMA,
  ventilatie 0/1/2/auto, energiestand/rustscherm, geen “tik ergens”/rode stip, geen HTTP
  in LVGL, geen snapshot op LVGL-stack. Hosted 2.7.0, niet geüpgraded.
- Firmware `0.1.8-m18a`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. Niet geflasht.

### 0.1.8-m18b — 24 u-reeks uit de database
- Pal-app-pad: 24 u-grafiek komt uit tabel **`sensor_data`** (kolommen `temperature`,
  `humidity`, `ph`, `flow_rate`, `created_at`, `sensor_id`, `user_id`). De app leest via
  REST `/rest/v1/sensor_data` met **user-JWT** (RLS). Het paneel heeft geen user-JWT —
  geen REST (herhaalt geen 401). Geen aparte history-RPC.
- Bestaande Edge Function **`ha-status`** uitgebreid (pal-app
  `supabase/functions/ha-status/index.ts`): `GET …/functions/v1/ha-status?history=1&interval=300`
  met header **`X-HA-Token`** (zelfde als ha-status/task-close). Optioneel `sensor_id`,
  `from`, `to` (ISO). Default: alle gekoppelde sensoren, laatste 24 u, buckets van 300 s
  (max 288 punten). Antwoord `{history:{from,to,interval_s,series:[{key,sensor_id,t[],v[]}]}}`.
  Lege reeks weggelaten; pH zonder rijen = geen punten.
- Firmware: na geslaagde ha-status (en bij openen pop-up tot het binnen is) GET history
  in de backend-queue, ringbuffer vullen, daarna MQTT-punten erbij. Geen HTTP in LVGL,
  geen snapshot op de LVGL-stack. Labels niet klikbaar. Tegelraster m18a ongewijzigd.
- Ontbrekende historie: grafiek 1 punt + “geen 24 u-historie (alleen huidige waarde)”,
  geen crash. pH zonder sensor: geen verzonnen punten.
- Firmware `0.1.8-m18b`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. Niet geflasht.

### Getest op hardware
**24 u-historie uit DB: OK** (Jorrit, 1 okt 2026). Grafiek is bewust simpel; polish later, niet in deze mijlpaal.

### Open — restpunten M1.8
Grafiek visueel verbeteren: later. Hardwaretest pop-up/T1/HA-schakelaar **meenemen bij 0.2.0-m2b**.

1. **Eerst `ha-status` her-deployen** (pal-app, zoals destijds task-close), daarna flashen.
   Zonder deze deploy blijft de grafiek 1 punt (latest_readings / MQTT); log:
   `geen history-veld (ha-status her-deployen…)`.
   ```
   npx supabase functions deploy ha-status --project-ref pbpuvumeshaeplbwbwzv
   ```
   `verify_jwt` blijft false (`config.toml`). Geen nieuwe function-naam.
2. Flashen (niet door Cursor): `idf.py -p COMx flash monitor`. Eerst beide USB-C
   eraf, 5 s, verse POWERON. Hosted niet upgraden. Firmware `0.1.8-m18b`.
   `secrets.h` niet committen.
3. **Visueel Overzicht:** tegels strak: gelijke marge links/rechts (12 px), gelijke
   gaten, watertemp/bijvulwater even breed als twee smalle tegels + gat, ventilatie
   niet scheef t.o.v. lucht/pH/taken. Statusbalk en tabs blijven volle breedte.
4. Tik op watertemp / lucht / RV / pH / bijvulwater → pop-up met juiste titel, waarde,
   meettijd, leeftijd, bron, sensor. Labels van tegels stelen geen tik. Ventilatie 0/1/2
   en Auto blijven de ventilatie, Open taken gaat naar tab Taken.
5. Bron: na herstart "Laatst opgeslagen (database)" als `latest_readings` er is; na
   MQTT "Live (MQTT)". **Grafiek:** na history-GET een lijn over de laatste 24 u
   (doorgaans tientallen tot 288 punten, 5 min-buckets uit `sensor_data`), tekst
   “laatste 24 uur (database)”, plus min/max/gem. Zonder deploy of zonder rijen:
   1 punt + “geen 24 u-historie (alleen huidige waarde)”. pH zonder sensor: “geen sensor”,
   geen lijn. Daarna groeit de lijn verder met MQTT (elke 5 min).
6. Pop-up sluit met **Sluiten**, tik ernaast, en vanzelf na T1 (daarna Rust). Op het
   rustscherm opent een tik **geen** pop-up (alleen wekken).
7. Watertemp: extra app-regels alleen als `ha-status` `water_temp_24h` / `water_temp_week`
   / `trend` / `season` levert; anders weggelaten. Bijvulwater: debiet/vandaag/meterstand
   alleen als die waarden er zijn.
8. M1.7 meenemen: korte T1/T2, wekken in Rust/Uit bedient niets, HA-schakelaar
   Paneelscherm. Ventilatie en taken/waterwissel ongewijzigd. Geen `task_wdt`.

## M2 — Handmatige metingen

### Gedaan
- `data/param_catalog`: één tabel (§8 startwaarden). Sleutels `kh`, `gh`, `tan`,
  `nitriet`, `nitraat`, `fosfaat`, `ph`, `zout`. Eenheden, fysiek bereik, stap,
  optioneel waarschuwingsbereik (pal-app drempels als start), houdbaarheid.
  **B6 nog open:** catalogus is §8, niet het Hanna/Colombo-model van de app.
  Pal-app schrijft nu `water_parameters` met Engelse types (`nitrite`, `ammonia`).
  Het paneel volgt de brief (`POST manual-measurement`, sleutels §8).
- `data/measurement_queue`: NVS-blob (max 200, compact ~32 B/stuk), UUID v4
  (R4), bij vol eerst oudste geüploade weg (R3). Historie = laatste 50.
  MOCK default **aan** tot de Edge Function live is en Jorrit de toggle uitzet.
- Uploader in `backend_client` (geen HTTP in LVGL): MOCK logt body + succes;
  live: `POST …/manual-measurement` met **`X-HA-Token`** (zelfde als ha-status /
  task-close). Geen Bearer-anon, geen REST `/rest/v1/water_parameters` (RLS).
  2xx = geüpload; 4xx (behalve 401) = definitief afgewezen; 401/5xx/netwerk =
  backoff 10 s → 10 min. Zonder SNTP geen `measured_at` (R5).
- MQTT Discovery + retained state/attr per parameter onder `koiiot/<panel_id>/…`
  (niet de sensormodule). Diagnostiek: rssi, uptime, queue, fw. Direct na invoer
  retained, daarna uploadstatus bijwerken.
- Tab **Meting invoeren**: raster 8 knoppen (laatste waarde + houdbaarheid),
  numpad, eenheid, meetmoment (nu / 1 u / 2 u / 4 u / gisteren), bevestiging,
  extra bevestiging buiten waarschuwingsbereik, buiten fysiek bereik geblokkeerd.
  Na opslaan: "Opgeslagen - wordt geupload" → Overzicht.
- Tab **Historie**: laatste 50 van dit paneel, uploadstatus; tik → pop-up.
  Rijen 1/tick (geen 50 creates in één klik).
- Overzicht: 8 extra tegels (scroll; status/nav zweven). Tik → meet-pop-up
  (houdbaarheid, upload, knop nieuwe meting). Sensortegels ongewijzigd.
- Instellingen: MOCK aan/uit (NVS). Statusbalk toont `qN` bij wachtende uploads.
- M1.5–M1.8 ongewijzigd: taken/water_changes, ventilatie 0/1/2/auto, energiestand,
  pop-up+24u+tegelraster, geen tik-ergens/rode stip, C6-skip, DMA, geen HTTP in
  LVGL, geen snapshot op LVGL-stack, labels niet klikbaar.
- Firmware `0.2.0-m2a`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit. Niet geflasht.

### 0.2.0-m2b — crash “Weet je het zeker?” (Load access fault)
- **Hardware (Jorrit, 0.2.0-m2a):** tik onderaan (y=596) op Ja/Annuleren in de
  extra bevestiging bij waarde buiten waarschuwingsbereik → `Guru Meditation
  Load access fault` in `lv_obj_mark_layout_as_dirty` / `lv_obj_class_init_obj`,
  `on_warn_yes` / `on_warn_no`, `A0=0 A1=0 MTVAL=0x2a`. Zelfde klasse als m15i:
  NULL/dode parent bij create, of overlay-wissel in dezelfde LVGL-click als
  hide van de aangeklikte boom.
- **Oorzaak:** warn-Ja verbergde `s_warn` en riep in dezelfde click `show_confirm`
  (`move_foreground` + unhide); warn-Annuleren deed hetzelfde naar de numpad.
  Numpad/warn/confirm hingen als siblings aan `s_scr` (chrome + 8 tegels + nav).
- **Fix:** overlays op **één host** (eenmalig bij scherm-create, niet in een
  click). Volgende stap via `lv_timer` 50 ms (niet periode 0 / niet
  `lv_async_call`). Geen `lv_obj_create` zonder `lv_obj_is_valid(parent)`.
  Click-handlers zetten alleen de stap; hide/show gebeurt in de timer.
  Labels niet klikbaar. `MeasSnapshot` blijft PSRAM. Geen HTTP in LVGL.
  Wachtrij + MOCK ongewijzigd. M1.5–M1.8 ongewijzigd. Geen zware dialog-create
  in één tick (modals al klaar).
- Firmware `0.2.0-m2b`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit. Niet geflasht.

### 0.2.0-m2c — crash “Weet je het zeker?” (m2b onvolledig)
- **Hardware (Jorrit, 0.2.0-m2b):** na schone boot tik Ja op “Weet je het zeker?”
  → zelfde `Load access fault` in `lv_obj_mark_layout_as_dirty` /
  `lv_obj_class_init_obj`, `on_warn_yes` / `on_warn_no`, `A0=0`.
- **Oorzaak:** m2b zette de stap wel via een 50 ms-timer, maar die timer
  verborg daarna alsnog `s_warn` (parent van Ja/Annuleren) en deed
  `move_foreground` op de overlay-host. Hide/raise van de aangeklikte boom
  terwijl LVGL de click nog afhandelt (of indev de knop nog vasthoudt) blijft
  dezelfde NULL-parent-create. Bovendien stak de FLOATING nav-balk door de
  overlay heen (tik y≈575).
- **Fix:** numpad/warn/confirm blijven eenmalig pre-created. Click-handlers
  zetten alleen de stap. Timer 80 ms unhidet de volgende overlay; de vorige
  blijft staan. Een tweede timer-tick (`HidePrev`) verbergt pas daarna de
  oude overlay. Geen `lv_obj_delete` / `clean` / recreate, geen
  `move_foreground` op `s_scr`, geen hide van warn in `on_warn_yes` /
  `on_warn_no` of in de eerste confirm-tick. Overlay-host is FLOATING +
  klikbaar als hij zichtbaar is. Annuleren op de waarschuwing unhidet de
  numpad zonder de ingevoerde waarde te wissen.
- Firmware `0.2.0-m2c`. Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit.
  Niet geflasht.

### 0.2.0-m2d — crash bij tab “Meting invoeren” (create in click)
- **Hardware (Jorrit, 0.2.0-m2c):** tik onderaan nav (513,589) op Overzicht →
  `Load access fault` in `lv_label_create` / `lv_obj_class_init_obj(NULL)`,
  `make_modal` (confirm-tekst) in `screen_entry_create`. Daarna `SW_CPU_RESET`.
- **Oorzaak:** eerste tab-click deed `on_nav` → `ui_root_show(Entry)` →
  `screen_entry_create()` in dezelfde LVGL-click. Hele scherm + numpad + twee
  `make_modal`-bomen in één tick op intern heap (`work_mem_int`).
  `lv_obj_class_create_obj` gaf NULL (OOM); LVGL 9 doet `init_obj(NULL)`.
  m2c-timerfix gold alleen de warn-stap, niet deze first-open create.
- **Fix:** invoerscherm één keer via 80 ms-boot-timer in `ui_root_init`, nooit
  in een click. Tab click doet alleen `lv_screen_load` van het bestaande
  scherm (of wacht op de timer). Overlays (numpad, balken, warn, confirm)
  gestaggerd per 50 ms; `make_modal` draait niet twee keer en niet vanuit
  een event. Create-helpers checken parent + intern heap vóór `lv_*_create`.
  Geen delete/recreate bij tab-wissel. m2c-regel blijft: click zet alleen
  stap + timer.
- Firmware `0.2.0-m2d`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit. Niet geflasht.

### 0.2.0-m2e — boot-loop in overlay_build (LVGL-pool 64 KB)
- **Hardware (Jorrit, 0.2.0-m2d):** twee boots (PANIC-skip-wifi én POWERON+wifi)
  crashen ná `invoerscherm-shell klaar`. Stack: `overlay_build_cb` →
  `make_modal`/`make_btn` → `safe_obj` → `lv_obj_create` →
  `lv_obj_class_init_obj(NULL)`. ESP-intern heap ~379–404 KB vrij; dat is
  dus niet de limiter.
- **Oorzaak:** LVGL 9 builtin TLSF (`CONFIG_LV_USE_BUILTIN_MALLOC`,
  `LV_MEM_SIZE` 64 KB). Die pool is vol na Overzicht+idle+invoerscherm-shell.
  `lv_obj_create` doet intern `create_obj` + `init_obj`; bij NULL crasht
  `init_obj` vóór `safe_obj` de pointer ziet. Twee `make_modal`-bomen
  (warn+confirm) plus numpad was te veel voor 64 KB.
- **Fix:** `CONFIG_LV_USE_CLIB_MALLOC` (C-malloc; `SPIRAM_USE_MALLOC` mag
  PSRAM gebruiken). Geen `LV_MEM_SIZE`-verhoging, hosted-DMA-reserve
  ongewijzigd 32 KB. `safe_obj`/`safe_label` via `lv_obj_class_create_obj`,
  NULL-check, dan pas `init_obj`. Eén herbruikbare dialog i.p.v. twee
  modals. Overlay-timer blijft; create-falen logt en slaat over, geen
  boot-loop. Numpad dezelfde NULL-safe create.
- Firmware `0.2.0-m2e`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit. Niet geflasht.

### 0.2.0-m2f — invoer-popup: moment van meten over knoppen
- **Hardware (Jorrit, 0.2.0-m2e):** tab Meting invoeren opent, popup verschijnt,
  geen crash. Layout-fout: “moment van meten” (y=528) lag over Volgende/Annuleren.
- **Fix (alleen layout):** overlay vult het content-gebied (status+nav blijven).
  Van boven naar beneden, vaste rijen zonder overlap: parameter + waarde +
  eenheid; numpad (resterende ruimte, toetsen 64 px); eigen rij “moment van
  meten”; vaste footer Volgende/Annuleren. Gedrag ongewijzigd (KH-waarschuwing,
  bevestigen, wachtrij, MOCK).
- Firmware `0.2.0-m2f`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit. Niet geflasht.

### 0.2.0-m2g — invoer in twee stappen
- **Hardware (Jorrit, 0.2.0-m2f):** geen overlap meer, maar te krap: header
  (parameter + bereik + waarde + eenheden) + numpad + moment van meten +
  footer in 480 px tussen status en nav.
- **Fix:** zelfde pre-created numpad + 1 dialog. Stap 1 waarde (titel+bereik
  op één regel, grote waarde, eenheid alleen bij 2 units, numpad 64 px,
  Volgende/Annuleren; geen tijdrij). Stap 2 moment (samenvatting + 5 grote
  keuzes in 2+3, Volgende/Terug; Terug houdt de getypte waarde). Daarna
  bestaande warn/confirm/wachtrij/MOCK. Geen create/delete in click.
- Firmware `0.2.0-m2g`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit. Niet geflasht.

### 0.2.0-m2h — live-upload naar water_parameters
- **Oorzaak van MOCK-only:** `manual-measurement` bestond niet; live-POST gebruikte
  Bearer-anon (werkt niet: RLS + `esp_http_client` Bearer). REST
  `/rest/v1/water_parameters` eist user-JWT — zelfde valkuil als water_changes.
- **Pal-app** (`C:/Users/Jorrit/Documents/GitHub/koi-pond-pal`): Edge Function
  `supabase/functions/manual-measurement` toegevoegd, auth als `task-close`
  (`X-HA-Token` → `device_tokens` → service role insert). `verify_jwt = false`.
  **Nog niet gedeployed** (Jorrit deployt zelf).
- Mapping paneel → `water_parameters.parameter_type`: `nitriet`→`nitrite`,
  `nitraat`→`nitrate`, `fosfaat`→`phosphate`, `tan`→`ammonia`, `kh`/`gh`/`ph`
  ongewijzigd. `zout` bestaat niet in de DB-CHECK → HTTP 400, Historie
  "afgewezen", geen retry. `user_id` uit het token; `notes` = `via paneel`
  (+ `client_id` voor idempotentie).
- Firmware: live-POST gebruikt `http_perform` (`X-HA-Token`), niet Bearer-anon.
  MOCK-toggle blijft (default aan tot NVS anders zegt). Geen nieuwe UI.
- Firmware `0.2.0-m2h`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit. Niet geflasht.

### Getest op hardware
0.2.0-m2a: crash bij waarschuwing Ja/Annuleren bevestigd (Jorrit).
0.2.0-m2b: zelfde crash bij Ja bevestigd (Jorrit).
0.2.0-m2c: crash bij eerste tik op tab Meting invoeren bevestigd (Jorrit).
0.2.0-m2d: boot-loop in overlay_build bevestigd (Jorrit, 2×).
0.2.0-m2e: tab + popup zonder crash bevestigd (Jorrit). Layout: overlap moment/knoppen.
0.2.0-m2f: geen overlap, wel te krap (Jorrit).
0.2.0-m2g: twee-stappeninvoer bevestigd (Jorrit).
0.2.0-m2h: **live-upload bevestigd (Jorrit, 4 okt 2026).** MOCK uit, POST
  `manual-measurement` → rij in `water_parameters`, eenheid `°dH` klopt.

### Open — M2-restpunten (al gebouwd, nog niet hardware-getest)
Firmware had deze M2-eisen al in 0.2.0-m2a; niet opnieuw gebouwd. Mag meelopen
met het flashen van **0.3.0-m3c**:
- HA: apparaat "Koi IoT Paneel", per parameter een sensor + diagnostiek,
  retained na HA-herstart.
- Historie-pop-up; Overzicht-tegel → "Nieuwe meting invoeren".
- Offline-wachtrij: wifi uit + invoer → één upload na reconnect; herstart
  houdt NVS-wachtrij.

### Open — TODO
- B6: catalogus afstemmen op testers (Hanna/Colombo) en app-sleutels.
- `latest_measurements` in ha-status: tolerant geparsed als het er is.

## M3 — Instellingen en onderhoud

### 0.3.0-m3a — Info, vijverinhoud, herstart
- Tab Instellingen scrollbaar (status/nav blijven). Secties: Scherm (M1.7),
  Backend MOCK, **Vijver** (inhoud, default 13.500 L, NVS), **Info**
  (`panel_id`, firmware, IP, RSSI, uptime, vrij intern/PSRAM), **Onderhoud**
  met herstartknop. Bevestiging "Paneel herstarten?" pre-created; Ja/Annuleren
  via 80 ms-timer (geen create/hide in de click). T1 sluit de pop-up als
  Annuleren. Scherm wordt na invoerscherm via boot-timer gebouwd, niet in
  de tab-click.
- M2 ongewijzigd: live `manual-measurement`, twee-stappeninvoer, wachtrij,
  MQTT-discovery. Hosted 2.7.0, niet geüpgraded. C6-skip/DMA ongewijzigd.
- Firmware `0.3.0-m3a`. `idf.py build` (ESP-IDF v5.5.4, esp32p4): **schoon**.
  `secrets.h` niet gecommit. Niet geflasht.

### 0.3.0-m3b — Instellingen scrollt
- Hardware: Instellingen scrollde niet. Oorzaak: swipe op labels/lege ruimte
  ging naar het scherm (`SCROLLABLE` uit), de binnenlijst had `CLICKABLE` uit,
  en de FLOATING herstart-host (1024×600) kon drags vangen. Fix: status + nav
  blijven vast; daartussen één verticale scroller 1024 × (600−48−72); alle
  secties als kinderen; bevestiging niet FLOATING als die dicht is. Knoppen
  houden `SCROLL_CHAIN`. Firmware `0.3.0-m3b`. **Scroll bevestigd (Jorrit, 4 okt 2026).**

### 0.3.0-m3c — Wifi runtime (scan + wachtwoord)
- Sectie **Wifi** bovenaan de m3b-scroller (status/nav vast). **Zoeken**
  start `esp_wifi_scan_start` in `net_task` (geen scan in LVGL). Resultaten
  (max 12 unieke SSID’s, sterkste RSSI) via cyclus-knop **Netwerk**.
- Wachtwoord: **geen** `lv_keyboard` / grote buttonmatrix. Overlay
  pre-created (groep abc/ABC/123/tekens + teken + Toevoegen/Wissen).
  Click zet alleen een stap; show/hide via 80 ms-timer.
- NVS-namespace `wifi` (`ssid`/`pass`) gaat voor op `secrets.h`. Leeg
  wachtwoord bij dezelfde SSID = huidig houden. Open netwerk: geen pass.
  **Verbinden** zet een vlag; `net_task` slaat NVS op en doet
  `bsp_wifi_connect` (geen `esp_wifi_*` vanuit LVGL).
- C6-skip / hosted 2.7.0 / DMA-reserve 32 KB ongewijzigd. Wachtwoord
  wordt niet gelogd. `secrets.h` niet gecommit.
- Firmware `0.3.0-m3c`. **Wifi-runtime bevestigd (Jorrit, 4 okt 2026).**

### 0.3.0-m3d — MQTT runtime
- Sectie **MQTT** in de m3b-scroller (na Wifi): status verbonden/niet, host,
  poort, gebruiker (niet het wachtwoord). Velden via dezelfde teken-overlay
  als wifi (abc/ABC/123/tekens + Toevoegen/Wissen). Geen `lv_keyboard`.
- NVS-namespace `mqtt` (`host`/`port`/`user`/`pass`) gaat voor op
  `app_config.h` / `secrets.h`. Leeg wachtwoord bij Toepassen = huidig houden.
- **Toepassen** zet alleen een vlag; `net_task` slaat NVS op en herbouwt de
  MQTT-client (stop/destroy/init, start bij wifi-IP). Geen MQTT in LVGL.
  Toepassen zonder wijziging reconnect alsnog.
- `device_id`, device-token en OTA niet in deze slice. Wifi, scroll,
  herstart, MOCK, Info, vijver ongewijzigd. Hosted 2.7.0, niet geüpgraded.
- Firmware `0.3.0-m3d`. **MQTT-runtime bevestigd (Jorrit, 4 okt 2026).**

### 0.3.0-m3e — device-token
- Sectie **Backend** (na Scherm): MOCK blijft; **Device-token** gemaskeerd
  (`****` + laatste 4). Wijzig via dezelfde teken-overlay als wifi/MQTT
  (abc/ABC/123/tekens + Toevoegen/Wissen). Geen `lv_keyboard`.
- NVS-namespace `back` (`token`) gaat voor op `KOISENSEI_HA_TOKEN` in
  `secrets.h`. Leeg token bij Toepassen = huidig houden. Toepassen schrijft
  NVS en zet `backend_client_request_fetch` (geen HTTP in LVGL).
- `backend_client` leest het token bij elke ha-status / task-close /
  manual-measurement. Volledige token wordt niet gelogd (wel len + last4).
- `device_id` / topic-filter en OTA niet in deze slice (brief zet
  `device_id` bij de sensormodule, niet bij het token). Wifi, MQTT, scroll,
  herstart, MOCK, Info, vijver ongewijzigd. Hosted 2.7.0, niet geüpgraded.
- Firmware `0.3.0-m3e`. **Device-token bevestigd (Jorrit, 4 okt 2026).**

### 0.3.0-m3f — OTA + rollback (R8)
- Partitietabel ongewijzigd: factory + ota_0 + ota_1 elk 0x3F0000, otadata
  8K. Geen hosted-upgrade, DMA-reserve 32 KB blijft.
- `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`: nieuwe image start als
  `PENDING_VERIFY`. Na UI-up: `esp_ota_mark_app_valid_cancel_rollback`.
  Crash/stroom-eraf vóór die call → bootloader terug naar vorige slot.
- `io/ota_client`: eigen taak, `esp_https_ota`, cert-bundel. Geen LVGL
  vanuit HTTP. Voortgang via snapshot + 250 ms-refresh. Weigert niet-
  HTTPS, lege URL, en image waarvan `project_name` ≠ `koi_iot_paneel`.
  IDF valideert daarnaast chip/magic (esp32p4). Fout = log + UI, oude
  firmware blijft.
- Instellingen **Firmware / OTA**: versie, draaiende partitie, URL
  (zelfde teken-overlay als wifi, `/` bij tekens, geen `lv_keyboard`),
  knop **Controleren / Installeren**. Succes: bestaande herstart-dialog
  via 80 ms-timer. URL in NVS `ota`/`url`; leeg = vorige houden.
- Wifi, MQTT, token, scroll, herstart, MOCK, Info, vijver ongewijzigd.
  Hosted 2.7.0, niet geüpgraded. `secrets.h` niet gecommit.
- Firmware `0.3.0-m3f`. `idf.py build` in de ESP-IDF-terminal van Jorrit
  (Cursor-agent: Device Guard blokkeert `riscv32-esp-elf-g++.exe`, error 4551).
  `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y` staat in sdkconfig. Niet geflasht.

### Open — nog niet in deze slice
- `device_id` / MQTT-topicfilter in Instellingen.
- B6 catalogus (Hanna/Colombo) — beslissing van Jorrit, geen code.

### Open — te doen door Jorrit
0. **Eerst bouwen** in de ESP-IDF-terminal (niet via Cursor-agent):
   `cd C:\esp\koi-iot-paneel ; idf.py build`
   Device Guard blokkeert `riscv32-esp-elf-g++.exe` vanuit de agent (4551).
1. Flashen (niet door Cursor): `idf.py -p COM6 flash monitor`. Eerst beide
   USB-C eraf, 5 s, verse POWERON. Hosted niet upgraden. Firmware `0.3.0-m3f`.
   Deze USB-flash zet ook de bootloader met rollback (nodig voor R8).
2. Tab **Instellingen**, sectie **Firmware / OTA**: versie `0.3.0-m3f`,
   partitie `factory` (eerste USB-flash). Swipe, wifi, MQTT, token,
   herstart blijven. Geen crash, geen `task_wdt`, geen toetsenbord.
3. **Zelfde image als test:** host `build/koi_iot_paneel.bin` via HTTPS
   (geldig cert, geen self-signed). URL invoeren, **Controleren /
   Installeren**. Voortgang in de statusregel. Bij succes: dialog → Ja
   → herstart. Daarna partitie `ota_0`, log `image bevestigd` /
   `rollback geannuleerd`.
4. **Foutpad:** foute URL / HTML-pagina / ander project → foutmelding,
   geen herstart, blijft op huidige partitie.
5. **Rollback zonder crash-image:** na OTA-herstart meteen beide USB-C
   eraf (vóór het dashboard / `image bevestigd`). Volgende POWERON moet
   terug naar de vorige partitie (`factory`).
6. Wifi, MQTT, token, MOCK, vijver, herstart-bevestiging blijven werken.

## M4 — Automatiseringen
Alleen op expliciete opdracht van Jorrit.
