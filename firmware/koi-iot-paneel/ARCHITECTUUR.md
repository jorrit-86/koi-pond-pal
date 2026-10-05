# KOIoT Paneel — Architectuur

*Bijgehouden per mijlpaal (W5). Stand: M3f gebouwd (0.3.0-m3f, OTA + rollback).*

Bouwinstructie en eisen: `docs/koi-iot-paneel-cursor-brief.md`. Dit document legt vast **hoe** het
gebouwd is en **welke beslissingen** genomen zijn.

---

## 1. Hardware en toolchain

| Onderdeel | Waarde | Bron |
|---|---|---|
| Board | Elecrow CrowPanel Advanced 10.1" ESP32-P4 HMI (DHE04310D), **hardwareversie V1.2** | Jorrit (beslissing B1) |
| SoC | ESP32-P4, 16 MB flash, 32 MB PSRAM (HEX-modus) | Elecrow-sdkconfig |
| Wifi | ESP32-C6 co-processor via **esp_hosted over SDIO** (`esp_wifi_remote`) | Elecrow Lesson16 |
| ESP-IDF | **v5.5.4** (`C:\esp\v5.5.4\esp-idf`) | vendor `idf_component.yml` pint 5.5.4 |
| Toolchain | riscv32-esp-elf gcc 14.2.0 (esp-14.2.0_20260121), cmake 3.30.2, ninja 1.12.1 | Espressif-installer |

Gepinde componentversies (identiek aan Elecrow Lesson16 V1.2; `dependencies.lock` is letterlijk overgenomen):

| Component | Versie |
|---|---|
| espressif/esp_hosted | 2.7.0 |
| espressif/esp_wifi_remote | 0.16.1 |
| espressif/esp_lcd_ek79007 | 1.0.2 |
| espressif/esp_lcd_touch_gt911 | 1.1.3 (esp_lcd_touch 1.2.1) |
| lvgl/lvgl | 9.1.0 |
| espressif/esp_lvgl_port | 2.6.0 |
| (transitief) eppp_link 1.1.6, wifi_remote_over_eppp 0.3.3, esp_serial_slave_link 1.1.2, cmake_utilities 0.5.3 | |

**Niet upgraden** zonder de C6-firmware mee te nemen (brief §3, valkuil esp_hosted-versie).

### 1.1 Pinnen en board-instellingen (uit Elecrow, niet zelf bedacht — W3/W4)

| Functie | Pin/waarde | Waar vastgelegd |
|---|---|---|
| I2C (touch + externe poort) | SDA 45, SCL 46, poort 0, interne pull-up aan | `components/bsp_i2c/Kconfig` |
| GT911 touch | RST 40, INT 42, adres `ESP_LCD_TOUCH_IO_I2C_GT911_ADDRESS` | `components/bsp_display/Kconfig`, `bsp_display.c` |
| Backlight | GPIO 31, LEDC PWM 30 kHz, 11-bit | `components/bsp_display/Kconfig` |
| Display | MIPI-DSI 2 lanes, 900 Mbps, DPI 51 MHz, 1024×600 RGB565, EK79007 | `bsp_display.c` |
| LDO3 | 2,5 V (MIPI-DSI PHY) | `main/main.cpp` (zoals vendor `main.c`) |
| esp_hosted SDIO naar C6 (**V1.2**) | slot 1, 4-bit, 40 MHz, CMD 19, CLK 18, **D0 17, D1 16, D2 15, D3 14**, reset GPIO 54 (actief hoog), reset-delay 1500 ms, slave-reset bij elke boot | `sdkconfig.defaults` (uit Elecrow-sdkconfig) |

Let op bij de SDIO-pinnen: de Espressif-defaults voor de P4 zijn D0..D3 = 14/15/16/17; de V1.2-print
heeft ze **omgekeerd**. In de esp_hosted-2.7.0-Kconfig zijn alleen de
`CONFIG_ESP_HOSTED_PRIV_SDIO_PIN_*_SLOT_1`-symbolen instelbaar; `CONFIG_ESP_HOSTED_SDIO_PIN_*` zijn
afgeleid. Daarom staan in `sdkconfig.defaults` de `PRIV_*_SLOT_1`-varianten. Na `idf.py reconfigure`
is de gegenereerde `sdkconfig` in de secties ESP_HOSTED / SPIRAM / ESPTOOLPY / PARTITION_TABLE /
ESP32P4 / BSP identiek aan de Elecrow-sdkconfig (geverifieerd met een regel-voor-regel diff).

### 1.2 sdkconfig-beslissingen

| Instelling | Waarde | Waarom |
|---|---|---|
| `CONFIG_ESPTOOLPY_FLASHSIZE_16MB`, DIO, 80 MHz | 16 MB | Elecrow-sdkconfig; stond niet in hun defaults |
| `CONFIG_PARTITION_TABLE_CUSTOM` → `partitions.csv` | nvs 16K, otadata 8K, phy_init 4K, factory/ota_0/ota_1 elk 4032K | Elecrow; OTA met rollback (M3f); maten ongewijzigd |
| `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE` | aan (M3f, R8) | Nieuwe image = PENDING_VERIFY tot `esp_ota_mark_app_valid_cancel_rollback` na UI-up. Geen anti-rollback (secure_version). |
| `CONFIG_ESP32P4_SELECTS_REV_LESS_V3`, REV_MIN_100, REV_MAX_FULL=199 | overgenomen | Brief §3: niet opschonen |
| `CONFIG_SPIRAM_MODE_HEX` | HEX | Elecrow-defaults zegt `QUAD`, maar dat symbool bestaat niet voor de P4 (`esp_psram/esp32p4/Kconfig.spiram` kent alleen HEX); de werkende Elecrow-sdkconfig heeft HEX |
| CPU 360 MHz, L2-cache 128 KB/64 B | overgenomen | Elecrow-sdkconfig |
| `CONFIG_COMPILER_OPTIMIZATION_DEBUG` (-Og) | Elecrow-default | Bewust nog niet naar -O2/-Os; kan later als LVGL-performance dat vraagt |
| `CONFIG_ESP_TASK_WDT_EN/INIT`, timeout **10 s** (Elecrow: 5 s) | KOIoT (R6) | `net_task` is bij de TWDT aangemeld; esp_hosted-RPC's naar de C6 kunnen enkele seconden blokkeren |
| `CONFIG_ESP_MAIN_TASK_STACK_SIZE=8192` (Elecrow: 3584) | KOIoT | app_main doet C++-init en display-init |
| `CONFIG_SPIRAM_MALLOC_RESERVE_INTERNAL=32768` (Elecrow) | KOIoT (0.1.5-m15h) | 96 KB (m15f) sneed de contiguous intern+DMA-heap; m15g grootste blok 212 KB. Terug naar 32 KB. Hosted blijft 2.7.0 |
| `CONFIG_LV_FONT_MONTSERRAT_14/20/24/30/42/48`, default 24 | KOIoT | startscherm; alleen ASCII (eigen Latin-1-fonts volgen, brief §7) |
| `CONFIG_LV_USE_KEYBOARD` | **uit** (0.1.5-m15m) | `lv_keyboard` = buttonmatrix met tientallen toetsen; `allocate_button_areas_and_controls` in één create triggert TWDT. Tekstvelden: cyclus-presets + Overslaan. textarea/buttonmatrix blijven aan (LVGL-msgbox/spinbox), maar het paneel maakt ze niet aan |
| `CONFIG_LV_USE_CLIB_MALLOC` | KOIoT (0.2.0-m2e) | Builtin TLSF 64 KB vol na Overzicht+idle+invoer-shell. C-malloc via `SPIRAM_USE_MALLOC` (PSRAM). Geen `LV_MEM_SIZE`-verhoging. Hosted-DMA-reserve 32 KB ongewijzigd |
| `CONFIG_LV_USE_LINE` | **aan** (M1.8) | lijngrafiek in de meetgegevens-pop-up (`lv_line`, geen `lv_chart`) |
| `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE` (full) | KOIoT (M1.5) | HTTPS naar Supabase `ha-status` |
| `CONFIG_LWIP_SNTP_MAX_SERVERS=1`, update 3600 s | IDF-default | R5 |

Alle overige waarden zijn gelijk aan de Elecrow-sdkconfig (KOIoT-afwijkingen: TWDT 10 s,
main-stack 8192, extra LVGL-fonts, cert-bundel; DMA-reserve weer 32 KB zoals Elecrow).
Geen `lv_keyboard` (m15m).

---

## 2. Projectstructuur (M1.8)

```
koi-iot-paneel/
  CMakeLists.txt              MINIMAL_BUILD + EXTRA_COMPONENT_DIRS components (zoals Elecrow)
  sdkconfig.defaults          zie 1.2
  partitions.csv              letterlijk Elecrow
  dependencies.lock           letterlijk Elecrow (gepinde versies), gecommit
  .gitignore                  build/, sdkconfig*, managed_components/, main/secrets.h
  components/
    bsp_i2c/                  Elecrow; alleen extern "C"-guards toegevoegd
    bsp_display/              Elecrow; extern "C"-guards + swap_bytes=false (M0 weergavebug)
    bsp_wifi/                 Elecrow; extern "C", const char*-signatuur, bsp_wifi_set_auto_reconnect()
  main/
    CMakeLists.txt            C++-bronnen, -Wall -Wextra op eigen code
    idf_component.yml         letterlijk Elecrow
    main.cpp                  app_main: init-volgorde
    app_config.h              compile-time defaults (wifi, SNTP, MQTT, stale-drempels)
    secrets.example.h         template (gecommit); secrets.h lokaal (genegeerd)
    core/app_state.*          gedeelde statusstruct (mutex), snapshot voor de UI
    core/panel_id.*           KOIoT-P-XXXXXX uit eFuse-MAC
    core/net_manager.*        wifi-verbinding, reconnect (R1), start/stop MQTT bij IP
    core/time_sync.*          SNTP + tijdzone (R5)
    core/settings_store.*     NVS: scherm (M1.7), vijver (M3a), wifi (M3c), MQTT (M3d), token (M3e), OTA-URL (M3f)
    core/screen_manager.*     energiestand Actief/Rust/Uit (§7.6)
    data/diag_store.*         ringbuffer recente MQTT-berichten (ruwe log)
    data/live_store.*         mappingtabel suffix→veld, last_update, DB-startwaarden, vandaag-liter, historie 24u
    data/status_store.*       laatste geldige ha-status in RAM (seizoen, voer, taken)
    data/vent_store.*         laatste ventilatiestand (HA REST, kleine snapshot)
    data/param_catalog.*      handmatige parameters (§8)
    data/measurement_queue.*  NVS-wachtrij + laatste 50 + MOCK-vlag
    io/mqtt_link.*            esp-mqtt: subscribe sensormodule, LWT, switch Paneelscherm, M2 discovery
    io/backend_client.*       HTTPS GET ha-status + ?history=1 + POST task-close + upload (eigen taak)
    io/ha_client.*            HA REST: GET states + POST services (eigen taak; M1.6/M4)
    io/ota_client.*           HTTPS OTA + rollback-bevestiging (M3f, eigen taak)
    ui/ui_root.*              Overzicht + Taken + Instellingen + rustscherm
    ui/ui_chrome.*            statusbalk + 5 tabs (gedeeld)
    ui/ui_numpad.*            numeriek toetsenblok (komma UI; afronden + later M2)
    ui/screen_dashboard.*     Overzicht: tegels + ventilatie + seizoen/voer + open taken
    ui/screen_measure.*       Meetgegevens-pop-up + lijngrafiek (M1.8) + handmatig (M2)
    ui/screen_entry.*         Meting invoeren (M2)
    ui/screen_history.*       Historie laatste 50 (M2)
    ui/screen_tasks.*         Taken: lijst, afronden (optionele invoer), vernieuwen
    ui/screen_idle.*          Rustscherm (tijd, watertemp, open taken; verschuift)
    ui/screen_settings.*      Instellingen: Wifi, MQTT, token, OTA, Scherm, MOCK, vijver, Info, herstart
    ui/screen_boot.*          M1a-diagnosescherm (niet meer in de build)
  vendor/elecrow-lesson16-bsp/  onaangeroerde Elecrow-bron (referentie; niet in de build)
  docs/                       brief
```

`vendor/` doet niet mee in de build (staat niet in `EXTRA_COMPONENT_DIRS`).

---

## 3. Runtime-ontwerp

### 3.1 Init-volgorde (`main.cpp`, volgt Elecrow `main.c`)

1. Bootbanner (fw-versie, chiprevisie, flashgrootte, resetoorzaak)
2. LDO3 2,5 V (`esp_ldo_acquire_channel`)
3. `nvs_flash_init` (met erase bij versie-/pagina-fout)
4. `app_state_init`, `diag_store_init`, `live_store_init`, `panel_id_init`, `vent_store_init`,
   `settings_store_init`, `ota_client_init` (NVS + partitie-log; klein, geen DMA)
5. `i2c_init` → `touch_init` → `display_init` (Elecrow; `display_init` doet `lvgl_port_init`, DSI-display en touch-indev toevoegen, backlight 0)
6. **Direct** `net_manager_init` (`bsp_wifi_init` …) **alleen bij POWERON** (of andere reset
   zonder hosted-fail-guard). Hosted SDIO-RX alloceert uit interne DMA-heap
   (`sdio_rx_get_buffer` / `_h_malloc_align` INTERNAL\|DMA). Heap (inclusief grootste intern+DMA-blok)
   wordt hier gelogd. Na hosted-assert/0x107 (`SW_CPU_RESET`/`PANIC` + RTC-guard): **geen**
   `bsp_wifi_init`, geen 8 s pauze. Wifi/MQTT overslaan tot echte POWERON (beide USB-C).
   Dashboard + oranje banner “Wifi wacht op stroom-eraf (C6)”.
7. `time_sync_init` (TZ, `esp_netif_sntp_init` met `start=false`; heeft de TCP/IP-stack uit stap 6 nodig)
8. `mqtt_link_init` + `backend_client_init` + `ha_client_init` + `ota_client_start` (HTTP/OTA nog niet; start pas bij GOT_IP; `ota_client_init` eerder, geen DMA)
9. `status_store_init` — PSRAM-snapshot, **geen INTERNAL-fallback** (dat at DMA vóór hosted-RX)
10. `ui_root_init` (Overzicht; rustscherm-objecten; Taken/Instellingen pas bij tab; lekbanner;
    refresh-timer 250 ms; UI-snapshot in PSRAM; pointer-hook voor T1 / wekken)
11. `screen_manager_init` — Actief, backlight uit NVS (default 80%)
11b. `ota_client_confirm_running` — PENDING_VERIFY → geldig (R8)
12. `net_manager_start` + `backend_client_start` + `ha_client_start` (MQTT, ha-status en HA-ventilatie starten pas bij GOT_IP)

M1a bouwde eerst het zware diagnosescherm en daarna pas wifi. Dat gaf op hardware `assert failed: sdio_rx_get_buffer sdio_drv.c:830 (*buf)`: de eerste hosted-RX-buffer kwam niet uit de interne DMA-heap. Lesson16 maakt de app-UI pas ná `bsp_wifi_init`. **M1b houdt die volgorde:** display_init → wifi/hosted → daarna dashboard. Niet omdraaien.

`live_store_init` (mutex + NVS-read middernachtstand) vóór I2C/display gebruikt geen DMA en
breekt SDIO niet. Grotere DROM (dashboard/mapping) krimpt de hosted-heap niet; log vóór wifi.

Bekende C6-valkuil: na flash of hosted-crash blijft de C6 vaak ziek tot **beide USB-C eraf**.
Hosted 2.7.0 reset de P4 zelf bij SDIO 0x107 / geen INIT-event (`Host is reseting itself`).
GPIO54-reset is geen stroom eraf. Na SW_CPU_RESET of PANIC tijdens hosted-init: wifi/MQTT
overslaan tot POWERON; het dashboard blijft bruikbaar. Een 8 s retry (m15f) triggert opnieuw
hosted-self-reset en bevriest de UI op “Wifi start opnieuw…”. Hosted niet upgraden (W4).

### 3.2 Taken

| Taak | Prio | Verantwoordelijkheid |
|---|---|---|
| LVGL (esp_lvgl_port) | `configMAX_PRIORITIES-4`, stack 16 KB | rendering, touch-indev, LVGL-timers (o.a. UI-refresh 250 ms), event-callbacks |
| `net_task` (net_manager) | 5, stack 6 KB, aangemeld bij TWDT | reconnect-beleid, herstart-bewaking, RSSI-poll (5 s), SNTP-bewaking |
| mqtt (esp-mqtt) | IDF-default, stack 8 KB | brokerverbinding, auto-reconnect, subscribe, inkomende publishes |
| `backend` | 4, stack 16 KB | HTTPS GET `ha-status` (15 min + Vernieuwen), GET `ha-status?history=1` (24 u-reeks), POST `task-close`; nooit vanuit LVGL |
| `ha` | 4, stack 8 KB | HTTP GET/POST Home Assistant REST (ventilatie); nooit vanuit LVGL |
| default event loop | IDF | wifi-/IP-events → `on_wifi_event` (status + logging + SNTP/MQTT/backend start/stop) |
| lwIP/tcpip | IDF | SNTP-client; `on_time_synced`-callback |

### 3.3 Threading-regels (brief §5)

- LVGL-aanroepen **alleen** binnen `lvgl_port_lock()/unlock()` (opbouw in `ui_root_init`) of vanuit
  LVGL-timers/event-callbacks (lopen in de LVGL-taak). `screen_dashboard_update` wordt uitsluitend
  door de LVGL-timer aangeroepen.
- Netwerktaken, wifi-eventhandlers en **MQTT-callbacks** raken LVGL **nooit** aan. Status gaat naar
  `AppState`; ruwe berichten naar `diag_store`; gemapte waarden naar `live_store` (eigen mutex).
  De UI leest kopieën (`app_state_snapshot()`, `live_store_snapshot()`, `vent_store_snapshot()`)
  in de 250 ms-timer.
- Geen netwerk in LVGL-callbacks: de UI zet `backend_client_request_fetch/close` of
  `ha_client_request_poll/set_stand` op een FreeRTOS-queue; de `backend`- of `ha`-taak
  voert HTTP uit.
- `StatusSnapshot` (~18 KB bij 24 taken + optionele invoervelden) gaat **niet** by-value op de LVGL-stack (Elecrow
  16 KB) en staat in **PSRAM** (store + UI-kopie). De 250 ms-timer vult die buffer via `status_store_snapshot(&buf)`.
  Tik Gedaan/Gezien/Niet van toepassing: alleen rij-index in `user_data`; id/titel/acties
  staan in `TaskRow` (PSRAM). Bevestigen enqueue't `task_id` + `status`; POST in `backend`.
- Takenkaarten alleen als tab Taken zichtbaar is (Overzicht tekent ze niet). SNTP wijzigt due-labels
  op bestaande kaarten; een nieuwe hash **annuleert** een lopende opbouw (geen “herbouw uitgesteld”
  bovenop 15 bestaande kaarten). Max 1 kaart of 1 due-label per LVGL-tick. Wizard-hervatting unhidet
  nooit alle kaarten ineens: lijst blijft `HIDDEN` tot staggered clear+opbouw. Numpad en
  waterwissel-keuze pas bij tik Gedaan (niet bij boot). Geen `lv_keyboard`.

### 3.4 `AppState` (gedeelde status)

`panel_id`, `wifi` (Idle/Connecting/Connected/Disconnected/WaitPowerCycle), `ssid`, `ip`, `rssi`,
`connect_attempts`, `last_disconnect_reason`, `next_retry_in_s`, `offline_for_s`, `time_synced`,
`mqtt` (Idle/Connecting/Connected/Disconnected/Error), `mqtt_error`.
Live sensorwaarden staan **niet** in `AppState` maar in `live_store`. Ruwe berichten blijven in
`diag_store` (alleen voor logging).

### 3.5 net_manager — reconnect-beleid (R1)

- Elecrow `bsp_wifi` doet de driver-init; het automatische `esp_wifi_connect()` in hun
  disconnect-handler is uitgeschakeld via `bsp_wifi_set_auto_reconnect(false)` zodat het beleid op één
  plek ligt.
- Poging 1: `bsp_wifi_connect(ssid, pass)` (Elecrow-volgorde: stop → set_config → start → connect).
- Bij mislukking/verlies: elke **15 s** (`APP_WIFI_RECONNECT_INTERVAL_S`) `esp_wifi_connect()`;
  elke 8e mislukte poging (`APP_WIFI_FULL_RESTART_EVERY_N`) opnieuw een volledige `bsp_wifi_connect`.
- Een poging zonder resultaat binnen 15 s wordt als mislukt beschouwd.
- **10 min** (`APP_WIFI_RESTART_AFTER_S`) onafgebroken offline (gemeten vanaf boot of vanaf het
  laatste verlies) → log met aantal pogingen en laatste reden → `esp_restart()`.
- Verbonden = `IP_EVENT_STA_GOT_IP` (niet al bij associatie), zoals Elecrow.
- Logging (W7): elke poging (`poging N: ...`), elk succes (`VERBONDEN: IP/netmask/gateway`), elk falen
  met `wifi_err_reason_t`-code én Nederlandse omschrijving (`wifi_reason_text`).
- Bij verbinding wordt ook de wifi-STA-MAC van de C6 gelogd (ter referentie, niet gebruikt voor `panel_id`).
- M3c: scan (`esp_wifi_scan_start`) en netwerkwissel (`bsp_wifi_connect` met NVS-creds)
  alleen in `net_task` / eventloop. UI zet een vlag. Wachtwoord nooit in de log.

### 3.6 time_sync (R5)

- `TZ=CET-1CEST,M3.5.0,M10.5.0/3`, server `pool.ntp.org`, `esp_netif_sntp` met `start=false`.
- Bij elk `GOT_IP`: `esp_netif_sntp_start()` (= `sntp_stop()+sntp_init()`, dus veilig bij reconnect).
- Sync-callback zet `AppState.time_synced=true` en logt de lokale tijd.
- UI toont `--:--` en `-- --- ----` tot de eerste sync; daarna `HH:MM:SS` en `za 26 sep 2026`.
- Na 60 s netwerk zonder sync (`APP_SNTP_WARN_AFTER_S`) één waarschuwing in de log.

### 3.7 panel_id — **beslissing: eFuse-basis-MAC van de P4**

`esp_efuse_mac_get_default()` → laatste drie bytes → `KOIoT-P-%02X%02X%02X`. Redenen: fabrieksmatig
en stabiel, beschikbaar vóór wifi/C6 (dus ook als de C6 niet reageert), zelfde stijl als de
sensormodule (`KOIoT-57226C`). De wifi-MAC van de C6 (`esp_wifi_get_mac`) wordt alleen gelogd.

### 3.8 UI (M1.8-dashboard + Taken + Instellingen)

1024×600, donker (#0E1216), kaarten #1B2229, tekst #E6EDF3, statuskleuren groen/oranje/rood.
- **Statusbalk** (~48 px): klok, datum, wifi (symbool + RSSI), MQTT, app-status
  (`app OK` / `app ...` / `app token` / `app fout`; wachtende uploads volgen in M2).
-   **Navigatie** (~72 px): Overzicht · Taken (badge met aantal open taken) · Meting invoeren ·
  Historie · Instellingen. Alle vijf tabs zijn actief. Labels nooit klikbaar (M1b-les).
- **Tegelraster (M1.8):** 4 gelijke kolommen × 2 rijen in het vlak onder status+banner en boven
  de tabs. Marge 12 px aan alle vier zijden van dat vlak, gap 12 px. Kolom = 241 px, dubbele
  tegel (watertemp, bijvulwater) = 2×kolom+gap = 494 px, rijhoogte 204 px. Ventilatie deelt
  dezelfde celmaat als lucht/pH/open taken.
- **Tegels:** watertemperatuur (2 kolommen, 1 decimaal), lucht (temp + RV), seizoen/voer
  (**alleen als `season`/`feed_band` of `data_ok=false` in ha-status zitten**; anders geen regels),
  bijvulwater (L/min + vandaag), pH ("geen sensor" tot er een gemapt pH-topic is),
  **ventilatie** (titel **Ventilatie** bovenaan; drie knoppen **0 · 1 · 2**, 80 px;
  daaronder knop **Auto aan/uit** voor
  `input_boolean.ventilatie_automatisch`; huidige stand gemarkeerd; seizoen/voer als extra
  regels onder de tegel als die velden er zijn),
  open taken (aantal **vandaag due of overdue** + titel van die taak; tik → tab Taken).
  Badge op tab Taken = hetzelfde aantal, **niet** `open_tasks` uit JSON (toekomst telt niet mee).
  Tik op een sensortegel (of de RV-regel) opent de meetgegevens-pop-up (§7.7 / 3.17).
- Databasewaarde: klein **"laatst opgeslagen"** bij de leeftijd; verdwijnt bij live MQTT.
  Leeftijd vanaf `measured_at`, niet vanaf ophaalmoment.
- **Lekbanner** (~36 px, overlay op Overzicht): bij `flow_leak=ON` rood, volle breedte.
  Lek tijdens Rust/Uit wekt naar Actief.
- Lege/niet-retained velden: **"wacht op data"** tot de eerste waarde (B5). Daarna leeftijd of
  **"verouderd (xx min)"** (30 min temp/RV/pH, 60 s debiet).
- Decimaal in de UI: komma. Eenheid temperatuur: ` C` (ASCII tot eigen fonts).
- Alle teksten ASCII + `LV_SYMBOL_*`; UTF-8 uit de app wordt getranslitereerd.
- **M0 weergavebug:** `.swap_bytes = false` (zie eerder).

### 3.9 mqtt_link (M1a)

- Component: ESP-IDF `mqtt` (esp-mqtt). Buffer in- en uit **2048** B. Auto-reconnect aan (10 s).
  Keepalive 60 s. Client-id = `panel_id` (`KOIoT-P-XXXXXX`).
- Credentials: `MQTT_USER` / `MQTT_PASS` uit `secrets.h`. Gebruiker **`koiiot_paneel`** (B2:
  eigen niet-admin HA-account). Wachtwoord vult Jorrit lokaal in; placeholder `CHANGE_ME` wordt
  gelogd als waarschuwing.
- Start pas bij `IP_EVENT_STA_GOT_IP`. Bij wifi-verlies: `esp_mqtt_client_stop()` zodat we niet
  zonder netwerk op de broker hameren. Bij opnieuw IP: `esp_mqtt_client_start()`. Broker-drop
  terwijl wifi blijft: auto-reconnect van esp-mqtt.
- Subscribe in `MQTT_EVENT_CONNECTED` (dus ook na elke MQTT-reconnect): `koiiot/KOIoT-57226C/#`
  én `koiiot/<panel_id>/scherm/set`.
- LWT retained: `koiiot/<panel_id>/status` = `offline`. Bij connect: `online` (retained) +
  discovery + schermstate opnieuw (R2).
- HA MQTT Discovery: `switch` **Paneelscherm** (`homeassistant/switch/<panel_id>/scherm/config`).
  Command `…/scherm/set` ON/OFF; state `…/scherm/state` retained (ON bij Actief/Rust, OFF bij Uit).
  MQTT-callback zet alleen een vlag; `screen_manager` voert de overgang uit in de LVGL-timer
  (geen LVGL in de MQTT-taak).
- Logging (W7): BEFORE_CONNECT, connect suc/fail, subscribe poging/succes/fail, disconnect,
  elke inkomende publish (topic + payload + lengte + retain), elke eigen publish (topic + len,
  fout met payloadgrootte). TCP-fouten met foutcode;
  broker-weigering met MQTT connect-return-code (o.a. user/pass).
- Gemapte payloads van de **sensormodule** gaan naar `live_store`. Eigen schermtopics gaan niet
  naar live_store. Onbekende suffix: eenmalige logregel `ongemapped topic`.
- Metingen van de sensormodule worden **niet** opnieuw gepubliceerd.

### 3.10 live_store — mappingtabel (M1-log 27 sep 2026)

Payloads zijn **kale getalstrings of ON/OFF**, geen JSON. Suffix = deel na `koiiot/KOIoT-57226C/`.

| Suffix | Veld | Eenheid / vorm | Status |
|---|---|---|---|
| `status` | Status | `online` (tekst) | **bevestigd** |
| `flow_rate` | FlowRate | L/min | **bevestigd** |
| `flow_total` | FlowTotal | L cumulatief | **bevestigd** |
| `flow_leak` | FlowLeak | ON/OFF | **bevestigd** |
| `water_temp` | WaterTemp | 1 decimaal, C | **bevestigd** |
| `air_temp` | AirTemp | 1 decimaal, C | **bevestigd** |
| `humidity` | Humidity | RV % | **bevestigd** |
| — | Ph | pH | **geen mapping** (TODO; suffix niet verzonnen) |

Niet-gemapte suffixes worden eenmalig gelogd (`ongemapped topic: suffix='…'`), zonder harde fout.
pH-kandidaten alleen als commentaar in `live_store.cpp` (W3: niet verzinnen):
`ph` / `pH` / `water_ph`. Zodra een latere log zo'n suffix toont: één rij in `k_map` toevoegen.

`last_update` per veld (`esp_timer`). Stale: 30 min voor temp/RV/pH, 60 s voor debiet
(`APP_STALE_TEMP_S` / `APP_STALE_FLOW_S` in `app_config.h`).

`diag_store` blijft bestaan als ruwe ringbuffer; de UI leest die niet meer.

### 3.11 B5 — retain (vastgelegd, M1-log)

| Topic | Retain | Gevolg na herstart van het paneel |
|---|---|---|
| `koiiot/KOIoT-57226C/status` | ja (1) | direct `online` bij subscribe |
| `flow_rate`, `flow_total`, `flow_leak` | nee (0) | geen flow tot de volgende publicatie (~1 s) |
| `water_temp`, `air_temp`, `humidity` | nee (0) | geen temp/RV tot de volgende publicatie (meetinterval tot 900 s) |
| pH | niet gezien | mogelijk pas na het meetinterval (tot 900 s) |

Aanpassing van retain in de sensormodule valt **buiten** dit project. De UI toont "wacht op data"
tot de eerste waarde per veld (pH: "geen sensor" tot er ooit een waarde binnenkomt).

### 3.12 "Vandaag"-liter (bijvulwater)

`vandaag L` = huidige `flow_total` minus de stand om 00:00 lokale tijd.

**Gekozen regel** (zodat "vandaag" nooit de lifetime-total toont):

1. NVS-namespace `live`: `mid_l` (float, liters) en `mid_ymd` (uint32, lokale YYYYMMDD).
   Overleeft herstart.
2. Alleen als SNTP-tijd synchroon is (R5: nooit een 1970-datum).
3. Geen opgeslagen stand, of opgeslagen dag ≠ lokale dag van nu: bij de **eerste geldige
   `flow_total`** van die lokale dag (eerste na middernacht, of eerste na boot als de tijd al
   synchroon is) wordt die waarde de baseline. "vandaag" start dan op 0 L.
4. Zelfde lokale dag: `vandaag = max(0, flow_total - baseline)`.
5. `flow_total` lager dan de baseline (teller-reset): nieuwe baseline = huidige waarde.
6. Zonder tijdsync: UI toont "vandaag: wacht op tijd".

### 3.13 Beslissingen B2 / B5

| # | Beslissing | Stand |
|---|---|---|
| B2 | Eigen HA-gebruiker voor het paneel | **vastgelegd**: `koiiot_paneel` (niet-admin) |
| B5 | Retained publicatie in de sensormodule | **vastgelegd uit log**: alleen `status` is retained; `flow_*`, `water_temp`, `air_temp` en `humidity` niet. Wenselijke wijziging in de sensormodule, buiten dit project. |

### 3.14 ha-status en task-close (M1.5)

- Endpoint `GET {APP_BACKEND_BASE_URL}ha-status` (`…/functions/v1/ha-status`) met header
  **`X-HA-Token: <KOISENSEI_HA_TOKEN>`** (geen Bearer-anon; 401 = tokenfout, 404 = verkeerd pad).
  HTTPS via `esp_crt_bundle`, timeout 10 s. Parse tolerant (onbekende velden negeren).
- Ophalen bij GOT_IP, daarna elke 15 min, en na tik op Vernieuwen. Laatste geldige antwoord in RAM
  (`status_store`). 401: melding "Token ongeldig - controleer KOISENSEI_HA_TOKEN", lijst niet wissen.
- **Taken (A6):** `tasks[]` met `id`, `title`, `type`, `due_date`, `overdue`, `description`,
  `actions`. Optioneel later: `kind`, `severity`. Knoppen **alleen** uit `actions`:
  `done`→Gedaan/`done`, `seen`→Gezien/`seen`, `dismissed`→Niet van toepassing/`dismissed`.
  Ontbreekt `actions` of `id`: geen knoppen. Vervaldatum als "vandaag"/"morgen"/"N dagen te laat".
  Lijst gegroepeerd: **Vandaag / te laat** (`overdue` of `due_date` ≤ lokale SNTP-dag) vs **Later**.
  Badge en tegel Open taken = aantal in de eerste groep. Zonder SNTP: alleen `overdue` telt als
  "nu" (geen 1970 als vandaag). `open_tasks` uit JSON blijft het totaal (log).
- **Seizoen/voer:** tegel en kop Taken alleen als `season` en/of `feed_band` er zijn (of
  `data_ok=false`). `feed_band` als string of object met `label`; geen extra nested velden verzinnen.
- **`latest_readings` (A8):** array van objecten `{sensor_id, key, value, unit, measured_at}`.
  Alleen A8-sleutels (`water_temp`, `air_temp`, `humidity`, `ph`, `flow_rate`, `flow_total`).
  Object-vorm of andere keys: eenmalig gelogd, niet toegepast. Age vanaf `measured_at`.
  MQTT wint als het meettijdstip nieuwer is (MQTT zonder stempel: ontvangst). MQTT >5 min weg:
  nieuwere DB-waarden bij de poll overnemen. Dit is **één punt per sleutel**, geen 24 u-reeks.
- **24 u-historie (M1.8):** pal-app leest `sensor_data` via REST `/rest/v1/sensor_data`
  (`user_id`, `sensor_id`, `created_at`, kolommen `temperature`/`humidity`/`ph`/`flow_rate`,
  24h: `gte created_at`, `order created_at.desc`, limit 200–1000) met **user-JWT**. Het paneel
  heeft alleen `X-HA-Token` — geen REST (RLS-401). Zelfde tabel via bestaande function:
  `GET {base}ha-status?history=1&interval=300` (optioneel `sensor_id`, `from`, `to` ISO).
  Auth identiek aan ha-status/task-close. Antwoord (na her-deploy):
  `{api_version, generated_at, history:{from,to,interval_s,series:[{key,sensor_id,t[],v[]}]}}`.
  Lege reeks weglaten (pH zonder rijen: geen verzonnen punten). Firmware: één GET ná geslaagde
  ha-status (en bij pop-up tot het binnen is), parse in de backend-taak, ringbuffer vullen;
  daarna MQTT-punten erbij (5 min). Zonder `history`-veld: log “ha-status her-deployen”,
  grafiek 1 punt + “geen 24 u-historie”.
- Eerste succesvolle parse logt één keer de ruwe JSON-vorm (root object vs array, keys,
  `latest_readings`-type, `tasks[0]`-keys en `actions`).
- `POST {base}task-close` met `{task_id, status}` en optioneel `note` (A7). Extra JSON-sleutels
  (`liters_added`, `water_type`, `reason`, of `ph`/`kh`/`nitrite`/`nitrate`) plus object `parameters`
  met dezelfde keys: pal-app waterwissel of watermeting, of een veldschema uit ha-status
  (`fields` / `form` / `extra` / `payload`).
  **Waterwissel** (type/kind `water_change`, of titel waterwissel / water change / water ververs):
  zelfde vragen als de pal-app (`WaterChangePopup`): liters (>0, L), type water, reden, optionele
  opmerkingen. JSON-keys gelijk aan tabel `water_changes`.
  **Watermeting** (type/kind `water_parameters`, of titel watermeting / waterparameter): pal-app
  `ParameterForm` (niet de “al gemeten?”-popup). Max 4 velden: `ph` (verplicht), `kh`, `nitrite`,
  `nitrate` — of een schema uit ha-status. Geen liters. POST `{task_id, status, note, parameters:{…}}`
  plus de veldkeys. `note` krijgt een samenvatting. Overige taken zonder schema: alleen Ja/Annuleren.
  Invoerstap (numpad, keuze, komma UI) **niet in dezelfde LVGL-click** als de volgende
  overlay-create (wizardstap via `lv_async_call`; overlays hangen aan één host, nooit create op
  een dode parent). Keuze (water_type/reden) **en** optionele opmerkingen / andere text-velden:
  **één cyclus-knop** (tik = volgende waarde; notes: leeg / Geen bijzonderheden / Algen) +
  Overslaan of OK. Geen `lv_keyboard`, geen grote `lv_buttonmatrix`. Vaste coords, overlay
  `HIDDEN` tot klaar. Opbouw met `lv_timer` periode 50 ms (niet
  `lv_async_call` periode 0): max 1 `lv_obj_create` per expire. Notes-stap hergebruikt de
  bestaande overlay (geen extra creates). Tijdens de wizard is de
  takenlijst verborgen en wordt niet herbouwd (geen flex-relayout van 15 kaarten). Hervatten na de
  wizard is **geen** show-all: in-flight opbouw wordt geannuleerd, de lijst blijft `HIDDEN` tot
  POST klaar is (2xx verwijdert de taak lokaal, daarna GET ha-status) en staggered clear+opbouw
  (max 1 kaart/tick). `layout_tasks` alleen als de kop wijzigt, niet bij 15 zichtbare kaarten.
  POST via de backend-queue (geen HTTP in LVGL). 2xx: taak meteen uit de lokale lijst (niet wachten
  op GET voor “niet-Bezig”) + opnieuw ha-status. 404 + `error: task_not_found` of 409: "Taak was al afgesloten".
  404 zonder dat veld: endpoint ontbreekt, knoppen blijven, alleen-lezen. HTTP nooit in LVGL-callback
  (alleen queue; crashfix 0.1.5-m15b: geen `StatusSnapshot` in de event-callback).

### 3.15 Home Assistant REST — ventilatie (M1.6)

- Basis-URL `APP_HA_BASE_URL` (`http://192.168.178.58:8123`), lokaal HTTP. Authenticatie
  `Authorization: Bearer <HA_TOKEN>` (long-lived token van `koiiot_paneel`).
  `esp_http_client` krijgt `max_authorization_retries = -1`: een 401 met
  `WWW-Authenticate: Bearer` mag niet intern retried worden (dat gaf eerder 0x106).
- Generieke API in `ha_client`: `GET /api/states/<entity_id>` en
  `POST /api/services/<domein>/<service>` met JSON-body. Eigen taak; UI alleen queue.
- Pollen: 10 s zolang Overzicht in beeld (`ha_client_set_fast_poll`), anders 60 s,
  1 s tijdens bevestiging, en direct na een tik.
- Koppeling knop 0/1/2 ↔ HA-percentage staat in `app_config.h` (interne stand 1/2/3).
  B7: `fan.ventilatie`, KIND=2 (fan %), VALUE 0 / 50 / 100. `supported_features` 49 =
  SET_SPEED + TURN_ON + TURN_OFF, geen PRESET_MODE (`preset_modes` is null). GET leest
  `state` (off → 0%) en `attributes.percentage`. Zetten: `fan.set_percentage`
  (50/100); 0% via `fan.turn_off`. Ander %: tekst, geen knop. KIND 0 = soort
  detecteren uit GET (lege/null `preset_modes` telt niet als preset).
- Automatische stand: aparte entiteit `input_boolean.ventilatie_automatisch`
  (`APP_HA_VENT_AUTO_ENTITY_ID`). GET `/api/states/…` (on/off); POST
  `input_boolean/turn_on` of `turn_off`. Knop onder de standen 0/1/2; HTTP
  in de ha-taak.
- Gedrag: tik toont "bezig" op die knop; markering pas na GET die de nieuwe stand
  toont. Na 10 s of HTTP-fout: terug naar de werkelijke stand + korte melding.
  Stand die niet 0/1/2 is: die tekst, geen knop. Na GET 200: geen "wacht op HA"
  (init-tekst wordt gewist). 401: tokenmelding. HA/wifi weg: tegel grijs,
  "Home Assistant niet bereikbaar" of `HA fout HTTP n`. Idle >15 s na IP:
  "geen antwoord van HA".
- `vent_store`: kleine snapshot (geen PSRAM nodig). HTTP-body in PSRAM.

### 3.16 Energiestand en rustscherm (M1.7)

`screen_manager` kent Actief, Rust en Uit (§7.6 / R7). Tick in de LVGL-timer (250 ms); touch via
één pointer-PRESSED-hook (`lv_indev_wait_release` in Rust/Uit zodat de wek-tik niets bedient).

| Stand | Helderheid | Overgang |
|---|---|---|
| Actief | NVS, default 80% | T1 zonder tik → Rust (of Uit als rustscherm uit) |
| Rust | NVS, default 15% | T2 vanaf begin van Rust → Uit; T2=0 = nooit |
| Uit | PWM 0 (BSP heeft geen aparte backlight-voeding) | tik of HA ON → Actief op Overzicht |

T1/T2, helderheid en rustscherm aan/uit staan in NVS (`settings_store`, namespace `scr`) en in
tab **Instellingen**, sectie Scherm (cyclus-knoppen, o.a. T1=30 s / T2=1 min voor hardwaretest).
Een open pop-up/wizard telt niet als uitzondering: na T1 sluit hij als Annuleren. Zolang
`task-close` of een ventilatie-POST loopt, geen overgang naar Rust. HA-switch OFF idem.

Rustscherm: donkere achtergrond, tijd, watertemperatuur (verouderd volgens §6.1) en aantal open
taken (zelfde telregel als de badge: vandaag due of overdue). Blok verschuift bij binnenkomst en
elke 2 min max ±60 px, geen animatie. Wifi/MQTT/ha-status lopen door bij Uit.

Voorbeeld-HA-automatisering: `docs/ha-paneelscherm.yaml` (placeholder-sensor, B8).

### 3.17 Meetgegevens-pop-up (M1.8)

`ui/screen_measure`: één overlay op Overzicht (niet `lv_layer_top`). Create bij dashboard-init;
open/dicht is show/hide. Geen HTTP, geen `StatusSnapshot` op de LVGL-stack.

- 70% van 1024 px breed, knop Sluiten ≥ 64 px, tik op de dimming eromheen sluit.
- Live bijwerken in de bestaande 250 ms-timer. T1 (§7.6) sluit als Annuleren; tabwissel ook.
- Ringbuffer in `live_store` (PSRAM): per sensorreeks 288 floats, eerst gevuld uit
  `ha-status?history=1` (`sensor_data`, 5 min-buckets), daarna sample vanuit
  `live_store_snapshot` als het veld present is en ≥ 5 min sinds de vorige. Grafiek = `lv_line`
  (punten in PSRAM); hertekenen alleen als het aantal punten verandert. Ontbrekende historie:
  1 punt + “geen 24 u-historie (alleen huidige waarde)”. pH zonder sensor: geen punten.
- Extra watertemp-velden uit `ha-status` (`water_temp_24h`, `water_temp_week`, `trend`)
  tolerant geparsed in `status_store`; ontbreken = regel weglaten.

### 3.18 Handmatige metingen (M2)

Volgorde bij opslaan: NVS-wachtrij → retained MQTT → HTTPS `manual-measurement` (of MOCK).
Geen REST `/rest/v1/water_parameters` (RLS/user-JWT). Catalogus staat alleen in
`param_catalog` (§8 startwaarden; B6 open). Compacte NVS-blob in namespace `meas`
(niet 200 losse keys). UUID v4 via `esp_fill_random`. MOCK default aan, schakelaar
in Instellingen. HTTP in de backend-taak; `X-HA-Token` (zelfde als ha-status /
task-close), geen Bearer-anon. Discovery per parameter onder het paneel-device,
niet onder de sensormodule. Historie-rijen 1/tick. Overzicht extra tegels: scherm
scrollt, status/nav/banners `LV_OBJ_FLAG_FLOATING`.

### 3.19 Instellingen M3c / M3d / M3e

Tab Instellingen is scrollbaar (status/nav FLOATING; M3b). Secties: **Wifi**
(M3c), **MQTT** (M3d), Scherm (M1.7), Backend MOCK + device-token (M3e),
Vijverinhoud (cyclus, NVS `pond`), Info (panel_id, fw, IP, RSSI, uptime, vrij
intern/PSRAM) en herstart met pre-created bevestiging.

**Wifi.** Scan en connect lopen in `net_task` / de wifi-eventloop, nooit in
LVGL. UI zet `net_manager_request_scan` / `request_apply`. Scan: unieke
SSID’s, max 12, gesorteerd op RSSI; open vs beveiligd. Wachtwoord: cyclus
abc/ABC/123/tekens + Toevoegen/Wissen (waterwissel-patroon). Geen
`lv_keyboard`. NVS-namespace `wifi` gaat voor op `secrets.h`. Leeg
wachtwoord bij dezelfde SSID houdt het huidige. Wachtwoord wordt niet
gelogd. Click zet alleen een stap; overlays via 80 ms-timer.

**MQTT (M3d).** Sectie toont host:poort, gebruiker (niet het wachtwoord) en
verbonden/niet. Host, poort, user en wachtwoord zijn runtime bewerkbaar via
dezelfde teken-overlay als wifi. `mqtt_link_request_apply` zet alleen een
vlag; `net_task` slaat NVS op (`mqtt` / host/port/user/pass) en herbouwt de
esp-mqtt-client (stop/destroy/init, daarna start bij wifi-IP). Nooit MQTT
start/stop vanuit LVGL. Leeg wachtwoord bij Toepassen = huidig houden.
NVS gaat voor op `app_config.h` / `secrets.h`. `device_id` volgt later.

**Device-token (M3e).** Backend-sectie toont het token gemaskeerd (`****` +
laatste 4). Wijzig via dezelfde teken-overlay als wifi/MQTT. NVS-namespace
`back` / `token` gaat voor op `KOISENSEI_HA_TOKEN`. Leeg Toepassen houdt het
huidige. `backend_client` leest het token bij elke HTTPS-call; Toepassen zet
alleen `backend_client_request_fetch` (geen HTTP in LVGL). Volledige token
wordt niet gelogd.

**OTA (M3f, R8).** Sectie Firmware / OTA toont `APP_FW_VERSION` en de
draaiende partitie (`factory` / `ota_0` / `ota_1`). URL via dezelfde
teken-overlay (`/` zit bij tekens). NVS `ota`/`url`; leeg = vorige houden.
**Controleren / Installeren** zet alleen een vlag; `ota_client` downloadt
HTTPS in een eigen taak (`esp_https_ota` + cert-bundel). Image moet
`project_name` = `koi_iot_paneel` zijn (CMake `project()`); IDF weigert
verkeerde chip/magic. Succes: bootpartitie zetten + bestaande
herstart-dialog via 80 ms-timer. Na UI-up: `esp_ota_mark_app_valid_cancel_rollback`.
Hosted/C6 wordt niet geüpdatet.

---

## 4. Wijzigingen aan Elecrow-code (W4 — minimaal)

| Bestand | Wijziging | Reden |
|---|---|---|
| `bsp_i2c.h`, `bsp_display.h`, `bsp_wifi.h` | `#ifdef __cplusplus extern "C"`-guards | aanroepen vanuit C++17 |
| `bsp_wifi.h/.c` | `bsp_wifi_connect(const char*, const char*)` (was `char*`) | const-correctheid, geen casts in C++ |
| `bsp_wifi.h/.c` | nieuw `bsp_wifi_set_auto_reconnect(bool)`; disconnect-handler roept `esp_wifi_connect()` alleen aan als de vlag aan staat (default aan = origineel gedrag) | reconnect-beleid R1 in `net_manager` |
| `bsp_i2c.c` | **ongewijzigd** | |
| `bsp_display.c` | `lvgl_port_display_cfg_t.flags.swap_bytes = false` (was `true`) | MIPI-DSI RGB565 in-place swap brak donkere kleuren en veroorzaakte redraw-strepen (M0) |

Bekende waarschuwingen uit Elecrow-/managed code (niet aangepast, breken de build niet):
`esp_lcd_touch_get_coordinates` is deprecated (in `bsp_display.c:114` en `esp_lvgl_port_touch.c:128`).

---

## 5. Configuratie en secrets

- `main/secrets.h` (genegeerd): `WIFI_SSID`, `WIFI_PASS`, `MQTT_USER`, `MQTT_PASS`,
  `KOISENSEI_HA_TOKEN`, `HA_TOKEN` (M1.6, HA REST). Template: `main/secrets.example.h`.
- `main/app_config.h`: fw-versie, MQTT, stale-drempels, backend-URL/poll/timeout, NVS-keys live,
  HA-basis-URL, ventilatie-mapping knop 0/1/2 = 0/50/100 % (`APP_HA_VENT_*`),
  auto-entity `input_boolean.ventilatie_automatisch`, NVS-keys scherm (`APP_SCREEN_NVS_*`),
  tegelraster (`APP_UI_GRID_*`), historie (`APP_HIST_*`) en vijver (`APP_POND_*`).
- Runtime-instellingen: `settings_store` (M1.7: sectie Scherm; M3a: vijver
  `pond`; M3c: wifi `ssid`/`pass`; M3d: MQTT `host`/`port`/`user`/`pass`;
  M3e: device-token `back`/`token`; M3f: OTA-URL `ota`/`url`). Middernachtstand
  blijft in namespace `live`.

---

## 6. Nog niet klaar in M3f (bewust)

M3f: OTA + rollback. `device_id` / MQTT-topicfilter volgt in een latere
M3-slice. B6 (Hanna/Colombo vs §8) blijft open. Mapping pH-sensor,
Latin-1-fonts, M4. Zie `STATUS.md`.
