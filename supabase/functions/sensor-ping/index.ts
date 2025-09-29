import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { sensor_id, user_id } = await req.json()

    if (!sensor_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sensor_id, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify that the sensor belongs to the user
    const { data: userSensor, error: sensorError } = await supabaseClient
      .from('user_sensors')
      .select('*')
      .eq('sensor_id', sensor_id)
      .eq('user_id', user_id)
      .single()

    if (sensorError || !userSensor) {
      return new Response(
        JSON.stringify({ error: 'Sensor not found or not owned by user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if sensor has sent data recently (within last 15 minutes)
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)

    const { data: recentData, error: dataError } = await supabaseClient
      .from('sensor_data')
      .select('measurement_time, created_at')
      .eq('sensor_id', sensor_id)
      .eq('user_id', user_id)
      .gte('measurement_time', fifteenMinutesAgo.toISOString())
      .order('measurement_time', { ascending: false })
      .limit(1)
      .single()

    if (dataError && dataError.code !== 'PGRST116') {
      console.error('Error checking recent sensor data:', dataError)
      return new Response(
        JSON.stringify({ error: 'Failed to check sensor status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isOnline = !!recentData
    const lastSeen = recentData?.measurement_time || null
    const responseTime = recentData ? 
      Math.floor((new Date().getTime() - new Date(recentData.measurement_time).getTime()) / 1000) : 
      null

    // Update sensor status in user_sensors table
    const { error: updateError } = await supabaseClient
      .from('user_sensors')
      .update({
        last_ping: new Date().toISOString(),
        status: isOnline ? 'active' : 'offline'
      })
      .eq('sensor_id', sensor_id)
      .eq('user_id', user_id)

    if (updateError) {
      console.error('Error updating sensor status:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        sensor_id,
        status: isOnline ? 'online' : 'offline',
        last_seen: lastSeen,
        response_time: responseTime,
        ping_time: new Date().toISOString()
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
