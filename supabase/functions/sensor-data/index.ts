import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Parse request body
    const { temperature, sensor_id, device_id, sensor_type } = await req.json()

    // Validate required fields
    if (!temperature || !sensor_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: temperature, sensor_id' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate sensor_id format (KOIoT-XXXXXX or KOIoT-XXXXXX-XX)
    if (!sensor_id.startsWith('KOIoT-') || (sensor_id.length !== 12 && sensor_id.length !== 15)) {
      return new Response(
        JSON.stringify({ error: 'Invalid sensor_id format. Must be KOIoT-XXXXXX or KOIoT-XXXXXX-XX' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if sensor is registered to a user
    const { data: sensorData, error: sensorError } = await supabaseClient
      .from('user_sensors')
      .select('user_id, status')
      .eq('sensor_id', sensor_id)
      .eq('status', 'active')
      .single()

    if (sensorError || !sensorData) {
      console.error('Sensor lookup error:', sensorError)
      return new Response(
        JSON.stringify({ 
          error: 'Sensor not registered or not active',
          details: 'This sensor is not registered to any user or is not active'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle sensor types - both sensors are temperatuurmeter
    let finalSensorType = sensor_type || 'temperatuurmeter'
    let sensorName = 'Temperatuurmeter'
    
    // Determine sensor name from sensor_id suffix
    if (sensor_id.endsWith('-01')) {
      finalSensorType = 'temperatuurmeter'
      sensorName = 'Vijver Water Temperatuurmeter'
    } else if (sensor_id.endsWith('-02')) {
      finalSensorType = 'temperatuurmeter'
      sensorName = 'Filter Inlaat Temperatuurmeter'
    } else if (sensor_type === 'temperatuurmeter') {
      finalSensorType = 'temperatuurmeter'
      sensorName = 'Temperatuurmeter'
    }

    console.log('Processing sensor data:', { temperature, sensor_id, sensor_type, finalSensorType, sensorName })

    // Insert sensor data (without sensor_name for now)
    const { data, error } = await supabaseClient
      .from('sensor_data')
      .insert([
        {
          sensor_id,
          temperature: parseFloat(temperature),
          user_id: sensorData.user_id,
          status: 'active',
          device_id: device_id || null,
          sensor_type: finalSensorType
        }
      ])
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to insert sensor data', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Sensor data inserted:', data)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sensor data received successfully',
        data: data[0]
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