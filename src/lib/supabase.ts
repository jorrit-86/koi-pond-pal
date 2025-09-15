import { createClient } from '@supabase/supabase-js'

// Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

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
