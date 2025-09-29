import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

export interface UserSensor {
  id: string
  user_id: string
  sensor_id: string
  sensor_name?: string
  status: 'active' | 'pending_transfer' | 'transferred' | 'offline'
  created_at: string
  updated_at: string
}

export interface SensorTransferRequest {
  id: string
  sensor_id: string
  from_user_id: string
  to_user_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  message?: string
  created_at: string
  responded_at?: string
  expires_at: string
}

export function useSensorManagement() {
  const { user } = useAuth()
  const [sensors, setSensors] = useState<UserSensor[]>([])
  const [transferRequests, setTransferRequests] = useState<SensorTransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSensors = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('user_sensors')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading sensors:', error)
        setError('Failed to load sensors')
        return
      }

      setSensors(data || [])
    } catch (error) {
      console.error('Error in loadSensors:', error)
      setError('Failed to load sensors')
    } finally {
      setLoading(false)
    }
  }

  const loadTransferRequests = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('sensor_transfer_requests')
        .select('*')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading transfer requests:', error)
        return
      }

      setTransferRequests(data || [])
    } catch (error) {
      console.error('Error in loadTransferRequests:', error)
    }
  }

  const addSensor = async (sensorId: string, sensorName?: string) => {
    if (!user) return { success: false, error: 'User not authenticated' }

    // Validate sensor ID format
    if (!sensorId.match(/^KOIoT-[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{6}$/)) {
      return { success: false, error: 'Invalid sensor ID format. Must be KOIoT- followed by 6 characters (letters, numbers, symbols).' }
    }

    try {
      // Check if sensor is already registered
      const { data: existingSensor, error: checkError } = await supabase
        .from('user_sensors')
        .select('*')
        .eq('sensor_id', sensorId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is what we want
        console.error('Error checking existing sensor:', checkError)
        return { success: false, error: 'Failed to check sensor availability' }
      }

      if (existingSensor) {
        if (existingSensor.user_id === user.id) {
          return { success: false, error: 'Sensor is already registered to your account' }
        } else {
          // Sensor is registered to another user, create transfer request
          const { error: transferError } = await supabase
            .from('sensor_transfer_requests')
            .insert([
              {
                sensor_id: sensorId,
                from_user_id: existingSensor.user_id,
                to_user_id: user.id,
                message: `Transfer request for sensor ${sensorId}`
              }
            ])

          if (transferError) {
            console.error('Error creating transfer request:', transferError)
            return { success: false, error: 'Failed to create transfer request' }
          }

          return { 
            success: false, 
            error: 'Sensor is already registered to another user. A transfer request has been sent.',
            requiresTransfer: true
          }
        }
      }

      // Add sensor to user
      const { data, error } = await supabase
        .from('user_sensors')
        .insert([
          {
            user_id: user.id,
            sensor_id: sensorId,
            sensor_name: sensorName || `Sensor ${sensorId}`
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Error adding sensor:', error)
        return { success: false, error: 'Failed to add sensor' }
      }

      // Reload sensors
      await loadSensors()

      return { success: true, data }
    } catch (error) {
      console.error('Error in addSensor:', error)
      return { success: false, error: 'Failed to add sensor' }
    }
  }

  const removeSensor = async (sensorId: string) => {
    if (!user) return { success: false, error: 'User not authenticated' }

    try {
      const { error } = await supabase
        .from('user_sensors')
        .delete()
        .eq('sensor_id', sensorId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error removing sensor:', error)
        return { success: false, error: 'Failed to remove sensor' }
      }

      // Reload sensors
      await loadSensors()

      return { success: true }
    } catch (error) {
      console.error('Error in removeSensor:', error)
      return { success: false, error: 'Failed to remove sensor' }
    }
  }

  const respondToTransferRequest = async (
    requestId: string, 
    sensorId: string, 
    fromUserId: string, 
    toUserId: string, 
    accept: boolean
  ) => {
    if (!user) return { success: false, error: 'User not authenticated' }

    try {
      const { error } = await supabase.rpc('process_sensor_transfer', {
        p_sensor_id: sensorId,
        p_from_user_id: fromUserId,
        p_to_user_id: toUserId,
        p_accept: accept
      })

      if (error) {
        console.error('Error processing transfer:', error)
        return { success: false, error: 'Failed to process transfer request' }
      }

      // Reload data
      await loadSensors()
      await loadTransferRequests()

      return { success: true }
    } catch (error) {
      console.error('Error in respondToTransferRequest:', error)
      return { success: false, error: 'Failed to process transfer request' }
    }
  }

  const updateSensorName = async (sensorId: string, newName: string) => {
    if (!user) return { success: false, error: 'User not authenticated' }

    try {
      const { error } = await supabase
        .from('user_sensors')
        .update({ sensor_name: newName })
        .eq('sensor_id', sensorId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating sensor name:', error)
        return { success: false, error: 'Failed to update sensor name' }
      }

      // Reload sensors
      await loadSensors()

      return { success: true }
    } catch (error) {
      console.error('Error in updateSensorName:', error)
      return { success: false, error: 'Failed to update sensor name' }
    }
  }

  useEffect(() => {
    if (user) {
      loadSensors()
      loadTransferRequests()
    }
  }, [user])

  return {
    sensors,
    transferRequests,
    loading,
    error,
    addSensor,
    removeSensor,
    respondToTransferRequest,
    updateSensorName,
    refreshSensors: loadSensors,
    refreshTransferRequests: loadTransferRequests
  }
}
