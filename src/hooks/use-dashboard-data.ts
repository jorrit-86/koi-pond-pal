import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, createSupabaseHeaders } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface WaterParameter {
  type: string
  name: string
  value: number | null
  unit: string
  status: 'good' | 'warning' | 'danger'
  range: string
}

export interface WaterChange {
  id: string
  liters_added: number | string
  water_type: string
  reason?: string
  changed_at: string
  notes?: string
}

export function formatTimeDifference(timestamp: string | Date): string {
  const updateTime = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - updateTime.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'Zojuist'
  if (diffMinutes < 60) return `${diffMinutes} min geleden`
  if (diffHours < 24) return `${diffHours} uur geleden`
  return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`
}

function getParameterStatus(type: string, value: number): 'good' | 'warning' | 'danger' {
  if (value === undefined || value === null) return 'warning'
  switch (type) {
    case 'ph':
      if (value >= 6.8 && value <= 8.2) return 'good'
      if (value >= 6.5 && value <= 8.5) return 'warning'
      return 'danger'
    case 'temperature':
      if (value >= 15 && value <= 25) return 'good'
      if (value >= 10 && value <= 30) return 'warning'
      return 'danger'
    case 'kh':
      if (value >= 3 && value <= 8) return 'good'
      if (value >= 2 && value <= 10) return 'warning'
      return 'danger'
    case 'gh':
      if (value >= 4 && value <= 12) return 'good'
      if (value >= 3 && value <= 15) return 'warning'
      return 'danger'
    case 'nitrite':
      if (value <= 0.3) return 'good'
      if (value <= 0.5) return 'warning'
      return 'danger'
    case 'nitrate':
      if (value < 25) return 'good'
      if (value < 50) return 'warning'
      return 'danger'
    case 'phosphate':
      if (value < 1.0) return 'good'
      if (value < 2.0) return 'warning'
      return 'danger'
    case 'ammonia':
      if (value <= 0.05) return 'good'
      if (value <= 0.1) return 'warning'
      return 'danger'
    default:
      return 'warning'
  }
}

export interface DashboardData {
  waterParameters: WaterParameter[]
  loading: boolean
  koiCount: number
  lastUpdate: string
  pondTemperature: number | null
  pondSensorId: string | null
  pondSensorDisplayName: string
  pondSensorLastUpdate: string
  ambientTemperature: number | null
  ambientSensorId: string | null
  ambientSensorDisplayName: string
  ambientSensorLastUpdate: string
  lastWaterChange: WaterChange | null
  pondSize: number | null
}

export function useDashboardData(refreshTrigger?: number): DashboardData {
  const { t } = useTranslation()
  const { user, session, loading: authLoading } = useAuth()

  const [waterParameters, setWaterParameters] = useState<WaterParameter[]>([])
  const [loading, setLoading] = useState(true)
  const waterParametersRef = useRef<WaterParameter[]>([])
  const [koiCount, setKoiCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState('No data')
  const [pondTemperature, setPondTemperature] = useState<number | null>(null)
  const [pondSensorId, setPondSensorId] = useState<string | null>(null)
  const [pondSensorDisplayName, setPondSensorDisplayName] = useState<string>('Vijverwatertemperatuur')
  const [pondSensorLastUpdate, setPondSensorLastUpdate] = useState<string>('No data')
  const [ambientTemperature, setAmbientTemperature] = useState<number | null>(null)
  const [ambientSensorId, setAmbientSensorId] = useState<string | null>(null)
  const [ambientSensorDisplayName, setAmbientSensorDisplayName] = useState<string>('Buitentemperatuur')
  const [ambientSensorLastUpdate, setAmbientSensorLastUpdate] = useState<string>('No data')
  const [lastWaterChange, setLastWaterChange] = useState<WaterChange | null>(null)
  const [pondSize, setPondSize] = useState<number | null>(null)

  // ── helpers ──────────────────────────────────────────────────────────────

  function buildParameterList(
    latestReadings: Record<string, { value?: number; unit?: string } | undefined>,
    currentPondTemp: number | null
  ): WaterParameter[] {
    return [
      {
        type: 'ph',
        name: t('waterParameters.ph'),
        value: latestReadings.ph?.value ?? null,
        unit: latestReadings.ph?.unit || '',
        status: getParameterStatus('ph', latestReadings.ph?.value ?? 0),
        range: '6.8-8.2',
      },
      {
        type: 'kh',
        name: t('waterParameters.kh'),
        value: latestReadings.kh?.value ?? null,
        unit: latestReadings.kh?.unit || '°dH',
        status: getParameterStatus('kh', latestReadings.kh?.value ?? 0),
        range: '3-8°dH',
      },
      {
        type: 'gh',
        name: t('waterParameters.gh'),
        value: latestReadings.gh?.value ?? null,
        unit: latestReadings.gh?.unit || '°dH',
        status: getParameterStatus('gh', latestReadings.gh?.value ?? 0),
        range: '4-12°dH',
      },
      {
        type: 'nitrite',
        name: t('waterParameters.nitrite'),
        value: latestReadings.nitrite?.value ?? null,
        unit: latestReadings.nitrite?.unit || 'mg/l',
        status: getParameterStatus('nitrite', latestReadings.nitrite?.value ?? 0),
        range: '0-0.3mg/l',
      },
      {
        type: 'nitrate',
        name: t('waterParameters.nitrate'),
        value: latestReadings.nitrate?.value ?? null,
        unit: latestReadings.nitrate?.unit || 'mg/l',
        status: getParameterStatus('nitrate', latestReadings.nitrate?.value ?? 0),
        range: '<25mg/l',
      },
      {
        type: 'phosphate',
        name: t('waterParameters.phosphate'),
        value: latestReadings.phosphate?.value ?? null,
        unit: latestReadings.phosphate?.unit || 'mg/l',
        status: getParameterStatus('phosphate', latestReadings.phosphate?.value ?? 0),
        range: '<1.0mg/l',
      },
      {
        type: 'ammonia',
        name: t('waterParameters.ammonia'),
        value: latestReadings.ammonia?.value ?? null,
        unit: latestReadings.ammonia?.unit || 'mg/l',
        status: getParameterStatus('ammonia', latestReadings.ammonia?.value ?? 0),
        range: '0-0.05mg/l',
      },
      {
        type: 'temperature',
        name: t('waterParameters.temperature'),
        value: currentPondTemp ?? latestReadings.temperature?.value ?? null,
        unit: '°C',
        status: getParameterStatus(
          'temperature',
          currentPondTemp ?? latestReadings.temperature?.value ?? 0
        ),
        range: '15-25°C',
      },
    ]
  }

  // ── data loading ─────────────────────────────────────────────────────────

  const loadWaterParameters = async () => {
    if (!user || !user.id) {
      setLoading(false)
      return
    }

    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (!currentSession && session?.access_token) {
      try {
        setLoading(true)
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/water_parameters?user_id=eq.${user.id}&select=*&order=measured_at.desc`,
          { headers: createSupabaseHeaders(session.access_token) }
        )

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        const data = await response.json()
        const latestReadings: Record<string, { value?: number; unit?: string; measured_at?: string }> = {}
        data?.forEach((reading: { parameter_type?: string; value?: number; unit?: string; measured_at?: string }) => {
          const paramType = reading.parameter_type?.toLowerCase()
          if (
            paramType &&
            (!latestReadings[paramType] ||
              new Date(reading.measured_at ?? 0) > new Date(latestReadings[paramType].measured_at ?? 0))
          ) {
            latestReadings[paramType] = reading
          }
        })

        const parameters = buildParameterList(latestReadings, pondTemperature)
        waterParametersRef.current = parameters
        setWaterParameters(parameters)

        const latestReading = data?.[0]
        setLastUpdate(latestReading ? formatTimeDifference(latestReading.measured_at) : 'No data')
        setLoading(false)
        return
      } catch (error) {
        console.error('Error loading water parameters with direct fetch:', error)
        setWaterParameters([])
        setLastUpdate('No data')
        setLoading(false)
        return
      }
    }

    try {
      setLoading(true)

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      )
      const queryPromise = supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })

      let queryResult: Awaited<typeof queryPromise>
      try {
        queryResult = await Promise.race([queryPromise, timeoutPromise])
      } catch (timeoutError) {
        if ((timeoutError as Error)?.message === 'Query timeout') {
          setWaterParameters([])
          setLastUpdate('No data')
          setLoading(false)
          return
        }
        throw timeoutError
      }

      const { data, error } = queryResult

      if (error) {
        console.error('Error loading water parameters:', error)
        setWaterParameters([])
        setLastUpdate('No data')
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        if (waterParametersRef.current.length > 0) {
          setLoading(false)
          return
        }
        setWaterParameters([])
        setLastUpdate('No data')
        setLoading(false)
        return
      }

      const latestReadings: Record<string, { value?: number; unit?: string; measured_at?: string }> = {}
      data?.forEach(reading => {
        const paramType = reading.parameter_type?.toLowerCase()
        if (
          paramType &&
          (!latestReadings[paramType] ||
            new Date(reading.measured_at ?? 0) > new Date(latestReadings[paramType].measured_at ?? 0))
        ) {
          latestReadings[paramType] = reading
        }
      })

      if (Object.keys(latestReadings).length === 0) {
        if (waterParametersRef.current.length > 0) {
          setLoading(false)
          return
        }
        setWaterParameters([])
        setLastUpdate('No data')
        setLoading(false)
        return
      }

      const parameters = buildParameterList(latestReadings, pondTemperature)
      waterParametersRef.current = parameters
      setWaterParameters(parameters)

      const latestReading = data?.[0]
      if (latestReading) setLastUpdate(formatTimeDifference(latestReading.measured_at))
      setLoading(false)
    } catch (error) {
      console.error('Error in loadWaterParameters:', error)
      setWaterParameters([])
      setLastUpdate('No data')
      setLoading(false)
    }
  }

  const loadKoiCount = async (retryCount = 0): Promise<void> => {
    if (!user || !user.id) {
      setKoiCount(0)
      return
    }

    let { data: { session: currentSession } } = await supabase.auth.getSession()

    if (!currentSession && session?.access_token) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/koi?user_id=eq.${user.id}&select=*`,
          { headers: createSupabaseHeaders(session.access_token, { Prefer: 'count=exact' }) }
        )
        if (response.ok) {
          const countHeader = response.headers.get('content-range')
          setKoiCount(countHeader ? (parseInt(countHeader.split('/')[1]) || 0) : 0)
          return
        }
      } catch (error) {
        console.error('Error loading koi count with direct fetch:', error)
      }
    }

    if (retryCount > 0 && !currentSession) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const { data: { session: checkSession } } = await supabase.auth.getSession()
      if (!checkSession && retryCount < 5) {
        if (session?.access_token && retryCount >= 2) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/koi?user_id=eq.${user.id}&select=*`,
              { headers: createSupabaseHeaders(session.access_token, { Prefer: 'count=exact' }) }
            )
            if (response.ok) {
              const countHeader = response.headers.get('content-range')
              setKoiCount(countHeader ? (parseInt(countHeader.split('/')[1]) || 0) : 0)
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
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      )
      const queryPromise = supabase
        .from('koi')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const { count, error } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>

      if (error) {
        if (
          (error.code === 'PGRST301' ||
            error.message?.includes('JWT') ||
            error.message?.includes('session')) &&
          retryCount < 3
        ) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          return loadKoiCount(retryCount + 1)
        }
        console.error('Database error loading koi count:', error)
        setKoiCount(0)
        return
      }

      setKoiCount(count || 0)
    } catch (error) {
      if ((error as Error)?.message === 'Query timeout' && retryCount < 2) {
        return loadKoiCount(retryCount + 1)
      }
      console.error('Unexpected error loading koi count:', error)
      setKoiCount(0)
    }
  }

  const loadLastWaterChange = async () => {
    if (!user || !user.id) {
      setLastWaterChange(null)
      return
    }

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      let waterChangeData: WaterChange | null = null

      if (!currentSession && session?.access_token) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/water_changes?user_id=eq.${user.id}&select=id,liters_added,water_type,reason,changed_at,notes&order=changed_at.desc&limit=1`,
            { headers: createSupabaseHeaders(session.access_token) }
          )
          if (response.ok) {
            const data = await response.json()
            waterChangeData = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data
          } else if (response.status === 406 || response.status === 404) {
            setLastWaterChange(null)
            return
          }
        } catch (error) {
          console.error('Error loading last water change with direct fetch:', error)
        }
      }

      if (!waterChangeData) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
        const queryPromise = supabase
          .from('water_changes')
          .select('id, liters_added, water_type, reason, changed_at, notes')
          .eq('user_id', user.id)
          .order('changed_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>

        if (error) {
          if ((error as { status?: number }).status === 406 || error.code === 'PGRST116') {
            setLastWaterChange(null)
            return
          }
          console.error('Database error loading last water change:', error)
          setLastWaterChange(null)
          return
        }
        waterChangeData = data as WaterChange | null
      }

      setLastWaterChange(waterChangeData)
    } catch (error) {
      console.error('Unexpected error loading last water change:', error)
      setLastWaterChange(null)
    }
  }

  const loadPondSize = async () => {
    if (!user?.id) {
      setPondSize(1000)
      return
    }

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      let data: { pond_size_liters?: number | string } | null = null
      let fetchError: unknown = null

      if (!currentSession && session?.access_token) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${user.id}&select=pond_size_liters`,
            { headers: createSupabaseHeaders(session.access_token) }
          )
          if (response.ok) {
            const responseData = await response.json()
            data = Array.isArray(responseData)
              ? responseData.length > 0 ? responseData[0] : null
              : responseData
          } else if (response.status === 406 || response.status === 404) {
            setPondSize(1000)
            return
          }
        } catch (err) {
          console.error('Error loading pond size with direct fetch:', err)
          fetchError = err
        }
      }

      if (!data && !fetchError) {
        const queryResult = await supabase
          .from('user_preferences')
          .select('pond_size_liters')
          .eq('user_id', user.id)
          .maybeSingle()
        data = queryResult.data as typeof data
        if (queryResult.error) fetchError = queryResult.error
      }

      if (fetchError) {
        const err = fetchError as { status?: number; code?: string }
        if (err.status === 406 || err.code === 'PGRST116') {
          setPondSize(1000)
          return
        }
        console.error('Error loading pond size:', fetchError)
        setPondSize(1000)
        return
      }

      if (data?.pond_size_liters) {
        const raw = data.pond_size_liters
        setPondSize(typeof raw === 'string' ? parseFloat(raw) : Number(raw))
      } else {
        setPondSize(1000)
      }
    } catch (error) {
      console.error('Error loading pond size:', error)
      setPondSize(1000)
    }
  }

  const loadPondTemperature = async () => {
    if (!user || !user.id) {
      setPondTemperature(null)
      setPondSensorId(null)
      setPondSensorLastUpdate('No data')
      setPondSensorDisplayName('Vijverwatertemperatuur')
      return
    }

    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (!currentSession && session?.access_token) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sensor_data?user_id=eq.${user.id}&sensor_type=eq.temperatuurmeter&select=*&order=created_at.desc&limit=50`,
          { headers: createSupabaseHeaders(session.access_token) }
        )
        if (response.ok) {
          const data = await response.json()
          const pondSensorData = data?.filter((item: { sensor_id?: string }) =>
            item.sensor_id?.endsWith('-01')
          )
          if (pondSensorData && pondSensorData.length > 0) {
            const latest = pondSensorData[0]
            setPondTemperature(latest.temperature)
            setPondSensorId(latest.sensor_id)
            setPondSensorLastUpdate(formatTimeDifference(latest.created_at))

            try {
              const configResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/individual_sensor_configs?sensor_id=eq.${latest.sensor_id}&select=display_name&limit=1`,
                { headers: createSupabaseHeaders(session.access_token) }
              )
              if (configResponse.ok) {
                const configData = await configResponse.json()
                setPondSensorDisplayName(
                  configData?.length > 0 && configData[0].display_name
                    ? configData[0].display_name
                    : 'Vijverwatertemperatuur'
                )
              } else {
                setPondSensorDisplayName('Vijverwatertemperatuur')
              }
            } catch {
              setPondSensorDisplayName('Vijverwatertemperatuur')
            }
            return
          }
        }
        setPondTemperature(null)
        setPondSensorId(null)
        setPondSensorLastUpdate('No data')
        setPondSensorDisplayName('Vijverwatertemperatuur')
        return
      } catch (error) {
        console.error('Error loading pond temperature with direct fetch:', error)
        setPondTemperature(null)
        setPondSensorId(null)
        setPondSensorLastUpdate('No data')
        setPondSensorDisplayName('Vijverwatertemperatuur')
        return
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      )
      const queryPromise = supabase
        .from('sensor_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('sensor_type', 'temperatuurmeter')
        .like('sensor_id', '%-01')
        .order('created_at', { ascending: false })
        .limit(1)

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>

      if (error) {
        console.error('Error loading pond temperature:', error)
        setPondTemperature(null)
        setPondSensorId(null)
        setPondSensorLastUpdate('No data')
        setPondSensorDisplayName('Vijverwatertemperatuur')
        return
      }

      if (data && data.length > 0) {
        const latest = data[0] as { temperature: number; sensor_id: string; created_at: string }
        setPondTemperature(latest.temperature)
        setPondSensorId(latest.sensor_id)
        setPondSensorLastUpdate(formatTimeDifference(latest.created_at))

        try {
          const configTimeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Config query timeout')), 5000)
          )
          const configQueryPromise = supabase
            .from('individual_sensor_configs')
            .select('display_name')
            .eq('sensor_id', latest.sensor_id)
            .single()

          const { data: configData, error: configError } = await Promise.race([
            configQueryPromise,
            configTimeoutPromise,
          ]) as Awaited<typeof configQueryPromise>

          if (configError && configError.code !== 'PGRST116') {
            console.error('Error loading pond sensor config:', configError)
          }
          setPondSensorDisplayName(
            (configData as { display_name?: string } | null)?.display_name || 'Vijverwatertemperatuur'
          )
        } catch {
          setPondSensorDisplayName('Vijverwatertemperatuur')
        }
      } else {
        setPondTemperature(null)
        setPondSensorId(null)
        setPondSensorLastUpdate('No data')
        setPondSensorDisplayName('Vijverwatertemperatuur')
      }
    } catch (error) {
      console.error('Error in loadPondTemperature:', error)
      setPondTemperature(null)
      setPondSensorId(null)
      setPondSensorLastUpdate('No data')
      setPondSensorDisplayName('Vijverwatertemperatuur')
    }
  }

  const loadAmbientTemperature = async () => {
    if (!user || !user.id) {
      setAmbientTemperature(null)
      setAmbientSensorId(null)
      setAmbientSensorLastUpdate('No data')
      setAmbientSensorDisplayName('Buitentemperatuur')
      return
    }

    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (!currentSession && session?.access_token) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sensor_data?user_id=eq.${user.id}&sensor_type=eq.temperatuurmeter&select=*&order=created_at.desc&limit=50`,
          { headers: createSupabaseHeaders(session.access_token) }
        )
        if (response.ok) {
          const data = await response.json()
          const ambientSensorData = data?.filter((item: { sensor_id?: string }) =>
            item.sensor_id?.endsWith('-02')
          )
          if (ambientSensorData && ambientSensorData.length > 0) {
            const latest = ambientSensorData[0]
            setAmbientTemperature(latest.temperature)
            setAmbientSensorId(latest.sensor_id)
            setAmbientSensorLastUpdate(formatTimeDifference(latest.created_at))

            try {
              const configResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/individual_sensor_configs?sensor_id=eq.${latest.sensor_id}&select=display_name&limit=1`,
                { headers: createSupabaseHeaders(session.access_token) }
              )
              if (configResponse.ok) {
                const configData = await configResponse.json()
                setAmbientSensorDisplayName(
                  configData?.length > 0 && configData[0].display_name
                    ? configData[0].display_name
                    : 'Buitentemperatuur'
                )
              } else {
                setAmbientSensorDisplayName('Buitentemperatuur')
              }
            } catch {
              setAmbientSensorDisplayName('Buitentemperatuur')
            }
            return
          }
        }
        setAmbientTemperature(null)
        setAmbientSensorId(null)
        setAmbientSensorLastUpdate('No data')
        setAmbientSensorDisplayName('Buitentemperatuur')
        return
      } catch (error) {
        console.error('Error loading ambient temperature with direct fetch:', error)
        setAmbientTemperature(null)
        setAmbientSensorId(null)
        setAmbientSensorLastUpdate('No data')
        setAmbientSensorDisplayName('Buitentemperatuur')
        return
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      )
      const queryPromise = supabase
        .from('sensor_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('sensor_type', 'temperatuurmeter')
        .like('sensor_id', '%-02')
        .order('created_at', { ascending: false })
        .limit(1)

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>

      if (error) {
        console.error('Error loading ambient temperature:', error)
        setAmbientTemperature(null)
        setAmbientSensorId(null)
        setAmbientSensorLastUpdate('No data')
        setAmbientSensorDisplayName('Buitentemperatuur')
        return
      }

      if (data && data.length > 0) {
        const latest = data[0] as { temperature: number; sensor_id: string; created_at: string }
        setAmbientTemperature(latest.temperature)
        setAmbientSensorId(latest.sensor_id)
        setAmbientSensorLastUpdate(formatTimeDifference(latest.created_at))

        try {
          const configTimeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Config query timeout')), 5000)
          )
          const configQueryPromise = supabase
            .from('individual_sensor_configs')
            .select('display_name')
            .eq('sensor_id', latest.sensor_id)
            .single()

          const { data: configData, error: configError } = await Promise.race([
            configQueryPromise,
            configTimeoutPromise,
          ]) as Awaited<typeof configQueryPromise>

          if (configError && configError.code !== 'PGRST116') {
            console.error('Error loading ambient sensor config:', configError)
          }
          setAmbientSensorDisplayName(
            (configData as { display_name?: string } | null)?.display_name || 'Buitentemperatuur'
          )
        } catch {
          setAmbientSensorDisplayName('Buitentemperatuur')
        }
      } else {
        setAmbientTemperature(null)
        setAmbientSensorId(null)
        setAmbientSensorLastUpdate('No data')
        setAmbientSensorDisplayName('Buitentemperatuur')
      }
    } catch (error) {
      console.error('Error in loadAmbientTemperature:', error)
      setAmbientTemperature(null)
      setAmbientSensorId(null)
      setAmbientSensorLastUpdate('No data')
      setAmbientSensorDisplayName('Buitentemperatuur')
    }
  }

  // ── effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user && !authLoading) {
      loadWaterParameters()
      loadKoiCount()
      loadLastWaterChange()
      loadPondSize()
    } else if (!user && !authLoading) {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session, authLoading, refreshTrigger])

  useEffect(() => {
    if (user && !authLoading) {
      loadPondTemperature()
      loadAmbientTemperature()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, refreshTrigger])

  // When pondTemperature arrives after waterParameters, patch the temperature entry in place
  useEffect(() => {
    if (pondTemperature !== null && waterParameters.length > 0) {
      const tempEntry = waterParameters.find(p => p.type === 'temperature')
      if (tempEntry && tempEntry.value !== pondTemperature) {
        const updated = waterParameters.map(p =>
          p.type === 'temperature'
            ? { ...p, value: pondTemperature, status: getParameterStatus('temperature', pondTemperature) }
            : p
        )
        waterParametersRef.current = updated
        setWaterParameters(updated)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pondTemperature])

  useEffect(() => {
    if (loading && user && waterParameters.length === 0) {
      const timeout = setTimeout(() => setLoading(false), 10000)
      return () => clearTimeout(timeout)
    } else if (loading && waterParameters.length > 0) {
      setLoading(false)
    }
  }, [loading, user, waterParameters.length])

  // ── return ────────────────────────────────────────────────────────────────

  return {
    waterParameters,
    loading,
    koiCount,
    lastUpdate,
    pondTemperature,
    pondSensorId,
    pondSensorDisplayName,
    pondSensorLastUpdate,
    ambientTemperature,
    ambientSensorId,
    ambientSensorDisplayName,
    ambientSensorLastUpdate,
    lastWaterChange,
    pondSize,
  }
}
