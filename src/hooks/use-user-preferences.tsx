import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface UserPreferences {
  dashboard_sensor_selection: 'sensor_1' | 'sensor_2' | 'latest'
}

export const useUserPreferences = () => {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<UserPreferences>({
    dashboard_sensor_selection: 'sensor_1'
  })
  const [loading, setLoading] = useState(true)

  const loadPreferences = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('dashboard_sensor_selection')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading user preferences:', error)
        return
      }

      if (data) {
        const newPreferences = {
          dashboard_sensor_selection: data.dashboard_sensor_selection || 'sensor_1'
        }
        setPreferences(newPreferences)
      } else {
        const defaultPreferences = {
          dashboard_sensor_selection: 'sensor_1'
        }
        setPreferences(defaultPreferences)
      }
    } catch (error) {
      console.error('Error loading user preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const updatePreferences = async (newPreferences: Partial<UserPreferences>) => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...newPreferences
        }, {
          onConflict: 'user_id'
        })

      if (error) {
        console.error('Error updating user preferences:', error)
        return false
      }

      setPreferences(prev => ({ ...prev, ...newPreferences }))
      return true
    } catch (error) {
      console.error('Error updating user preferences:', error)
      return false
    }
  }

  useEffect(() => {
    loadPreferences()
  }, [user])

  return {
    preferences,
    loading,
    updatePreferences,
    refreshPreferences: loadPreferences
  }
}
