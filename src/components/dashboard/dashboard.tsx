import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Thermometer, Activity, Droplets, AlertTriangle, TrendingUp, Plus, History, Lightbulb, Waves, Calculator } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { MaintenanceTodos } from "@/components/maintenance/maintenance-todos"
import { testData } from "@/lib/test-data"

interface WaterParameter {
  name: string
  value: number | null
  unit: string
  status: "good" | "warning" | "danger"
  range: string
}

interface DashboardProps {
  onNavigate: (tab: string) => void
  refreshTrigger?: number // Add this to trigger refresh from parent
  onNavigateToTemperatureSensor?: (sensorId: string) => void
}

export function Dashboard({ onNavigate, refreshTrigger, onNavigateToTemperatureSensor }: DashboardProps) {
  const { t } = useTranslation()
  const { user, session, loading: authLoading } = useAuth()
  const [waterParameters, setWaterParameters] = useState<WaterParameter[]>([])
  const [loading, setLoading] = useState(true)
  const waterParametersRef = useRef<WaterParameter[]>([])
  const [koiCount, setKoiCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState("No data")
  const [pondTemperature, setPondTemperature] = useState<number | null>(null)
  const [pondSensorId, setPondSensorId] = useState<string | null>(null)
  const [pondSensorDisplayName, setPondSensorDisplayName] = useState<string>("Vijverwatertemperatuur")
  const [pondSensorLastUpdate, setPondSensorLastUpdate] = useState<string>("No data")
  const [ambientTemperature, setAmbientTemperature] = useState<number | null>(null)
  const [ambientSensorId, setAmbientSensorId] = useState<string | null>(null)
  const [ambientSensorDisplayName, setAmbientSensorDisplayName] = useState<string>("Buitentemperatuur")
  const [ambientSensorLastUpdate, setAmbientSensorLastUpdate] = useState<string>("No data")
  const [lastWaterChange, setLastWaterChange] = useState<any>(null)
  const [pondSize, setPondSize] = useState<number | null>(null)
  


  // Format time difference for display
  const formatTimeDifference = (timestamp: string | Date) => {
    const updateTime = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - updateTime.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    // If less than 1 minute
    if (diffSeconds < 60) {
      return t("dashboard.justNow")
    }
    
    // If less than 1 hour, show minutes
    if (diffMinutes < 60) {
      return `${diffMinutes} min geleden`
    }
    
    // If less than 24 hours, show hours
    if (diffHours < 24) {
      return `${diffHours} uur geleden`
    }
    
    // If 24 hours or more, show days
    return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`
  }

  // Load water parameters from database
  useEffect(() => {
    // Wait for auth to finish loading - session is optional (can use direct fetch with access token)
    if (user && !authLoading) {
      loadWaterParameters()
      loadKoiCount()
      loadLastWaterChange()
      loadPondSize()
    } else if (!user && !authLoading) {
      // If no user and auth is done loading, reset loading state
      setLoading(false)
    }
  }, [user, session, authLoading, refreshTrigger])

  // Load pond temperature and ambient temperature when available
  useEffect(() => {
    if (user && !authLoading) {
      loadPondTemperature()
      loadAmbientTemperature()
    }
  }, [user, authLoading, refreshTrigger])

  // Update temperature in water parameters when pondTemperature changes
  // This avoids reloading all parameters, just updates the temperature value
  useEffect(() => {
    if (pondTemperature !== null && waterParameters.length > 0) {
      // Find temperature parameter and update its value
      const temperatureParam = waterParameters.find(param => param.name === t("waterParameters.temperature"))
      // Only update if the value actually changed
      if (temperatureParam && temperatureParam.value !== pondTemperature) {
        const updatedParameters = waterParameters.map(param => {
          if (param.name === t("waterParameters.temperature")) {
            return {
              ...param,
              value: pondTemperature,
              status: getParameterStatus('temperature', pondTemperature)
            }
          }
          return param
        })
        waterParametersRef.current = updatedParameters
        setWaterParameters(updatedParameters)
        console.log('Updated temperature in water parameters to:', pondTemperature, '°C')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pondTemperature])


  const loadWaterParameters = async () => {
    if (!user || !user.id) {
      setLoading(false)
      return
    }

    // Check if Supabase has a session
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    
    // If no Supabase session but we have React session, use direct fetch
    if (!currentSession && session?.access_token) {
      try {
        console.log('Loading water parameters using direct fetch with access token...')
        setLoading(true)
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_parameters?user_id=eq.${user.id}&select=*&order=measured_at.desc`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('Water parameters data loaded:', data?.length || 0, 'records')
        
        // Process data the same way as normal path
        const latestReadings: Record<string, any> = {}
        data?.forEach((reading: any) => {
          // Ensure parameter_type is lowercase to match the mapping keys
          const paramType = reading.parameter_type?.toLowerCase()
          if (paramType && (!latestReadings[paramType] || 
              new Date(reading.measured_at) > new Date(latestReadings[paramType].measured_at))) {
            latestReadings[paramType] = reading
          }
        })
        
        console.log('Water parameters query result (direct fetch):', {
          totalRecords: data?.length || 0,
          uniqueParameterTypes: [...new Set(data?.map((r: any) => r.parameter_type) || [])],
          latestReadings: Object.keys(latestReadings),
          latestReadingsValues: Object.entries(latestReadings).map(([key, val]: [string, any]) => `${key}: ${val?.value || 'null'}`)
        })
        
        
        // Transform to WaterParameter format (same as below)
        // Always include all parameters, even if they have no data
        const parameters: WaterParameter[] = [
          { 
            name: t("waterParameters.ph"), 
            value: latestReadings.ph?.value ?? null, 
            unit: latestReadings.ph?.unit || "", 
            status: getParameterStatus('ph', latestReadings.ph?.value ?? 0), 
            range: "6.8-8.2" 
          },
          { 
            name: t("waterParameters.kh"), 
            value: latestReadings.kh?.value ?? null, 
            unit: latestReadings.kh?.unit || "°dH", 
            status: getParameterStatus('kh', latestReadings.kh?.value ?? 0), 
            range: "3-8°dH" 
          },
          { 
            name: t("waterParameters.gh"), 
            value: latestReadings.gh?.value ?? null, 
            unit: latestReadings.gh?.unit || "°dH", 
            status: getParameterStatus('gh', latestReadings.gh?.value ?? 0), 
            range: "4-12°dH" 
          },
          { 
            name: t("waterParameters.nitrite"), 
            value: latestReadings.nitrite?.value ?? null, 
            unit: latestReadings.nitrite?.unit || "mg/l", 
            status: getParameterStatus('nitrite', latestReadings.nitrite?.value ?? 0), 
            range: "0-0.3mg/l" 
          },
          { 
            name: t("waterParameters.nitrate"), 
            value: latestReadings.nitrate?.value ?? null, 
            unit: latestReadings.nitrate?.unit || "mg/l", 
            status: getParameterStatus('nitrate', latestReadings.nitrate?.value ?? 0), 
            range: "<25mg/l" 
          },
          { 
            name: t("waterParameters.phosphate"), 
            value: latestReadings.phosphate?.value ?? null, 
            unit: latestReadings.phosphate?.unit || "mg/l", 
            status: getParameterStatus('phosphate', latestReadings.phosphate?.value ?? 0), 
            range: "<1.0mg/l" 
          },
          { 
            name: t("waterParameters.ammonia"), 
            value: latestReadings.ammonia?.value ?? null, 
            unit: latestReadings.ammonia?.unit || "mg/l", 
            status: getParameterStatus('ammonia', latestReadings.ammonia?.value ?? 0), 
            range: "0-0.05mg/l" 
          },
          { 
            name: t("waterParameters.temperature"), 
            value: pondTemperature ?? latestReadings.temperature?.value ?? null, 
            unit: "°C", 
            status: getParameterStatus('temperature', pondTemperature ?? latestReadings.temperature?.value ?? 0), 
            range: "15-25°C" 
          },
        ]
        
        console.log('Setting water parameters (direct fetch):', parameters.length, 'parameters')
        console.log('Parameter names (direct fetch):', parameters.map(p => p.name))
        console.log('Parameter values (direct fetch):', parameters.map(p => `${p.name}: ${p.value !== null ? `${p.value}${p.unit}` : 'null'}`))
        
        waterParametersRef.current = parameters
        setWaterParameters(parameters)
        
        // Set last update time
        const latestReading = data?.[0]
        if (latestReading) {
          setLastUpdate(formatTimeDifference(latestReading.measured_at))
        } else {
          setLastUpdate("No data")
        }
        
        setLoading(false)
        return
      } catch (error) {
        console.error('Error loading water parameters with direct fetch:', error)
        setWaterParameters([])
        setLastUpdate("No data")
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)
      
      // Get the latest reading for each parameter type
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 10000) // 10 seconds
      })
      
      // Get the latest reading for each parameter type
      const queryPromise = supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })

      // Race query against timeout - wrap in try-catch to handle timeout properly
      let queryResult: any
      try {
        queryResult = await Promise.race([queryPromise, timeoutPromise])
      } catch (timeoutError: any) {
        if (timeoutError?.message === 'Query timeout') {
          console.warn('loadWaterParameters timed out after 10 seconds')
          setWaterParameters([])
          setLastUpdate("No data")
          setLoading(false)
          return
        }
        throw timeoutError // Re-throw if it's a different error
      }

      const { data, error } = queryResult





      if (error) {
        console.error('Error loading water parameters:', error)
        setWaterParameters([])
        setLastUpdate("No data")
        setLoading(false)
        return
      }

      // Check if we got any data - if not, don't overwrite existing parameters
      if (!data || data.length === 0) {
        // If we already have parameters loaded, don't overwrite them
        if (waterParametersRef.current.length > 0) {
          // Silently keep existing parameters - this is normal behavior
          setLoading(false)
          return
        }
        // If we have no existing parameters, set empty array
        setWaterParameters([])
        setLastUpdate("No data")
        setLoading(false)
        return
      }

      // Group by parameter type and get the latest value for each
      const latestReadings: Record<string, any> = {}
      data?.forEach(reading => {
        // Ensure parameter_type is lowercase to match the mapping keys
        const paramType = reading.parameter_type?.toLowerCase()
        if (paramType && (!latestReadings[paramType] || 
            new Date(reading.measured_at) > new Date(latestReadings[paramType].measured_at))) {
          latestReadings[paramType] = reading
        }
      })
      
      console.log('Water parameters query result:', {
        totalRecords: data?.length || 0,
        uniqueParameterTypes: [...new Set(data?.map((r: any) => r.parameter_type) || [])],
        latestReadings: Object.keys(latestReadings),
        latestReadingsValues: Object.entries(latestReadings).map(([key, val]: [string, any]) => `${key}: ${val?.value || 'null'}`)
      })

      // Check if we have any readings - if not, don't overwrite existing parameters
      if (Object.keys(latestReadings).length === 0) {
        console.log('No latest readings found in normal path, keeping existing parameters')
        // If we already have parameters loaded, don't overwrite them
        if (waterParametersRef.current.length > 0) {
          console.log('Keeping', waterParametersRef.current.length, 'existing parameters')
          setLoading(false)
          return
        }
        // If we have no existing parameters, set empty array
        setWaterParameters([])
        setLastUpdate("No data")
        setLoading(false)
        return
      }

      // Transform to WaterParameter format
      // Always include all parameters, even if they have no data (value will be 0 or null)
      const parameters: WaterParameter[] = [
        { 
          name: t("waterParameters.ph"), 
          value: latestReadings.ph?.value ?? null, 
          unit: latestReadings.ph?.unit || "", 
          status: getParameterStatus('ph', latestReadings.ph?.value ?? 0), 
          range: "6.8-8.2" 
        },
        { 
          name: t("waterParameters.kh"), 
          value: latestReadings.kh?.value ?? null, 
          unit: latestReadings.kh?.unit || "°dH", 
          status: getParameterStatus('kh', latestReadings.kh?.value ?? 0), 
          range: "3-8°dH" 
        },
        { 
          name: t("waterParameters.gh"), 
          value: latestReadings.gh?.value ?? null, 
          unit: latestReadings.gh?.unit || "°dH", 
          status: getParameterStatus('gh', latestReadings.gh?.value ?? 0), 
          range: "4-12°dH" 
        },
        { 
          name: t("waterParameters.nitrite"), 
          value: latestReadings.nitrite?.value ?? null, 
          unit: latestReadings.nitrite?.unit || "mg/l", 
          status: getParameterStatus('nitrite', latestReadings.nitrite?.value ?? 0), 
          range: "0-0.3mg/l" 
        },
        { 
          name: t("waterParameters.nitrate"), 
          value: latestReadings.nitrate?.value ?? null, 
          unit: latestReadings.nitrate?.unit || "mg/l", 
          status: getParameterStatus('nitrate', latestReadings.nitrate?.value ?? 0), 
          range: "<25mg/l" 
        },
        { 
          name: t("waterParameters.phosphate"), 
          value: latestReadings.phosphate?.value ?? null, 
          unit: latestReadings.phosphate?.unit || "mg/l", 
          status: getParameterStatus('phosphate', latestReadings.phosphate?.value ?? 0), 
          range: "<1.0mg/l" 
        },
        { 
          name: t("waterParameters.ammonia"), 
          value: latestReadings.ammonia?.value ?? null, 
          unit: latestReadings.ammonia?.unit || "mg/l", 
          status: getParameterStatus('ammonia', latestReadings.ammonia?.value ?? 0), 
          range: "0-0.05mg/l" 
        },
        { 
          name: t("waterParameters.temperature"), 
          value: pondTemperature ?? latestReadings.temperature?.value ?? null, 
          unit: "°C", 
          status: getParameterStatus('temperature', pondTemperature ?? latestReadings.temperature?.value ?? 0), 
          range: "15-25°C" 
        },
      ]

      console.log('Setting water parameters (normal path):', parameters.length, 'parameters')
      console.log('Parameter names (normal path):', parameters.map(p => p.name))
      console.log('Parameter values (normal path):', parameters.map(p => `${p.name}: ${p.value !== null ? `${p.value}${p.unit}` : 'null'}`))
      
      waterParametersRef.current = parameters
      setWaterParameters(parameters)
      
      // Set last update time
      const latestReading = data?.[0]
      if (latestReading) {
        setLastUpdate(formatTimeDifference(latestReading.measured_at))
      }
      
      setLoading(false)

    } catch (error: any) {
      console.error('Error in loadWaterParameters:', error)
      if (error?.message === 'Query timeout' || error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        console.warn('loadWaterParameters timed out after 10 seconds')
      }
      setWaterParameters([])
      setLastUpdate("No data")
      setLoading(false)
    }
  }

  const loadKoiCount = async (retryCount = 0) => {
    if (!user || !user.id) {
      setKoiCount(0)
      return
    }

    // Check if session is available
    let { data: { session: currentSession } } = await supabase.auth.getSession()
    
    // If no Supabase session but we have React session, use direct fetch
    // Don't try to restore session with setSession() - it causes 403 errors
    if (!currentSession && session?.access_token) {
      try {
        console.log('Loading koi count using direct fetch with access token...')
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi?user_id=eq.${user.id}&select=*`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'Prefer': 'count=exact'
            }
          }
        )
        
        if (response.ok) {
          const countHeader = response.headers.get('content-range')
          const count = countHeader ? parseInt(countHeader.split('/')[1]) : 0
          console.log('Loaded REAL koi count (direct fetch):', count || 0)
          setKoiCount(count || 0)
          return
        } else {
          console.error('Direct fetch failed with status:', response.status)
        }
      } catch (error) {
        console.error('Error loading koi count with direct fetch:', error)
      }
    }

    // Wait for session to be available if retrying (session might be restoring)
    if (retryCount > 0 && !currentSession) {
      await new Promise(resolve => setTimeout(resolve, 500))
      // Check if session is available now
      const { data: { session: checkSession } } = await supabase.auth.getSession()
      if (!checkSession && retryCount < 5) {
        // If still no session but we have React session, use direct fetch on retry
        if (session?.access_token && retryCount >= 2) {
          // After 2 retries, switch to direct fetch
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi?user_id=eq.${user.id}&select=*`,
              {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'count=exact'
                }
              }
            )
            if (response.ok) {
              const countHeader = response.headers.get('content-range')
              const count = countHeader ? parseInt(countHeader.split('/')[1]) : 0
              console.log('Loaded REAL koi count (direct fetch on retry):', count || 0)
              setKoiCount(count || 0)
              return
            }
          } catch (error) {
            console.error('Error loading koi count with direct fetch on retry:', error)
          }
        }
        return loadKoiCount(retryCount + 1)
      }
      currentSession = checkSession
    }

    try {
      console.log('Loading REAL koi count for user:', user.id, retryCount > 0 ? `(retry ${retryCount})` : '')
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 10000) // 10 seconds
      })
      
      const queryPromise = supabase
        .from('koi')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const { count, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      if (error) {
        // If auth error and we haven't retried too many times, try again
        if ((error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('session')) && retryCount < 3) {
          console.log('Auth error detected in loadKoiCount, waiting for session restore and retrying...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          return loadKoiCount(retryCount + 1)
        }
        
        console.error('Database error loading koi count:', error)
        setKoiCount(0)
        return
      }

      console.log('Loaded REAL koi count:', count || 0)
      setKoiCount(count || 0)
    } catch (error: any) {
      // If timeout and we haven't retried too many times, try again
      if (error?.message === 'Query timeout' && retryCount < 2) {
        console.log('loadKoiCount timed out, retrying...')
        return loadKoiCount(retryCount + 1)
      }
      
      console.error('Unexpected error loading koi count:', error)
      if (error?.message === 'Query timeout') {
        console.warn('loadKoiCount timed out after 10 seconds')
      }
      setKoiCount(0)
    }
  }

  const loadLastWaterChange = async () => {
    if (!user || !user.id) {
      setLastWaterChange(null)
      return
    }

    try {
      console.log('Loading REAL last water change for user:', user.id)
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let waterChangeData: any = null
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading last water change using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_changes?user_id=eq.${user.id}&select=id,liters_added,water_type,reason,changed_at,notes&order=changed_at.desc&limit=1`,
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
            waterChangeData = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data
            console.log('Loaded last water change (direct fetch):', waterChangeData ? 'found' : 'none')
          } else if (response.status === 406 || response.status === 404) {
            // Table doesn't exist or not accessible - silently ignore
            setLastWaterChange(null)
            return
          }
        } catch (error: any) {
          console.error('Error loading last water change with direct fetch:', error)
          // Fall through to try normal Supabase query
        }
      }
      
      // If we don't have data yet, try normal Supabase query
      if (!waterChangeData) {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), 10000) // 10 seconds
        })
        
        const queryPromise = supabase
          .from('water_changes')
          .select('id, liters_added, water_type, reason, changed_at, notes')
          .eq('user_id', user.id)
          .order('changed_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

        if (error) {
          // Handle 406 errors gracefully - usually means RLS policy issue or table structure mismatch
          if ((error as any).status === 406 || error.code === 'PGRST116') {
            console.warn('406 error loading water change (RLS or schema issue):', error.message)
            setLastWaterChange(null)
            return
          }
          console.error('Database error loading last water change:', error)
          setLastWaterChange(null)
          return
        }
        
        waterChangeData = data
      }

      console.log('Loaded REAL last water change:', waterChangeData ? 'found' : 'none')
      setLastWaterChange(waterChangeData)
    } catch (error: any) {
      console.error('Unexpected error loading last water change:', error)
      if (error?.message === 'Query timeout') {
        console.warn('loadLastWaterChange timed out after 10 seconds')
      }
      setLastWaterChange(null)
    }
  }

  const loadPondSize = async () => {
    if (!user?.id) {
      setPondSize(1000) // Default pond size
      return
    }
    
    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let data: any = null
      let error: any = null

      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/user_preferences?user_id=eq.${user.id}&select=pond_size_liters`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (response.ok) {
            const responseData = await response.json()
            data = Array.isArray(responseData) ? (responseData.length > 0 ? responseData[0] : null) : responseData
          } else if (response.status === 406 || response.status === 404) {
            // Table doesn't exist or not accessible - use default
            setPondSize(1000)
            return
          }
        } catch (fetchError: any) {
          console.error('Error loading pond size with direct fetch:', fetchError)
          error = fetchError
          // Fall through to try normal Supabase query
        }
      }

      // If we don't have data yet, try normal Supabase query
      if (!data && !error) {
        const queryResult = await supabase
          .from('user_preferences')
          .select('pond_size_liters')
          .eq('user_id', user.id)
          .maybeSingle()
        
        data = queryResult.data
        error = queryResult.error
      }

      if (error) {
        // Handle 406 errors gracefully - usually means RLS policy issue or table structure mismatch
        if ((error as any).status === 406 || error.code === 'PGRST116') {
          console.warn('406 error loading pond size (RLS or schema issue):', error.message)
          setPondSize(1000) // Default pond size
          return
        }
        console.error('Error loading pond size:', error)
        setPondSize(1000) // Default pond size
        return
      }

      if (data && data.pond_size_liters) {
        // Convert to number if needed (Supabase returns DECIMAL as string sometimes)
        const pondSizeValue = typeof data.pond_size_liters === 'string' 
          ? parseFloat(data.pond_size_liters) 
          : Number(data.pond_size_liters)
        setPondSize(pondSizeValue)
      } else {
        setPondSize(1000) // Default pond size
      }
    } catch (error: any) {
      console.error('Error loading pond size:', error)
      setPondSize(1000) // Default pond size
    }
  }

  const loadPondTemperature = async () => {
    if (!user || !user.id) {
      setPondTemperature(null)
      setPondSensorId(null)
      setPondSensorLastUpdate("No data")
      setPondSensorDisplayName("Vijverwatertemperatuur")
      return
    }

    // Check if Supabase has a session
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    
    // If no Supabase session but we have React session, use direct fetch
    if (!currentSession && session?.access_token) {
      try {
        console.log('Loading pond temperature using direct fetch with access token...')
        // Fetch all temperature sensors and filter client-side for sensor ending in -01
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/sensor_data?user_id=eq.${user.id}&sensor_type=eq.temperatuurmeter&select=*&order=created_at.desc&limit=50`,
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
          // Filter for sensor ending in -01 (pond sensor)
          const pondSensorData = data?.filter((item: any) => item.sensor_id?.endsWith('-01'))
          if (pondSensorData && pondSensorData.length > 0) {
            // Get the most recent reading
            const latest = pondSensorData[0]
            setPondTemperature(latest.temperature)
            setPondSensorId(latest.sensor_id)
            setPondSensorLastUpdate(formatTimeDifference(latest.created_at))
            
            // Get display name from individual_sensor_configs
            try {
              const configResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/individual_sensor_configs?sensor_id=eq.${latest.sensor_id}&select=display_name&limit=1`,
                {
                  headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                  }
                }
              )
              if (configResponse.ok) {
                const configData = await configResponse.json()
                if (configData && configData.length > 0 && configData[0].display_name) {
                  setPondSensorDisplayName(configData[0].display_name)
                } else {
                  setPondSensorDisplayName("Vijverwatertemperatuur")
                }
              } else {
                setPondSensorDisplayName("Vijverwatertemperatuur")
              }
            } catch (configError) {
              console.warn('Error loading pond sensor display name:', configError)
              setPondSensorDisplayName("Vijverwatertemperatuur")
            }
            return
          }
        }
        setPondTemperature(null)
        setPondSensorId(null)
        setPondSensorLastUpdate("No data")
        setPondSensorDisplayName("Vijverwatertemperatuur")
        return
      } catch (error) {
        console.error('Error loading pond temperature with direct fetch:', error)
        setPondTemperature(null)
        setPondSensorId(null)
        setPondSensorLastUpdate("No data")
        setPondSensorDisplayName("Vijverwatertemperatuur")
        return
      }
    }

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 10000) // 10 seconds
      })
      
      // Always load sensor 1 (pond water temperature) for water parameters
      const queryPromise = supabase
        .from('sensor_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('sensor_type', 'temperatuurmeter')
        .like('sensor_id', '%-01')
        .order('created_at', { ascending: false })
        .limit(1)

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      if (error) {
        console.error('Error loading pond temperature:', error)
        setPondTemperature(null)
        setPondSensorId(null)
        setPondSensorLastUpdate("No data")
        setPondSensorDisplayName("Vijverwatertemperatuur")
        return
      }

      if (data && data.length > 0) {
        const latest = data[0]
        setPondTemperature(latest.temperature)
        setPondSensorId(latest.sensor_id)
        setPondSensorLastUpdate(formatTimeDifference(latest.created_at))
        
        // Get display name from individual_sensor_configs
        try {
          const configTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Config query timeout')), 5000) // 5 seconds
          })
          
          const configQueryPromise = supabase
            .from('individual_sensor_configs')
            .select('display_name')
            .eq('sensor_id', latest.sensor_id)
            .single()

          const { data: configData, error: configError } = await Promise.race([configQueryPromise, configTimeoutPromise]) as any

          if (configError && configError.code !== 'PGRST116') {
            console.error('Error loading pond sensor config:', configError)
          }

          // Use display name or fallback to default
          const displayName = configData?.display_name || 'Vijverwatertemperatuur'
          setPondSensorDisplayName(displayName)
        } catch (configError: any) {
          console.warn('Sensor config query timed out or failed:', configError)
          setPondSensorDisplayName('Vijverwatertemperatuur')
        }
      } else {
        setPondTemperature(null)
        setPondSensorId(null)
        setPondSensorLastUpdate("No data")
        setPondSensorDisplayName("Vijverwatertemperatuur")
      }
    } catch (error: any) {
      console.error('Error in loadPondTemperature:', error)
      if (error?.message === 'Query timeout') {
        console.warn('loadPondTemperature timed out after 10 seconds')
      }
      setPondTemperature(null)
      setPondSensorId(null)
      setPondSensorLastUpdate("No data")
      setPondSensorDisplayName("Vijverwatertemperatuur")
    }
  }

  const loadAmbientTemperature = async () => {
    if (!user || !user.id) {
      setAmbientTemperature(null)
      setAmbientSensorId(null)
      setAmbientSensorLastUpdate("No data")
      setAmbientSensorDisplayName("Buitentemperatuur")
      return
    }

    // Check if Supabase has a session
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    
    // If no Supabase session but we have React session, use direct fetch
    if (!currentSession && session?.access_token) {
      try {
        console.log('Loading ambient temperature using direct fetch with access token...')
        // Fetch all temperature sensors and filter client-side for sensor ending in -02
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/sensor_data?user_id=eq.${user.id}&sensor_type=eq.temperatuurmeter&select=*&order=created_at.desc&limit=50`,
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
          // Filter for sensor ending in -02 (ambient sensor)
          const ambientSensorData = data?.filter((item: any) => item.sensor_id?.endsWith('-02'))
          if (ambientSensorData && ambientSensorData.length > 0) {
            // Get the most recent reading
            const latest = ambientSensorData[0]
            setAmbientTemperature(latest.temperature)
            setAmbientSensorId(latest.sensor_id)
            setAmbientSensorLastUpdate(formatTimeDifference(latest.created_at))
            
            // Get display name from individual_sensor_configs
            try {
              const configResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/individual_sensor_configs?sensor_id=eq.${latest.sensor_id}&select=display_name&limit=1`,
                {
                  headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                  }
                }
              )
              if (configResponse.ok) {
                const configData = await configResponse.json()
                if (configData && configData.length > 0 && configData[0].display_name) {
                  setAmbientSensorDisplayName(configData[0].display_name)
                } else {
                  setAmbientSensorDisplayName("Buitentemperatuur")
                }
              } else {
                setAmbientSensorDisplayName("Buitentemperatuur")
              }
            } catch (configError) {
              console.warn('Error loading ambient sensor display name:', configError)
              setAmbientSensorDisplayName("Buitentemperatuur")
            }
            return
          }
        }
        setAmbientTemperature(null)
        setAmbientSensorId(null)
        setAmbientSensorLastUpdate("No data")
        setAmbientSensorDisplayName("Buitentemperatuur")
        return
      } catch (error) {
        console.error('Error loading ambient temperature with direct fetch:', error)
        setAmbientTemperature(null)
        setAmbientSensorId(null)
        setAmbientSensorLastUpdate("No data")
        setAmbientSensorDisplayName("Buitentemperatuur")
        return
      }
    }

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 10000) // 10 seconds
      })
      
      // Always load sensor 2 (ambient temperature) for secondary display
      const queryPromise = supabase
        .from('sensor_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('sensor_type', 'temperatuurmeter')
        .like('sensor_id', '%-02')
        .order('created_at', { ascending: false })
        .limit(1)

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      if (error) {
        console.error('Error loading ambient temperature:', error)
        setAmbientTemperature(null)
        setAmbientSensorId(null)
        setAmbientSensorLastUpdate("No data")
        setAmbientSensorDisplayName("Buitentemperatuur")
        return
      }

      if (data && data.length > 0) {
        const latest = data[0]
        setAmbientTemperature(latest.temperature)
        setAmbientSensorId(latest.sensor_id)
        setAmbientSensorLastUpdate(formatTimeDifference(latest.created_at))
        
        // Get display name from individual_sensor_configs
        try {
          const configTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Config query timeout')), 5000) // 5 seconds
          })
          
          const configQueryPromise = supabase
            .from('individual_sensor_configs')
            .select('display_name')
            .eq('sensor_id', latest.sensor_id)
            .single()

          const { data: configData, error: configError } = await Promise.race([configQueryPromise, configTimeoutPromise]) as any

          if (configError && configError.code !== 'PGRST116') {
            console.error('Error loading ambient sensor config:', configError)
          }

          // Use display name or fallback to default
          const displayName = configData?.display_name || 'Buitentemperatuur'
          setAmbientSensorDisplayName(displayName)
        } catch (configError: any) {
          console.warn('Ambient sensor config query timed out or failed:', configError)
          setAmbientSensorDisplayName('Buitentemperatuur')
        }
      } else {
        setAmbientTemperature(null)
        setAmbientSensorId(null)
        setAmbientSensorLastUpdate("No data")
        setAmbientSensorDisplayName("Buitentemperatuur")
      }
    } catch (error: any) {
      console.error('Error in loadAmbientTemperature:', error)
      if (error?.message === 'Query timeout') {
        console.warn('loadAmbientTemperature timed out after 10 seconds')
      }
      setAmbientTemperature(null)
      setAmbientSensorId(null)
      setAmbientSensorLastUpdate("No data")
      setAmbientSensorDisplayName("Buitentemperatuur")
    }
  }




  const getParameterStatus = (type: string, value: number): "good" | "warning" | "danger" => {
    // Handle cases where value is 0 or undefined
    if (value === undefined || value === null) return "warning"
    
    switch (type) {
      case 'ph':
        if (value >= 6.8 && value <= 8.2) return "good"
        if (value >= 6.5 && value <= 8.5) return "warning"
        return "danger"
      case 'temperature':
        if (value >= 15 && value <= 25) return "good"
        if (value >= 10 && value <= 30) return "warning"
        return "danger"
      case 'kh':
        if (value >= 3 && value <= 8) return "good"
        if (value >= 2 && value <= 10) return "warning"
        return "danger"
      case 'gh':
        if (value >= 4 && value <= 12) return "good"
        if (value >= 3 && value <= 15) return "warning"
        return "danger"
      case 'nitrite':
        // 0 mg/l is actually good for nitrite
        if (value <= 0.3) return "good"
        if (value <= 0.5) return "warning"
        return "danger"
      case 'nitrate':
        if (value < 25) return "good"
        if (value < 50) return "warning"
        return "danger"
      case 'phosphate':
        // 0 mg/l is actually good for phosphate
        if (value < 1.0) return "good"
        if (value < 2.0) return "warning"
        return "danger"
      case 'ammonia':
        // 0 mg/l is actually good for ammonia
        if (value <= 0.05) return "good"
        if (value <= 0.1) return "warning"
        return "danger"
      default:
        return "warning"
    }
  }

  // Use pond temperature (sensor -01) for main display - always show vijverwatertemperatuur
  const currentTemp = pondTemperature !== null ? pondTemperature : 0

  // Use water parameters as-is since temperature is already included
  const displayWaterParameters = waterParameters
  

  // Generate dynamic alerts based on actual water parameter values
  const generateAlerts = () => {
    const alerts: Array<{
      type: "warning" | "danger"
      title: string
      description: string
      parameter: string
    }> = []

    displayWaterParameters.forEach(param => {
      if (param.status === "danger") {
        switch (param.name) {
          case t("waterParameters.ph"):
            alerts.push({
              type: "danger",
              title: t("dashboard.criticalPhLevel"),
              description: param.value < 6.5 
                ? t("dashboard.lowPhWarning")
                : t("dashboard.highPhWarning"),
              parameter: "ph"
            })
            break
          case t("waterParameters.temperature"):
            alerts.push({
              type: "danger",
              title: t("dashboard.criticalTemperature"),
              description: param.value < 10 
                ? t("dashboard.lowTempWarning")
                : param.value > 30
                ? t("dashboard.highTempWarning")
                : t("dashboard.temperatureWarning"),
              parameter: "temperature"
            })
            break
          case t("waterParameters.nitrite"):
            alerts.push({
              type: "danger",
              title: t("dashboard.dangerousNitriteLevel"),
              description: t("dashboard.nitriteDangerWarning"),
              parameter: "nitrite"
            })
            break
          case t("waterParameters.nitrate"):
            alerts.push({
              type: "danger",
              title: t("dashboard.dangerousNitrateLevel"),
              description: t("dashboard.nitrateDangerWarning"),
              parameter: "nitrate"
            })
            break
          case t("waterParameters.phosphate"):
            alerts.push({
              type: "danger",
              title: t("dashboard.dangerousPhosphateLevel"),
              description: t("dashboard.phosphateDangerWarning"),
              parameter: "phosphate"
            })
            break
        }
      } else if (param.status === "warning") {
        switch (param.name) {
          case t("waterParameters.ph"):
            alerts.push({
              type: "warning",
              title: t("dashboard.elevatedPhLevel"),
              description: t("dashboard.phWarning"),
              parameter: "ph"
            })
            break
          case t("waterParameters.temperature"):
            alerts.push({
              type: "warning",
              title: param.value < 15 
                ? t("dashboard.lowTemperature")
                : t("dashboard.elevatedTemperature"),
              description: t("dashboard.temperatureWarning"),
              parameter: "temperature"
            })
            break
          case t("waterParameters.nitrate"):
            alerts.push({
              type: "warning",
              title: t("dashboard.elevatedNitrates"),
              description: t("dashboard.nitrateWarning"),
              parameter: "nitrate"
            })
            break
          case t("waterParameters.phosphate"):
            alerts.push({
              type: "warning",
              title: t("dashboard.highPhosphateLevel"),
              description: t("dashboard.phosphateWarning"),
              parameter: "phosphate"
            })
            break
        }
      }
    })

    return alerts
  }

  const alerts = generateAlerts()

  const handleParameterClick = (parameterName: string) => {
    // Special handling for temperature - use pond sensor for water parameters
    if (parameterName === t("waterParameters.temperature")) {
      if (pondSensorId && onNavigateToTemperatureSensor) {
        onNavigateToTemperatureSensor(pondSensorId)
      } else {
        onNavigate("temperature")
      }
      return
    }
    
    const parameterRoutes: Record<string, string> = {
      [t("waterParameters.ph")]: "ph",
      [t("waterParameters.kh")]: "kh", 
      [t("waterParameters.gh")]: "gh",
      [t("waterParameters.nitrite")]: "nitrite",
      [t("waterParameters.nitrate")]: "nitrate",
      [t("waterParameters.phosphate")]: "phosphate",
      [t("waterParameters.ammonia")]: "ammonia"
    }
    
    const route = parameterRoutes[parameterName]
    if (route) {
      onNavigate(route)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good": return "bg-success text-success-foreground"
      case "warning": return "bg-warning text-warning-foreground"
      case "danger": return "bg-destructive text-destructive-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "good": return t("waterParameters.optimal")
      case "warning": return t("waterParameters.warning")
      case "danger": return t("waterParameters.critical")
      default: return status
    }
  }

  // Show loading if auth is still loading or dashboard data is loading
  // But add a timeout to prevent infinite loading
  // Only set timeout if we have no water parameters yet
  useEffect(() => {
    if (loading && user && waterParameters.length === 0) {
      const timeout = setTimeout(() => {
        console.warn('Dashboard loading timeout - forcing loading to false')
        setLoading(false)
      }, 10000) // 10 second timeout
      
      return () => clearTimeout(timeout)
    } else if (loading && waterParameters.length > 0) {
      // If we have parameters but still loading, stop loading immediately
      setLoading(false)
    }
  }, [loading, user, waterParameters.length])
  
  if (authLoading || (loading && user)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">{t("dashboard.subtitle")}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card 
          className="bg-gradient-water cursor-pointer hover:shadow-water transition-shadow"
          onClick={() => pondSensorId ? onNavigateToTemperatureSensor?.(pondSensorId) : onNavigate("temperature")}
        >
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-2">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{pondSensorDisplayName}</p>
                <p className="text-lg sm:text-2xl font-bold">{currentTemp}°C</p>
                {ambientTemperature !== null && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Buiten: {ambientTemperature}°C
                  </p>
                )}
                {pondTemperature !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📡 <span className="font-mono">{pondSensorLastUpdate}</span>
                  </p>
                )}
              </div>
              <Thermometer className="h-5 w-5 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("koi")}>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-2">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("dashboard.koiCount")}</p>
                <p className="text-lg sm:text-2xl font-bold">{koiCount}</p>
              </div>
              <Activity className="h-5 w-5 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water col-span-2 lg:col-span-1 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("water-history")}>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-2">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("dashboard.lastUpdated")}</p>
                <p className="text-lg sm:text-2xl font-bold">{lastUpdate}</p>
              </div>
              <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Alerts */}
      {alerts.length > 0 && (
        <Card className={alerts.some(a => a.type === "danger") ? "border-destructive" : "border-warning"}>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className={`flex items-center gap-2 text-lg sm:text-xl ${alerts.some(a => a.type === "danger") ? "text-destructive" : "text-warning"}`}>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              {t("dashboard.alertsRecommendations")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-start space-x-2 sm:space-x-3">
                  <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mt-2 ${alert.type === "danger" ? "bg-destructive" : "bg-warning"}`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm sm:text-base">{alert.title}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {alert.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Todos */}
      <MaintenanceTodos onNavigate={onNavigate} />

      {/* Water Parameters */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                {t("waterParameters.title")}
              </CardTitle>
              <CardDescription className="text-sm">{t("dashboard.currentWaterQuality")}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => onNavigate("parameters")} size="sm" className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {t("waterParameters.addReading")}
              </Button>
              <Button onClick={() => onNavigate("water-change")} size="sm" className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm">
                <Waves className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Waterwissel
              </Button>
              <Button onClick={() => onNavigate("water-history")} variant="outline" size="sm" className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm">
                <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Bekijk eerdere metingen</span>
                <span className="sm:hidden">Geschiedenis</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 sm:space-y-4">
            {/* Debug: Log what's being rendered */}
            {(() => {
              console.log('Rendering water parameters:', {
                count: displayWaterParameters.length,
                names: displayWaterParameters.map(p => p.name),
                loading: loading
              })
              if (displayWaterParameters.length === 0 && !loading) {
                console.warn('WARNING: No water parameters to display, but loading is false!')
              }
              return null
            })()}
            {/* All 8 parameters in responsive grid - show all at once */}
            {displayWaterParameters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Geen waterparameters beschikbaar</p>
                {loading && <p className="text-sm mt-2">Laden...</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {displayWaterParameters.map((param) => (
                <Card 
                  key={param.name}
                  className="cursor-pointer hover:shadow-water transition-shadow"
                  onClick={() => handleParameterClick(param.name)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm sm:text-base">
                        {param.name === "kH (Carbonaathardheid)" ? (
                          <>
                            <span className="sm:hidden">kH (carbo-<br />naatheid)</span>
                            <span className="hidden sm:inline">kH (Carbonaathardheid)</span>
                          </>
                        ) : (
                          param.name
                        )}
                      </h3>
                      <div className="flex items-start gap-2">
                        {/* Mobile: only colored dot */}
                        <div className={`w-2 h-2 rounded-full sm:hidden mt-1 ${
                          param.status === 'good' ? 'bg-green-500' :
                          param.status === 'warning' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}></div>
                        {/* Desktop: full badge */}
                        <Badge className={`${getStatusColor(param.status)} text-xs hidden sm:inline-flex`}>
                          {getStatusText(param.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl sm:text-2xl font-bold">
                        {param.value !== null && param.value !== undefined 
                          ? `${param.value}${param.unit}` 
                          : <span className="text-muted-foreground italic">Geen data</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboard.ideal")}: {param.range}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}
            
            {/* Water Change Tile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {/* Water Change Tile */}
              <Card 
                className="cursor-pointer hover:shadow-water transition-shadow"
                onClick={() => onNavigate("water-change")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="mb-2">
                    <h3 className="font-semibold flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base">
                      <Waves className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                      <span>Laatste Waterwissel</span>
                    </h3>
                  </div>
                  <div className="space-y-1">
                    {lastWaterChange ? (
                      <>
                        <p className="text-xl sm:text-2xl font-bold text-blue-600">
                          {(() => {
                            // Ensure liters_added is a number
                            const litersAdded = typeof lastWaterChange.liters_added === 'string' 
                              ? parseFloat(lastWaterChange.liters_added) 
                              : Number(lastWaterChange.liters_added)
                            return litersAdded.toLocaleString('nl-NL')
                          })()}L
                        {pondSize && pondSize > 0 && lastWaterChange?.liters_added && (() => {
                          // Ensure both values are numbers for calculation
                          const litersAdded = typeof lastWaterChange.liters_added === 'string' 
                            ? parseFloat(lastWaterChange.liters_added) 
                            : Number(lastWaterChange.liters_added)
                          const pondSizeNum = typeof pondSize === 'string' 
                            ? parseFloat(pondSize) 
                            : Number(pondSize)
                          
                          if (isNaN(litersAdded) || isNaN(pondSizeNum) || pondSizeNum <= 0) {
                            return null
                          }
                          
                          const percentage = (litersAdded / pondSizeNum) * 100
                          return (
                            <span className="text-xs sm:text-sm font-semibold text-purple-600 ml-1 sm:ml-2">
                              ({percentage.toFixed(1)}%)
                            </span>
                          )
                        })()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeDifference(lastWaterChange.changed_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lastWaterChange.water_type === 'tap_water' ? 'Kraanwater' :
                           lastWaterChange.water_type === 'well_water' ? 'Putwater' :
                           lastWaterChange.water_type === 'rain_water' ? 'Regenwater' :
                           lastWaterChange.water_type === 'ro_water' ? 'RO water' :
                           lastWaterChange.water_type === 'mixed' ? 'Gemengd' : lastWaterChange.water_type}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-base sm:text-lg font-semibold text-gray-500">
                          Geen waterwissel
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Klik om een waterwissel te registreren
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
        </CardContent>
      </Card>




      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="cursor-pointer hover:shadow-water transition-shadow" onClick={() => onNavigate("parameters")}>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.logWaterParameters")}</CardTitle>
            <CardDescription className="text-sm">{t("dashboard.recordNewMeasurements")}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-water transition-shadow" onClick={() => onNavigate("koi")}>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.manageKoi")}</CardTitle>
            <CardDescription className="text-sm">{t("dashboard.addUpdateKoiInfo")}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-water transition-shadow sm:col-span-2 lg:col-span-1" onClick={() => onNavigate("koi-weight-calculator")}>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Koi Voerstrategie Calculator</span>
              <span className="sm:hidden">Voerstrategie</span>
            </CardTitle>
            <CardDescription className="text-sm">Bereken de optimale voerstrategie voor je koi groep</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}