# Firmware-instructie: pH, flow en humidity naar Koi Pond Pal

Geef dit aan Claude in het `koi-iot-esp32` project. De app/backend is klaar.
Zet `postPh()` en `postFlow()` aan in `main.cpp`, en stuur humidity mee op `-02`.

Niet wijzigen: het bestaande temperatuur-contract voor `-01` en `-02`.

---

## Endpoint (ongewijzigd)

- **URL:** `POST https://pbpuvumeshaeplbwbwzv.supabase.co/functions/v1/sensor-data`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <SUPABASE_ANON_KEY>` (zelfde key als nu)
- Geen timestamp in de body.

Ongeldige meting (`NaN`, niet gekalibreerd, sensor niet aangesloten): **veld weglaten**, niet `NaN` of `null` sturen als de firmware dat niet al doet. Weglaten is het contract.

---

## Sensor-ID mapping (één fysieke sensor = één ID)

Device-ID voorbeeld: `KOIoT-57226C`

| Suffix | Hardware | sensor_type | JSON-velden |
|---|---|---|---|
| `-01` | DS18B20 watertemp | `"temperatuurmeter"` | `temperature` |
| `-02` | SHT31 (één chip) | `"temperatuurmeter"` | `temperature` + optioneel `humidity` |
| `-03` | analoge pH-probe | `"ph_meter"` | `ph` |
| `-04` | YF-S201 flowmeter | `"waterflowmeter"` | `flow_rate` + `flow_total` |

Humidity hoort bij `-02` (zelfde SHT31). Geen nieuw ID.
pH is `-03`. Flow is `-04`. **Niet** meer `flow_rate`/`flow_total` op `-01` meesturen.

---

## Bodies

### `-01` — watertemperatuur (bestaand, niet breken)

```json
{
  "temperature": 22.45,
  "sensor_id": "KOIoT-57226C-01",
  "device_id": "KOIoT-57226C",
  "sensor_type": "temperatuurmeter"
}
```

### `-02` — omgeving + vochtigheid (humidity erbij)

```json
{
  "temperature": 24.1,
  "humidity": 55.0,
  "sensor_id": "KOIoT-57226C-02",
  "device_id": "KOIoT-57226C",
  "sensor_type": "temperatuurmeter"
}
```

Als humidity `NaN` is: POST zonder `"humidity"`, temperatuur mag blijven.

### `-03` — pH (geen temperature verplicht)

```json
{
  "ph": 7.2,
  "sensor_id": "KOIoT-57226C-03",
  "device_id": "KOIoT-57226C",
  "sensor_type": "ph_meter"
}
```

### `-04` — flow (geen temperature verplicht)

```json
{
  "flow_rate": 3.1,
  "flow_total": 145.7,
  "sensor_id": "KOIoT-57226C-04",
  "device_id": "KOIoT-57226C",
  "sensor_type": "waterflowmeter"
}
```

- `flow_rate`: actueel debiet in **L/min**
- `flow_total`: cumulatieve teller in **L** (NVS, overleeft reboot). Alleen meesturen als de waarde geldig is.

Als één van de twee ongeldig is: dat veld weglaten; de andere mag wel mee.

---

## Wat te doen in code

1. In `main.cpp`: `AppClient::postPh()` en `AppClient::postFlow()` aanroepen op dezelfde meetcyclus als temperatuur (niet vaker dan het meetinterval).
2. `postPh()` moet body + `sensor_type` `"ph_meter"` + ID `…-03` gebruiken zoals hierboven.
3. `postFlow()` moet body + `sensor_type` `"waterflowmeter"` + ID `…-04` gebruiken zoals hierboven.
4. SHT31-POST (`-02`) uitbreiden met `humidity` als `SensorsSht31::read()` een geldige RV geeft.
5. Verwijder/stop eventuele flow-velden op de `-01` watertemp-POST.
6. `sensor_id` / `device_id` dynamisch uit het bestaande device-ID bouwen (`KOIoT-XXXXXX` + suffix), niet hardcoden op alleen 57226C als de firmware al een DEVICE_ID heeft.

---

## Klaar als

- Serial/HTTP: 200 op pH- en flow-POSTs
- App KOIoT-lijst: `-03` toont pH, `-04` toont L/min + L totaal, `-02` toont °C en % RV als humidity meekomt
- `-01` temperatuur blijft werken zoals voorheen
