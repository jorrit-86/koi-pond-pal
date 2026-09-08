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

const DEVICE_ID_REGEX = /^KOIoT-[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{6}$/

type DeviceSensorDef = {
  suffix: string
  sensor_type: string
  display_name: string
}

/** Per-device sensor layout. Fallback = classic 2x DS18B20 (vijver + filter). */
const DEVICE_SENSOR_PROFILES: Record<string, DeviceSensorDef[]> = {
  'KOIoT-57226C': [
    { suffix: '01', sensor_type: 'vijver_water', display_name: 'Watertemperatuur' },
    { suffix: '02', sensor_type: 'omgevingstemperatuur', display_name: 'Omgevingstemperatuur' },
    { suffix: '03', sensor_type: 'ph_meter', display_name: 'pH' },
    { suffix: '04', sensor_type: 'waterflowmeter', display_name: 'Waterdebiet' },
  ],
}

const DEFAULT_SENSOR_PROFILE: DeviceSensorDef[] = [
  { suffix: '01', sensor_type: 'vijver_water', display_name: 'Vijver Water Temperatuur' },
  { suffix: '02', sensor_type: 'filter_inlaat', display_name: 'Filter Inlaat Temperatuur' },
]

function getSensorProfile(deviceId: string): DeviceSensorDef[] {
  return DEVICE_SENSOR_PROFILES[deviceId] ?? DEFAULT_SENSOR_PROFILE
}

function childSensorIds(deviceId: string, profile = getSensorProfile(deviceId)) {
  return profile.map((s) => `${deviceId}-${s.suffix}`)
}

export function useSensorManagement() {
  const { user } = useAuth()
  const [sensors, setSensors] = useState<UserSensor[]>([])
  const [transferRequests, setTransferRequests] = useState<SensorTransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Ensure device appears in the KOIoT overview and can receive ESP32 data.
   * Only creates missing rows — does not overwrite existing names/types of other devices.
   */
  const provisionDeviceRecords = async (
    deviceId: string,
    sensorName?: string,
    options?: { overwriteLabels?: boolean }
  ) => {
    if (!user) return { success: false as const, error: 'User not authenticated' }

    const overwriteLabels = options?.overwriteLabels === true
    const displayName = sensorName?.trim() || `Device ${deviceId}`
    const profile = getSensorProfile(deviceId)

    const userSensorRows = [
      { user_id: user.id, sensor_id: deviceId, sensor_name: displayName, status: 'active' as const },
      ...profile.map((sensor) => ({
        user_id: user.id,
        sensor_id: `${deviceId}-${sensor.suffix}`,
        sensor_name: sensor.display_name,
        status: 'active' as const,
      })),
    ]

    for (const row of userSensorRows) {
      const { data: existing, error: lookupError } = await supabase
        .from('user_sensors')
        .select('id, user_id')
        .eq('sensor_id', row.sensor_id)
        .maybeSingle()

      if (lookupError) {
        console.error('Error checking user_sensors:', lookupError)
        return { success: false as const, error: 'Failed to check sensor availability' }
      }

      if (!existing) {
        const { error: insertError } = await supabase.from('user_sensors').insert(row)
        if (insertError) {
          console.error('Error inserting user_sensors:', insertError)
          return { success: false as const, error: 'Failed to register sensor' }
        }
      } else if (existing.user_id !== user.id) {
        return {
          success: false as const,
          error: `Sensor ${row.sensor_id} is already registered to another user`,
        }
      } else if (overwriteLabels) {
        await supabase
          .from('user_sensors')
          .update({ sensor_name: row.sensor_name, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      }
    }

    const { data: existingConfig, error: configLookupError } = await supabase
      .from('sensor_configurations')
      .select('sensor_id, user_id')
      .eq('sensor_id', deviceId)
      .maybeSingle()

    if (configLookupError) {
      console.error('Error checking sensor_configurations:', configLookupError)
      return {
        success: false as const,
        error: `Configuratie controleren mislukt: ${configLookupError.message}`,
      }
    }

    const configPayload = {
      sensor_id: deviceId,
      sensor_name: displayName,
      user_id: user.id,
      measurement_interval: 300,
      wifi_auto_connect: true,
      temperature_offset: 0,
      temperature_scale: 1,
      deep_sleep_enabled: false,
      deep_sleep_duration: 3600,
      debug_mode: false,
      log_level: 'info' as const,
      config_version: 1,
      pending_changes: false,
      restart_requested: false,
      updated_at: new Date().toISOString(),
    }

    if (!existingConfig) {
      const { error: configUpsertError } = await supabase
        .from('sensor_configurations')
        .upsert(configPayload, { onConflict: 'sensor_id' })

      if (configUpsertError) {
        console.error('Error upserting sensor_configurations:', configUpsertError)

        const { error: minimalInsertError } = await supabase
          .from('sensor_configurations')
          .insert({
            sensor_id: deviceId,
            sensor_name: displayName,
            user_id: user.id,
          })

        if (minimalInsertError) {
          console.error('Error inserting sensor_configurations (minimal):', minimalInsertError)

          if (minimalInsertError.code === '23505' || configUpsertError.code === '23505') {
            const { error: claimError } = await supabase
              .from('sensor_configurations')
              .update({
                user_id: user.id,
                sensor_name: displayName,
                updated_at: new Date().toISOString(),
              })
              .eq('sensor_id', deviceId)

            if (claimError) {
              console.error('Error claiming existing sensor_configurations:', claimError)
              return {
                success: false as const,
                error: `Configuratie claimen mislukt: ${claimError.message}. Voer fix-sensor-configurations-rls.sql uit in Supabase.`,
              }
            }
          } else {
            return {
              success: false as const,
              error: `Configuratie aanmaken mislukt: ${minimalInsertError.message || configUpsertError.message}`,
            }
          }
        }
      }
    } else if (existingConfig.user_id && existingConfig.user_id !== user.id) {
      return {
        success: false as const,
        error: 'Sensor configuration is already linked to another user',
      }
    } else if (!existingConfig.user_id) {
      const { error: configUpdateError } = await supabase
        .from('sensor_configurations')
        .update({
          user_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('sensor_id', deviceId)

      if (configUpdateError) {
        console.error('Error claiming sensor_configurations:', configUpdateError)
        return {
          success: false as const,
          error: `Configuratie koppelen mislukt: ${configUpdateError.message}`,
        }
      }
    }

    // Create missing individual sensor configs; fix wrong device_id on existing rows
    for (const sensor of profile) {
      const sensorId = `${deviceId}-${sensor.suffix}`

      const { data: existingIndividuals, error: individualLookupError } = await supabase
        .from('individual_sensor_configs')
        .select('id, device_id, sensor_type, display_name')
        .eq('sensor_id', sensorId)

      if (individualLookupError) {
        console.error('Error checking individual_sensor_configs:', individualLookupError)
        return {
          success: false as const,
          error: `Individuele sensorconfigs controleren mislukt: ${individualLookupError.message}`,
        }
      }

      const matching = existingIndividuals?.find((row) => row.sensor_type === sensor.sensor_type)

      if (!matching) {
        // Drop stale types for this sensor_id (e.g. filter_inlaat on a water/ambient device)
        if (existingIndividuals && existingIndividuals.length > 0 && overwriteLabels) {
          await supabase.from('individual_sensor_configs').delete().eq('sensor_id', sensorId)
        }

        const { error: insertIndividualError } = await supabase
          .from('individual_sensor_configs')
          .insert({
            sensor_id: sensorId,
            sensor_type: sensor.sensor_type,
            device_id: deviceId,
            display_name: sensor.display_name,
            temperature_offset: 0,
            temperature_scale: 1,
            enabled: true,
          })

        if (insertIndividualError) {
          console.error('Error inserting individual_sensor_configs:', insertIndividualError)
          return {
            success: false as const,
            error: `Individuele sensorconfigs mislukt: ${insertIndividualError.message}`,
          }
        }
      } else if (matching.device_id !== deviceId || overwriteLabels) {
        const { error: fixError } = await supabase
          .from('individual_sensor_configs')
          .update({
            device_id: deviceId,
            ...(overwriteLabels
              ? { display_name: sensor.display_name, sensor_type: sensor.sensor_type }
              : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', matching.id)

        if (fixError) {
          console.error('Error fixing individual_sensor_configs device_id:', fixError)
        }
      }
    }

    return { success: true as const }
  }

  const loadSensors = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: loadError } = await supabase
        .from('user_sensors')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (loadError) {
        console.error('Error loading sensors:', loadError)
        setError('Failed to load sensors')
        return
      }

      const rows = data || []
      setSensors(rows)

      // Heal only missing config rows — never rewrite labels of other devices
      const deviceIds = [
        ...new Set(rows.map((row) => row.sensor_id).filter((id) => DEVICE_ID_REGEX.test(id))),
      ]

      for (const deviceId of deviceIds) {
        const row = rows.find((r) => r.sensor_id === deviceId)
        await provisionDeviceRecords(deviceId, row?.sensor_name, { overwriteLabels: false })
      }
    } catch (err) {
      console.error('Error in loadSensors:', err)
      setError('Failed to load sensors')
    } finally {
      setLoading(false)
    }
  }

  const loadTransferRequests = async () => {
    if (!user) return

    try {
      const { data, error: transferError } = await supabase
        .from('sensor_transfer_requests')
        .select('*')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (transferError) {
        console.error('Error loading transfer requests:', transferError)
        return
      }

      setTransferRequests(data || [])
    } catch (err) {
      console.error('Error in loadTransferRequests:', err)
    }
  }

  const addSensor = async (sensorId: string, sensorName?: string) => {
    if (!user) return { success: false, error: 'User not authenticated' }

    if (!DEVICE_ID_REGEX.test(sensorId)) {
      return {
        success: false,
        error: 'Invalid sensor ID format. Must be KOIoT- followed by 6 characters (letters, numbers, symbols).',
      }
    }

    try {
      const { data: existingSensor, error: checkError } = await supabase
        .from('user_sensors')
        .select('*')
        .eq('sensor_id', sensorId)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing sensor:', checkError)
        return { success: false, error: 'Failed to check sensor availability' }
      }

      if (existingSensor) {
        if (existingSensor.user_id === user.id) {
          const provisioned = await provisionDeviceRecords(
            sensorId,
            sensorName || existingSensor.sensor_name,
            { overwriteLabels: true }
          )
          if (!provisioned.success) return provisioned

          await loadSensors()
          return { success: true, healed: true, data: existingSensor }
        }

        const { error: transferError } = await supabase
          .from('sensor_transfer_requests')
          .insert([
            {
              sensor_id: sensorId,
              from_user_id: existingSensor.user_id,
              to_user_id: user.id,
              message: `Transfer request for sensor ${sensorId}`,
            },
          ])

        if (transferError) {
          console.error('Error creating transfer request:', transferError)
          return { success: false, error: 'Failed to create transfer request' }
        }

        return {
          success: false,
          error: 'Sensor is already registered to another user. A transfer request has been sent.',
          requiresTransfer: true,
        }
      }

      const provisioned = await provisionDeviceRecords(sensorId, sensorName, {
        overwriteLabels: true,
      })
      if (!provisioned.success) return provisioned

      const { data, error: fetchError } = await supabase
        .from('user_sensors')
        .select('*')
        .eq('sensor_id', sensorId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        console.error('Error loading added sensor:', fetchError)
      }

      await loadSensors()
      return { success: true, data }
    } catch (err) {
      console.error('Error in addSensor:', err)
      return { success: false, error: 'Failed to add sensor' }
    }
  }

  const removeSensor = async (sensorId: string) => {
    if (!user) return { success: false, error: 'User not authenticated' }

    try {
      const deviceId = DEVICE_ID_REGEX.test(sensorId)
        ? sensorId
        : sensorId.replace(/-\d{2}$/, '')

      const profileIds = childSensorIds(deviceId)
      const idsToDelete = [deviceId, ...profileIds]

      const { error: userSensorsError } = await supabase
        .from('user_sensors')
        .delete()
        .eq('user_id', user.id)
        .or(`sensor_id.eq.${deviceId},sensor_id.like.${deviceId}-%`)

      if (userSensorsError) {
        console.error('Error removing user_sensors:', userSensorsError)
        // Fallback to explicit id list
        const { error: fallbackError } = await supabase
          .from('user_sensors')
          .delete()
          .in('sensor_id', idsToDelete)
          .eq('user_id', user.id)
        if (fallbackError) {
          return { success: false, error: 'Failed to remove sensor' }
        }
      }

      // Delete by prefix (source of truth) AND by device_id (legacy/wrong links)
      await supabase
        .from('individual_sensor_configs')
        .delete()
        .or(`device_id.eq.${deviceId},sensor_id.like.${deviceId}-%`)

      await supabase
        .from('sensor_configurations')
        .delete()
        .eq('sensor_id', deviceId)
        .eq('user_id', user.id)

      await loadSensors()
      return { success: true }
    } catch (err) {
      console.error('Error in removeSensor:', err)
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
      const { error: rpcError } = await supabase.rpc('process_sensor_transfer', {
        p_sensor_id: sensorId,
        p_from_user_id: fromUserId,
        p_to_user_id: toUserId,
        p_accept: accept,
      })

      if (rpcError) {
        console.error('Error processing transfer:', rpcError)
        return { success: false, error: 'Failed to process transfer request' }
      }

      if (accept && DEVICE_ID_REGEX.test(sensorId)) {
        await provisionDeviceRecords(sensorId, undefined, { overwriteLabels: true })
      }

      await loadSensors()
      await loadTransferRequests()

      return { success: true }
    } catch (err) {
      console.error('Error in respondToTransferRequest:', err)
      return { success: false, error: 'Failed to process transfer request' }
    }
  }

  const updateSensorName = async (sensorId: string, newName: string) => {
    if (!user) return { success: false, error: 'User not authenticated' }

    try {
      const { error: updateError } = await supabase
        .from('user_sensors')
        .update({ sensor_name: newName })
        .eq('sensor_id', sensorId)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Error updating sensor name:', updateError)
        return { success: false, error: 'Failed to update sensor name' }
      }

      if (DEVICE_ID_REGEX.test(sensorId)) {
        await supabase
          .from('sensor_configurations')
          .update({ sensor_name: newName, updated_at: new Date().toISOString() })
          .eq('sensor_id', sensorId)
          .eq('user_id', user.id)
      }

      await loadSensors()
      return { success: true }
    } catch (err) {
      console.error('Error in updateSensorName:', err)
      return { success: false, error: 'Failed to update sensor name' }
    }
  }

  useEffect(() => {
    if (user) {
      void loadSensors()
      void loadTransferRequests()
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
    refreshTransferRequests: loadTransferRequests,
  }
}
