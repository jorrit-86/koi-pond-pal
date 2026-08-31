/**
 * Normalize QR / pasted sensor ID content to the 6-character suffix after KOIoT-.
 * Accepts: "KOIoT-A1b2C3", "A1b2C3", or URLs/text containing either.
 */
export function parseSensorIdFromQr(raw: string): { ok: true; id: string } | { ok: false; error: string } {
  const text = raw.trim()
  if (!text) {
    return { ok: false, error: "QR-code is leeg" }
  }

  // Prefer full KOIoT-XXXXXX (optionally with -01 / -02 suffix for multi-sensor devices)
  const fullMatch = text.match(/KOIoT-([a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{6})(?:-\d{2})?/i)
  if (fullMatch) {
    return { ok: true, id: fullMatch[1] }
  }

  // Bare 6-character ID (entire payload)
  const bare = text.trim()
  if (/^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{6}$/.test(bare)) {
    return { ok: true, id: bare }
  }

  return {
    ok: false,
    error: 'Ongeldige QR-code. Verwacht formaat: KOIoT-XXXXXX of 6 tekens.',
  }
}
