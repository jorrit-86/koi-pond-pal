import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface UserPreferences {
  // Future preferences can be added here
}

export const useUserPreferences = () => {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [loading, setLoading] = useState(true)

  const loadPreferences = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        // Handle 406 errors gracefully - usually means RLS policy issue or table structure mismatch
        if ((error as any).status === 406 || error.code === 'PGRST116') {
          console.warn('406 error loading preferences (RLS or schema issue):', error.message)
          setPreferences({})
          setLoading(false)
          return
        }
        console.error('Error loading user preferences:', error)
        return
      }

      if (data) {
        // Filter out dashboard_sensor_selection if it exists (legacy field)
        const { dashboard_sensor_selection, ...otherPreferences } = data
        setPreferences(otherPreferences as UserPreferences)
      } else {
        setPreferences({})
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
