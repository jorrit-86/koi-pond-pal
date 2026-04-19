import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface ParameterData {
  historicData: Array<{ date: string; value: number; time: string }>
  currentValue: number
  status: "optimal" | "warning" | "critical"
  loading: boolean
}

interface ParameterConfig {
  parameterType: string
  getStatus: (value: number) => "optimal" | "warning" | "critical"
}

export function useParameterData(config: ParameterConfig): ParameterData {
  const { user } = useAuth()
  const [historicData, setHistoricData] = useState<Array<{ date: string; value: number; time: string }>>([])
  const [currentValue, setCurrentValue] = useState<number>(0)
  const [status, setStatus] = useState<"optimal" | "warning" | "critical">("optimal")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadParameterData()
    }
  }, [user, config.parameterType])

  const loadParameterData = async () => {
    if (!user || !user.id) {
      setHistoricData([])
      setCurrentValue(0)
      setStatus("optimal")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 10000) // 10 seconds
      })
      
      // Get parameter data from database
      const queryPromise = supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user.id)
        .eq('parameter_type', config.parameterType)
        .order('measured_at', { ascending: false })

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      if (error) {
        console.error(`Error loading ${config.parameterType} data:`, error)
        setHistoricData([])
        setCurrentValue(0)
        setStatus("optimal")
        return
      }

      if (data && data.length > 0) {
        // Set current value (most recent) - prioritize manual measurements
        const mostRecentReading = data[0]
        setCurrentValue(mostRecentReading.value)
        setStatus(config.getStatus(mostRecentReading.value))

        // Process historical data - group by date and take most recent per date
        const dataByDate = new Map<string, any>()
        
        data.forEach(reading => {
          const date = new Date(reading.measured_at).toISOString().split('T')[0]
          if (!dataByDate.has(date) || new Date(reading.measured_at) > new Date(dataByDate.get(date).measured_at)) {
            dataByDate.set(date, reading)
          }
        })

        // Convert to chart format and sort by date
        const chartData = Array.from(dataByDate.values())
          .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
          .slice(-7) // Last 7 days
          .map(reading => ({
            date: new Date(reading.measured_at).toISOString().split('T')[0],
            value: reading.value,
            time: new Date(reading.measured_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
            timestamp: reading.measured_at,
            measured_at: reading.measured_at
          }))

        setHistoricData(chartData)
      } else {
        // No data available
        setHistoricData([])
        setCurrentValue(0)
        setStatus("optimal")
      }
    } catch (error: any) {
      console.error(`Error in loadParameterData for ${config.parameterType}:`, error)
      if (error?.message === 'Query timeout') {
        console.warn(`loadParameterData for ${config.parameterType} timed out after 10 seconds`)
      }
      setHistoricData([])
      setCurrentValue(0)
      setStatus("optimal")
    } finally {
      setLoading(false)
    }
  }

  return {
    historicData,
    currentValue,
    status,
    loading
  }
}
