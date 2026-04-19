import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface AverageTempResult {
  avgTemp: number | null
  daysUsed: number
  lastUpdate: string | null
  hasEnoughData: boolean
}

interface Use3DayAverageResult {
  pondTemp: AverageTempResult
  ambientTemp: AverageTempResult
  loading: boolean
  error: string | null
  refreshAverages: () => Promise<void>
}

export function use3DayAverage(): Use3DayAverageResult {
  const { user } = useAuth()
  const [pondTemp, setPondTemp] = useState<AverageTempResult>({
    avgTemp: null,
    daysUsed: 0,
    lastUpdate: null,
    hasEnoughData: false
  })
  const [ambientTemp, setAmbientTemp] = useState<AverageTempResult>({
    avgTemp: null,
    daysUsed: 0,
    lastUpdate: null,
    hasEnoughData: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate 3-day average for a specific sensor type
  const calculateAverage = async (sensorType: 'pond' | 'ambient'): Promise<AverageTempResult> => {
    if (!user) {
      return { avgTemp: null, daysUsed: 0, lastUpdate: null, hasEnoughData: false }
    }

    try {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      // Get sensor data for the last 3 days
      const { data: sensorData, error: sensorError } = await supabase
        .from('sensor_data')
        .select('temperature, measurement_time, sensor_id, sensor_name')
        .eq('sensor_type', 'temperatuurmeter')
        .gte('measurement_time', threeDaysAgo.toISOString())
        .order('measurement_time', { ascending: false })

      if (sensorError) {
        console.error(`Error loading ${sensorType} sensor data:`, sensorError)
        return { avgTemp: null, daysUsed: 0, lastUpdate: null, hasEnoughData: false }
      }

      if (!sensorData || sensorData.length === 0) {
        return { avgTemp: null, daysUsed: 0, lastUpdate: null, hasEnoughData: false }
      }

      // Group by sensor and get the most recent reading per day
      const sensorGroups = new Map()
      sensorData.forEach(record => {
        if (!sensorGroups.has(record.sensor_id)) {
          sensorGroups.set(record.sensor_id, [])
        }
        sensorGroups.get(record.sensor_id).push(record)
      })

      // Find the appropriate sensor based on type - ALWAYS use sensor -01 for pond and -02 for ambient
      let targetSensor = null
      
      if (sensorType === 'pond') {
        // ALWAYS use sensor ending in -01 for vijverwatertemperatuur
        for (const [sensorId, records] of sensorGroups) {
          if (sensorId.endsWith('-01')) {
            targetSensor = records
            console.log('Using sensor -01 for 3-day pond temperature average:', sensorId)
            break
          }
        }
        if (!targetSensor) {
          console.warn('Sensor -01 (vijverwatertemperatuur) not found for 3-day average')
        }
      } else if (sensorType === 'ambient') {
        // ALWAYS use sensor ending in -02 for buitentemperatuur
        for (const [sensorId, records] of sensorGroups) {
          if (sensorId.endsWith('-02')) {
            targetSensor = records
            console.log('Using sensor -02 for 3-day ambient temperature average:', sensorId)
            break
          }
        }
        if (!targetSensor) {
          console.warn('Sensor -02 (buitentemperatuur) not found for 3-day average')
        }
      }

      if (!targetSensor || targetSensor.length === 0) {
        return { avgTemp: null, daysUsed: 0, lastUpdate: null, hasEnoughData: false }
      }

      // Group readings by day and get the most recent reading per day
      const dailyReadings = new Map()
      targetSensor.forEach(record => {
        const date = new Date(record.measurement_time).toDateString()
        if (!dailyReadings.has(date) || 
            new Date(record.measurement_time) > new Date(dailyReadings.get(date).measurement_time)) {
          dailyReadings.set(date, record)
        }
      })

      const readings = Array.from(dailyReadings.values())
      const daysUsed = readings.length
      const hasEnoughData = daysUsed >= 1 // At least 1 day of data

      if (readings.length === 0) {
        return { avgTemp: null, daysUsed: 0, lastUpdate: null, hasEnoughData: false }
      }

      // Calculate average temperature
      const sum = readings.reduce((acc, record) => acc + record.temperature, 0)
      const avgTemp = sum / readings.length

      return {
        avgTemp,
        daysUsed,
        lastUpdate: readings[0].measurement_time,
        hasEnoughData
      }

    } catch (err) {
      console.error(`Error calculating ${sensorType} average:`, err)
      return { avgTemp: null, daysUsed: 0, lastUpdate: null, hasEnoughData: false }
    }
  }

  // Load averages
  const loadAverages = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const [pondResult, ambientResult] = await Promise.all([
        calculateAverage('pond'),
        calculateAverage('ambient')
      ])

      setPondTemp(pondResult)
      setAmbientTemp(ambientResult)

    } catch (err) {
      console.error('Error loading 3-day averages:', err)
      setError('Fout bij laden van gemiddelde temperaturen')
    } finally {
      setLoading(false)
    }
  }

  // Refresh averages
  const refreshAverages = async () => {
    await loadAverages()
  }

  // Load on mount
  useEffect(() => {
    loadAverages()
  }, [user])

  return {
    pondTemp,
    ambientTemp,
    loading,
    error,
    refreshAverages
  }
}





