import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface TimerConfig {
  enabled: boolean
  duration: number // in minutes
}

interface TimerState {
  isRunning: boolean
  timeLeft: number // in seconds
  startTime?: Date
}

interface ParameterTimersContextType {
  timerConfigs: Record<string, TimerConfig>
  timerStates: Record<string, TimerState>
  isLoading: boolean
  updateTimerConfig: (parameter: string, config: TimerConfig) => void
  startTimer: (parameter: string) => void
  stopTimer: (parameter: string) => void
  resetTimer: (parameter: string) => void
}

const ParameterTimersContext = createContext<ParameterTimersContextType | undefined>(undefined)

const defaultTimerConfigs: Record<string, TimerConfig> = {
  ph: { enabled: false, duration: 30 },
  temperature: { enabled: false, duration: 15 },
  kh: { enabled: false, duration: 60 },
  gh: { enabled: false, duration: 60 },
  nitrite: { enabled: false, duration: 45 },
  nitrate: { enabled: false, duration: 45 },
  phosphate: { enabled: false, duration: 30 },
  ammonia: { enabled: false, duration: 30 }
}

export function ParameterTimersProvider({ children }: { children: ReactNode }) {
  // Use try-catch to handle cases where AuthProvider is not available
  let user = null
  try {
    const authContext = useAuth()
    user = authContext?.user || null
  } catch (error) {
    // AuthProvider not available, continue without user
    console.log('AuthProvider not available, using localStorage only')
  }
  
  const [isLoading, setIsLoading] = useState(false) // Set to false since we're using localStorage only
  
  // Load timer configs from localStorage immediately
  const [timerConfigs, setTimerConfigs] = useState<Record<string, TimerConfig>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('parameter-timer-configs')
      if (saved) {
        try {
          const configs = JSON.parse(saved)
          console.log('Initialized timer configs from localStorage:', configs)
          return configs
        } catch (error) {
          console.error('Error loading timer configs from localStorage:', error)
        }
      }
    }
    return defaultTimerConfigs
  })
  
  // Sync localStorage configs to database (DISABLED - using localStorage only)
  const syncLocalStorageToDatabase = async (configs: Record<string, TimerConfig>) => {
    console.log('Database sync disabled - using localStorage only')
    console.log('Timer configs are stored in localStorage:', configs)
    // Database sync is disabled for now
    return
  }

  // Load timer configs from localStorage only (database sync disabled)
  const loadTimerConfigsFromDatabase = async () => {
    console.log('Loading timer configs from localStorage only')
    
    // Always load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('parameter-timer-configs')
      if (saved) {
        try {
          const configs = JSON.parse(saved)
          console.log('Loaded from localStorage:', configs)
          setTimerConfigs(configs)
        } catch (error) {
          console.error('Error loading timer configs from localStorage:', error)
          setTimerConfigs(defaultTimerConfigs)
        }
      } else {
        console.log('No localStorage data, using defaults')
        setTimerConfigs(defaultTimerConfigs)
      }
    }
    setIsLoading(false)
  }

  const [timerStates, setTimerStates] = useState<Record<string, TimerState>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('parameter-timer-states')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Convert startTime strings back to Date objects
          Object.keys(parsed).forEach(key => {
            if (parsed[key].startTime) {
              parsed[key].startTime = new Date(parsed[key].startTime)
            }
          })
          return parsed
        } catch (error) {
          console.error('Error loading timer states from localStorage:', error)
        }
      }
    }
    return {}
  })

  // Save timer configs to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('parameter-timer-configs', JSON.stringify(timerConfigs))
    }
  }, [timerConfigs])

  // Save timer states to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('parameter-timer-states', JSON.stringify(timerStates))
    }
  }, [timerStates])

  // Timer configs are loaded directly in useState initialization

  // Database sync is disabled - no additional useEffects needed

  // Calculate remaining time for running timers on page load
  useEffect(() => {
    setTimerStates(prev => {
      const updated = { ...prev }
      let hasChanges = false

      Object.keys(updated).forEach(parameter => {
        const timer = updated[parameter]
        if (timer.isRunning && timer.startTime) {
          const config = timerConfigs[parameter]
          if (config) {
            const elapsed = Math.floor((Date.now() - timer.startTime.getTime()) / 1000)
            const totalDuration = config.duration * 60
            const remaining = Math.max(0, totalDuration - elapsed)
            
            if (remaining !== timer.timeLeft) {
              updated[parameter] = {
                ...timer,
                timeLeft: remaining
              }
              hasChanges = true
            }
          }
        }
      })

      return hasChanges ? updated : prev
    })
  }, [timerConfigs])

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerStates(prev => {
        const updated = { ...prev }
        let hasChanges = false

        Object.keys(updated).forEach(parameter => {
          const timer = updated[parameter]
          if (timer.isRunning && timer.timeLeft > 0) {
            updated[parameter] = {
              ...timer,
              timeLeft: timer.timeLeft - 1
            }
            hasChanges = true
          } else if (timer.isRunning && timer.timeLeft <= 0) {
            updated[parameter] = {
              ...timer,
              isRunning: false,
              timeLeft: 0
            }
            hasChanges = true
            
            // Trigger notification when timer completes
            if (Notification.permission === "granted") {
              new Notification(`${parameter.toUpperCase()} Timer Complete`, {
                body: `Time to test ${parameter} levels!`,
                icon: "/favicon.ico"
              })
            }
          }
        })

        return hasChanges ? updated : prev
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const updateTimerConfig = async (parameter: string, config: TimerConfig) => {
    console.log('Updating timer config:', parameter, config)
    
    // Update local state immediately
    setTimerConfigs(prev => ({
      ...prev,
      [parameter]: config
    }))

    // Save to localStorage immediately
    if (typeof window !== 'undefined') {
      const updatedConfigs = {
        ...timerConfigs,
        [parameter]: config
      }
      localStorage.setItem('parameter-timer-configs', JSON.stringify(updatedConfigs))
      console.log('Saved to localStorage:', updatedConfigs)
    }

    // Database sync is disabled - using localStorage only
    console.log('Timer config saved to localStorage only (database sync disabled)')
  }

  const startTimer = (parameter: string) => {
    const config = timerConfigs[parameter]
    if (!config || !config.enabled) return

    setTimerStates(prev => ({
      ...prev,
      [parameter]: {
        isRunning: true,
        timeLeft: config.duration * 60, // convert minutes to seconds
        startTime: new Date()
      }
    }))

    // Request notification permission if not already granted
    if (Notification.permission === "default") {
      Notification.requestPermission()
    }
  }

  const stopTimer = (parameter: string) => {
    setTimerStates(prev => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        isRunning: false
      }
    }))
  }

  const resetTimer = (parameter: string) => {
    const config = timerConfigs[parameter]
    if (!config) return

    setTimerStates(prev => ({
      ...prev,
      [parameter]: {
        isRunning: false,
        timeLeft: config.duration * 60,
        startTime: undefined
      }
    }))
  }

  return (
    <ParameterTimersContext.Provider
      value={{
        timerConfigs,
        timerStates,
        isLoading,
        updateTimerConfig,
        startTimer,
        stopTimer,
        resetTimer
      }}
    >
      {children}
    </ParameterTimersContext.Provider>
  )
}

export function useParameterTimers() {
  const context = useContext(ParameterTimersContext)
  if (context === undefined) {
    throw new Error("useParameterTimers must be used within a ParameterTimersProvider")
  }
  return context
}