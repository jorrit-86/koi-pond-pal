import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface TemperatureDataPoint {
  date: string
  value: number
  time: string
  source: 'manual' | 'sensor'
  timestamp: string
  sensor_type?: string
  sensor_id?: string
  sensor_name?: string
}

interface SensorInfo {
  sensor_id: string
  display_name: string
  location?: string
  status?: string
  color?: string
}

export function useMultiSensorTemperatureData(timeRange: string = "7d") {
  const { user } = useAuth()
  const [combinedData, setCombinedData] = useState<TemperatureDataPoint[]>([])
  const [sensors, setSensors] = useState<SensorInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasDataInTimeRange, setHasDataInTimeRange] = useState(true)
  const [timeRangeInfo, setTimeRangeInfo] = useState<{
    range: string
    startDate: string
    endDate: string
  } | null>(null)

  const getDateRange = (timeRange: string) => {
    const now = new Date()
    const startDate = new Date(now)
    
    switch (timeRange) {
      case "1h":
        startDate.setTime(now.getTime() - (1 * 60 * 60 * 1000))
        break
      case "4h":
        startDate.setTime(now.getTime() - (4 * 60 * 60 * 1000))
        break
      case "24h":
        startDate.setTime(now.getTime() - (24 * 60 * 60 * 1000))
        break
      case "7d":
        // 7 days ago - use date calculation for consistency
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0) // Start of day 7 days ago
        startDate.setTime(sevenDaysAgo.getTime())
        break
      case "14d":
        // 14 days ago - use date calculation for consistency
        const fourteenDaysAgo = new Date(now)
        fourteenDaysAgo.setDate(now.getDate() - 14)
        fourteenDaysAgo.setHours(0, 0, 0, 0) // Start of day 14 days ago
        startDate.setTime(fourteenDaysAgo.getTime())
        break
      case "30d":
        // 30 days ago - use date calculation for consistency
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(now.getDate() - 30)
        thirtyDaysAgo.setHours(0, 0, 0, 0) // Start of day 30 days ago
        startDate.setTime(thirtyDaysAgo.getTime())
        break
      case "90d":
        // 90 days ago - use date calculation for consistency
        const ninetyDaysAgo = new Date(now)
        ninetyDaysAgo.setDate(now.getDate() - 90)
        ninetyDaysAgo.setHours(0, 0, 0, 0) // Start of day 90 days ago
        startDate.setTime(ninetyDaysAgo.getTime())
        break
      case "365d":
        // 365 days ago - use date calculation for consistency
        const threeSixtyFiveDaysAgo = new Date(now)
        threeSixtyFiveDaysAgo.setDate(now.getDate() - 365)
        threeSixtyFiveDaysAgo.setHours(0, 0, 0, 0) // Start of day 365 days ago
        startDate.setTime(threeSixtyFiveDaysAgo.getTime())
        break
      default:
        // Default to 7 days ago
        const defaultDaysAgo = new Date(now)
        defaultDaysAgo.setDate(now.getDate() - 7)
        defaultDaysAgo.setHours(0, 0, 0, 0) // Start of day 7 days ago
        startDate.setTime(defaultDaysAgo.getTime())
    }
    
    return startDate.toISOString()
  }

  const getDataLimit = (timeRange: string) => {
    switch (timeRange) {
      case "1h": return 50
      case "4h": return 100
      case "24h": return 200
      case "7d": return 500
      case "14d": return 1000
      case "30d": return 2000
      case "90d": return 5000
      case "365d": return 10000
      default: return 500
    }
  }

  const loadMultiSensorData = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const now = new Date() // Define now here
      const startDate = getDateRange(timeRange)
      const dataLimit = getDataLimit(timeRange)


      // Fetch all temperature sensor data
      let sensorData: any[] = []
      let sensorError: any = null

      // Special handling for 7 days - get ALL data and filter client-side
      if (timeRange === "7d") {
        console.log(`=== 7 DAYS DATA FETCHING ===`)
        
        // Get ALL temperature data for the user (no date filtering)
        let allDataQuery = supabase
          .from('sensor_data')
          .select('*')
          .eq('user_id', user.id)
          .eq('sensor_type', 'temperatuurmeter')
          .order('created_at', { ascending: false })
          .limit(2000) // Get more data to ensure we have enough

        // Race query against timeout
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('7d query timeout')), 10000) // 10 second timeout
          })
          
          const { data: allData, error: allError } = await Promise.race([allDataQuery, timeoutPromise]) as any

          if (allError) {
            console.error('Error fetching all data:', allError)
            sensorError = allError
          } else {
          console.log(`Fetched ${allData?.length || 0} total data points`)
          
          if (allData && allData.length > 0) {
            // Calculate 7 days ago from now
            const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
            console.log(`Filtering data from ${sevenDaysAgo.toLocaleString('nl-NL')} to ${now.toLocaleString('nl-NL')}`)
            
            // Filter data client-side for last 7 days
            const filteredData = allData.filter(item => {
              const itemDate = new Date(item.created_at)
              return itemDate >= sevenDaysAgo && itemDate <= now
            })
            
            console.log(`After client-side filtering: ${filteredData.length} data points`)
            
            // If we still don't have enough data, try a more lenient approach
            if (filteredData.length === 0) {
              console.log('No data in strict 7 days, trying lenient approach...')
              const lenientStart = new Date(now.getTime() - (8 * 24 * 60 * 60 * 1000)) // 8 days ago
              const lenientData = allData.filter(item => {
                const itemDate = new Date(item.created_at)
                return itemDate >= lenientStart
              })
              console.log(`Lenient filtering (8 days): ${lenientData.length} data points`)
              sensorData = lenientData
            } else {
              sensorData = filteredData
            }
          } else {
            sensorData = []
            console.log('No data found in database')
          }
        }
        } catch (timeoutError: any) {
          if (timeoutError.message === '7d query timeout') {
            console.warn('7d query timed out after 10 seconds')
            sensorData = []
            sensorError = timeoutError
          } else {
            throw timeoutError
          }
        }
      } else {
        // Standard approach for other time ranges
        let standardQuery = supabase
          .from('sensor_data')
          .select('*')
          .eq('user_id', user.id)
          .eq('sensor_type', 'temperatuurmeter')
          .gte('created_at', startDate)
          .order('created_at', { ascending: false })
          .limit(dataLimit)

        // Race query against timeout
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Standard query timeout')), 10000) // 10 second timeout
          })
          
          const { data: standardData, error: standardError } = await Promise.race([standardQuery, timeoutPromise]) as any
          
          sensorData = standardData || []
          sensorError = standardError
        } catch (timeoutError: any) {
          if (timeoutError.message === 'Standard query timeout') {
            console.warn('Standard query timed out after 10 seconds')
            sensorData = []
            sensorError = timeoutError
          } else {
            throw timeoutError
          }
        }
      }

      if (sensorError) throw sensorError

      // Debug: Log data count for 7 days
      if (timeRange === "7d") {
        console.log(`=== 7 DAYS FINAL RESULT ===`)
        console.log(`Final result: Found ${sensorData?.length || 0} sensor data points for 7 days`)
        if (sensorData && sensorData.length > 0) {
          const sortedData = sensorData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          const oldestData = sortedData[0]
          const newestData = sortedData[sortedData.length - 1]
          console.log(`Data range: ${new Date(oldestData.created_at).toLocaleString('nl-NL')} to ${new Date(newestData.created_at).toLocaleString('nl-NL')}`)
          console.log(`Data points per sensor:`)
          const sensorCounts = sortedData.reduce((acc, item) => {
            acc[item.sensor_id] = (acc[item.sensor_id] || 0) + 1
            return acc
          }, {} as { [key: string]: number })
          console.log(sensorCounts)
        } else {
          console.log('No data found for 7 days period')
        }
      }

      // Get all unique sensor IDs and their configurations
      const uniqueSensorIds = [...new Set(sensorData?.map(d => d.sensor_id) || [])]
      
      // Try both tables to get sensor configurations
      let configData: any[] = []
      let configError: any = null

      // Load config with timeout
      if (uniqueSensorIds.length > 0) {
        try {
          const configQueryPromise = supabase
            .from('individual_sensor_configs')
            .select('sensor_id, display_name')
            .in('sensor_id', uniqueSensorIds)
          
          const configTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Config query timeout')), 5000) // 5 second timeout
          })
          
          const { data: individualConfigs, error: individualError } = await Promise.race([configQueryPromise, configTimeout]) as any

          if (individualError) {
            console.error('Error loading individual_sensor_configs:', individualError)
            configError = individualError
          } else {
            if (individualConfigs && individualConfigs.length > 0) {
              configData = individualConfigs
              console.log('Found data in individual_sensor_configs:', configData)
            } else {
              console.log('No data in individual_sensor_configs, trying sensor_configurations...')
              try {
                const sensorConfigQueryPromise = supabase
                  .from('sensor_configurations')
                  .select('sensor_id, sensor_name')
                  .in('sensor_id', uniqueSensorIds)
                
                const sensorConfigTimeout = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Sensor config query timeout')), 5000) // 5 second timeout
                })
                
                const { data: sensorConfigs, error: sensorError } = await Promise.race([sensorConfigQueryPromise, sensorConfigTimeout]) as any
                
                if (sensorError) {
                  console.error('Error loading sensor_configurations:', sensorError)
                  configError = sensorError
                } else if (sensorConfigs && sensorConfigs.length > 0) {
                  console.log('Found data in sensor_configurations:', sensorConfigs)
                  configData = sensorConfigs.map((config: any) => ({
                    sensor_id: config.sensor_id,
                    display_name: config.sensor_name,
                    location: config.location,
                    status: config.status
                  }))
                }
              } catch (sensorConfigError) {
                console.warn('Sensor config query timed out or failed:', sensorConfigError)
                // Continue without config data
              }
            }
          }
        } catch (configTimeoutError) {
          console.warn('Config query timed out or failed:', configTimeoutError)
          // Continue without config data
        }
      }

      if (configError) {
        console.error('Error loading sensor configs:', configError)
      }

      console.log('Sensor configs loaded:', configData)
      console.log('Unique sensor IDs:', uniqueSensorIds)
      
      // Debug: Check what's in the database
      console.log('=== DEBUGGING SENSOR NAMES ===')
      console.log('Found sensor IDs:', uniqueSensorIds)
      console.log('Config data from database:', configData)
      
      // If no config data, let's check what's actually in the database
      if (!configData || configData.length === 0) {
        console.log('No config data found, checking database tables...')
        
        // Check individual_sensor_configs table
        const { data: allIndividualConfigs } = await supabase
          .from('individual_sensor_configs')
          .select('*')
          .eq('user_id', user.id)
        
        console.log('All individual_sensor_configs for user:', allIndividualConfigs)
        
        // Check sensor_configurations table
        const { data: allSensorConfigs } = await supabase
          .from('sensor_configurations')
          .select('*')
          .eq('user_id', user.id)
        
        console.log('All sensor_configurations for user:', allSensorConfigs)
      }

      // Create sensor info with colors
      const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']
      const sensorsInfo: SensorInfo[] = uniqueSensorIds.map((sensorId, index) => {
        const config = configData?.find(c => c.sensor_id === sensorId)
        
        // Try to get a better name from the sensor data itself
        const sensorDataPoint = sensorData?.find(d => d.sensor_id === sensorId)
        let displayName = config?.display_name || `Sensor ${index + 1}`
        
        // If we have sensor data with a name, use that
        if (sensorDataPoint && sensorDataPoint.sensor_name) {
          displayName = sensorDataPoint.sensor_name
        }
        
        // Special handling for known sensor IDs with specific colors
        if (sensorId.includes('-01')) {
          displayName = 'Water Temperatuur'
        } else if (sensorId.includes('-02')) {
          displayName = 'Buitentemperatuur'
        } else if (sensorId.includes('KOIoT')) {
          displayName = 'Vijver Temperatuur'
        }
        
        console.log(`Sensor ${sensorId}: using display name "${displayName}"`)
        
        // Assign specific colors based on sensor type
        let sensorColor = colors[index % colors.length]
        if (displayName === 'Water Temperatuur') {
          sensorColor = '#3b82f6' // Blue
        } else if (displayName === 'Buitentemperatuur') {
          sensorColor = '#f59e0b' // Orange
        } else if (displayName === 'Vijver Temperatuur') {
          sensorColor = '#10b981' // Green
        }
        
        console.log(`Sensor ${sensorId} (${displayName}): using color "${sensorColor}"`)
        
        return {
          sensor_id: sensorId,
          display_name: displayName,
          location: config?.location,
          status: config?.status || 'active',
          color: sensorColor
        }
      })

      console.log('Final sensors info:', sensorsInfo)
      setSensors(sensorsInfo)

      // Process data for chart
      if (sensorData && sensorData.length > 0) {
        console.log(`Processing ${sensorData.length} data points for chart`)
        
        // Sort data by timestamp (oldest first for proper chart display)
        const sortedData = sensorData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        
        console.log(`Sorted data range: ${new Date(sortedData[0].created_at).toLocaleString('nl-NL')} to ${new Date(sortedData[sortedData.length - 1].created_at).toLocaleString('nl-NL')}`)
        
        const chartData: TemperatureDataPoint[] = sortedData.map(reading => {
          const sensor = sensorsInfo.find(s => s.sensor_id === reading.sensor_id)
          return {
            date: new Date(reading.created_at).toISOString().split('T')[0],
            value: reading.temperature,
            time: new Date(reading.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
            source: 'sensor' as const,
            timestamp: reading.created_at,
            sensor_type: reading.sensor_type,
            sensor_id: reading.sensor_id,
            sensor_name: sensor?.display_name || 'Unknown Sensor'
          }
        })

        console.log(`Final chart data: ${chartData.length} points`)
        setCombinedData(chartData)
        
        // Set hasDataInTimeRange and timeRangeInfo
        setHasDataInTimeRange(chartData.length > 0)
        setTimeRangeInfo({
          range: timeRange,
          startDate: startDate,
          endDate: now.toISOString()
        })
      } else {
        console.log('No sensor data to process')
        setCombinedData([])
        setHasDataInTimeRange(false)
        setTimeRangeInfo({
          range: timeRange,
          startDate: startDate,
          endDate: now.toISOString()
        })
      }

    } catch (error) {
      console.error('Error loading multi-sensor temperature data:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
      // Ensure data is set to empty arrays on error
      setCombinedData([])
      setHasDataInTimeRange(false)
    } finally {
      // Always clear loading state, even if there was an error or early return
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadMultiSensorData()
    } else if (!user) {
      // If no user, clear loading state
      setLoading(false)
    }
  }, [user, timeRange])

  // Add timeout to prevent infinite loading
  useEffect(() => {
    if (loading && user) {
      const timeout = setTimeout(() => {
        console.warn('Multi-sensor temperature data loading timeout - forcing loading to false')
        setLoading(false)
        setError('Loading timeout - please try again')
        setCombinedData([])
        setHasDataInTimeRange(false)
      }, 15000) // 15 second timeout
      
      return () => clearTimeout(timeout)
    }
  }, [loading, user])

  return {
    combinedData,
    sensors,
    loading,
    error,
    hasDataInTimeRange,
    timeRangeInfo,
    refetch: loadMultiSensorData
  }
}
