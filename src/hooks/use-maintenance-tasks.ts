import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { 
  MaintenanceTaskTemplate, 
  MaintenanceTask, 
  CreateTaskTemplateData, 
  UpdateTaskTemplateData,
  TaskCompletionData,
  SkippedTask,
  WaterChangeDetails,
  WaterParametersDetails
} from '@/types/maintenance'

export function useMaintenanceTasks() {
  const { user, session } = useAuth()
  const [templates, setTemplates] = useState<MaintenanceTaskTemplate[]>([])
  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Load templates
  const loadTemplates = async () => {
    if (!user || !user.id) return

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let templatesData: any[] = []
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading maintenance templates using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_task_templates?user_id=eq.${user.id}&select=*&order=created_at.desc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            templatesData = Array.isArray(data) ? data : [data]
            console.log('Loaded maintenance templates (direct fetch):', templatesData.length, 'templates')
          } else if (response.status === 406 || response.status === 404) {
            // Table doesn't exist or not accessible - silently ignore
            setTemplates([])
            return
          }
        } catch (error: any) {
          console.error('Error loading templates with direct fetch:', error)
          // Fall through to try normal Supabase query
        }
      }
      
      // If we don't have data yet, try normal Supabase query
      if (templatesData.length === 0) {
        const { data, error } = await supabase
          .from('maintenance_task_templates')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading templates:', error)
          // If table doesn't exist or RLS issues, just set empty array
          if (error.code === 'PGRST116' || 
              error.message.includes('relation') || 
              error.message.includes('does not exist') ||
              error.code === 'PGRST301' ||
              error.message.includes('permission denied')) {
            console.warn('Maintenance task templates table does not exist or RLS issues')
            setTemplates([])
            return
          }
          throw error
        }
        
        templatesData = data || []
      }
      
      setTemplates(templatesData)
      console.log('Loaded', templatesData.length, 'maintenance templates')
    } catch (err) {
      console.error('Error loading templates:', err)
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    }
  }

  // Load tasks
  const loadTasks = async () => {
    if (!user || !user.id) return

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let tasksData: any[] = []
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading maintenance tasks using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_tasks?user_id=eq.${user.id}&select=*&order=due_date.asc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            tasksData = Array.isArray(data) ? data : [data]
            console.log('Loaded maintenance tasks (direct fetch):', tasksData.length, 'tasks')
          } else if (response.status === 406 || response.status === 404) {
            // Table doesn't exist or not accessible - silently ignore
            setTasks([])
            return
          }
        } catch (error: any) {
          console.error('Error loading tasks with direct fetch:', error)
          // Fall through to try normal Supabase query
        }
      }
      
      // If we don't have data yet, try normal Supabase query
      if (tasksData.length === 0) {
        const { data, error } = await supabase
          .from('maintenance_tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('due_date', { ascending: true })

        if (error) {
          console.error('Error loading tasks:', error)
          // If table doesn't exist or RLS issues, just set empty array
          if (error.code === 'PGRST116' || 
              error.message.includes('relation') || 
              error.message.includes('does not exist') ||
              error.code === 'PGRST301' ||
              error.message.includes('permission denied')) {
            console.warn('Maintenance tasks table does not exist or RLS issues')
            setTasks([])
            return
          }
          throw error
        }
        
        tasksData = data || []
      }
      
      setTasks(tasksData)
      console.log('Loaded', tasksData.length, 'maintenance tasks')
    } catch (err) {
      console.error('Error loading tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    }
  }

  // Create template
  const createTemplate = async (templateData: CreateTaskTemplateData) => {
    if (!user || !user.id) throw new Error('User not authenticated')

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let newTemplate: any = null
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Creating maintenance template using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_task_templates`,
            {
              method: 'POST',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({
                ...templateData,
                user_id: user.id
              })
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            newTemplate = Array.isArray(data) ? data[0] : data
            setTemplates(prev => [newTemplate, ...prev])
            return newTemplate
          } else {
            const errorData = await response.json()
            if (response.status === 406 || response.status === 404) {
              throw new Error('Database tables not set up yet. Please run the database setup first.')
            }
            throw new Error(errorData.message || 'Failed to create template')
          }
        } catch (error: any) {
          console.error('Error creating template with direct fetch:', error)
          throw error
        }
      } else {
        // Normal Supabase query
        const { data, error } = await supabase
          .from('maintenance_task_templates')
          .insert({
            ...templateData,
            user_id: user.id
          })
          .select()
          .single()

        if (error) {
          if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
            throw new Error('Database tables not set up yet. Please run the database setup first.')
          }
          throw error
        }
        
        newTemplate = data
        setTemplates(prev => [newTemplate, ...prev])
        return newTemplate
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
      throw err
    }
  }

  // Update template
  const updateTemplate = async (id: string, templateData: UpdateTaskTemplateData) => {
    if (!user || !user.id) throw new Error('User not authenticated')
    
    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let updatedTemplate: any = null
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Updating maintenance template using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_task_templates?id=eq.${id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(templateData)
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            updatedTemplate = Array.isArray(data) ? data[0] : data
            setTemplates(prev => prev.map(t => t.id === id ? updatedTemplate : t))
          } else {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Failed to update template')
          }
        } catch (error: any) {
          console.error('Error updating template with direct fetch:', error)
          throw error
        }
      } else {
        // Normal Supabase query
        const { data, error } = await supabase
          .from('maintenance_task_templates')
          .update(templateData)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        updatedTemplate = data
        setTemplates(prev => prev.map(t => t.id === id ? updatedTemplate : t))
      }
      
      // Update existing tasks for this template
      if (templateData.advance_notice_days !== undefined || templateData.task_name) {
        // Update existing pending tasks with new values
        try {
          // Check if Supabase has a session
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          
          const updateData = {
            advance_notice_days: templateData.advance_notice_days,
            task_name: templateData.task_name
          }
          
          // If no Supabase session but we have React session, use direct fetch
          if (!currentSession && session?.access_token) {
            try {
              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_tasks?template_id=eq.${id}&status=eq.pending`,
                {
                  method: 'PATCH',
                  headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                  },
                  body: JSON.stringify(updateData)
                }
              )
              
              // Silently ignore errors for task updates
            } catch (error) {
              // Silently ignore errors
            }
          } else {
            await supabase
              .from('maintenance_tasks')
              .update(updateData)
              .eq('template_id', id)
              .eq('status', 'pending')
          }
        } catch (error) {
          // Silently ignore errors
        }
        
        // Only regenerate if advance_notice_days changed (not for task name changes)
        if (templateData.advance_notice_days !== undefined) {
          await generateTasks()
          await updateOverdueTasks()
          await loadTasks() // Refresh the tasks list
        } else {
          // For task name changes, just reload tasks without regeneration
          await loadTasks()
        }
      }
      
      return updatedTemplate
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template')
      throw err
    }
  }

  // Delete template
  const deleteTemplate = async (id: string) => {
    if (!user || !user.id) throw new Error('User not authenticated')
    
    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Deleting maintenance template using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_task_templates?id=eq.${id}`,
            {
              method: 'DELETE',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (response.ok) {
            setTemplates(prev => prev.filter(t => t.id !== id))
          } else {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Failed to delete template')
          }
        } catch (error: any) {
          console.error('Error deleting template with direct fetch:', error)
          throw error
        }
      } else {
        // Normal Supabase query
        const { error } = await supabase
          .from('maintenance_task_templates')
          .delete()
          .eq('id', id)

        if (error) throw error
        setTemplates(prev => prev.filter(t => t.id !== id))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
      throw err
    }
  }

  // Get skipped tasks from localStorage
  const getSkippedTasks = (): SkippedTask[] => {
    if (!user) return []
    try {
      const key = `skipped_tasks_${user.id}`
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (err) {
      console.error('Error loading skipped tasks:', err)
    }
    return []
  }

  // Get completed tasks from database
  const getCompletedTasks = (): MaintenanceTask[] => {
    return tasks.filter(task => task.status === 'completed' && task.completed_at)
  }

  // Get water change details for a completed task
  const getWaterChangeDetails = async (completedAt: string): Promise<WaterChangeDetails | null> => {
    if (!user || !user.id) return null

    try {
      // Find water change within 1 hour of task completion
      const completedDate = new Date(completedAt)
      const startTime = new Date(completedDate.getTime() - 60 * 60 * 1000) // 1 hour before
      const endTime = new Date(completedDate.getTime() + 60 * 60 * 1000) // 1 hour after

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let waterChange: any = null

      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_changes?user_id=eq.${user.id}&changed_at=gte.${startTime.toISOString()}&changed_at=lte.${endTime.toISOString()}&order=changed_at.desc&limit=1`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            waterChange = Array.isArray(data) && data.length > 0 ? data[0] : null
          }
        } catch (error) {
          console.error('Error loading water change details:', error)
        }
      } else {
        // Normal Supabase query
        const { data, error } = await supabase
          .from('water_changes')
          .select('*')
          .eq('user_id', user.id)
          .gte('changed_at', startTime.toISOString())
          .lte('changed_at', endTime.toISOString())
          .order('changed_at', { ascending: false })
          .limit(1)
          .single()

        if (!error && data) {
          waterChange = data
        }
      }

      if (waterChange) {
        return {
          id: waterChange.id,
          liters_added: waterChange.liters_added,
          water_type: waterChange.water_type,
          reason: waterChange.reason,
          notes: waterChange.notes,
          changed_at: waterChange.changed_at
        }
      }

      return null
    } catch (err) {
      console.error('Error getting water change details:', err)
      return null
    }
  }

  // Get water parameters details for a completed task
  const getWaterParametersDetails = async (completedAt: string): Promise<WaterParametersDetails | null> => {
    if (!user || !user.id) return null

    try {
      // Find water parameters within 1 hour of task completion
      const completedDate = new Date(completedAt)
      const startTime = new Date(completedDate.getTime() - 60 * 60 * 1000) // 1 hour before
      const endTime = new Date(completedDate.getTime() + 60 * 60 * 1000) // 1 hour after

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let parameters: any[] = []

      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_parameters?user_id=eq.${user.id}&measured_at=gte.${startTime.toISOString()}&measured_at=lte.${endTime.toISOString()}&order=measured_at.desc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            parameters = Array.isArray(data) ? data : []
          }
        } catch (error) {
          console.error('Error loading water parameters details:', error)
        }
      } else {
        // Normal Supabase query
        const { data, error } = await supabase
          .from('water_parameters')
          .select('*')
          .eq('user_id', user.id)
          .gte('measured_at', startTime.toISOString())
          .lte('measured_at', endTime.toISOString())
          .order('measured_at', { ascending: false })

        if (!error && data) {
          parameters = data
        }
      }

      if (parameters.length > 0) {
        // Group parameters by measured_at (same measurement)
        const groupedByTime = parameters.reduce((acc: any, param: any) => {
          const key = param.measured_at
          if (!acc[key]) {
            acc[key] = {
              measured_at: param.measured_at,
              parameters: [],
              notes: param.notes
            }
          }
          acc[key].parameters.push({
            type: param.parameter_type,
            value: param.value,
            unit: param.unit || ''
          })
          return acc
        }, {})

        // Get the most recent measurement
        const latestMeasurement = Object.values(groupedByTime)[0] as any
        return latestMeasurement || null
      }

      return null
    } catch (err) {
      console.error('Error getting water parameters details:', err)
      return null
    }
  }

  // Save skipped tasks to localStorage
  const saveSkippedTasks = (skippedTasks: SkippedTask[]) => {
    if (!user) return
    try {
      const key = `skipped_tasks_${user.id}`
      localStorage.setItem(key, JSON.stringify(skippedTasks))
    } catch (err) {
      console.error('Error saving skipped tasks:', err)
    }
  }

  // Skip task (stores locally, doesn't save to database)
  const skipTask = async (taskId: string) => {
    if (!user) throw new Error('User not authenticated')
    
    const task = tasks.find(t => t.id === taskId)
    if (!task) throw new Error('Task not found')

    // Check if template allows skipping
    const template = task.template_id ? templates.find(t => t.id === task.template_id) : null
    if (!template || !template.can_skip) {
      throw new Error('Deze taak kan niet worden overgeslagen')
    }

    // Create skipped task record
    const skippedTask: SkippedTask = {
      task_id: taskId,
      task_name: task.task_name,
      task_type: task.task_type,
      due_date: task.due_date,
      skipped_at: new Date().toISOString(),
      template_id: task.template_id
    }

    // Add to localStorage
    const skippedTasks = getSkippedTasks()
    skippedTasks.push(skippedTask)
    saveSkippedTasks(skippedTasks)

    // Remove task from list (mark as completed so it disappears)
    // We'll mark it as completed but store the skip info separately
    await completeTask(taskId, { notes: 'Overgeslagen' })
    
    return skippedTask
  }

  // Complete task
  const completeTask = async (id: string, completionData?: TaskCompletionData) => {
    if (!user || !user.id) throw new Error('User not authenticated')
    
    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let completedTask: any = null
      
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        ...completionData
      }
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Completing maintenance task using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_tasks?id=eq.${id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(updateData)
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            completedTask = Array.isArray(data) ? data[0] : data
            setTasks(prev => prev.map(t => t.id === id ? completedTask : t))
          } else {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Failed to complete task')
          }
        } catch (error: any) {
          console.error('Error completing task with direct fetch:', error)
          throw error
        }
      } else {
        // Normal Supabase query
        const { data, error } = await supabase
          .from('maintenance_tasks')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        completedTask = data
        setTasks(prev => prev.map(t => t.id === id ? completedTask : t))
      }
      
      // After completing a task, regenerate tasks to ensure we have future tasks
      setTimeout(async () => {
        await generateTasks()
        await updateOverdueTasks()
        await loadTasks()
      }, 100)
      
      return completedTask
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task')
      throw err
    }
  }

  // Generate tasks for active templates
  const generateTasks = async () => {
    if (!user) return
    
    // Prevent multiple simultaneous generation calls
    if (isGenerating) {
      console.log('Task generation already in progress, skipping...')
      return
    }
    
    // Check if we have a valid Supabase session or React session before proceeding
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (!currentSession && !session?.access_token) {
      console.log('No session available for task generation, skipping... (tasks will be generated when session is restored)')
      return
    }
    
    setIsGenerating(true)
    try {
      const activeTemplates = templates.filter(t => t.is_active)
      for (const template of activeTemplates) {
        // Generate tasks for the next month to ensure enough tasks are visible
        const now = new Date()
        const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 1 month from now
        
        let currentDate = new Date(now)
        let taskCount = 0
        const maxTasks = 3 // Reduced to 3 tasks per template for better performance
        
        // First, try to get the next due date from today
        let nextDueDate = calculateNextDueDate(template)
        if (!nextDueDate) {
          // If no next due date from today, try from tomorrow
          currentDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          nextDueDate = calculateNextDueDateForDate(template, currentDate)
        }
        
        // If still no next due date, try from next week
        if (!nextDueDate) {
          currentDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          nextDueDate = calculateNextDueDateForDate(template, currentDate)
        }
        
        while (nextDueDate && nextDueDate <= endDate && taskCount < maxTasks) {
          // Check if task already exists for this template and date
          let existingTasks: any[] = []
          
          // Check if Supabase has a session
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          
          // If no Supabase session but we have React session, use direct fetch
          if (!currentSession && session?.access_token) {
            try {
              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_tasks?template_id=eq.${template.id}&due_date=eq.${encodeURIComponent(nextDueDate.toISOString())}&select=id,due_date,advance_notice_days`,
                {
                  headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                  }
                }
              )
              
              if (response.ok) {
                const data = await response.json()
                existingTasks = Array.isArray(data) ? data : [data]
              }
            } catch (error) {
              // Silently ignore errors
            }
          } else {
            const { data } = await supabase
              .from('maintenance_tasks')
              .select('id, due_date, advance_notice_days')
              .eq('template_id', template.id)
              .eq('due_date', nextDueDate.toISOString())
            
            existingTasks = data || []
          }

          if (existingTasks && existingTasks.length > 0) {
            // console.log('Task already exists, updating if needed')
            const existingTask = existingTasks[0]
            // Update existing task if advance notice changed
            if (existingTask.advance_notice_days !== template.advance_notice_days) {
              try {
                const updateData = { 
                  advance_notice_days: template.advance_notice_days,
                  task_name: template.task_name 
                }
                
                // If no Supabase session but we have React session, use direct fetch
                if (!currentSession && session?.access_token) {
                  try {
                    await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_tasks?id=eq.${existingTask.id}`,
                      {
                        method: 'PATCH',
                        headers: {
                          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                          'Authorization': `Bearer ${session.access_token}`,
                          'Content-Type': 'application/json',
                          'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(updateData)
                      }
                    )
                  } catch (error) {
                    // Silently ignore errors
                  }
                } else {
                  await supabase
                    .from('maintenance_tasks')
                    .update(updateData)
                    .eq('id', existingTask.id)
                }
              } catch (error) {
                // Silently ignore errors
              }
            }
          } else {
            // console.log('Creating new task for:', nextDueDate.toISOString())
            try {
              const newTaskData = {
                user_id: user.id,
                template_id: template.id,
                task_name: template.task_name,
                task_type: template.task_type,
                due_date: nextDueDate.toISOString(),
                advance_notice_days: template.advance_notice_days,
                status: 'pending'
              }
              
              // If no Supabase session but we have React session, use direct fetch
              if (!currentSession && session?.access_token) {
                try {
                  const response = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/maintenance_tasks`,
                    {
                      method: 'POST',
                      headers: {
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                      },
                      body: JSON.stringify(newTaskData)
                    }
                  )
                  
                  // Silently ignore errors (401, 42501, etc.)
                  if (!response.ok) {
                    // Silently skip this task
                    continue
                  }
                } catch (error) {
                  // Silently ignore errors
                  continue
                }
              } else {
                // Create new task with upsert to avoid conflicts
                const { error } = await supabase
                  .from('maintenance_tasks')
                  .upsert(newTaskData, {
                    onConflict: 'template_id,due_date'
                  })
                
                if (error) {
                  // Check if it's an auth/RLS error - silently ignore
                  if (error.code === '42501' || error.code === 'PGRST301' || error.message?.includes('row-level security')) {
                    // Silently skip this task
                    continue
                  }
                  // If upsert fails, try regular insert (only if not an auth error)
                  if (error.code !== '42501' && error.code !== 'PGRST301') {
                    const { error: insertError } = await supabase
                      .from('maintenance_tasks')
                      .insert(newTaskData)
                    if (insertError && (insertError.code === '42501' || insertError.code === 'PGRST301')) {
                      // Silently skip this task
                      continue
                    }
                  } else {
                    // Silently skip this task
                    continue
                  }
                }
              }
            } catch (insertError) {
              // Silently ignore errors and continue with next task
              continue
            }
          }

          // Move to next occurrence based on frequency
          currentDate = getNextOccurrenceDate(template, nextDueDate)
          nextDueDate = calculateNextDueDateForDate(template, currentDate)
          taskCount++
        }
        
        // Generated tasks for template
      }

      // Always reload tasks after generation
      await loadTasks()
      console.log('Task generation completed')
      
      // Check if we have enough visible tasks
      const visibleTasks = getVisibleTasks()
      if (visibleTasks.length === 0) {
        console.log('No visible tasks found after generation')
      }
    } catch (err) {
      console.error('Error generating tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate tasks')
    } finally {
      setIsGenerating(false)
    }
  }

  // Calculate next due date for a template
  const calculateNextDueDate = (template: MaintenanceTaskTemplate): Date | null => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (template.frequency_type) {
      case 'daily':
        return new Date(today.getTime() + 24 * 60 * 60 * 1000)

      case 'weekly':
        if (template.frequency_value === undefined) return null
        const targetDay = template.frequency_value // 0 = Sunday, 1 = Monday, etc.
        const currentDay = today.getDay()
        const daysUntilTarget = (targetDay - currentDay + 7) % 7
        return new Date(today.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000)

      case 'x_days':
        if (template.frequency_value === undefined) return null
        return new Date(today.getTime() + template.frequency_value * 24 * 60 * 60 * 1000)

      case 'four_weeks':
        return new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000)

      case 'monthly':
        if (template.frequency_value === undefined) return null
        const nextMonth = new Date(today)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setDate(template.frequency_value)
        return nextMonth

      default:
        return null
    }
  }

  // Calculate next due date for a template from a specific date
  const calculateNextDueDateForDate = (template: MaintenanceTaskTemplate, fromDate: Date): Date | null => {
    const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())

    switch (template.frequency_type) {
      case 'daily':
        return new Date(today.getTime() + 24 * 60 * 60 * 1000)

      case 'weekly':
        if (template.frequency_value === undefined) return null
        const targetDay = template.frequency_value // 0 = Sunday, 1 = Monday, etc.
        const currentDay = today.getDay()
        const daysUntilTarget = (targetDay - currentDay + 7) % 7
        const nextDate = new Date(today.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000)
        return nextDate

      case 'x_days':
        if (template.frequency_value === undefined) return null
        return new Date(today.getTime() + template.frequency_value * 24 * 60 * 60 * 1000)

      case 'four_weeks':
        return new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000)

      case 'monthly':
        if (template.frequency_value === undefined) return null
        const nextMonth = new Date(today)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setDate(template.frequency_value)
        return nextMonth

      default:
        return null
    }
  }

  // Calculate next occurrence date for a template from a specific date
  const getNextOccurrenceDate = (template: MaintenanceTaskTemplate, fromDate: Date): Date => {
    switch (template.frequency_type) {
      case 'daily':
        return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000)

      case 'weekly':
        return new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000)

      case 'x_days':
        if (template.frequency_value === undefined) return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000)
        return new Date(fromDate.getTime() + template.frequency_value * 24 * 60 * 60 * 1000)

      case 'four_weeks':
        return new Date(fromDate.getTime() + 28 * 24 * 60 * 60 * 1000)

      case 'monthly':
        const nextMonth = new Date(fromDate)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        return nextMonth

      default:
        return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000)
    }
  }

  // Get tasks that should be visible (due within advance notice period)
  const getVisibleTasks = (): MaintenanceTask[] => {
    const now = new Date()
    return tasks.filter(task => {
      if (task.status === 'completed') return false
      
      const dueDate = new Date(task.due_date)
      const advanceNoticeDays = task.advance_notice_days || 1
      
      // Calculate days until due date
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      
      // Task should be visible if we're within the advance notice period
      // OR if the task is overdue (daysUntilDue < 0)
      return daysUntilDue <= advanceNoticeDays
    })
  }

  // Get overdue tasks
  const getOverdueTasks = (): MaintenanceTask[] => {
    const now = new Date()
    return tasks.filter(task => {
      if (task.status === 'completed') return false
      const dueDate = new Date(task.due_date)
      return now > dueDate
    })
  }

  // Update task status to overdue
  const updateOverdueTasks = async () => {
    const overdueTasks = getOverdueTasks()
    
    for (const task of overdueTasks) {
      if (task.status !== 'overdue') {
        await supabase
          .from('maintenance_tasks')
          .update({ status: 'overdue' })
          .eq('id', task.id)
      }
    }
    
    if (overdueTasks.length > 0) {
      await loadTasks()
    }
  }

  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setLoading(true)
        try {
          await Promise.all([loadTemplates(), loadTasks()])
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }
  }, [user])

  useEffect(() => {
    if (templates.length > 0) {
      generateTasks()
      updateOverdueTasks()
    }
  }, [templates])

  // Retry task generation when session becomes available
  useEffect(() => {
    if (templates.length > 0 && user && session) {
      // Check if Supabase session is available
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (currentSession) {
          // Session is available, try to generate tasks if needed
          generateTasks()
        }
      })
    }
  }, [session, templates.length, user])


  return {
    templates,
    tasks,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    completeTask,
    skipTask,
    getSkippedTasks,
    getCompletedTasks,
    getWaterChangeDetails,
    getWaterParametersDetails,
    generateTasks,
    getVisibleTasks,
    getOverdueTasks,
    refresh: () => {
      loadTemplates()
      loadTasks()
    },
    forceRegenerateTasks: async () => {
      if (!user) return
      
      try {
        // Delete all pending tasks
        const { error: deleteError } = await supabase
          .from('maintenance_tasks')
          .delete()
          .eq('user_id', user.id)
          .eq('status', 'pending')
        
        if (deleteError) {
          console.error('Error deleting tasks:', deleteError)
          throw deleteError
        }
        
        // Regenerate all tasks
        await generateTasks()
        await updateOverdueTasks()
        await loadTasks()
      } catch (err) {
        console.error('Error in forceRegenerateTasks:', err)
        setError(err instanceof Error ? err.message : 'Failed to regenerate tasks')
      }
    },
    cleanupOldTasks: async () => {
      if (!user) return
      
      try {
        // Delete tasks that are more than 3 months old and completed
        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        
        const { error } = await supabase
          .from('maintenance_tasks')
          .delete()
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .lt('due_date', threeMonthsAgo.toISOString())
        
        if (error) {
          console.error('Error cleaning up old tasks:', error)
        } else {
          console.log('Cleaned up old completed tasks')
          await loadTasks()
        }
      } catch (err) {
        console.error('Error in cleanupOldTasks:', err)
      }
    },
    resetRecentCompletedTasks: async () => {
      if (!user) return
      
      try {
        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        
        // Reset completed tasks from today and yesterday back to pending
        const { error: resetError } = await supabase
          .from('maintenance_tasks')
          .update({ 
            status: 'pending',
            completed_at: null
          })
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .gte('completed_at', yesterday.toISOString().split('T')[0]) // From yesterday onwards
        
        if (resetError) {
          console.error('Error resetting completed tasks:', resetError)
          throw resetError
        }
        
        // Reset recent completed tasks to pending
        
        // Reload tasks to show the reset tasks
        await loadTasks()
        
        // Recent completed tasks reset successfully
      } catch (err) {
        console.error('Error in resetRecentCompletedTasks:', err)
        setError(err instanceof Error ? err.message : 'Failed to reset completed tasks')
      }
    },
    createTestTask: async () => {
      if (!user) return
      
      try {
        // Create a test task that should be visible immediately
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        await supabase
          .from('maintenance_tasks')
          .insert({
            user_id: user.id,
            task_name: 'Test Taak - Zichtbaar',
            task_type: 'water_change',
            due_date: tomorrow.toISOString(),
            advance_notice_days: 2, // 2 dagen van tevoren
            status: 'pending'
          })
        
        await loadTasks()
        console.log('Test taak aangemaakt:', {
          dueDate: tomorrow.toISOString(),
          advanceNoticeDays: 2,
          shouldBeVisible: true
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create test task')
      }
    },
    debugTasks: () => {
      console.log('=== DEBUG TASKS ===')
      console.log('Templates:', templates)
      console.log('Tasks:', tasks)
      console.log('Visible tasks:', getVisibleTasks())
      console.log('Overdue tasks:', getOverdueTasks())
      
      // Debug each task individually
      tasks.forEach((task, index) => {
        const dueDate = new Date(task.due_date)
        const now = new Date()
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        const advanceNoticeDays = task.advance_notice_days || 1
        
        console.log(`Task ${index + 1}:`, {
          name: task.task_name,
          dueDate: task.due_date,
          daysUntilDue,
          advanceNoticeDays,
          shouldBeVisible: daysUntilDue <= advanceNoticeDays,
          status: task.status,
          currentTime: now.toISOString(),
          dueTime: dueDate.toISOString(),
          templateId: task.template_id
        })
      })
      
      // Debug templates
      templates.forEach((template, index) => {
        console.log(`Template ${index + 1}:`, {
          name: template.task_name,
          frequency: template.frequency_type,
          frequencyValue: template.frequency_value,
          advanceNotice: template.advance_notice_days,
          isActive: template.is_active
        })
      })
      
      console.log('==================')
    }
  }
}
