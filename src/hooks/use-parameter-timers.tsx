import { createContext, useContext, useState, useEffect, ReactNode } from "react"

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
  phosphate: { enabled: false, duration: 30 }
}

export function ParameterTimersProvider({ children }: { children: ReactNode }) {
  const [timerConfigs, setTimerConfigs] = useState<Record<string, TimerConfig>>(defaultTimerConfigs)
  const [timerStates, setTimerStates] = useState<Record<string, TimerState>>({})

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

  const updateTimerConfig = (parameter: string, config: TimerConfig) => {
    setTimerConfigs(prev => ({
      ...prev,
      [parameter]: config
    }))
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