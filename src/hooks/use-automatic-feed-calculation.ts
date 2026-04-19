import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { use3DayAverage } from './use-3day-average'

interface AutomaticCalculationResult {
  id: string
  calculation_date: string
  avg_water_temp: number
  avg_air_temp: number
  feed_advice_g: number
  source: 'auto' | 'manual'
  calculation_details: any
}

interface UseAutomaticFeedCalculationResult {
  lastAutoCalculation: AutomaticCalculationResult | null
  loading: boolean
  error: string | null
  triggerManualCalculation: () => Promise<void>
  isCalculating: boolean
}

export function useAutomaticFeedCalculation(): UseAutomaticFeedCalculationResult {
  const { user, session } = useAuth()
  const { pondTemp, ambientTemp, refreshAverages } = use3DayAverage()
  const [lastAutoCalculation, setLastAutoCalculation] = useState<AutomaticCalculationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Load last automatic calculation
  const loadLastCalculation = useCallback(async () => {
    if (!user || !user.id) return

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading last calculation using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/feed_advice_history?user_id=eq.${user.id}&source=eq.auto&select=*&order=calculation_date.desc&limit=1`,
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
            const calculation = Array.isArray(data) ? data[0] : data
            if (calculation) {
              setLastAutoCalculation(calculation)
              return
            }
          }
        } catch (error: any) {
          console.error('Error loading last calculation with direct fetch:', error)
          // Fall through to try normal Supabase query
        }
      }

      // Normal Supabase query
      const { data, error: fetchError } = await supabase
        .from('feed_advice_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('source', 'auto')
        .order('calculation_date', { ascending: false })
        .limit(1)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading last calculation:', fetchError)
        if (fetchError.code === 'PGRST205') {
          console.warn('feed_advice_history table not found - please run the SQL script first')
        }
        return
      }

      setLastAutoCalculation(data)
    } catch (err) {
      console.error('Error in loadLastCalculation:', err)
    }
  }, [user, session])

  // Perform automatic calculation using 3-day averages
  const performAutomaticCalculation = useCallback(async () => {
    if (!user) return

    setIsCalculating(true)
    setError(null)

    try {
      // Refresh 3-day averages
      await refreshAverages()

      // Use 3-day averages or fallback to current values
      const avgPondTemp = pondTemp.avgTemp || 20 // Fallback to 20°C
      const avgAmbientTemp = ambientTemp.avgTemp || 15 // Fallback to 15°C
      
      // Show warning if insufficient data
      const insufficientData = !pondTemp.hasEnoughData || !ambientTemp.hasEnoughData
      if (insufficientData) {
        console.warn('Onvoldoende data voor 3-daags gemiddelde - gebruik fallback waarden')
      }

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let pondData: any = null
      let koiData: any[] = []
      let waterData: any[] = []
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading data for automatic calculation using direct fetch...')
          
          // Load pond properties
          const pondResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/pond_properties?user_id=eq.${user.id}&select=*`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (pondResponse.ok) {
            const pondDataArray = await pondResponse.json()
            pondData = Array.isArray(pondDataArray) ? pondDataArray[0] : pondDataArray
          }
          
          // Load koi data
          const koiResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi?user_id=eq.${user.id}&select=*`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (koiResponse.ok) {
            const koiDataArray = await koiResponse.json()
            koiData = Array.isArray(koiDataArray) ? koiDataArray : [koiDataArray]
          }
          
          // Load water parameters
          const waterResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_parameters?user_id=eq.${user.id}&parameter_type=in.(ammonia,nitrite)&select=parameter_type,value,created_at&order=created_at.desc&limit=10`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (waterResponse.ok) {
            const waterDataArray = await waterResponse.json()
            waterData = Array.isArray(waterDataArray) ? waterDataArray : [waterDataArray]
          }
        } catch (error: any) {
          console.error('Error loading data with direct fetch:', error)
          // Fall through to try normal Supabase queries
        }
      }
      
      // If we don't have data yet, try normal Supabase queries
      if (!pondData) {
        const { data: pondDataResult, error: pondError } = await supabase
          .from('pond_properties')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (pondError) {
          console.error('Error loading pond profile:', pondError)
        } else {
          pondData = pondDataResult
        }
      }

      if (koiData.length === 0) {
        const { data: koiDataResult, error: koiError } = await supabase
          .from('koi')
          .select('*')
          .eq('user_id', user.id)

        if (koiError) {
          console.error('Error loading koi data:', koiError)
        } else {
          koiData = koiDataResult || []
        }
      }

      console.log('Automatic calculation - loaded koi data:', koiData?.length || 0, 'fish')

      if (waterData.length === 0) {
        const { data: waterDataResult, error: waterError } = await supabase
          .from('water_parameters')
          .select('parameter_type, value, created_at')
          .eq('user_id', user.id)
          .in('parameter_type', ['ammonia', 'nitrite'])
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (!waterError) {
          waterData = waterDataResult || []
        }
      }

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

      // Fallback biomass if no koi data
      if (totalBiomass === 0) {
        totalBiomass = 10000 // 10kg fallback
      }

      // Temperature scale factor
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

      // Feed brand factor - use selected feed brand from localStorage
      const selectedFeedBrand = localStorage.getItem('feed-advisor-feed-brand') || (pondData?.voer_merk || 'Generiek Voer')
      
      // Get rendement from Supabase database
      let feedBrandRendement = 1.0
      try {
        // Check if Supabase has a session
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        
        // If no Supabase session but we have React session, use direct fetch
        if (!currentSession && session?.access_token) {
          try {
            const feedBrandResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/feed_brands?merk=eq.${encodeURIComponent(selectedFeedBrand)}&select=rendement`,
              {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json'
                }
              }
            )
            
            if (feedBrandResponse.ok) {
              const feedBrandDataArray = await feedBrandResponse.json()
              const feedBrandData = Array.isArray(feedBrandDataArray) ? feedBrandDataArray[0] : feedBrandDataArray
              if (feedBrandData?.rendement) {
                feedBrandRendement = feedBrandData.rendement
              } else {
                const { getFeedBrandRendement } = await import('@/lib/feed-brand-database')
                feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
              }
            } else {
              const { getFeedBrandRendement } = await import('@/lib/feed-brand-database')
              feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
            }
          } catch (error) {
            const { getFeedBrandRendement } = await import('@/lib/feed-brand-database')
            feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
          }
        } else {
          // Normal Supabase query
          const { data: feedBrandData, error } = await supabase
            .from('feed_brands')
            .select('rendement')
            .eq('merk', selectedFeedBrand)
            .single()
          
          if (!error && feedBrandData) {
            feedBrandRendement = feedBrandData.rendement
          } else {
            // Fallback to local database
            const { getFeedBrandRendement } = await import('@/lib/feed-brand-database')
            feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
          }
        }
      } catch (error) {
        // Fallback to local database
        const { getFeedBrandRendement } = await import('@/lib/feed-brand-database')
        feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
      }
      
      // Higher rendement means less feed needed (divide by rendement)
      const feedBrandFactor = 1.0 / feedBrandRendement

      // Calculate feed using cohort-weighted approach
      const cohortBands = {
        small: { weight: 0, bwRef: 0.035 },    // ≤ 30 cm: 3.5% BW
        medium: { weight: 0, bwRef: 0.015 },    // 31–55 cm: 1.5% BW
        large: { weight: 0, bwRef: 0.010 },     // 56–70 cm: 1.0% BW
        xlarge: { weight: 0, bwRef: 0.003 }      // ≥ 71 cm: 0.3% BW
      }
      
      // Assign koi to bands and calculate weights
      if (koiData && Array.isArray(koiData)) {
        console.log('Processing koi data for automatic calculation:', koiData.length, 'fish')
        koiData.forEach((koi, index) => {
          // Use size_cm field from database
          const length = parseFloat(koi.size_cm) || 0
          console.log(`Koi ${index + 1}: ${koi.name}, length: ${length}cm`)
          if (length > 0) {
            const weight = 0.014 * Math.pow(length, 3)
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
        baseFeed = totalBiomass * 0.01 * tempScale // 1% BW fallback
      }
      
      const totalFeed = baseFeed * filterFactor * waterQualityFactor * feedBrandFactor

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

      // Save calculation to history
      const calculationData = {
        user_id: user.id,
        avg_water_temp: avgPondTemp,
        avg_air_temp: avgAmbientTemp,
        feed_advice_g: totalFeed,
        source: 'auto',
        calculation_details: {
          totalBiomass,
          tempScale,
          filterFactor,
          waterQualityFactor,
          feedBrandFactor,
          feedBrand: selectedFeedBrand,
          season,
          filterStatus,
          ammoniak,
          nitriet,
          feedingFreq,
          feedingTimes,
          warnings,
          cohortBands,
          daysUsed: pondTemp.daysUsed,
          hasEnoughData: pondTemp.hasEnoughData,
          insufficientData,
          fallbackUsed: insufficientData
        }
      }
      
      // Check if Supabase has a session (reuse variable name from earlier in function)
      const { data: { session: currentSessionForSave } } = await supabase.auth.getSession()
      
      let calculation: any = null
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSessionForSave && session?.access_token) {
        try {
          console.log('Saving calculation using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/feed_advice_history`,
            {
              method: 'POST',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(calculationData)
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            calculation = Array.isArray(data) ? data[0] : data
            setLastAutoCalculation(calculation)
            console.log('Calculation saved successfully:', calculation)
            return
          } else {
            const errorData = await response.json()
            if (response.status === 404 || response.status === 406) {
              throw new Error('Database tabel feed_advice_history niet gevonden. Voer eerst het SQL script uit in Supabase.')
            }
            throw new Error(`Fout bij opslaan berekening: ${errorData.message || response.statusText}`)
          }
        } catch (error: any) {
          console.error('Error saving calculation with direct fetch:', error)
          throw error
        }
      } else {
        // Normal Supabase query
        const { data: calculationResult, error: saveError } = await supabase
          .from('feed_advice_history')
          .insert(calculationData)
          .select()
          .single()

        if (saveError) {
          if (saveError.code === 'PGRST205') {
            throw new Error('Database tabel feed_advice_history niet gevonden. Voer eerst het SQL script uit in Supabase.')
          }
          throw new Error(`Fout bij opslaan berekening: ${saveError.message}`)
        }

        calculation = calculationResult
        setLastAutoCalculation(calculation)
        console.log('Calculation saved successfully:', calculation)
      }
      
    } catch (err) {
      console.error('Error in performAutomaticCalculation:', err)
      setError(err instanceof Error ? err.message : 'Onbekende fout bij berekening')
    } finally {
      setIsCalculating(false)
    }
  }, [user, session, pondTemp, ambientTemp, refreshAverages])

  // Manual calculation trigger
  const triggerManualCalculation = useCallback(async () => {
    await performAutomaticCalculation()
  }, [performAutomaticCalculation])

  // Check if automatic calculation is due (every day at 00:01)
  const checkAutomaticCalculation = useCallback(() => {
    const now = new Date()
    const lastCalculation = lastAutoCalculation ? new Date(lastAutoCalculation.calculation_date) : null
    
    // If no calculation today and it's past 00:01
    if (!lastCalculation || lastCalculation.toDateString() !== now.toDateString()) {
      if (now.getHours() >= 0 && now.getMinutes() >= 1) {
        performAutomaticCalculation()
      }
    }
  }, [lastAutoCalculation, performAutomaticCalculation])

  // Load last calculation on mount
  useEffect(() => {
    loadLastCalculation()
  }, [loadLastCalculation])

  // Check for automatic calculation every minute
  useEffect(() => {
    const interval = setInterval(checkAutomaticCalculation, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [checkAutomaticCalculation])

  return {
    lastAutoCalculation,
    loading,
    error,
    triggerManualCalculation,
    isCalculating
  }
}
