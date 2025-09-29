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

    // Parse JSON with better error handling
    let requestData;
    try {
      const body = await req.text();
      console.log('Request body:', body);
      requestData = JSON.parse(body);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON format',
          details: parseError.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { sensor_id, action, sensor_type, sensor_config } = requestData

    if (!sensor_id) {
      return new Response(
        JSON.stringify({ error: 'Sensor ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'get_config') {
      // Get main configuration for the device from sensor_configurations table
      // sensor_id should be the device ID (KOIoT-001122)
      const { data: config, error: configError } = await supabaseClient
        .from('sensor_configurations')
        .select('*')
        .eq('sensor_id', sensor_id)
        .single()

      if (configError) {
        console.error('Error fetching configuration:', configError)
        return new Response(
          JSON.stringify({ error: 'Configuration not found' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Get individual sensor configurations for this device
      // Use device_id to find all individual sensors for this device
      const { data: individualConfigs, error: individualError } = await supabaseClient
        .from('individual_sensor_configs')
        .select('*')
        .eq('device_id', sensor_id)  // sensor_id is the device ID

      if (individualError) {
        console.error('Error fetching individual sensor configurations:', individualError)
        // Continue with main config even if individual configs fail
      }

      // Build response with individual sensor configs
      const response: any = {
        success: true,
        measurement_interval: config.measurement_interval,
        wifi_ssid: config.wifi_ssid,
        wifi_password: config.wifi_password,
        wifi_auto_connect: config.wifi_auto_connect,
        deep_sleep_enabled: config.deep_sleep_enabled,
        deep_sleep_duration: config.deep_sleep_duration,
        debug_mode: config.debug_mode,
        log_level: config.log_level,
        config_version: config.config_version,
        pending_changes: config.pending_changes,
        restart_requested: config.restart_requested,
        sensors: {}
      }

      // Add individual sensor configurations
      if (individualConfigs) {
        individualConfigs.forEach(sensorConfig => {
          response.sensors[sensorConfig.sensor_type] = {
            display_name: sensorConfig.display_name,
            temperature_offset: sensorConfig.temperature_offset,
            temperature_scale: sensorConfig.temperature_scale,
            enabled: sensorConfig.enabled,
            sensor_id: sensorConfig.sensor_id  // Include the individual sensor ID
          }
        })
      }

      return new Response(
        JSON.stringify(response),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'update_sensor_config') {
      // Update individual sensor configuration
      if (!sensor_type || !sensor_config) {
        return new Response(
          JSON.stringify({ error: 'Sensor type and sensor config are required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const { error: updateError } = await supabaseClient
        .from('individual_sensor_configs')
        .update({
          display_name: sensor_config.display_name,
          temperature_offset: sensor_config.temperature_offset,
          temperature_scale: sensor_config.temperature_scale,
          enabled: sensor_config.enabled,
          updated_at: new Date().toISOString()
        })
        .eq('sensor_id', sensor_config.sensor_id || sensor_id)  // Use individual sensor ID if provided
        .eq('sensor_type', sensor_type)

      if (updateError) {
        console.error('Error updating sensor configuration:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update sensor configuration' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'mark_applied') {
      // Mark configuration as applied
      const { error: updateError } = await supabaseClient
        .from('sensor_configurations')
        .update({ 
          pending_changes: false,
          last_config_applied: new Date().toISOString(),
          restart_requested: false
        })
        .eq('sensor_id', sensor_id)

      if (updateError) {
        console.error('Error marking configuration as applied:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to mark configuration as applied' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in esp32-config function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
