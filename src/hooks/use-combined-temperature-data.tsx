import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useSensorData } from "./use-sensor-data"

interface TemperatureDataPoint {
  date: string
  value: number
  time: string
  source: 'manual' | 'sensor'
  timestamp: string
  sensor_type?: string
  sensor_id?: string
  sensor_name?: string
  sensor1_value?: number
  sensor1_timestamp?: string
  sensor2_value?: number
  sensor2_timestamp?: string
}

export function useCombinedTemperatureData(timeRange: string = "7d", specificSensorId?: string) {
  const { user } = useAuth()
  const { temperature: sensorTemp, lastUpdate: sensorLastUpdate, loading: sensorLoading } = useSensorData()
  const [combinedData, setCombinedData] = useState<TemperatureDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCombinedData = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // Fetch sensor data from sensor_data (primary source)
      let sensorQuery = supabase
        .from('sensor_data')
        .select('temperature, created_at, sensor_type, sensor_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) // Get most recent first
        .limit(1000) // Limit to 1000 most recent records

      // If specific sensor ID is provided, filter by that sensor
      if (specificSensorId) {
        sensorQuery = sensorQuery.eq('sensor_id', specificSensorId)
      }

      const { data: sensorData, error: sensorError } = await sensorQuery

      if (sensorError) throw sensorError

      // Debug logging removed

      // Get display names from individual_sensor_configs
      const { data: configData, error: configError } = await supabase
        .from('individual_sensor_configs')
        .select('sensor_type, display_name, sensor_id')

      if (configError) {
        console.error('Error loading sensor configs:', configError)
      }

      // Combine and format data
      const combined: TemperatureDataPoint[] = []

      // Add sensor readings
      if (sensorData) {
        sensorData.forEach(reading => {
          const date = new Date(reading.created_at)
          const temperature = parseFloat(reading.temperature)
          
          // More strict validation for temperature values
          if (!isNaN(temperature) && 
              temperature >= 0 && 
              temperature <= 50 && 
              typeof temperature === 'number') {
            
            // Get sensor display name from config or use default
            const sensorConfig = configData?.find(c => 
              c.sensor_id === reading.sensor_id
            )
            
            let sensorName = sensorConfig?.display_name || 'Sensor'
            if (!sensorConfig) {
              // Fallback to default names based on sensor ID pattern
              if (reading.sensor_id && reading.sensor_id.endsWith('-01')) {
                sensorName = 'Vijver Water Temperatuur'
              } else if (reading.sensor_id && reading.sensor_id.endsWith('-02')) {
                sensorName = 'Filter Inlaat Temperatuur'
              } else if (reading.sensor_type === 'sensor_1') {
                sensorName = 'Sensor 1'
              } else if (reading.sensor_type === 'sensor_2') {
                sensorName = 'Sensor 2'
              } else if (reading.sensor_type === 'vijver_water') {
                sensorName = 'Sensor 1' // Legacy support
              } else if (reading.sensor_type === 'filter_inlaat') {
                sensorName = 'Sensor 2' // Legacy support
              }
            }
            
            combined.push({
              date: date.toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
              value: temperature,
              time: date.toLocaleTimeString('nl-NL', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
              source: 'sensor',
              timestamp: reading.created_at,
              sensor_type: reading.sensor_type,
              sensor_id: reading.sensor_id,
              sensor_name: sensorName
            })
          }
        })
      }

      // Sort by timestamp (chronological order) - reverse since we got most recent first
      combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      // Get data based on selected time range
      const now = new Date()
      let cutoffDate = new Date()
      
      switch (timeRange) {
        case "1h":
          cutoffDate = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
          break
        case "4h":
          cutoffDate = new Date(now.getTime() - 4 * 60 * 60 * 1000) // 4 hours ago
          break
        case "24h":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
          break
        case "7d":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
          break
        case "14d":
          cutoffDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
          break
        case "30d":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
          break
        case "90d":
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
          break
        case "365d":
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // 365 days ago
          break
        default:
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
          break
      }
      
      let recentData = combined.filter(point => {
        const pointDate = new Date(point.timestamp)
        return pointDate >= cutoffDate
      })

      // For 24h, show 1 point per hour to reduce clutter
      if (timeRange === "24h") {
        
        const hourlyData: TemperatureDataPoint[] = []
        const hourMap = new Map<string, TemperatureDataPoint>()
        
        // Group data by hour AND sensor_id, take the first measurement of each hour for each sensor
        recentData.forEach(point => {
          const date = new Date(point.timestamp)
          const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${point.sensor_id}`
          
          // Only keep the first measurement of each hour for each sensor
          if (!hourMap.has(hourKey)) {
            hourMap.set(hourKey, point)
          }
        })
        
        // Convert map back to array and sort by timestamp
        recentData = Array.from(hourMap.values()).sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        
      }
      
      // For longer periods (7d or more), show only the first measurement of each hour
      if (timeRange === "7d" || timeRange === "14d" || timeRange === "30d" || timeRange === "90d" || timeRange === "365d") {
        const hourlyData: TemperatureDataPoint[] = []
        const hourMap = new Map<string, TemperatureDataPoint>()
        
        recentData.forEach(point => {
          const date = new Date(point.timestamp)
          const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${point.sensor_id}`
          
          // Only keep the first measurement of each hour for each sensor
          if (!hourMap.has(hourKey)) {
            hourMap.set(hourKey, point)
          }
        })
        
        // Convert map back to array and sort by timestamp
        recentData = Array.from(hourMap.values()).sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      }

      setCombinedData(recentData)

    } catch (err: any) {
      console.error('Error loading combined temperature data:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadCombinedData()
      
      // Auto-refresh disabled - data will only load on initial mount or manual refresh
      // const interval = setInterval(loadCombinedData, 120000)
      // return () => clearInterval(interval)
    }
  }, [user, timeRange, specificSensorId])

  // Get current value (prioritize sensor if available)
  const currentValue = sensorTemp !== null ? sensorTemp : 
    combinedData.length > 0 ? combinedData[combinedData.length - 1].value : null

  // Get current status
  const getTemperatureStatus = (value: number): "optimal" | "warning" | "critical" => {
    if (value >= 15 && value <= 25) return "optimal"
    if (value >= 10 && value <= 30) return "warning"
    return "critical"
  }

  const status = currentValue ? getTemperatureStatus(currentValue) : "optimal"

  return {
    combinedData,
    currentValue,
    status,
    loading: loading || sensorLoading,
    error: error || null,
    refresh: loadCombinedData,
    sensorTemp,
    sensorLastUpdate
  }
}
