// KOIoT Paneel - tijdsynchronisatie via SNTP (R5).
#pragma once

// Zet de tijdzone (APP_TIMEZONE) en bereidt SNTP voor (start nog niet).
void time_sync_init();

// Aanroepen zodra er een IP-adres is: (her)start de SNTP-client en logt de poging.
void time_sync_on_network_up();

// Aanroepen bij verbindingsverlies (alleen logging/administratie; SNTP zelf blijft staan).
void time_sync_on_network_down();

// true zodra de systeemtijd minstens een keer via SNTP is gezet.
bool time_sync_is_synced();

// Periodieke controle vanuit de netwerktaak: logt een waarschuwing als er wel netwerk is
// maar na APP_SNTP_WARN_AFTER_S nog geen sync.
void time_sync_tick(bool network_up);
