import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { 
  KOIoTSensorConfig, 
  KOIoTConfigUpdate,
  KOIoTConfigFormData 
} from "@/types/esp32-config"

export function useKOIoTConfig() {
  const { user } = useAuth()
  const [sensors, setSensors] = useState<KOIoTSensorConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load all KOIoT sensors with their configurations
  const loadSensors = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // Fetch devices (main sensor configurations) from sensor_configurations table
      const { data: devicesData, error: devicesError } = await supabase
        .from('sensor_configurations')
        .select(`
          sensor_id,
          measurement_interval,
          wifi_ssid,
          wifi_password,
          wifi_auto_connect,
          temperature_offset,
          temperature_scale,
          deep_sleep_enabled,
          deep_sleep_duration,
          debug_mode,
          log_level,
          config_version,
          pending_changes,
          last_config_applied,
          restart_requested
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (devicesError) throw devicesError
      // Fetch individual sensor configurations for each device
      const deviceIds = devicesData?.map(d => d.sensor_id) || []
      
      const { data: individualConfigs, error: individualError } = await supabase
        .from('individual_sensor_configs')
        .select('*')
        .in('device_id', deviceIds)
        .order('created_at', { ascending: false })

      if (individualError) throw individualError

      // Fetch latest temperature readings for individual sensors
      const individualSensorIds = individualConfigs?.map(config => config.sensor_id) || []
      const { data: latestReadings, error: readingsError } = await supabase
        .from('sensor_data')
        .select('sensor_id, temperature, sensor_type, created_at')
        .in('sensor_id', individualSensorIds)
        .order('created_at', { ascending: false })

      if (readingsError) throw readingsError

      // Group latest readings by sensor_id
      const latestBySensor = new Map()
      latestReadings?.forEach(reading => {
        if (!latestBySensor.has(reading.sensor_id)) {
          latestBySensor.set(reading.sensor_id, reading)
        }
      })

      // Combine device configs with individual sensor configs and latest readings
      const combinedSensors: KOIoTSensorConfig[] = devicesData?.map(device => {
        // Get individual sensors for this device
        const deviceIndividualConfigs = individualConfigs?.filter(config => config.device_id === device.sensor_id) || []
        
        // Get latest readings for this device's individual sensors
        const deviceReadings = deviceIndividualConfigs.map(config => {
          return latestBySensor.get(config.sensor_id)
        }).filter(Boolean)

        return {
          sensor_id: device.sensor_id,
          sensor_name: `Device ${device.sensor_id}`,
          measurement_interval: device.measurement_interval,
          wifi_ssid: device.wifi_ssid,
          wifi_password: device.wifi_password,
          wifi_auto_connect: device.wifi_auto_connect,
          temperature_offset: device.temperature_offset,
          temperature_scale: device.temperature_scale,
          deep_sleep_enabled: device.deep_sleep_enabled,
          deep_sleep_duration: device.deep_sleep_duration,
          debug_mode: device.debug_mode,
          log_level: device.log_level,
          config_version: device.config_version,
          pending_changes: device.pending_changes,
          last_config_applied: device.last_config_applied,
          restart_requested: device.restart_requested,
          latest_readings: deviceReadings,
          individual_sensors: deviceIndividualConfigs
        }
      }) || []

      setSensors(combinedSensors)
    } catch (err: any) {
      console.error('Error loading KOIoT sensors:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Update sensor configuration
  const updateSensorConfiguration = async (sensorId: string, configUpdate: KOIoTConfigUpdate) => {
    if (!user) throw new Error('User not authenticated')

    try {
      // Eerst de huidige config_version ophalen
      const { data: currentConfig, error: fetchError } = await supabase
        .from('sensor_configurations')
        .select('config_version')
        .eq('sensor_id', sensorId)
        .single()

      if (fetchError) throw fetchError

      // Update de configuratie in de sensor_configurations tabel
      const { error } = await supabase
        .from('sensor_configurations')
        .update({
          ...configUpdate,
          config_version: (currentConfig?.config_version || 0) + 1,
          pending_changes: true,
          last_config_applied: null,
          updated_at: new Date().toISOString()
        })
        .eq('sensor_id', sensorId)

      if (error) throw error

      // Reload sensors
      await loadSensors()
    } catch (err: any) {
      console.error('Error updating sensor configuration:', err.message)
      throw err
    }
  }

  // Get configuration for sensor (called by ESP32)
  const getConfigurationForSensor = async (sensorId: string) => {
    try {
      const { data, error } = await supabase
        .from('sensor_configurations')
        .select('*')
        .eq('sensor_id', sensorId)
        .single()

      if (error) throw error
      return data
    } catch (err: any) {
      console.error('Error getting configuration for sensor:', err.message)
      throw err
    }
  }

  // Mark configuration as applied (called by ESP32)
  const markConfigurationApplied = async (sensorId: string) => {
    try {
      const { error } = await supabase
        .from('sensor_configurations')
        .update({ 
          pending_changes: false,
          last_config_applied: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('sensor_id', sensorId)

      if (error) throw error
    } catch (err: any) {
      console.error('Error marking configuration as applied:', err.message)
      throw err
    }
  }

  // Request restart for sensor
  const requestSensorRestart = async (sensorId: string) => {
    if (!user) throw new Error('User not authenticated')

    try {
      const { error } = await supabase
        .from('sensor_configurations')
        .update({ 
          restart_requested: true,
          updated_at: new Date().toISOString()
        })
        .eq('sensor_id', sensorId)

      if (error) throw error

      // Reload sensors to show updated status
      await loadSensors()
    } catch (err: any) {
      console.error('Error requesting sensor restart:', err.message)
      throw err
    }
  }

  // Format measurement interval for display
  const formatMeasurementInterval = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seconden`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      return `${minutes} minuten`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      if (minutes === 0) {
        return `${hours} uur`
      }
      return `${hours} uur ${minutes} minuten`
    }
  }

  // Get display name for sensor type
  const getSensorDisplayName = (sensorType: string, fallbackName?: string) => {
    if (fallbackName && fallbackName.trim()) {
      return fallbackName
    }
    
    switch (sensorType) {
      case 'sensor_1':
      case 'vijver_water':
        return 'Sensor 1'
      case 'sensor_2':
      case 'filter_inlaat':
        return 'Sensor 2'
      default:
        return 'Sensor'
    }
  }

  // Format latest reading for display
  const formatLatestReading = (reading?: any) => {
    if (!reading || !reading.created_at) return 'Geen data'
    
    try {
      const timeAgo = new Date(reading.created_at)
      const now = new Date()
      const diffMs = now.getTime() - timeAgo.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      
      if (diffMins < 1) return 'Zojuist'
      if (diffMins < 60) return `${diffMins} min geleden`
      
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours} uur geleden`
      
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays} dagen geleden`
    } catch (error) {
      return 'Ongeldige datum'
    }
  }

  // Validate configuration
  const validateConfiguration = (config: KOIoTConfigFormData) => {
    const errors: string[] = []

    if (config.measurement_interval < 60) {
      errors.push('Meetinterval moet minimaal 60 seconden zijn')
    }
    if (config.measurement_interval > 3600) {
      errors.push('Meetinterval moet maximaal 3600 seconden (1 uur) zijn')
    }
    if (config.wifi_ssid && config.wifi_ssid.length < 1) {
      errors.push('WiFi SSID mag niet leeg zijn')
    }
    if (config.wifi_password && config.wifi_password.length < 8) {
      errors.push('WiFi wachtwoord moet minimaal 8 karakters zijn')
    }
    if (config.temperature_scale <= 0) {
      errors.push('Temperatuur schaal moet groter dan 0 zijn')
    }
    if (config.deep_sleep_duration < 60) {
      errors.push('Deep sleep duur moet minimaal 60 seconden zijn')
    }

    return errors
  }

  useEffect(() => {
    if (user) {
      loadSensors()
      
      // Auto-refresh every 2 minutes to get latest readings
      const interval = setInterval(() => {
        loadSensors()
      }, 120000) // 2 minutes
      
      return () => clearInterval(interval)
    }
  }, [user])

  return {
    sensors,
    loading,
    error,
    loadSensors,
    updateSensorConfiguration,
    getConfigurationForSensor,
    markConfigurationApplied,
    requestSensorRestart,
    formatMeasurementInterval,
    validateConfiguration,
    getSensorDisplayName,
    formatLatestReading
  }
}
