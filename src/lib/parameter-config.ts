export type ParameterStatus = 'good' | 'warning' | 'danger'

export const MAX_PARAMETER_RECORDS = 10_000
export const MAX_SENSOR_RECORDS = 2_000

interface ParameterThresholds {
  goodMin?: number
  goodMax?: number
  warnMin?: number
  warnMax?: number
  range: string
}

const THRESHOLDS: Record<string, ParameterThresholds> = {
  ph:          { goodMin: 6.8, goodMax: 8.2, warnMin: 6.5, warnMax: 8.5, range: '6.8–8.2' },
  temperature: { goodMin: 15,  goodMax: 25,  warnMin: 10,  warnMax: 30,  range: '15–25°C' },
  kh:          { goodMin: 4,   goodMax: 10,  warnMin: 3,   warnMax: 12,  range: '4–10°dH' },
  gh:          { goodMin: 6,   goodMax: 16,  warnMin: 4,   warnMax: 20,  range: '6–16°dH' },
  nitrite:     { goodMax: 0.1, warnMax: 0.3,                              range: '0–0.1 mg/l' },
  nitrate:     { goodMax: 25,  warnMax: 50,                               range: '<25 mg/l' },
  phosphate:   { goodMax: 0.5, warnMax: 1.0,                              range: '<0.5 mg/l' },
}

export function getParameterStatus(type: string, value: number): ParameterStatus {
  if (value === undefined || value === null) return 'warning'
  const t = THRESHOLDS[type]
  if (!t) return 'warning'

  const aboveGoodMin = t.goodMin === undefined || value >= t.goodMin
  const belowGoodMax = t.goodMax === undefined || value <= t.goodMax
  if (aboveGoodMin && belowGoodMax) return 'good'

  const aboveWarnMin = t.warnMin === undefined || value >= t.warnMin
  const belowWarnMax = t.warnMax === undefined || value <= t.warnMax
  if (aboveWarnMin && belowWarnMax) return 'warning'

  return 'danger'
}

export function getParameterRange(type: string): string {
  return THRESHOLDS[type]?.range ?? 'N/A'
}
