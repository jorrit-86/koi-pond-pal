import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface AutoCalculationResult {
  id: string
  calculation_date: string
  pond_temperature: number
  ambient_temperature: number
  avg_pond_temperature_3d: number
  avg_ambient_temperature_3d: number
  season: string
  filter_status: string
  total_daily_feed: number
  feeding_frequency: number
  feeding_times: string[]
  warnings: string[]
  calculation_details: any
}

interface CalculationSchedule {
  id: string
  is_enabled: boolean
  calculation_interval_days: number
  next_calculation_date: string
  last_calculation_date: string | null
}

export function useAutoFeedCalculation() {
  const { user, session } = useAuth()
  const [lastCalculation, setLastCalculation] = useState<AutoCalculationResult | null>(null)
  const [schedule, setSchedule] = useState<CalculationSchedule | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load last calculation and schedule
  const loadCalculationData = useCallback(async () => {
    if (!user || !user.id) return

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // Try to load last calculation - silently fail if table doesn't exist
      try {
        let lastCalc: any = null
        
        // If no Supabase session but we have React session, use direct fetch
        if (!currentSession && session?.access_token) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/auto_feed_calculations?user_id=eq.${user.id}&select=*&order=calculation_date.desc&limit=1`,
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
              lastCalc = Array.isArray(data) ? data[0] : data
            } else if (response.status === 406 || response.status === 404) {
              // Table doesn't exist or not accessible - silently ignore
              return
            }
          } catch (error) {
            // Silently ignore errors for this optional table
            return
          }
        } else {
          const { data, error: calcError } = await supabase
            .from('auto_feed_calculations')
            .select('*')
            .eq('user_id', user.id)
            .order('calculation_date', { ascending: false })
            .limit(1)
            .single()

          if (calcError) {
            if (calcError.code === 'PGRST116' || calcError.code === 'PGRST205' || calcError.code === '42P01') {
              // Table doesn't exist or no data - silently ignore
              return
            }
            // Only log non-critical errors
            if (calcError.code !== '42501') {
              console.warn('Error loading last calculation:', calcError.code)
            }
          } else {
            lastCalc = data
          }
        }
        
        if (lastCalc) {
          setLastCalculation(lastCalc)
        }
      } catch (err) {
        // Silently ignore errors for optional table
      }

      // Try to load schedule - silently fail if table doesn't exist
      try {
        let scheduleData: any = null
        
        // If no Supabase session but we have React session, use direct fetch
        if (!currentSession && session?.access_token) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/feed_calculation_schedule?user_id=eq.${user.id}&select=*`,
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
              scheduleData = Array.isArray(data) ? data[0] : data
            } else if (response.status === 406 || response.status === 404) {
              // Table doesn't exist or not accessible - silently ignore
              return
            }
          } catch (error) {
            // Silently ignore errors for this optional table
            return
          }
        } else {
          const { data, error: scheduleError } = await supabase
            .from('feed_calculation_schedule')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (scheduleError) {
            if (scheduleError.code === 'PGRST116' || scheduleError.code === 'PGRST205' || scheduleError.code === '42P01') {
              // Table doesn't exist or no data - silently ignore, don't try to create
              return
            }
            // Only log non-critical errors
            if (scheduleError.code !== '42501') {
              console.warn('Error loading schedule:', scheduleError.code)
            }
          } else {
            scheduleData = data
          }
        }
        
        if (scheduleData) {
          setSchedule(scheduleData)
        }
      } catch (err) {
        // Silently ignore errors for optional table
      }
    } catch (err) {
      // Silently ignore errors for optional tables
    }
  }, [user, session])

  // Calculate 3-day average temperature
  const calculateAverageTemperature = useCallback(async (sensorType: 'pond' | 'ambient'): Promise<number | null> => {
    if (!user) return null

    try {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const { data: tempData, error } = await supabase
        .from('sensor_data')
        .select('temperature, measurement_time')
        .eq('sensor_type', 'temperatuurmeter')
        .gte('measurement_time', threeDaysAgo.toISOString())
        .order('measurement_time', { ascending: false })

      if (error) {
        console.error(`Error loading ${sensorType} temperature data:`, error)
        return null
      }

      if (!tempData || tempData.length === 0) {
        return null
      }

      // Calculate average
      const sum = tempData.reduce((acc, record) => acc + record.temperature, 0)
      return sum / tempData.length
    } catch (err) {
      console.error(`Error calculating average ${sensorType} temperature:`, err)
      return null
    }
  }, [user])

  // Perform automatic calculation
  const performAutoCalculation = useCallback(async () => {
    if (!user || !schedule) return

    setIsCalculating(true)
    setError(null)

    try {
      // Calculate average temperatures
      const avgPondTemp = await calculateAverageTemperature('pond')
      const avgAmbientTemp = await calculateAverageTemperature('ambient')

      if (avgPondTemp === null) {
        throw new Error('Geen vijver temperatuur data beschikbaar voor berekening')
      }

      // Get current pond profile data
      const { data: pondData, error: pondError } = await supabase
        .from('pond_properties')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (pondError) {
        console.error('Error loading pond profile:', pondError)
      }

      // Get koi data
      const { data: koiData, error: koiError } = await supabase
        .from('koi')
        .select('*')
        .eq('user_id', user.id)

      if (koiError) {
        console.error('Error loading koi data:', koiError)
      }

      // Get water parameters
      const { data: waterData, error: waterError } = await supabase
        .from('water_parameters')
        .select('parameter_type, value, created_at')
        .eq('user_id', user.id)
        .in('parameter_type', ['ammonia', 'nitrite'])
        .order('created_at', { ascending: false })
        .limit(10)

      let ammoniak = 0
      let nitriet = 0
      if (waterData && Array.isArray(waterData)) {
        const ammoniaRecord = waterData.find(record => record.parameter_type === 'ammonia')
        const nitriteRecord = waterData.find(record => record.parameter_type === 'nitrite')
        ammoniak = ammoniaRecord?.value || 0
        nitriet = nitriteRecord?.value || 0
      }

      // Calculate season
      const now = new Date()
      const month = now.getMonth() + 1
      let season = 'autumn'
      if (month === 10 || month === 11) {
        season = 'autumn'
      } else if (month === 12 || month === 1 || month === 2) {
        season = 'winter'
      } else if (month === 3 || month === 4 || month === 5) {
        season = 'spring'
      } else if (month === 6 || month === 7 || month === 8 || month === 9) {
        season = 'summer'
      }

      // Calculate total biomass
      let totalBiomass = 0
      if (koiData && Array.isArray(koiData)) {
        koiData.forEach(koi => {
          const length = parseFloat(koi.length) || 0
          if (length > 0) {
            const weight = 0.014 * Math.pow(length, 3)
            totalBiomass += weight
          }
        })
      }
      
      // Debug logging removed for production

      // Temperature scale factor - same as manual calculation
      let tempScale = 0
      if (avgPondTemp < 6) {
        tempScale = 0
      } else if (avgPondTemp < 8) {
        tempScale = 0.20
      } else if (avgPondTemp < 10) {
        tempScale = 0.35
      } else if (avgPondTemp < 12) {
        tempScale = 0.50
      } else if (avgPondTemp < 15) {
        tempScale = 0.65
      } else if (avgPondTemp < 18) {
        tempScale = 0.80
      } else if (avgPondTemp < 22) {
        tempScale = 0.95
      } else if (avgPondTemp < 26) {
        tempScale = 1.00
      } else if (avgPondTemp < 28) {
        tempScale = 0.90
      } else {
        tempScale = 0.75
      }

      // Filter factor
      const filterStatus = pondData?.filter_status || 'Auto'
      let filterFactor = 1.0
      if (season === 'spring') {
        filterFactor = 0.6
      } else if (season === 'summer' || season === 'autumn') {
        filterFactor = 1.0
      } else if (season === 'winter') {
        filterFactor = 0.8
      }

      // Water quality factor
      let waterQualityFactor = 1.0
      if (ammoniak > 0.10) {
        waterQualityFactor *= 0.75
      }
      if (nitriet > 0.50) {
        waterQualityFactor *= 0.85
      }

      // Feed brand factor
      const feedBrand = pondData?.voer_merk || 'Generiek Voer'
      let feedBrandFactor = 1.0
      if (feedBrand.includes('Premium') || feedBrand.includes('High-protein')) {
        feedBrandFactor = 1.10
      } else if (feedBrand.includes('Economy')) {
        feedBrandFactor = 0.85
      }

      // Calculate total feed using cohort-weighted approach
      // Calculate cohort weights based on koi lengths
      const cohortBands = {
        small: { weight: 0, bwRef: 0.035 },    // ≤ 30 cm: 3.5% BW
        medium: { weight: 0, bwRef: 0.015 },    // 31–55 cm: 1.5% BW
        large: { weight: 0, bwRef: 0.010 },     // 56–70 cm: 1.0% BW
        xlarge: { weight: 0, bwRef: 0.003 }      // ≥ 71 cm: 0.3% BW
      }
      
      // Assign koi to bands and calculate weights
      if (koiData && Array.isArray(koiData)) {
        koiData.forEach(koi => {
          const length = parseFloat(koi.length) || 0
          if (length > 0) {
            const weight = 0.014 * Math.pow(length, 3) // Weight in grams
            if (length <= 30) {
              cohortBands.small.weight += weight
            } else if (length <= 55) {
              cohortBands.medium.weight += weight
            } else if (length <= 70) {
              cohortBands.large.weight += weight
            } else {
              cohortBands.xlarge.weight += weight
            }
          }
        })
      }
      
      // Calculate base feed using cohort-weighted approach
      let baseFeed = 0
      Object.values(cohortBands).forEach(band => {
        baseFeed += band.weight * band.bwRef * tempScale
      })
      
      // Fallback if no koi data or invalid calculations
      if (isNaN(baseFeed) || baseFeed === 0) {
        // Use a reasonable fallback based on average pond size
        const fallbackBiomass = 10000 // 10kg fallback biomass
        baseFeed = fallbackBiomass * 0.01 * tempScale // 1% BW fallback
      }
      
      const totalFeed = baseFeed * filterFactor * waterQualityFactor * feedBrandFactor
      
      // Debug logging removed for production

      // Feeding frequency
      let feedingFreq = 2
      if (avgPondTemp >= 15 && avgPondTemp < 20) {
        feedingFreq = 3
      } else if (avgPondTemp >= 20) {
        feedingFreq = 4
      }

      // Feeding times
      const feedingTimes = []
      if (avgPondTemp < 15) {
        feedingTimes.push('11:00', '17:30')
      } else {
        feedingTimes.push('08:00', '12:00', '16:00', '20:00')
      }

      // Warnings
      const warnings = []
      if (avgPondTemp < 6) {
        warnings.push('Water te koud voor voeren')
      }
      if (ammoniak > 0.10) {
        warnings.push('Ammoniak te hoog - verminder voeren')
      }
      if (nitriet > 0.50) {
        warnings.push('Nitriet te hoog - verminder voeren')
      }

      // Save calculation
      const { data: calculation, error: saveError } = await supabase
        .from('auto_feed_calculations')
        .insert({
          user_id: user.id,
          pond_temperature: avgPondTemp,
          ambient_temperature: avgAmbientTemp,
          avg_pond_temperature_3d: avgPondTemp,
          avg_ambient_temperature_3d: avgAmbientTemp,
          season,
          filter_status: filterStatus,
          water_quality_ammonia: ammoniak,
          water_quality_nitrite: nitriet,
          feed_brand: feedBrand,
          feed_brand_efficiency: feedBrandFactor,
          total_biomass: totalBiomass,
          temperature_scale: tempScale,
          filter_factor: filterFactor,
          water_quality_factor: waterQualityFactor,
          feed_brand_factor: feedBrandFactor,
          total_daily_feed: totalFeed,
          feeding_frequency: feedingFreq,
          feeding_times: feedingTimes,
          warnings,
          calculation_details: {
            koi_count: koiData?.length || 0,
            calculation_method: 'auto_3day_average'
          }
        })
        .select()
        .single()

      if (saveError) {
        // Silently ignore errors for optional table
        if (saveError.code === 'PGRST205' || saveError.code === '42P01' || saveError.code === '42501') {
          return
        }
        // Only log non-critical errors
        if (saveError.code !== '42501') {
          console.warn('Error saving calculation:', saveError.code)
        }
        return
      }

      // Try to update schedule - silently fail if table doesn't exist
      if (schedule) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          const nextCalcDate = new Date()
          nextCalcDate.setDate(nextCalcDate.getDate() + schedule.calculation_interval_days)
          nextCalcDate.setHours(0, 1, 0, 0) // 00:01

          const updateData = {
            last_calculation_date: new Date().toISOString(),
            next_calculation_date: nextCalcDate.toISOString(),
            updated_at: new Date().toISOString()
          }
          
          // If no Supabase session but we have React session, use direct fetch
          if (!currentSession && session?.access_token) {
            try {
              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/feed_calculation_schedule?id=eq.${schedule.id}`,
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
              
              if (!response.ok && response.status !== 406 && response.status !== 404 && response.status !== 42501) {
                // Silently ignore errors for optional table
              }
            } catch (error) {
              // Silently ignore errors for optional table
            }
          } else {
            const { error: updateError } = await supabase
              .from('feed_calculation_schedule')
              .update(updateData)
              .eq('id', schedule.id)

            if (updateError) {
              if (updateError.code === 'PGRST205' || updateError.code === '42P01' || updateError.code === '42501') {
                // Table doesn't exist or RLS policy violation - silently ignore
                return
              }
              // Only log non-critical errors
              if (updateError.code !== '42501') {
                console.warn('Error updating schedule:', updateError.code)
              }
            }
          }
        } catch (err) {
          // Silently ignore errors for optional table
        }
      }

      setLastCalculation(calculation)
      
      // Reload schedule
      await loadCalculationData()

    } catch (err) {
      // Only log and set error for critical errors, not for optional table errors
      const errorMessage = err instanceof Error ? err.message : 'Onbekende fout bij berekening'
      if (!errorMessage.includes('auto_feed_calculations') && !errorMessage.includes('feed_calculation_schedule') && !errorMessage.includes('42501')) {
        console.error('Error in performAutoCalculation:', err)
        setError(errorMessage)
      }
    } finally {
      setIsCalculating(false)
    }
  }, [user, session, schedule, calculateAverageTemperature, loadCalculationData])

  // Check if calculation is due
  const checkCalculationDue = useCallback(() => {
    if (!schedule || !schedule.is_enabled) return false
    
    const now = new Date()
    const nextCalc = new Date(schedule.next_calculation_date)
    
    return now >= nextCalc
  }, [schedule])

  // Manual calculation trigger
  const triggerManualCalculation = useCallback(async () => {
    await performAutoCalculation()
  }, [performAutoCalculation])

  // Load data on mount
  useEffect(() => {
    loadCalculationData()
  }, [loadCalculationData])

  // Check for due calculations every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (checkCalculationDue()) {
        performAutoCalculation()
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [checkCalculationDue, performAutoCalculation])

  return {
    lastCalculation,
    schedule,
    isCalculating,
    error,
    triggerManualCalculation,
    checkCalculationDue: checkCalculationDue(),
    loadCalculationData
  }
}
