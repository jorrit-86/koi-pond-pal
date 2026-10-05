import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ha-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// Paneel-sleutels (brief §8: nitriet, tan, fosfaat, …) → water_parameters.parameter_type.
// CHECK in de DB: ph, temperature, kh, gh, nitrite, nitrate, phosphate, ammonia.
// zout/salt zit daar niet in → 400 (paneel markeert Historie afgewezen, geen retry).
const PARAM_MAP: Record<string, { type: string; defaultUnit: string }> = {
  kh: { type: "kh", defaultUnit: "°dH" },
  gh: { type: "gh", defaultUnit: "°dH" },
  ph: { type: "ph", defaultUnit: "" },
  nitriet: { type: "nitrite", defaultUnit: "mg/l" },
  nitrite: { type: "nitrite", defaultUnit: "mg/l" },
  nitraat: { type: "nitrate", defaultUnit: "mg/l" },
  nitrate: { type: "nitrate", defaultUnit: "mg/l" },
  fosfaat: { type: "phosphate", defaultUnit: "mg/l" },
  phosphate: { type: "phosphate", defaultUnit: "mg/l" },
  tan: { type: "ammonia", defaultUnit: "mg/l" },
  ammonia: { type: "ammonia", defaultUnit: "mg/l" },
}

// Paneel-catalogus gebruikt korte LVGL-labels (dH, mg/l NO3, pH). De app schrijft
// water_parameters.unit als °dH / mg/l / leeg (pH). Normaliseer naar die conventie.
function compactUnit(raw: string): string {
  return raw.trim().toLowerCase().replace(/°/g, "").replace(/\s+/g, "")
}

function normalizeUnit(paramType: string, incoming: string, defaultUnit: string): string {
  const compact = compactUnit(incoming)

  if (paramType === "kh" || paramType === "gh") {
    if (compact === "" || compact === "dh" || compact === "dkh" || compact === "dgh") {
      return "°dH"
    }
    return incoming.trim() !== "" ? incoming.trim() : defaultUnit
  }

  if (paramType === "ph") {
    return ""
  }

  if (defaultUnit === "mg/l") {
    if (compact === "" || compact === "mgl" || compact.startsWith("mg/l")) {
      return "mg/l"
    }
    return incoming.trim() !== "" ? incoming.trim() : defaultUnit
  }

  return incoming.trim() !== "" ? incoming.trim() : defaultUnit
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const FUTURE_SKEW_MS = 5 * 60 * 1000

function parseValue(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = parseFloat(raw.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function parseMeasuredAt(raw: unknown, nowMs: number): { ok: true; iso: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, iso: new Date(nowMs).toISOString() }
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "invalid_measured_at" }
  }
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) {
    return { ok: false, error: "invalid_measured_at" }
  }
  if (ms > nowMs + FUTURE_SKEW_MS) {
    return { ok: false, error: "measured_at_in_future" }
  }
  if (ms < nowMs - MAX_AGE_MS) {
    return { ok: false, error: "measured_at_too_old" }
  }
  return { ok: true, iso: new Date(ms).toISOString() }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const token = req.headers.get("X-HA-Token")?.trim()
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const tokenHash = await sha256Hex(token)
    const { data: deviceToken, error: tokenError } = await supabase
      .from("device_tokens")
      .select("id, user_id, revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle()

    if (tokenError || !deviceToken) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    await supabase
      .from("device_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", deviceToken.id)

    let body: {
      parameter?: string
      parameter_type?: string
      value?: number | string
      unit?: string
      measured_at?: string
      client_id?: string
      device_id?: string
      source?: string
    }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const rawKey = (typeof body.parameter === "string" && body.parameter.trim() !== "")
      ? body.parameter.trim()
      : (typeof body.parameter_type === "string" ? body.parameter_type.trim() : "")
    const key = rawKey.toLowerCase()
    if (!key) {
      return new Response(
        JSON.stringify({ error: "invalid_body", details: "parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const mapped = PARAM_MAP[key]
    if (!mapped) {
      return new Response(
        JSON.stringify({
          error: "unsupported_parameter",
          details: key === "zout" || key === "salt"
            ? "zout/salt is not a water_parameters type"
            : `unknown parameter '${key}'`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const value = parseValue(body.value)
    if (value === null) {
      return new Response(
        JSON.stringify({ error: "invalid_value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const nowMs = Date.now()
    const when = parseMeasuredAt(body.measured_at, nowMs)
    if (!when.ok) {
      return new Response(JSON.stringify({ error: when.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const incomingUnit = typeof body.unit === "string" ? body.unit : ""
    const unit = normalizeUnit(mapped.type, incomingUnit, mapped.defaultUnit)

    const clientId =
      (typeof body.client_id === "string" && body.client_id.trim() !== "")
        ? body.client_id.trim()
        : ""
    const notes = clientId !== "" ? `via paneel ${clientId}` : "via paneel"

    if (clientId !== "") {
      const { data: existing } = await supabase
        .from("water_parameters")
        .select("id, parameter_type, value, unit, measured_at")
        .eq("user_id", deviceToken.user_id)
        .eq("notes", notes)
        .maybeSingle()
      if (existing) {
        return new Response(
          JSON.stringify({ ok: true, id: existing.id, parameter_type: existing.parameter_type, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
      }
    }

    const { data: inserted, error: wpError } = await supabase
      .from("water_parameters")
      .insert({
        user_id: deviceToken.user_id,
        parameter_type: mapped.type,
        value,
        unit,
        notes,
        measured_at: when.iso,
      })
      .select("id, parameter_type, value, unit, measured_at")
      .maybeSingle()

    if (wpError) {
      console.error("water_parameters insert (via manual-measurement) error:", wpError)
      return new Response(
        JSON.stringify({ error: "water_parameters_failed", details: wpError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        id: inserted?.id ?? null,
        parameter_type: mapped.type,
        value,
        unit,
        measured_at: when.iso,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("manual-measurement error:", error)
    return new Response(
      JSON.stringify({
        error: "internal_server_error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
