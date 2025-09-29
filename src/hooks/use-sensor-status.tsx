import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface SensorStatus {
  sensor_id: string
  status: 'online' | 'offline' | 'unknown'
  last_seen: string | null
  last_ping: string | null
  response_time: number | null
}

export function useSensorStatus() {
  const { user } = useAuth()
  const [sensorStatuses, setSensorStatuses] = useState<SensorStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkSensorStatus = useCallback(async () => {
    if (!user) return

    try {
      // Get user's linked sensors
      const { data: userSensors, error: sensorsError } = await supabase
        .from('user_sensors')
        .select('sensor_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (sensorsError) throw sensorsError

      if (!userSensors || userSensors.length === 0) {
        setSensorStatuses([])
        setLoading(false)
        return
      }

      const sensorIds = userSensors.map(s => s.sensor_id)
      const statuses: SensorStatus[] = []

      // Check each sensor's last activity
      for (const sensorId of sensorIds) {
        const { data: lastData, error: dataError } = await supabase
          .from('sensor_data')
          .select('measurement_time, created_at')
          .eq('sensor_id', sensorId)
          .eq('user_id', user.id)
          .order('measurement_time', { ascending: false })
          .limit(1)
          .single()

        if (dataError && dataError.code !== 'PGRST116') {
          console.error(`Error checking sensor ${sensorId}:`, dataError)
          statuses.push({
            sensor_id: sensorId,
            status: 'unknown',
            last_seen: null,
            last_ping: null,
            response_time: null
          })
          continue
        }

        if (lastData) {
          const lastSeen = new Date(lastData.measurement_time)
          const now = new Date()
          const timeDiff = now.getTime() - lastSeen.getTime()
          const minutesAgo = Math.floor(timeDiff / (1000 * 60))

          // Consider sensor online if last data was within 15 minutes
          const status = minutesAgo <= 15 ? 'online' : 'offline'

          statuses.push({
            sensor_id: sensorId,
            status,
            last_seen: lastData.measurement_time,
            last_ping: lastData.created_at,
            response_time: minutesAgo
          })
        } else {
          statuses.push({
            sensor_id: sensorId,
            status: 'unknown',
            last_seen: null,
            last_ping: null,
            response_time: null
          })
        }
      }

      setSensorStatuses(statuses)
      setError(null)

    } catch (err: any) {
      console.error('Error checking sensor statuses:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  const pingSensor = useCallback(async (sensorId: string) => {
    if (!user) return { success: false, error: 'User not authenticated' }

    try {
      // Send a ping request to the sensor via Edge Function
      const { data, error } = await supabase.functions.invoke('sensor-ping', {
        body: {
          sensor_id: sensorId,
          user_id: user.id
        }
      })

      if (error) throw error

      // Refresh status after ping
      await checkSensorStatus()

      return { success: true, data }

    } catch (err: any) {
      console.error('Error pinging sensor:', err.message)
      return { success: false, error: err.message }
    }
  }, [user, checkSensorStatus])

  const getSensorStatus = useCallback((sensorId: string) => {
    return sensorStatuses.find(s => s.sensor_id === sensorId)
  }, [sensorStatuses])

  const getOverallStatus = useCallback(() => {
    if (sensorStatuses.length === 0) return 'no_sensors'
    
    const onlineCount = sensorStatuses.filter(s => s.status === 'online').length
    const totalCount = sensorStatuses.length

    if (onlineCount === totalCount) return 'all_online'
    if (onlineCount > 0) return 'partial_online'
    return 'all_offline'
  }, [sensorStatuses])

  useEffect(() => {
    if (user) {
      checkSensorStatus()
      
      // Check status every 2 minutes
      const interval = setInterval(checkSensorStatus, 120000)
      return () => clearInterval(interval)
    }
  }, [user, checkSensorStatus])

  return {
    sensorStatuses,
    loading,
    error,
    checkSensorStatus,
    pingSensor,
    getSensorStatus,
    getOverallStatus,
    refresh: checkSensorStatus
  }
}
