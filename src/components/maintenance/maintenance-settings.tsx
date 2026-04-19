import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslation } from 'react-i18next'
import { useMaintenanceTasks } from '@/hooks/use-maintenance-tasks'
import { MaintenanceTaskTemplate, CreateTaskTemplateData } from '@/types/maintenance'
import { Plus, Edit, Trash2, Check, X, RotateCcw, Menu } from 'lucide-react'
import { toast } from 'sonner'

export function MaintenanceSettings() {
  const { t } = useTranslation()
  const {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    forceRegenerateTasks,
    cleanupOldTasks,
    resetRecentCompletedTasks
  } = useMaintenanceTasks()

  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateTaskTemplateData>({
    task_name: '',
    task_type: 'water_change',
    frequency_type: 'weekly',
    frequency_value: 0, // Sunday
    advance_notice_days: 1,
    can_skip: false
  })

  const taskTypeOptions = [
    { value: 'water_change', label: t('maintenance.taskTypes.water_change') },
    { value: 'clean_brushes', label: t('maintenance.taskTypes.clean_brushes') },
    { value: 'filter_check', label: t('maintenance.taskTypes.filter_check') },
    { value: 'water_parameters', label: t('maintenance.taskTypes.water_parameters') },
    { value: 'custom', label: t('maintenance.taskTypes.custom') }
  ]

  const frequencyOptions = [
    { value: 'daily', label: t('maintenance.frequencyTypes.daily') },
    { value: 'weekly', label: t('maintenance.frequencyTypes.weekly') },
    { value: 'x_days', label: t('maintenance.frequencyTypes.x_days') },
    { value: 'four_weeks', label: t('maintenance.frequencyTypes.four_weeks') },
    { value: 'monthly', label: t('maintenance.frequencyTypes.monthly') }
  ]

  const weekDays = [
    { value: 0, label: t('maintenance.weekDays.sunday') },
    { value: 1, label: t('maintenance.weekDays.monday') },
    { value: 2, label: t('maintenance.weekDays.tuesday') },
    { value: 3, label: t('maintenance.weekDays.wednesday') },
    { value: 4, label: t('maintenance.weekDays.thursday') },
    { value: 5, label: t('maintenance.weekDays.friday') },
    { value: 6, label: t('maintenance.weekDays.saturday') }
  ]

  const handleCreate = async () => {
    try {
      await createTemplate(formData)
      setIsCreating(false)
      setFormData({
        task_name: '',
        task_type: 'water_change',
        frequency_type: 'weekly',
        frequency_value: 0,
        advance_notice_days: 1,
        can_skip: false
      })
      toast.success(t('maintenance.messages.taskCreated'))
    } catch (err) {
      toast.error(t('maintenance.messages.createError'))
    }
  }

  const handleEdit = (template: MaintenanceTaskTemplate) => {
    setEditingId(template.id)
    setFormData({
      task_name: template.task_name,
      task_type: template.task_type,
      frequency_type: template.frequency_type,
      frequency_value: template.frequency_value,
      advance_notice_days: template.advance_notice_days,
      can_skip: template.can_skip || false
    })
  }

  const handleUpdate = async () => {
    if (!editingId) return

    try {
      await updateTemplate(editingId, formData)
      setEditingId(null)
      setFormData({
        task_name: '',
        task_type: 'water_change',
        frequency_type: 'weekly',
        frequency_value: 0,
        advance_notice_days: 1,
        can_skip: false
      })
      toast.success(t('maintenance.messages.taskUpdated'))
    } catch (err) {
      toast.error(t('maintenance.messages.updateError'))
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm(t('maintenance.form.deleteTask'))) {
      try {
        await deleteTemplate(id)
        toast.success(t('maintenance.messages.taskDeleted'))
      } catch (err) {
        toast.error(t('maintenance.messages.deleteError'))
      }
    }
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingId(null)
    setFormData({
      task_name: '',
      task_type: 'water_change',
      frequency_type: 'weekly',
      frequency_value: 0,
      advance_notice_days: 1
    })
  }

  const getFrequencyDescription = (template: MaintenanceTaskTemplate) => {
    switch (template.frequency_type) {
      case 'daily':
        return t('maintenance.frequencyTypes.daily')
      case 'weekly':
        const dayName = weekDays.find(d => d.value === template.frequency_value)?.label
        return `${t('maintenance.frequencyTypes.weekly')} (${dayName})`
      case 'x_days':
        return `${t('maintenance.frequencyTypes.x_days')} (${template.frequency_value} ${template.frequency_value === 1 ? 'dag' : 'dagen'})`
      case 'four_weeks':
        return t('maintenance.frequencyTypes.four_weeks')
      case 'monthly':
        return `${t('maintenance.frequencyTypes.monthly')} (${template.frequency_value})`
      default:
        return ''
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('maintenance.title')}</h2>
          <p className="text-muted-foreground">
            Beheer je terugkerende onderhoudstaken
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('maintenance.form.createTask')}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={async () => {
                  try {
                    await forceRegenerateTasks()
                    toast.success('Taken opnieuw gegenereerd')
                  } catch (err) {
                    toast.error('Fout bij regenereren van taken')
                  }
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Taken Regenereren
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={async () => {
                  try {
                    await resetRecentCompletedTasks()
                    toast.success('Recente voltooide taken zijn gereset')
                  } catch (err) {
                    toast.error('Fout bij resetten van taken')
                  }
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Taken Resetten
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={async () => {
                  try {
                    await cleanupOldTasks()
                    toast.success('Oude taken opgeruimd')
                  } catch (err) {
                    toast.error('Fout bij opruimen oude taken')
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Opruimen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {error.includes('Database tables not set up') && (
              <div className="mt-2 p-2 bg-destructive/10 rounded text-sm">
                <strong>Oplossing:</strong> Ga naar je Supabase dashboard → SQL Editor en voer de database setup uit die ik eerder heb gegeven.
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCreating ? t('maintenance.form.createTask') : t('maintenance.form.editTask')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task_name">{t('maintenance.form.taskName')}</Label>
                <Input
                  id="task_name"
                  value={formData.task_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, task_name: e.target.value }))}
                  placeholder="Bijv. Waterwissel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task_type">{t('maintenance.form.taskType')}</Label>
                <Select
                  value={formData.task_type}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, task_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency_type">{t('maintenance.form.frequency')}</Label>
                <Select
                  value={formData.frequency_type}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, frequency_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.frequency_type === 'weekly' && (
                <div className="space-y-2">
                  <Label htmlFor="frequency_value">Dag van de week</Label>
                  <Select
                    value={formData.frequency_value?.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, frequency_value: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekDays.map(day => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.frequency_type === 'x_days' && (
                <div className="space-y-2">
                  <Label htmlFor="frequency_value">Aantal dagen</Label>
                  <Input
                    id="frequency_value"
                    type="number"
                    min="1"
                    value={formData.frequency_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, frequency_value: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              )}

              {formData.frequency_type === 'monthly' && (
                <div className="space-y-2">
                  <Label htmlFor="frequency_value">Dag van de maand (1-31)</Label>
                  <Input
                    id="frequency_value"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.frequency_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, frequency_value: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="advance_notice_days">{t('maintenance.form.advanceNotice')}</Label>
                <Input
                  id="advance_notice_days"
                  type="number"
                  min="0"
                  max="30"
                  value={formData.advance_notice_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, advance_notice_days: parseInt(e.target.value) || 1 }))}
                />
                <p className="text-sm text-muted-foreground">
                  {t('maintenance.form.advanceNoticeDesc')}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="can_skip"
                  checked={formData.can_skip || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, can_skip: checked }))}
                />
                <Label htmlFor="can_skip" className="cursor-pointer">
                  Sla deze taak over (skip optie)
                </Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={isCreating ? handleCreate : handleUpdate}>
                {isCreating ? t('maintenance.form.createTask') : 'Taak opslaan'}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Annuleren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Geen onderhoudstaken geconfigureerd</p>
              <Button onClick={() => setIsCreating(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                {t('maintenance.form.createTask')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          templates.map(template => (
            <Card key={template.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{template.task_name}</h3>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Actief' : 'Inactief'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getFrequencyDescription(template)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Verschijnt {template.advance_notice_days} dag{template.advance_notice_days !== 1 ? 'en' : ''} van tevoren
                    </p>
                    {template.can_skip && (
                      <Badge variant="outline" className="mt-1">
                        Skip optie beschikbaar
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
