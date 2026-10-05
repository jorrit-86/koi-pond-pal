# KOIoT Paneel

Firmware voor het Koi IoT-bedieningspaneel op de **Elecrow CrowPanel Advanced 10.1" ESP32-P4 (V1.2)**.
Ontwerp en eisen: `docs/koi-iot-paneel-cursor-brief.md`. Architectuur: `ARCHITECTUUR.md`.
Voortgang: `STATUS.md`.

## Vereisten
- ESP-IDF **v5.5.4** (`C:\esp\v5.5.4\esp-idf`), geïnstalleerd via de Espressif Windows-installer.
- Board op **COM5** (twee USB-C-kabels aansluiten: één voor data, één als extra voeding).

## Eerste keer
```powershell
Copy-Item main\secrets.example.h main\secrets.h   # daarna WIFI_SSID / WIFI_PASS invullen
```
`main/secrets.h` staat in `.gitignore`.

## Bouwen en flashen (PowerShell, ESP-IDF 5.5.4 omgeving)
```powershell
$env:PYTHONIOENCODING = "utf-8"          # voorkomt een cp1252-crash van idf.py op Windows
cd C:\esp\koi-iot-paneel
idf.py set-target esp32p4                 # alleen de eerste keer (maakt sdkconfig uit sdkconfig.defaults)
idf.py build
idf.py -p COM5 flash monitor              # Ctrl+] sluit de monitor
```
Controleer de echte IDF-versie met `python $env:IDF_PATH\tools\idf.py --version` (de `idf.py.exe`-wrapper
meldt zijn eigen versie `v1.0.3`).

Na wijzigingen in `sdkconfig.defaults`: `Remove-Item sdkconfig; idf.py reconfigure` (defaults worden
alleen toegepast als er nog geen `sdkconfig` is).

## Structuur
Zie `ARCHITECTUUR.md` §2. Kort: `components/bsp_*` = Elecrow-BSP (minimaal aangepast), `main/core` =
netwerk/tijd/status, `main/ui` = LVGL-schermen, `vendor/` = onaangeroerde Elecrow-referentie (niet in
de build).
