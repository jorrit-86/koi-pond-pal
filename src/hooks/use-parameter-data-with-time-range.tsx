import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface ParameterData {
  historicData: Array<{ date: string; value: number; time: string; timestamp?: string; source?: 'manual' | 'sensor'; sensor_type?: string; sensor_id?: string; sensor_name?: string }>
  currentValue: number
  status: "optimal" | "warning" | "critical"
  loading: boolean
  hasDataInTimeRange: boolean
  timeRangeInfo: {
    range: string
    startDate: string
    endDate: string
  }
}

interface ParameterConfig {
  parameterType: string
  getStatus: (value: number) => "optimal" | "warning" | "critical"
}

export function useParameterDataWithTimeRange(config: ParameterConfig, timeRange: string = "7d"): ParameterData {
  const { user } = useAuth()
  const [historicData, setHistoricData] = useState<Array<{ date: string; value: number; time: string; timestamp?: string; source?: 'manual' | 'sensor'; sensor_type?: string; sensor_id?: string; sensor_name?: string }>>([])
  const [currentValue, setCurrentValue] = useState<number>(0)
  const [status, setStatus] = useState<"optimal" | "warning" | "critical">("optimal")
  const [loading, setLoading] = useState(true)
  const [hasDataInTimeRange, setHasDataInTimeRange] = useState<boolean>(false)
  const [timeRangeInfo, setTimeRangeInfo] = useState<{ range: string; startDate: string; endDate: string }>({
    range: timeRange,
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    if (user) {
      loadParameterData()
    }
  }, [user, config.parameterType, timeRange])

  const getDateRange = (timeRange: string) => {
    const now = new Date()
    const startDate = new Date(now)
    
    switch (timeRange) {
      case "1h":
        startDate.setTime(now.getTime() - (1 * 60 * 60 * 1000)) // 1 hour ago
        break
      case "4h":
        startDate.setTime(now.getTime() - (4 * 60 * 60 * 1000)) // 4 hours ago
        break
      case "24h":
        startDate.setTime(now.getTime() - (24 * 60 * 60 * 1000)) // 24 hours ago
        break
      case "7d":
        // 7 days ago - be more precise with date calculation
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0) // Start of day 7 days ago
        startDate = sevenDaysAgo
        break
      case "14d":
        startDate.setTime(now.getTime() - (14 * 24 * 60 * 60 * 1000)) // 14 days ago
        break
      case "30d":
        startDate.setTime(now.getTime() - (30 * 24 * 60 * 60 * 1000)) // 30 days ago
        break
      case "90d":
        startDate.setTime(now.getTime() - (90 * 24 * 60 * 60 * 1000)) // 90 days ago
        break
      case "365d":
        startDate.setTime(now.getTime() - (365 * 24 * 60 * 60 * 1000)) // 365 days ago
        break
      default:
        startDate.setTime(now.getTime() - (7 * 24 * 60 * 60 * 1000)) // 7 days ago
    }
    
    return startDate.toISOString()
  }

  const getDataLimit = (timeRange: string) => {
    switch (timeRange) {
      case "1h":
        return 100 // More data points for short periods
      case "4h":
        return 200
      case "24h":
        return 500
      case "7d":
        return 50
      case "14d":
        return 100
      case "30d":
        return 200
      case "90d":
        return 500
      case "365d":
        return 1000
      default:
        return 50
    }
  }

  const loadParameterData = async () => {
    try {
      setLoading(true)
      
      // Calculate date range based on timeRange
      const now = new Date()
      const startDate = getDateRange(timeRange)
      const dataLimit = getDataLimit(timeRange)
      
      // Update time range info
      setTimeRangeInfo({
        range: timeRange,
        startDate: startDate,
        endDate: now.toISOString()
      })
      
      console.log(`Loading ${config.parameterType} data for timeRange: ${timeRange}`)
      console.log(`Current time: ${now.toISOString()} (${now.toLocaleString('nl-NL')})`)
      console.log(`Start date: ${startDate} (${new Date(startDate).toLocaleString('nl-NL')})`)
      console.log(`Time difference: ${Math.round((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60))} hours`)
      console.log(`Data limit: ${dataLimit}`)
      
      // Special debug for 7 days
      if (timeRange === "7d") {
        console.log(`=== 7 DAYS DEBUG ===`)
        console.log(`Now: ${now.toISOString()}`)
        console.log(`7 days ago start: ${startDate}`)
        console.log(`7 days ago formatted: ${new Date(startDate).toLocaleDateString('nl-NL')} ${new Date(startDate).toLocaleTimeString('nl-NL')}`)
        console.log(`Days difference: ${Math.round((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} days`)
      }
      
      // Get parameter data from database with time filtering
      let query = supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user?.id)
        .eq('parameter_type', config.parameterType)
        .gte('measured_at', startDate)
        .order('measured_at', { ascending: false })
        .limit(dataLimit)

      // For 7 days, also try a more lenient approach if no data found
      if (timeRange === "7d") {
        console.log(`Querying for 7 days with startDate: ${startDate}`)
      }

      const { data, error } = await query

      if (error) {
        console.error(`Error loading ${config.parameterType} data:`, error)
        return
      }

      console.log(`Found ${data?.length || 0} records for ${config.parameterType} within time range`)
      
      // Check if we have data within the time range
      const hasDataInRange = data && data.length > 0
      setHasDataInTimeRange(hasDataInRange)
      
      // If no data found within time range, try to get the most recent data as fallback
      // Only use fallback for longer periods, not for precise short periods
      let finalData = data
      let usedFallback = false
      
      if ((!data || data.length === 0) && (timeRange === "7d" || timeRange === "14d" || timeRange === "30d" || timeRange === "90d" || timeRange === "365d")) {
        console.log('No data found within time range, trying to get most recent data as fallback...')
        
        // Special handling for 7 days - try a more lenient date range
        if (timeRange === "7d") {
          console.log('Trying more lenient 7-day range...')
          const moreLenientStart = new Date(now)
          moreLenientStart.setDate(now.getDate() - 8) // Go back 8 days instead of 7
          moreLenientStart.setHours(0, 0, 0, 0)
          
          const { data: lenientData, error: lenientError } = await supabase
            .from('water_parameters')
            .select('*')
            .eq('user_id', user?.id)
            .eq('parameter_type', config.parameterType)
            .gte('measured_at', moreLenientStart.toISOString())
            .order('measured_at', { ascending: false })
            .limit(50)
          
          if (!lenientError && lenientData && lenientData.length > 0) {
            console.log(`Found ${lenientData.length} records with more lenient 7-day range`)
            finalData = lenientData
            usedFallback = true
          }
        }
        
        // If still no data, try general fallback
        if (!usedFallback) {
          const { data: recentData, error: recentError } = await supabase
            .from('water_parameters')
            .select('*')
            .eq('user_id', user?.id)
            .eq('parameter_type', config.parameterType)
            .order('measured_at', { ascending: false })
            .limit(20) // Get last 20 records
          
          if (!recentError && recentData && recentData.length > 0) {
            console.log(`Found ${recentData.length} recent records as fallback`)
            finalData = recentData
            usedFallback = true
          }
        }
      }
      
      if (finalData && finalData.length > 0) {
        console.log('Sample data:', finalData.slice(0, 2))
        
        // Set current value (most recent) - prioritize manual measurements
        const mostRecentReading = finalData[0]
        setCurrentValue(mostRecentReading.value)
        setStatus(config.getStatus(mostRecentReading.value))

        // Process historical data based on time range
        let chartData: any[] = []
        
        if (timeRange === "1h" || timeRange === "4h" || timeRange === "24h") {
          // For short time ranges, show all data points
          chartData = finalData
            .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
            .map(reading => ({
              date: new Date(reading.measured_at).toISOString().split('T')[0],
              value: reading.value,
              time: new Date(reading.measured_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
              timestamp: reading.measured_at,
              measured_at: reading.measured_at,
              source: reading.source || 'manual',
              sensor_type: reading.sensor_type,
              sensor_id: reading.sensor_id,
              sensor_name: reading.sensor_name
            }))
        } else {
          // For longer time ranges, group by date and take most recent per date
          const dataByDate = new Map<string, any>()
          
          finalData.forEach(reading => {
            const date = new Date(reading.measured_at).toISOString().split('T')[0]
            if (!dataByDate.has(date) || new Date(reading.measured_at) > new Date(dataByDate.get(date).measured_at)) {
              dataByDate.set(date, reading)
            }
          })

          // For 7 days, filter to only show data within the actual 7-day range
          let filteredData = Array.from(dataByDate.values())
          if (timeRange === "7d" && !usedFallback) {
            const sevenDaysAgo = new Date(now)
            sevenDaysAgo.setDate(now.getDate() - 7)
            sevenDaysAgo.setHours(0, 0, 0, 0)
            
            filteredData = filteredData.filter(reading => 
              new Date(reading.measured_at) >= sevenDaysAgo
            )
            console.log(`Filtered 7-day data: ${filteredData.length} records after date filtering`)
          }

          chartData = filteredData
            .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
            .map(reading => ({
              date: new Date(reading.measured_at).toISOString().split('T')[0],
              value: reading.value,
              time: new Date(reading.measured_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
              timestamp: reading.measured_at,
              measured_at: reading.measured_at,
              source: reading.source || 'manual',
              sensor_type: reading.sensor_type,
              sensor_id: reading.sensor_id,
              sensor_name: reading.sensor_name
            }))
        }

        console.log(`Processed ${chartData.length} chart data points`)
        setHistoricData(chartData)
      } else {
        // No data available within the time range
        console.log(`No data found for ${config.parameterType} within the specified time range: ${timeRange}`)
        setHistoricData([])
        setCurrentValue(0)
        setStatus("optimal")
      }
    } catch (error) {
      console.error(`Error in loadParameterData for ${config.parameterType}:`, error)
    } finally {
      setLoading(false)
    }
  }

  return {
    historicData,
    currentValue,
    status,
    loading,
    hasDataInTimeRange,
    timeRangeInfo
  }
}
