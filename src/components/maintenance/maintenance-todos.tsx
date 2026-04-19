import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'
import { useMaintenanceTasks } from '@/hooks/use-maintenance-tasks'
import { MaintenanceTask } from '@/types/maintenance'
import { CheckCircle, Clock, AlertTriangle, Calendar, Plus, SkipForward, History } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { WaterChangePopup } from './water-change-popup'
import { WaterParametersPopup } from './water-parameters-popup'

interface MaintenanceTodosProps {
  onNavigate?: (tab: string) => void
}

export function MaintenanceTodos({ onNavigate }: MaintenanceTodosProps) {
  const { t } = useTranslation()
  const {
    tasks,
    templates,
    loading,
    completeTask,
    skipTask,
    getVisibleTasks,
    getOverdueTasks
  } = useMaintenanceTasks()

  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [skippingTask, setSkippingTask] = useState<string | null>(null)
  const [taskNotes, setTaskNotes] = useState<{ [key: string]: string }>({})
  const [waterChangePopup, setWaterChangePopup] = useState<{ isOpen: boolean; taskId: string; taskName: string }>({
    isOpen: false,
    taskId: '',
    taskName: ''
  })
  const [waterParametersPopup, setWaterParametersPopup] = useState<{ isOpen: boolean; taskId: string; taskName: string }>({
    isOpen: false,
    taskId: '',
    taskName: ''
  })

  const visibleTasks = getVisibleTasks()
  const overdueTasks = getOverdueTasks()
  const upcomingTasks = visibleTasks.filter(task => task.status === 'pending')

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (taskDate.getTime() === today.getTime()) {
      return t('maintenance.dashboard.dueToday')
    } else if (taskDate.getTime() === tomorrow.getTime()) {
      return t('maintenance.dashboard.dueTomorrow')
    } else if (taskDate < today) {
      const daysOverdue = Math.ceil((today.getTime() - taskDate.getTime()) / (24 * 60 * 60 * 1000))
      return t('maintenance.dashboard.overdueByDays', { days: daysOverdue })
    } else {
      const daysUntil = Math.ceil((taskDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      return t('maintenance.dashboard.dueInDays', { days: daysUntil })
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Check if this is a water change task
    if (task.task_type === 'water_change') {
      setWaterChangePopup({
        isOpen: true,
        taskId: taskId,
        taskName: task.task_name
      })
      return
    }

    // Check if this is a water parameters task
    if (task.task_type === 'water_parameters') {
      setWaterParametersPopup({
        isOpen: true,
        taskId: taskId,
        taskName: task.task_name
      })
      return
    }

    // For other tasks, complete normally
    setCompletingTask(taskId)
    try {
      const notes = taskNotes[taskId] || undefined
      await completeTask(taskId, { notes })
      setTaskNotes(prev => ({ ...prev, [taskId]: '' }))
      toast.success(t('maintenance.messages.taskCompleted'))
    } catch (err) {
      toast.error(t('maintenance.messages.completeError'))
    } finally {
      setCompletingTask(null)
    }
  }

  const handleWaterChangeComplete = async () => {
    setCompletingTask(waterChangePopup.taskId)
    try {
      const notes = taskNotes[waterChangePopup.taskId] || undefined
      await completeTask(waterChangePopup.taskId, { notes })
      setTaskNotes(prev => ({ ...prev, [waterChangePopup.taskId]: '' }))
      toast.success(t('maintenance.messages.taskCompleted'))
    } catch (err) {
      toast.error(t('maintenance.messages.completeError'))
    } finally {
      setCompletingTask(null)
    }
  }

  const handleWaterParametersComplete = async () => {
    setCompletingTask(waterParametersPopup.taskId)
    try {
      const notes = taskNotes[waterParametersPopup.taskId] || undefined
      await completeTask(waterParametersPopup.taskId, { notes })
      setTaskNotes(prev => ({ ...prev, [waterParametersPopup.taskId]: '' }))
      toast.success(t('maintenance.messages.taskCompleted'))
    } catch (err) {
      toast.error(t('maintenance.messages.completeError'))
    } finally {
      setCompletingTask(null)
    }
  }

  const handleNavigateToParameters = () => {
    // Store the pending task ID for completion when measurement is saved
    localStorage.setItem('pendingWaterParametersTask', waterParametersPopup.taskId)
    
    // Navigate to parameters page
    if (onNavigate) {
      onNavigate('parameters')
    }
  }

  const handleSkipTask = async (taskId: string) => {
    setSkippingTask(taskId)
    try {
      await skipTask(taskId)
      toast.success('Taak overgeslagen')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fout bij overslaan van taak')
    } finally {
      setSkippingTask(null)
    }
  }

  const canTaskBeSkipped = (task: MaintenanceTask): boolean => {
    if (!task.template_id) return false
    const template = templates.find(t => t.id === task.template_id)
    return template?.can_skip || false
  }

  const getTaskIcon = (task: MaintenanceTask) => {
    switch (task.task_type) {
      case 'water_change':
        return '💧'
      case 'clean_brushes':
        return '🧽'
      case 'filter_check':
        return '🔧'
      case 'water_parameters':
        return '📊'
      default:
        return '✅'
    }
  }

  const getStatusBadge = (task: MaintenanceTask) => {
    if (task.status === 'overdue') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {t('maintenance.status.overdue')}
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {t('maintenance.status.pending')}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with History Link */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Onderhoudstaken</h2>
        </div>
        {onNavigate && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onNavigate('maintenance-history')}
          >
            <History className="h-4 w-4 mr-2" />
            Historie
          </Button>
        )}
      </div>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-destructive text-lg sm:text-xl">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              {t('maintenance.dashboard.overdueTasks')}
            </CardTitle>
            <CardDescription className="text-sm">
              Deze taken zijn over tijd en moeten zo snel mogelijk worden uitgevoerd
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 border border-destructive/20 rounded-lg bg-destructive/5">
                <span className="text-2xl flex-shrink-0">{getTaskIcon(task)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base leading-tight">{task.task_name}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{formatDueDate(task.due_date)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {canTaskBeSkipped(task) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSkipTask(task.id)}
                      disabled={skippingTask === task.id || completingTask === task.id}
                      className="h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <SkipForward className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Sla over</span>
                      <span className="sm:hidden">Skip</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleCompleteTask(task.id)}
                    disabled={completingTask === task.id || skippingTask === task.id}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">{t('maintenance.form.completeTask')}</span>
                    <span className="sm:hidden">Voltooi</span>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              {t('maintenance.dashboard.upcomingTasks')}
            </CardTitle>
            <CardDescription className="text-sm">
              Aankomende onderhoudstaken
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <span className="text-2xl flex-shrink-0">{getTaskIcon(task)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base leading-tight">{task.task_name}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{formatDueDate(task.due_date)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {canTaskBeSkipped(task) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSkipTask(task.id)}
                      disabled={skippingTask === task.id || completingTask === task.id}
                      className="h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <SkipForward className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Sla over</span>
                      <span className="sm:hidden">Skip</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompleteTask(task.id)}
                    disabled={completingTask === task.id || skippingTask === task.id}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">{t('maintenance.form.completeTask')}</span>
                    <span className="sm:hidden">Voltooi</span>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No Tasks - Consistent with app styling */}
      {visibleTasks.length === 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Onderhoudstaken
            </CardTitle>
            <CardDescription>
              Geen actieve onderhoudstaken
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Alles bijgewerkt</span>
              </div>
              {onNavigate && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onNavigate('settings')}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Taak toevoegen
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Water Change Popup */}
      <WaterChangePopup
        isOpen={waterChangePopup.isOpen}
        onClose={() => setWaterChangePopup({ isOpen: false, taskId: '', taskName: '' })}
        onComplete={handleWaterChangeComplete}
        taskName={waterChangePopup.taskName}
      />

      {/* Water Parameters Popup */}
      <WaterParametersPopup
        isOpen={waterParametersPopup.isOpen}
        onClose={() => setWaterParametersPopup({ isOpen: false, taskId: '', taskName: '' })}
        onComplete={handleWaterParametersComplete}
        onNavigateToParameters={handleNavigateToParameters}
        taskName={waterParametersPopup.taskName}
      />
    </div>
  )
}
