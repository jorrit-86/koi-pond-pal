import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface ConfigData {
  display_letter: string;
  update_interval: number;
}

interface UpdateRequest {
  display_letter?: string;
  update_interval?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create a simple fetch request to Supabase REST API instead of using the client
    const baseUrl = `${supabaseUrl}/rest/v1/esp32_config_test`
    
    if (req.method === 'GET') {
      // GET: Return current configuration using direct REST API
      const response = await fetch(`${baseUrl}?select=display_letter,update_interval,updated_at&order=updated_at.desc&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.error('Error fetching config:', response.status, response.statusText)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch configuration' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const data = await response.json()
      
      if (!data || data.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No configuration found' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const config = data[0]
      const responseData: ConfigData = {
        display_letter: config.display_letter,
        update_interval: config.update_interval
      }

      return new Response(
        JSON.stringify(responseData),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } else if (req.method === 'POST') {
      // POST: Update configuration
      const body: UpdateRequest = await req.json()
      
      if (!body.display_letter && body.update_interval === undefined) {
        return new Response(
          JSON.stringify({ error: 'No valid fields to update' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Validate display_letter if provided
      if (body.display_letter && (typeof body.display_letter !== 'string' || body.display_letter.length !== 1)) {
        return new Response(
          JSON.stringify({ error: 'display_letter must be a single character' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Validate update_interval if provided
      if (body.update_interval !== undefined && (typeof body.update_interval !== 'number' || body.update_interval < 1)) {
        return new Response(
          JSON.stringify({ error: 'update_interval must be a positive number' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Prepare update data
      const updateData: Partial<ConfigData> = {}
      if (body.display_letter) updateData.display_letter = body.display_letter
      if (body.update_interval !== undefined) updateData.update_interval = body.update_interval

      // Update the configuration using PATCH
      const response = await fetch(baseUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        console.error('Error updating config:', response.status, response.statusText)
        return new Response(
          JSON.stringify({ error: 'Failed to update configuration' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const data = await response.json()
      const updatedConfig = data[0] || data

      const responseData = {
        success: true,
        message: 'Configuration updated successfully',
        data: {
          display_letter: updatedConfig.display_letter,
          update_interval: updatedConfig.update_interval,
          updated_at: updatedConfig.updated_at
        }
      }

      return new Response(
        JSON.stringify(responseData),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})