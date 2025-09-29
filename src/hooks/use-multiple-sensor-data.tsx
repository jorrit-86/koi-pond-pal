import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface SensorData {
  temperature: number | null
  lastUpdate: string
  sensorType: string
  sensorName: string
  loading: boolean
  error: string | null
}

interface MultipleSensorData {
  vijverWater: SensorData
  filterInlaat: SensorData
  loading: boolean
  error: string | null
}

export function useMultipleSensorData() {
  const { user } = useAuth()
  const [sensorData, setSensorData] = useState<MultipleSensorData>({
    vijverWater: {
      temperature: null,
      lastUpdate: "No data",
      sensorType: "vijver_water",
      sensorName: "Sensor 1",
      loading: true,
      error: null
    },
    filterInlaat: {
      temperature: null,
      lastUpdate: "No data",
      sensorType: "filter_inlaat",
      sensorName: "Sensor 2",
      loading: true,
      error: null
    },
    loading: true,
    error: null
  })

  const loadSensorData = async () => {
    if (!user) {
      setSensorData(prev => ({
        ...prev,
        loading: false,
        error: "User not authenticated"
      }))
      return
    }

    setSensorData(prev => ({
      ...prev,
      loading: true,
      error: null
    }))

    try {
      // Fetch sensor data for both sensor types
      const { data, error } = await supabase
        .from('sensor_data')
        .select('temperature, created_at, sensor_type, sensor_id')
        .eq('user_id', user.id)
        .in('sensor_type', ['sensor_1', 'sensor_2', 'vijver_water', 'filter_inlaat', 'temperatuurmeter']) // Include both new and legacy types
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get display names from individual_sensor_configs
      const { data: configData, error: configError } = await supabase
        .from('individual_sensor_configs')
        .select('sensor_type, display_name, sensor_id')

      if (configError) {
        console.error('Error loading sensor configs:', configError)
      }

      // Process data for each sensor type (new and legacy)
      const sensor1Data = data?.filter(d => d.sensor_type === 'sensor_1' || d.sensor_type === 'vijver_water' || (d.sensor_id && d.sensor_id.endsWith('-01')))[0]
      const sensor2Data = data?.filter(d => d.sensor_type === 'sensor_2' || d.sensor_type === 'filter_inlaat' || (d.sensor_id && d.sensor_id.endsWith('-02')))[0]

      // Get display names for each sensor
      const sensor1Config = configData?.find(c => 
        c.sensor_id === sensor1Data?.sensor_id
      )
      const sensor2Config = configData?.find(c => 
        c.sensor_id === sensor2Data?.sensor_id
      )
      

      // Process Sensor 1
      if (sensor1Data) {
        const updateTime = new Date(sensor1Data.created_at)
        const timeString = updateTime.toLocaleString('nl-NL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })

        const finalSensor1Name = sensor1Config?.display_name || "Sensor 1"
        
        setSensorData(prev => ({
          ...prev,
          vijverWater: {
            temperature: sensor1Data.temperature,
            lastUpdate: timeString,
            sensorType: sensor1Data.sensor_type,
            sensorName: finalSensor1Name,
            loading: false,
            error: null
          }
        }))
      } else {
        setSensorData(prev => ({
          ...prev,
          vijverWater: {
            ...prev.vijverWater,
            temperature: null,
            lastUpdate: "No data",
            loading: false,
            error: null
          }
        }))
      }

      // Process Sensor 2
      if (sensor2Data) {
        const updateTime = new Date(sensor2Data.created_at)
        const timeString = updateTime.toLocaleString('nl-NL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })

        const finalSensor2Name = sensor2Config?.display_name || "Sensor 2"
        
        setSensorData(prev => ({
          ...prev,
          filterInlaat: {
            temperature: sensor2Data.temperature,
            lastUpdate: timeString,
            sensorType: sensor2Data.sensor_type,
            sensorName: finalSensor2Name,
            loading: false,
            error: null
          }
        }))
      } else {
        setSensorData(prev => ({
          ...prev,
          filterInlaat: {
            ...prev.filterInlaat,
            temperature: null,
            lastUpdate: "No data",
            loading: false,
            error: null
          }
        }))
      }

      setSensorData(prev => ({
        ...prev,
        loading: false,
        error: null
      }))

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
    }
  }, [user])

  return {
    ...sensorData,
    refresh: loadSensorData
  }
}
