import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface SensorData {
  temperature: number | null
  lastUpdate: string
  loading: boolean
  error: string | null
}

export function useSensorData(sensorId?: string) {
  const { user } = useAuth()
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: null,
    lastUpdate: "No data",
    loading: true,
    error: null
  })

  const loadSensorData = async () => {
    if (!user) {
      setSensorData(prev => ({ ...prev, loading: false, error: 'User not authenticated' }))
      return
    }

    try {
      setSensorData(prev => ({ ...prev, loading: true, error: null }))
      
      // Get the latest sensor data from user's sensors
      let query = supabase
        .from('sensor_data')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      // If specific sensor ID is provided, filter by it
      if (sensorId) {
        query = query.eq('sensor_id', sensorId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading sensor data:', error)
        setSensorData(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Failed to load sensor data' 
        }))
        return
      }

      if (data && data.length > 0) {
        const latestReading = data[0]
        
        // Show exact time of measurement using created_at (correct timezone)
        const updateTime = new Date(latestReading.created_at)
        const timeString = updateTime.toLocaleString('nl-NL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })

        setSensorData({
          temperature: latestReading.temperature,
          lastUpdate: timeString,
          loading: false,
          error: null
        })
      } else {
        setSensorData({
          temperature: null,
          lastUpdate: "No data",
          loading: false,
          error: null
        })
      }
    } catch (error) {
      console.error('Error in loadSensorData:', error)
      setSensorData(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to load sensor data' 
      }))
    }
  }

  useEffect(() => {
    if (user) {
      loadSensorData()
      
      // Auto-refresh disabled - data will only load on initial mount or manual refresh
      // const interval = setInterval(loadSensorData, 30000)
      // return () => clearInterval(interval)
    }
  }, [user, sensorId])

  return {
    ...sensorData,
    refresh: loadSensorData
  }
}
