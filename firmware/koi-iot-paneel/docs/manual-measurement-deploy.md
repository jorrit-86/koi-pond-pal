# manual-measurement — deploy

Bron staat in de pal-app, niet in deze firmware-repo:

`C:/Users/Jorrit/Documents/GitHub/koi-pond-pal/supabase/functions/manual-measurement/index.ts`

Nog **niet** gedeployed. Zelfde patroon als `task-close` (`X-HA-Token`, `--no-verify-jwt` via `config.toml`).

```powershell
cd C:\Users\Jorrit\Documents\GitHub\koi-pond-pal
npx supabase functions deploy manual-measurement --project-ref pbpuvumeshaeplbwbwzv
```

Daarna op het paneel (firmware `0.2.0-m2h`): **Instellingen → MOCK uit**, een meting invoeren.

Paneel-JSON (voorbeeld): `parameter=nitriet` → DB-kolom `parameter_type=nitrite`.
`zout` wordt 400 (geen type in `water_parameters`).
