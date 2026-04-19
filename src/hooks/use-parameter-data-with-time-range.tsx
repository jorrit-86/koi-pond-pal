import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface ParameterData {
  historicData: Array<{ date: string; value: number; time: string; timestamp?: string; source?: 'manual' | 'sensor' }>
  currentValue: number
  status: "optimal" | "warning" | "critical"
  loading: boolean
  hasDataInTimeRange: boolean
  hasAnyDataInDatabase: boolean
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

export function useParameterDataWithTimeRange(config: ParameterConfig, timeRange: string = "30d"): ParameterData {
  const { user, session } = useAuth()
  const [historicData, setHistoricData] = useState<Array<{ date: string; value: number; time: string; timestamp?: string; source?: 'manual' | 'sensor' }>>([])
  const [currentValue, setCurrentValue] = useState<number>(0)
  const [status, setStatus] = useState<"optimal" | "warning" | "critical">("optimal")
  const [loading, setLoading] = useState(true)
  const [hasDataInTimeRange, setHasDataInTimeRange] = useState<boolean>(false)
  const [hasAnyDataInDatabase, setHasAnyDataInDatabase] = useState<boolean>(false)
  const [timeRangeInfo, setTimeRangeInfo] = useState<{ range: string; startDate: string; endDate: string }>({
    range: timeRange,
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    if (user && user.id) {
      loadParameterData()
    } else if (!user) {
      setLoading(false)
    }
  }, [user, config.parameterType, timeRange])

  // Calculate start date based on time range
  const getDateRange = (timeRange: string): { startDate: Date; endDate: Date } => {
    const endDate = new Date()
    // Set endDate to end of today (23:59:59.999) to include all measurements from today
    endDate.setHours(23, 59, 59, 999)
    
    const startDate = new Date()
    
    switch (timeRange) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        break
      case "30d":
        startDate.setDate(endDate.getDate() - 30)
        startDate.setHours(0, 0, 0, 0)
        break
      case "90d":
        startDate.setDate(endDate.getDate() - 90)
        startDate.setHours(0, 0, 0, 0)
        break
      case "365d":
        startDate.setDate(endDate.getDate() - 365)
        startDate.setHours(0, 0, 0, 0)
        break
      default:
        startDate.setDate(endDate.getDate() - 30)
        startDate.setHours(0, 0, 0, 0)
    }
    
    return { startDate, endDate }
  }

  const loadParameterData = async () => {
    if (!user || !user.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const { startDate, endDate } = getDateRange(timeRange)
      // Use the parameterType as-is for matching (case-insensitive)
      // Also try common variations (ph vs pH)
      const parameterTypeLower = config.parameterType.toLowerCase()
      const parameterTypeVariations = [
        parameterTypeLower,
        config.parameterType, // Original case
        // For pH specifically, try both 'ph' and 'pH'
        ...(parameterTypeLower === 'ph' ? ['pH', 'Ph', 'PH'] : []),
        // For other parameters, try capitalized version
        ...(parameterTypeLower !== 'ph' ? [config.parameterType.charAt(0).toUpperCase() + config.parameterType.slice(1).toLowerCase()] : [])
      ]
      
      // Update time range info
      setTimeRangeInfo({
        range: timeRange,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })

      let allData: any[] = []

      // Try direct fetch first if we have session token
      if (session?.access_token) {
        try {
          // First, try to fetch ALL data for this user to see what parameter_types exist
          const allUserDataResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_parameters?user_id=eq.${user.id}&select=parameter_type&limit=1000`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (allUserDataResponse.ok) {
            const allUserData = await allUserDataResponse.json()
            const uniqueTypes = [...new Set(allUserData.map((d: any) => d.parameter_type))]
            console.log(`Found parameter_types in database for user:`, uniqueTypes)
          }

          // Fetch ALL data for this parameter type using case-insensitive matching
          // Use ilike operator which is case-insensitive
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_parameters?user_id=eq.${user.id}&parameter_type=ilike.${encodeURIComponent(parameterTypeLower)}&select=*&order=measured_at.asc&limit=10000`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (response.ok) {
            const data = await response.json()
            allData = Array.isArray(data) ? data : []
            console.log(`Loaded ${allData.length} total records for ${config.parameterType} (searching for: ${parameterTypeLower}) using direct fetch`)
            
            // Log sample of parameter_type values found
            if (allData.length > 0) {
              const sampleTypes = [...new Set(allData.slice(0, 10).map((d: any) => d.parameter_type))]
              console.log(`Sample parameter_type values found:`, sampleTypes)
            }
          } else {
            const errorText = await response.text()
            console.warn(`Direct fetch returned ${response.status}:`, errorText)
          }
        } catch (error) {
          console.warn('Direct fetch failed, trying Supabase client:', error)
        }
      }

      // If direct fetch didn't work or returned no data, try Supabase client
      if (allData.length === 0) {
        // Try with ilike (case-insensitive)
        const { data, error } = await supabase
          .from('water_parameters')
          .select('*')
          .eq('user_id', user.id)
          .ilike('parameter_type', parameterTypeLower)
          .order('measured_at', { ascending: true })
          .limit(10000)

        if (error) {
          console.error(`Error loading ${config.parameterType} data:`, error)
          setHistoricData([])
          setCurrentValue(0)
          setStatus("optimal")
          setHasDataInTimeRange(false)
          setHasAnyDataInDatabase(false)
          setLoading(false)
          return
        }

        allData = data || []
        console.log(`Loaded ${allData.length} total records for ${config.parameterType} (searching for: ${parameterTypeLower}) using Supabase client`)
        
        // Log sample of parameter_type values found
        if (allData.length > 0) {
          const sampleTypes = [...new Set(allData.slice(0, 10).map((d: any) => d.parameter_type))]
          console.log(`Sample parameter_type values found:`, sampleTypes)
        }
      }
      
      // If still no data, try filtering client-side from all user data
      if (allData.length === 0) {
        console.log(`No data found with ilike, trying to fetch all user data and filter client-side...`)
        try {
          const { data: allUserData, error: allUserError } = await supabase
            .from('water_parameters')
            .select('*')
            .eq('user_id', user.id)
            .order('measured_at', { ascending: true })
            .limit(10000)
          
          if (!allUserError && allUserData) {
            // Filter client-side using case-insensitive matching
            allData = allUserData.filter((item: any) => 
              parameterTypeVariations.some(variation => 
                item.parameter_type?.toLowerCase() === variation.toLowerCase()
              )
            )
            console.log(`Filtered ${allData.length} records from ${allUserData.length} total records using client-side filtering`)
            
            // Log what parameter_types exist in database
            const allTypes = [...new Set(allUserData.map((d: any) => d.parameter_type))]
            console.log(`All parameter_type values in database:`, allTypes)
          }
        } catch (error) {
          console.error('Error fetching all user data:', error)
        }
      }

      // Mark if we have any data in database
      setHasAnyDataInDatabase(allData.length > 0)

      // Debug: Log all dates to understand what we have
      console.log(`=== DATE FILTERING DEBUG for ${config.parameterType} ===`)
      console.log(`Total records loaded: ${allData.length}`)
      console.log(`Date range: ${startDate.toLocaleDateString('nl-NL')} ${startDate.toLocaleTimeString('nl-NL')} to ${endDate.toLocaleDateString('nl-NL')} ${endDate.toLocaleTimeString('nl-NL')}`)
      console.log(`Date range (ISO): ${startDate.toISOString()} to ${endDate.toISOString()}`)
      
      // Log each record with its date and whether it's in range
      const dateAnalysis = allData.map((item: any) => {
        const measuredAt = new Date(item.measured_at)
        const isInRange = measuredAt >= startDate && measuredAt <= endDate
        const daysFromStart = Math.round((measuredAt.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        return {
          id: item.id,
          measured_at: item.measured_at,
          formatted: measuredAt.toLocaleString('nl-NL'),
          value: item.value,
          isInRange,
          daysFromStart,
          measuredAtTimestamp: measuredAt.getTime(),
          startDateTimestamp: startDate.getTime(),
          endDateTimestamp: endDate.getTime()
        }
      })
      
      // Log each record individually for better visibility
      console.log(`Date analysis (${dateAnalysis.length} records):`)
      dateAnalysis.forEach((record, index) => {
        console.log(`  Record ${index + 1}:`, {
          date: record.formatted,
          value: record.value,
          isInRange: record.isInRange ? '✅ IN RANGE' : '❌ OUT OF RANGE',
          daysFromStart: record.daysFromStart,
          measured_at: record.measured_at
        })
      })
      
      // Summary
      const inRange = dateAnalysis.filter(r => r.isInRange)
      const outOfRange = dateAnalysis.filter(r => !r.isInRange)
      console.log(`Summary: ${inRange.length} in range, ${outOfRange.length} out of range`)
      
      if (outOfRange.length > 0) {
        console.log(`Records outside range:`)
        outOfRange.forEach((record, index) => {
          console.log(`  ${index + 1}. ${record.formatted} (${record.daysFromStart} days from start, value: ${record.value})`)
        })
      }

      // Filter data to only include measurements within the selected time range
      const filteredData = allData.filter(item => {
        const measuredAt = new Date(item.measured_at)
        return measuredAt >= startDate && measuredAt <= endDate
      })

      console.log(`Filtered to ${filteredData.length} records within ${timeRange} range (${startDate.toLocaleDateString('nl-NL')} to ${endDate.toLocaleDateString('nl-NL')})`)
      console.log(`Records outside range: ${allData.length - filteredData.length}`)

      if (filteredData.length === 0) {
        setHistoricData([])
        setCurrentValue(0)
        setStatus("optimal")
        setHasDataInTimeRange(false)
        setLoading(false)
        return
      }

      // Group by date and keep only the last measurement of each day
      const dataByDate = new Map<string, any>()
      
      filteredData.forEach(item => {
        const measuredAt = new Date(item.measured_at)
        const dateKey = measuredAt.toISOString().split('T')[0] // YYYY-MM-DD
        
        // If we already have data for this date, keep the one with the latest timestamp
        const existing = dataByDate.get(dateKey)
        if (!existing || new Date(item.measured_at) > new Date(existing.measured_at)) {
          dataByDate.set(dateKey, item)
        }
      })

      // Convert to array and transform for chart
      const chartData = Array.from(dataByDate.values())
        .map(item => {
          const measuredAt = new Date(item.measured_at)
          return {
            date: measuredAt.toISOString().split('T')[0],
            value: item.value,
            time: measuredAt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
            timestamp: item.measured_at,
            source: 'manual' as const
          }
        })
        .sort((a, b) => {
          const timeA = new Date(a.timestamp || a.date).getTime()
          const timeB = new Date(b.timestamp || b.date).getTime()
          return timeA - timeB
        })

      console.log(`After grouping by date: ${chartData.length} unique days with data`)

      // Set current value (most recent)
      const mostRecent = chartData[chartData.length - 1]
      setCurrentValue(mostRecent.value)
      setStatus(config.getStatus(mostRecent.value))
      setHistoricData(chartData)
      setHasDataInTimeRange(true)
      setLoading(false)

    } catch (error) {
      console.error(`Error loading ${config.parameterType} data:`, error)
      setHistoricData([])
      setCurrentValue(0)
      setStatus("optimal")
      setHasDataInTimeRange(false)
      setLoading(false)
    }
  }

  return {
    historicData,
    currentValue,
    status,
    loading,
    hasDataInTimeRange,
    hasAnyDataInDatabase,
    timeRangeInfo
  }
}
