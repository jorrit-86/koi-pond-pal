import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})

export function createSupabaseHeaders(accessToken: string, extra?: Record<string, string>): Record<string, string> {
  return {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export const supabaseRestUrl = supabaseUrl

// Database types
export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  profile_photo_url?: string
  street?: string
  house_number?: string
  postal_code?: string
  city?: string
  country?: string
  role: 'admin' | 'user'
  two_factor_enabled: boolean
  two_factor_setup_completed?: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface WaterParameter {
  id: string
  user_id: string
  parameter_type: 'ph' | 'temperature' | 'kh' | 'gh' | 'nitrite' | 'nitrate' | 'phosphate'
  value: number
  unit: string
  notes?: string
  created_at: string
}

export interface Koi {
  id: string
  user_id: string
  name: string
  breed?: string
  size?: number
  age?: number
  color?: string
  health_status: 'healthy' | 'sick' | 'recovering'
  last_feeding?: string
  notes?: string
  created_at: string
  updated_at: string
}
