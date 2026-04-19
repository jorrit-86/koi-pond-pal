import { useState, useEffect } from 'react'
import { useMaintenanceTasks } from './use-maintenance-tasks'

export function usePendingWaterParametersTask() {
  const { completeTask } = useMaintenanceTasks()
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)

  useEffect(() => {
    // Check for pending task on mount
    const storedTaskId = localStorage.getItem('pendingWaterParametersTask')
    if (storedTaskId) {
      setPendingTaskId(storedTaskId)
    }
  }, [])

  const completePendingTask = async () => {
    if (pendingTaskId) {
      try {
        await completeTask(pendingTaskId, { notes: 'Water parameters gemeten en opgeslagen' })
        localStorage.removeItem('pendingWaterParametersTask')
        setPendingTaskId(null)
        return true
      } catch (error) {
        console.error('Error completing pending water parameters task:', error)
        return false
      }
    }
    return false
  }

  const clearPendingTask = () => {
    localStorage.removeItem('pendingWaterParametersTask')
    setPendingTaskId(null)
  }

  return {
    pendingTaskId,
    completePendingTask,
    clearPendingTask
  }
}
