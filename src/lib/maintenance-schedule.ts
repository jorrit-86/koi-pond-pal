import type { MaintenanceTaskTemplate } from '@/types/maintenance'

const DAY_MS = 24 * 60 * 60 * 1000

export function calculateNextDueDate(template: MaintenanceTaskTemplate): Date | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return calculateNextDueDateForDate(template, today)
}

export function calculateNextDueDateForDate(template: MaintenanceTaskTemplate, fromDate: Date): Date | null {
  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())

  switch (template.frequency_type) {
    case 'daily':
      return new Date(today.getTime() + DAY_MS)

    case 'weekly': {
      if (template.frequency_value === undefined) return null
      const targetDay = template.frequency_value
      const daysUntilTarget = (targetDay - today.getDay() + 7) % 7
      return new Date(today.getTime() + daysUntilTarget * DAY_MS)
    }

    case 'x_days':
      if (template.frequency_value === undefined) return null
      return new Date(today.getTime() + template.frequency_value * DAY_MS)

    case 'four_weeks':
      return new Date(today.getTime() + 28 * DAY_MS)

    case 'monthly': {
      if (template.frequency_value === undefined) return null
      const nextMonth = new Date(today)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      nextMonth.setDate(template.frequency_value)
      return nextMonth
    }

    default:
      return null
  }
}

export function getNextOccurrenceDate(template: MaintenanceTaskTemplate, fromDate: Date): Date {
  switch (template.frequency_type) {
    case 'daily':
      return new Date(fromDate.getTime() + DAY_MS)

    case 'weekly':
      return new Date(fromDate.getTime() + 7 * DAY_MS)

    case 'x_days':
      if (template.frequency_value === undefined) return new Date(fromDate.getTime() + DAY_MS)
      return new Date(fromDate.getTime() + template.frequency_value * DAY_MS)

    case 'four_weeks':
      return new Date(fromDate.getTime() + 28 * DAY_MS)

    case 'monthly': {
      const nextMonth = new Date(fromDate)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      return nextMonth
    }

    default:
      return new Date(fromDate.getTime() + DAY_MS)
  }
}
