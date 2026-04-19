import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface SensorData {
  pondTemp: number | null
  ambientTemp: number | null
  pondSensorConnected: boolean
  ambientSensorConnected: boolean
  lastUpdate: string | null
}

export function useSensorData() {
  // Use try-catch to handle cases where AuthContext is not available
  let user = null
  try {
    const authContext = useAuth()
    user = authContext?.user || null
  } catch (error) {
    // AuthProvider not available, continue without user
    console.log('AuthProvider not available for useSensorData, using fallback')
  }

  const [sensorData, setSensorData] = useState<SensorData>({
    pondTemp: null,
    ambientTemp: null,
    pondSensorConnected: false,
    ambientSensorConnected: false,
    lastUpdate: null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSensorData = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      // Get latest temperature data from sensors
      const { data: tempData, error: tempError } = await supabase
        .from('sensor_data')
        .select('sensor_id, value, timestamp, sensor_name')
        .eq('parameter', 'temperature')
        .order('timestamp', { ascending: false })
        .limit(10)

      if (tempError) {
        console.error('Error loading temperature data:', tempError)
        setError('Kon sensordata niet laden')
        return
      }

      // Get sensor configurations
      const { data: configData, error: configError } = await supabase
        .from('sensor_configurations')
        .select('sensor_id, display_name, location, status')
        .eq('user_id', user.id)

      if (configError) {
        console.error('Error loading sensor configs:', configError)
      }

      // Process sensor data
      let pondTemp: number | null = null
      let ambientTemp: number | null = null
      let pondSensorConnected = false
      let ambientSensorConnected = false
      let lastUpdate: string | null = null

      if (tempData && tempData.length > 0) {
        // Find pond temperature sensor (usually contains 'pond', 'water', or specific IDs)
        const pondSensor = tempData.find(sensor => 
          sensor.sensor_name?.toLowerCase().includes('pond') ||
          sensor.sensor_name?.toLowerCase().includes('water') ||
          sensor.sensor_name?.toLowerCase().includes('vijver') ||
          sensor.sensor_id?.includes('-01') ||
          sensor.sensor_id?.includes('KOIoT')
        )

        // Find ambient temperature sensor (usually contains 'ambient', 'outside', or specific IDs)
        const ambientSensor = tempData.find(sensor => 
          sensor.sensor_name?.toLowerCase().includes('ambient') ||
          sensor.sensor_name?.toLowerCase().includes('outside') ||
          sensor.sensor_name?.toLowerCase().includes('buiten') ||
          sensor.sensor_id?.includes('-02')
        )

        if (pondSensor) {
          pondTemp = pondSensor.value
          pondSensorConnected = true
          lastUpdate = pondSensor.timestamp
        }

        if (ambientSensor) {
          ambientTemp = ambientSensor.value
          ambientSensorConnected = true
          if (!lastUpdate || new Date(ambientSensor.timestamp) > new Date(lastUpdate)) {
            lastUpdate = ambientSensor.timestamp
          }
        }
      }

      setSensorData({
        pondTemp,
        ambientTemp,
        pondSensorConnected,
        ambientSensorConnected,
        lastUpdate
      })

    } catch (error) {
      console.error('Error in loadSensorData:', error)
      setError('Fout bij laden van sensordata')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadSensorData()
    }
  }, [user])

  return {
    sensorData,
    loading,
    error,
    refreshSensorData: loadSensorData
  }
}