// Individual Sensor Configuration
export interface IndividualSensorConfig {
  id?: string
  sensor_id: string // Individual sensor ID (KOIoT-001122-01, etc.)
  sensor_type: string // temperatuurmeter, etc.
  device_id: string // Device ID (KOIoT-001122)
  display_name: string
  temperature_offset: number
  temperature_scale: number
  enabled: boolean
  created_at?: string
  updated_at?: string
}

// Latest reading for a sensor
export interface LatestReading {
  sensor_id: string
  temperature: number
  sensor_type: string
  created_at: string
}

// KOIoT Sensor Configuration Types (Integrated)
export interface KOIoTSensorConfig {
  // Basic device info
  sensor_id: string // Device ID (KOIoT-001122)
  sensor_name?: string // Device name
  user_id?: string
  
  // Measurement settings
  measurement_interval: number // seconds (60-3600)
  
  // WiFi settings
  wifi_ssid?: string
  wifi_password?: string
  wifi_auto_connect: boolean
  
  // Global sensor settings (fallback)
  temperature_offset: number
  temperature_scale: number
  
  // Power management
  deep_sleep_enabled: boolean
  deep_sleep_duration: number // seconds
  
  // Debug settings
  debug_mode: boolean
  log_level: 'error' | 'warn' | 'info' | 'debug'
  
  // Configuration metadata
  config_version: number
  pending_changes: boolean
  last_config_applied?: string
  restart_requested?: boolean
  
  // Latest readings for individual sensors
  latest_readings?: LatestReading[]
  
  // Individual sensor configurations
  individual_sensors?: IndividualSensorConfig[]
}

// Form validation types
export interface KOIoTConfigFormData {
  measurement_interval: number
  wifi_ssid: string
  wifi_password: string
  wifi_auto_connect: boolean
  temperature_offset: number
  temperature_scale: number
  deep_sleep_enabled: boolean
  deep_sleep_duration: number
  debug_mode: boolean
  log_level: 'error' | 'warn' | 'info' | 'debug'
}

// API response types
export interface KOIoTConfigResponse {
  success: boolean
  data?: KOIoTSensorConfig
  error?: string
}

export interface KOIoTConfigUpdate {
  measurement_interval?: number
  wifi_ssid?: string
  wifi_password?: string
  wifi_auto_connect?: boolean
  temperature_offset?: number
  temperature_scale?: number
  deep_sleep_enabled?: boolean
  deep_sleep_duration?: number
  debug_mode?: boolean
  log_level?: 'error' | 'warn' | 'info' | 'debug'
}
