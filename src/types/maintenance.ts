export interface MaintenanceTaskTemplate {
  id: string
  user_id: string
  task_name: string
  task_type: 'water_change' | 'clean_brushes' | 'filter_check' | 'water_parameters' | 'custom'
  frequency_type: 'daily' | 'weekly' | 'x_days' | 'monthly' | 'four_weeks'
  frequency_value?: number // For 'x_days' and 'weekly' (day of week 0-6), 'monthly' (day of month 1-31)
  advance_notice_days: number
  is_active: boolean
  can_skip?: boolean // Option to allow skipping this task
  created_at: string
  updated_at: string
}

export interface MaintenanceTask {
  id: string
  user_id: string
  template_id?: string
  task_name: string
  task_type: 'water_change' | 'clean_brushes' | 'filter_check' | 'water_parameters' | 'custom'
  due_date: string
  advance_notice_days: number
  status: 'pending' | 'completed' | 'overdue'
  completed_at?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface CreateTaskTemplateData {
  task_name: string
  task_type: 'water_change' | 'clean_brushes' | 'filter_check' | 'water_parameters' | 'custom'
  frequency_type: 'daily' | 'weekly' | 'x_days' | 'monthly' | 'four_weeks'
  frequency_value?: number
  advance_notice_days: number
  can_skip?: boolean
}

export interface UpdateTaskTemplateData extends Partial<CreateTaskTemplateData> {
  is_active?: boolean
}

export interface TaskCompletionData {
  notes?: string
}

export interface SkippedTask {
  task_id: string
  task_name: string
  task_type: string
  due_date: string
  skipped_at: string
  template_id?: string
}

export interface WaterChangeDetails {
  id: string
  liters_added: number
  water_type: string
  reason: string
  notes?: string
  changed_at: string
}

export interface WaterParametersDetails {
  measured_at: string
  parameters: Array<{
    type: string
    value: number
    unit: string
  }>
  notes?: string
}
