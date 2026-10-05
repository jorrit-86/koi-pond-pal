// KOIoT Paneel - stabiele paneel-identiteit "KOIoT-P-XXXXXX".
#pragma once

// Leidt de panel_id af uit de eFuse-basis-MAC van de ESP32-P4 (esp_efuse_mac_get_default)
// en zet hem in de gedeelde status. Logt MAC en resultaat. Zie ARCHITECTUUR.md voor de keuze.
void panel_id_init();

// Geeft de panel_id terug (geldig na panel_id_init()).
const char* panel_id_get();
