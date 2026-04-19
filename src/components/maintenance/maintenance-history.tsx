import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { useMaintenanceTasks } from '@/hooks/use-maintenance-tasks'
import { SkippedTask, MaintenanceTask, WaterChangeDetails, WaterParametersDetails } from '@/types/maintenance'
import { History, Calendar, X, CheckCircle, SkipForward, ChevronDown, ChevronUp, Droplets, TestTube, Filter } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface MaintenanceHistoryProps {
  onNavigate?: (tab: string) => void
}

interface HistoryItem {
  id: string
  task_name: string
  task_type: string
  due_date: string
  completed_at: string
  notes?: string
  isSkipped: boolean
  waterChangeDetails?: WaterChangeDetails | null
  waterParametersDetails?: WaterParametersDetails | null
}

export function MaintenanceHistory({ onNavigate }: MaintenanceHistoryProps) {
  const { t } = useTranslation()
  const { 
    getSkippedTasks, 
    getCompletedTasks, 
    getWaterChangeDetails, 
    getWaterParametersDetails,
    tasks, 
    loading 
  } = useMaintenanceTasks()
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set())
  const [selectedFilter, setSelectedFilter] = useState<string>('all')

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'Alle taken' },
    { value: 'water_change', label: '💧 Waterwissel' },
    { value: 'clean_brushes', label: '🧽 Borstels schoonmaken' },
    { value: 'filter_check', label: '🔧 Filter controle' },
    { value: 'water_parameters', label: '📊 Waterparameters' },
    { value: 'custom', label: '✅ Aangepast' }
  ]

  // Filtered items based on selected filter
  const filteredItems = useMemo(() => {
    if (selectedFilter === 'all') {
      return historyItems
    }
    return historyItems.filter(item => item.task_type === selectedFilter)
  }, [historyItems, selectedFilter])

  useEffect(() => {
    const loadHistory = async () => {
      // Get skipped tasks from localStorage
      const skippedTasks = getSkippedTasks()
      
      // Get completed tasks from database
      const completedTasks = getCompletedTasks()
      
      // Combine and convert to history items
      const items: HistoryItem[] = []
      
      // Add skipped tasks
      skippedTasks.forEach(task => {
        items.push({
          id: `skipped-${task.task_id}-${task.skipped_at}`,
          task_name: task.task_name,
          task_type: task.task_type,
          due_date: task.due_date,
          completed_at: task.skipped_at,
          isSkipped: true
        })
      })
      
      // Add completed tasks (exclude those that were skipped)
      const skippedTaskIds = new Set(skippedTasks.map(t => t.task_id))
      for (const task of completedTasks) {
        // Only add if not already in skipped tasks
        if (!skippedTaskIds.has(task.id)) {
          const item: HistoryItem = {
            id: `completed-${task.id}`,
            task_name: task.task_name,
            task_type: task.task_type,
            due_date: task.due_date,
            completed_at: task.completed_at!,
            notes: task.notes,
            isSkipped: false
          }

          // Load details for water_change and water_parameters tasks
          if (task.task_type === 'water_change' && task.completed_at) {
            item.waterChangeDetails = await getWaterChangeDetails(task.completed_at)
          } else if (task.task_type === 'water_parameters' && task.completed_at) {
            item.waterParametersDetails = await getWaterParametersDetails(task.completed_at)
          }

          items.push(item)
        }
      }
      
      // Sort by completed_at date, most recent first
      items.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      
      setHistoryItems(items)
    }
    
    loadHistory()
    // Refresh every 5 seconds to catch new tasks
    const interval = setInterval(loadHistory, 5000)
    return () => clearInterval(interval)
  }, [getSkippedTasks, getCompletedTasks, getWaterChangeDetails, getWaterParametersDetails, tasks])

  const toggleExpand = async (itemId: string, item: HistoryItem) => {
    const isExpanded = expandedItems.has(itemId)
    
    if (isExpanded) {
      // Collapse
      setExpandedItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    } else {
      // Expand and load details if not already loaded
      setExpandedItems(prev => new Set(prev).add(itemId))
      
      // Load details if needed
      if (!item.waterChangeDetails && !item.waterParametersDetails && !item.isSkipped) {
        const task = tasks.find(t => item.id === `completed-${t.id}`)
        if (task && task.completed_at) {
          setLoadingDetails(prev => new Set(prev).add(itemId))
          
          if (task.task_type === 'water_change') {
            const details = await getWaterChangeDetails(task.completed_at)
            setHistoryItems(prev => prev.map(i => 
              i.id === itemId ? { ...i, waterChangeDetails: details } : i
            ))
          } else if (task.task_type === 'water_parameters') {
            const details = await getWaterParametersDetails(task.completed_at)
            setHistoryItems(prev => prev.map(i => 
              i.id === itemId ? { ...i, waterParametersDetails: details } : i
            ))
          }
          
          setLoadingDetails(prev => {
            const newSet = new Set(prev)
            newSet.delete(itemId)
            return newSet
          })
        }
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (taskDate.getTime() === today.getTime()) {
      return `Vandaag om ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    } else if (taskDate.getTime() === yesterday.getTime()) {
      return `Gisteren om ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString('nl-NL', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate)
    return date.toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric'
    })
  }

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
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

  const getWaterTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'tap_water': 'Kraanwater',
      'well_water': 'Putwater',
      'rain_water': 'Regenwater',
      'ro_water': 'RO water',
      'mixed': 'Gemengd'
    }
    return labels[type] || type
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'routine': 'Routine',
      'maintenance': 'Onderhoud',
      'problem': 'Probleem',
      'emergency': 'Noodgeval',
      'seasonal': 'Seizoensgebonden',
      'other': 'Anders'
    }
    return labels[reason] || reason
  }

  const getParameterLabel = (type: string) => {
    const labels: Record<string, string> = {
      'ph': 'pH',
      'kh': 'KH',
      'gh': 'GH',
      'nitrite': 'Nitriet',
      'nitrate': 'Nitraat',
      'phosphate': 'Fosfaat',
      'ammonia': 'Ammoniak',
      'temperature': 'Temperatuur'
    }
    return labels[type] || type
  }

  const hasDetails = (item: HistoryItem) => {
    return item.waterChangeDetails || item.waterParametersDetails || item.notes
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Historisch Overzicht</h2>
          <p className="text-muted-foreground">
            Overzicht van alle afgeronde en overgeslagen onderhoudstaken
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="task-filter" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter:
            </Label>
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger id="task-filter" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {onNavigate && (
            <Button variant="outline" onClick={() => onNavigate('dashboard')}>
              <X className="h-4 w-4 mr-2" />
              Sluiten
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex justify-center">Laden...</div>
          </CardContent>
        </Card>
      ) : historyItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Geen historische taken</p>
            <p className="text-sm text-muted-foreground mt-2">
              Afgeronde en overgeslagen taken worden hier weergegeven
            </p>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Geen taken gevonden voor dit filter</p>
            <p className="text-sm text-muted-foreground mt-2">
              Probeer een ander filter te selecteren
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historische Taken ({filteredItems.length} van {historyItems.length})
            </CardTitle>
            <CardDescription>
              {selectedFilter === 'all' 
                ? 'Alle afgeronde en overgeslagen onderhoudstaken'
                : `Gefilterd op: ${filterOptions.find(opt => opt.value === selectedFilter)?.label || selectedFilter}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredItems.map((item) => (
              <Collapsible
                key={item.id}
                open={expandedItems.has(item.id)}
                onOpenChange={() => toggleExpand(item.id, item)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <span className="text-2xl flex-shrink-0">{getTaskIcon(item.task_type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm sm:text-base leading-tight">{item.task_name}</p>
                          {item.isSkipped ? (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <SkipForward className="h-3 w-3" />
                              Overgeslagen
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Afgerond
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:gap-4 mt-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            Vervaldatum: {formatDueDate(item.due_date)}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {item.isSkipped ? 'Overgeslagen' : 'Afgerond'}: {formatDate(item.completed_at)}
                          </p>
                        </div>
                        {item.notes && !expandedItems.has(item.id) && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Notitie: {item.notes}
                          </p>
                        )}
                      </div>
                      {hasDetails(item) && (
                        <div className="flex-shrink-0">
                          {expandedItems.has(item.id) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-0 border-t bg-muted/30">
                      {loadingDetails.has(item.id) ? (
                        <div className="text-sm text-muted-foreground py-2">Details laden...</div>
                      ) : (
                        <div className="space-y-3 pt-3">
                          {/* Water Change Details */}
                          {item.waterChangeDetails && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <Droplets className="h-4 w-4" />
                                Waterwissel Details
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Aantal liters:</span>
                                  <span className="ml-2 font-medium">{item.waterChangeDetails.liters_added.toLocaleString('nl-NL')} L</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Watertype:</span>
                                  <span className="ml-2 font-medium">{getWaterTypeLabel(item.waterChangeDetails.water_type)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Reden:</span>
                                  <span className="ml-2 font-medium">{getReasonLabel(item.waterChangeDetails.reason)}</span>
                                </div>
                                {item.waterChangeDetails.notes && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Notitie:</span>
                                    <span className="ml-2">{item.waterChangeDetails.notes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Water Parameters Details */}
                          {item.waterParametersDetails && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <TestTube className="h-4 w-4" />
                                Waterparameters Details
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {item.waterParametersDetails.parameters.map((param, idx) => (
                                  <div key={idx}>
                                    <span className="text-muted-foreground">{getParameterLabel(param.type)}:</span>
                                    <span className="ml-2 font-medium">{param.value} {param.unit}</span>
                                  </div>
                                ))}
                                {item.waterParametersDetails.notes && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Notitie:</span>
                                    <span className="ml-2">{item.waterParametersDetails.notes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* General Notes */}
                          {item.notes && expandedItems.has(item.id) && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Notitie:</span>
                              <span className="ml-2">{item.notes}</span>
                            </div>
                          )}

                          {/* No details message */}
                          {!item.waterChangeDetails && !item.waterParametersDetails && !item.notes && (
                            <div className="text-sm text-muted-foreground">
                              Geen aanvullende details beschikbaar
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

