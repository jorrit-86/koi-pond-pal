import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function resolveSensorType(sensor_id: string, sensor_type?: string): string {
  if (sensor_id.endsWith('-03') || sensor_type === 'ph_meter') return 'ph_meter'
  if (sensor_id.endsWith('-04') || sensor_type === 'waterflowmeter') return 'waterflowmeter'
  if (
    sensor_id.endsWith('-01') ||
    sensor_id.endsWith('-02') ||
    sensor_type === 'temperatuurmeter' ||
    sensor_type === 'vijver_water' ||
    sensor_type === 'filter_inlaat' ||
    sensor_type === 'omgevingstemperatuur'
  ) {
    return 'temperatuurmeter'
  }
  return sensor_type || 'temperatuurmeter'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const body = await req.json()
    const { sensor_id, device_id, sensor_type } = body
    const temperature = parseOptionalNumber(body.temperature)
    const humidity = parseOptionalNumber(body.humidity)
    const ph = parseOptionalNumber(body.ph)
    const flow_rate = parseOptionalNumber(body.flow_rate)
    const flow_total = parseOptionalNumber(body.flow_total)

    if (!sensor_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sensor_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const hasMeasurement =
      temperature !== null ||
      humidity !== null ||
      ph !== null ||
      flow_rate !== null ||
      flow_total !== null

    if (!hasMeasurement) {
      return new Response(
        JSON.stringify({
          error: 'Missing measurement: provide at least one of temperature, humidity, ph, flow_rate, flow_total',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!sensor_id.startsWith('KOIoT-') || (sensor_id.length !== 12 && sensor_id.length !== 15)) {
      return new Response(
        JSON.stringify({ error: 'Invalid sensor_id format. Must be KOIoT-XXXXXX or KOIoT-XXXXXX-XX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const parentDeviceId =
      device_id && String(device_id).startsWith('KOIoT-')
        ? String(device_id)
        : sensor_id.length === 15
          ? sensor_id.slice(0, 12)
          : sensor_id

    let ownerUserId: string | null = null

    const { data: exactSensor } = await supabaseClient
      .from('user_sensors')
      .select('user_id, status')
      .eq('sensor_id', sensor_id)
      .eq('status', 'active')
      .maybeSingle()

    if (exactSensor?.user_id) {
      ownerUserId = exactSensor.user_id
    } else {
      const { data: deviceSensor } = await supabaseClient
        .from('user_sensors')
        .select('user_id, status')
        .eq('sensor_id', parentDeviceId)
        .eq('status', 'active')
        .maybeSingle()

      if (deviceSensor?.user_id) {
        ownerUserId = deviceSensor.user_id
      }
    }

    if (!ownerUserId) {
      console.error('Sensor lookup failed for', sensor_id, 'parent', parentDeviceId)
      return new Response(
        JSON.stringify({
          error: 'Sensor not registered or not active',
          details: `No active user_sensors row for ${sensor_id} or device ${parentDeviceId}`,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const finalSensorType = resolveSensorType(sensor_id, sensor_type)

    const insertRow: Record<string, unknown> = {
      sensor_id,
      user_id: ownerUserId,
      status: 'active',
      device_id: parentDeviceId,
      sensor_type: finalSensorType,
    }

    if (temperature !== null) insertRow.temperature = temperature
    if (humidity !== null) insertRow.humidity = humidity
    if (ph !== null) insertRow.ph = ph
    if (flow_rate !== null) insertRow.flow_rate = flow_rate
    if (flow_total !== null) insertRow.flow_total = flow_total

    console.log('Processing sensor data:', {
      temperature,
      humidity,
      ph,
      flow_rate,
      flow_total,
      sensor_id,
      device_id: parentDeviceId,
      finalSensorType,
      ownerUserId,
    })

    const { data, error } = await supabaseClient
      .from('sensor_data')
      .insert([insertRow])
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to insert sensor data', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sensor data received successfully',
        data: data[0],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
