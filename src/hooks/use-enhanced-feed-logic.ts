import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getFeedBrandRendement } from '@/lib/feed-brand-database'

export interface KoiFish {
  id: string
  name: string
  length: number
  age: number
  variety: string
}

export interface PondProfile {
  voerMerk: string
  voerRendement: number
  ammoniak: number
  nitriet: number
  filterStatus: string
  lastWaterTestDate: string | null
  vijverInhoud: number
}

export interface FeedCalculation {
  totalFeed: number
  feedPerMeal: number
  numMeals: number
  feedSchedule: Array<{
    time: string
    amount: number
    label: string
  }>
  warnings: string[]
  status: 'good' | 'warning' | 'critical'
  statusMessage: string
  temperatureFactor: number
  filterFactor: number
  waterQualityFactor: number
  feedBrandFactor: number
  baseBiomass: number
}

export function useEnhancedFeedLogic() {
  const { user, session } = useAuth()
  const [koiList, setKoiList] = useState<KoiFish[]>([])
  const [pondProfile, setPondProfile] = useState<PondProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load koi data
  const loadKoiData = async () => {
    if (!user || !user.id) {
      setError('Gebruiker niet ingelogd')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading koi data for feed advisor using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi?user_id=eq.${user.id}&select=*&order=created_at.desc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          const data = await response.json()
          const transformedData: KoiFish[] = data.map((koi: any) => ({
            id: koi.id,
            name: koi.name || koi.species || 'Onbekend',
            length: koi.size_cm || 0,
            age: koi.age_years || 0,
            variety: koi.species || 'Onbekend'
          }))

          console.log('Loaded koi data (direct fetch):', transformedData.length, 'fish')
          setKoiList(transformedData)
          return
        } catch (error: any) {
          console.error('Error loading koi data with direct fetch:', error)
          // Fall through to try normal Supabase query
        }
      }

      // Normal Supabase query
      const { data, error: koiError } = await supabase
        .from('koi')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (koiError) {
        console.error('Error loading koi data:', koiError)
        setError('Fout bij laden van koi data')
        return
      }

      const transformedData: KoiFish[] = data.map((koi: any) => ({
        id: koi.id,
        name: koi.name || koi.species || 'Onbekend',
        length: koi.size_cm || 0,
        age: koi.age_years || 0,
        variety: koi.species || 'Onbekend'
      }))

      console.log('Loaded koi data (normal query):', transformedData.length, 'fish')
      setKoiList(transformedData)
    } catch (error) {
      console.error('Error in loadKoiData:', error)
      setError('Fout bij laden van koi data')
    } finally {
      setLoading(false)
    }
  }

  // Load pond profile
  const loadPondProfile = async () => {
    if (!user || !user.id) {
      return
    }

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let pondData: any = null
      let waterData: any[] = []
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading pond profile using direct fetch with access token...')
          
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
          
          // Load latest water parameters
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
          console.error('Error loading pond profile with direct fetch:', error)
          // Fall through to try normal Supabase query
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
          return
        }
        
        pondData = pondDataResult
      }

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

      // Parse water parameters from the parameter_type/value structure
      let ammoniak = 0
      let nitriet = 0
      let lastWaterTest = null
      
      if (waterData && Array.isArray(waterData)) {
        const ammoniaRecord = waterData.find(record => record.parameter_type === 'ammonia')
        const nitriteRecord = waterData.find(record => record.parameter_type === 'nitrite')
        
        ammoniak = ammoniaRecord?.value || 0
        nitriet = nitriteRecord?.value || 0
        lastWaterTest = waterData[0]?.created_at || null
      }

      const profile: PondProfile = {
        voerMerk: pondData.voer_merk || 'Generiek Voer',
        voerRendement: getFeedBrandRendement(pondData.voer_merk || 'Generiek Voer'),
        ammoniak: ammoniak,
        nitriet: nitriet,
        filterStatus: pondData.filter_status || 'Auto',
        lastWaterTestDate: lastWaterTest,
        vijverInhoud: pondData.vijver_inhoud || 1000
      }

      setPondProfile(profile)
    } catch (error) {
      console.error('Error loading pond profile:', error)
    }
  }

  // Cohort-based calculation with length bands
  interface CohortBand {
    range: string
    bwRef: number // Warm-water BW% reference
    weight: number // Total weight in this band
    label: string
  }

  const getCohortBands = (): Record<string, CohortBand> => ({
    A: { range: "≤30", bwRef: 0.035, weight: 0, label: "tosai" },
    B: { range: "31-55", bwRef: 0.015, weight: 0, label: "nisai" },
    C: { range: "56-70", bwRef: 0.010, weight: 0, label: "sansai" },
    D: { range: "≥71", bwRef: 0.003, weight: 0, label: "ouder/groot" }
  })

  const assignKoiToBand = (length: number): string => {
    if (length <= 30) return 'A'
    if (length <= 55) return 'B'
    if (length <= 70) return 'C'
    return 'D'
  }

  const calculateCohortWeights = (koiList: KoiFish[]): Record<string, CohortBand> => {
    const bands = getCohortBands()
    
    koiList.forEach(koi => {
      const weight = 0.014 * Math.pow(koi.length, 3) // Weight in grams
      const band = assignKoiToBand(koi.length)
      bands[band].weight += weight
    })
    
    return bands
  }

  // Get season based on fixed dates (not temperature)
  const getSeason = (): { season: string, emoji: string, label: string } => {
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    
    // Directe maand mapping voor duidelijkheid
    if (month === 10 || month === 11) {
      return { season: 'autumn', emoji: '🍂', label: 'Najaar' }
    } else if (month === 12 || month === 1 || month === 2) {
      return { season: 'winter', emoji: '❄️', label: 'Winter' }
    } else if (month === 3 || month === 4 || month === 5) {
      return { season: 'spring', emoji: '🌱', label: 'Voorjaar' }
    } else if (month === 6 || month === 7 || month === 8 || month === 9) {
      return { season: 'summer', emoji: '☀️', label: 'Zomer' }
    } else {
      return { season: 'autumn', emoji: '🍂', label: 'Najaar' } // Default fallback
    }
  }

  // Get temperature scale factor (applied to all bands)
  const getTemperatureScale = (temp: number): number => {
    if (temp < 6) return 0.0
    if (temp < 8) return 0.20
    if (temp < 10) return 0.35
    if (temp < 12) return 0.50
    if (temp < 15) return 0.65
    if (temp < 18) return 0.80
    if (temp < 22) return 0.95
    if (temp < 26) return 1.00
    if (temp < 28) return 0.90
    return 0.75
  }

  // Get filter factor based on season and filter status
  const getFilterFactor = (filterStatus: string, season: string): number => {
    // Base factor from filter status
    let baseFactor = 1.0
    switch (filterStatus) {
      case 'opstartend':
      case 'Voorjaar (opstartend)':
        baseFactor = 0.6
        break
      case 'rustend':
      case 'Rust':
        baseFactor = 0.8
        break
      case 'actief':
      case 'Actief':
        baseFactor = 1.0
        break
      default:
        baseFactor = 1.0
    }
    
    // Season-based adjustments
    switch (season) {
      case 'spring':
        return Math.min(baseFactor, 0.6) // Voorjaar: max 0.6
      case 'summer':
        return Math.max(baseFactor, 1.0) // Zomer: min 1.0
      case 'autumn':
        return Math.min(baseFactor, 1.0) // Najaar: max 1.0
      case 'winter':
        return Math.min(baseFactor, 0.8) // Winter: max 0.8
      default:
        return baseFactor
    }
  }

  // Get water quality corrections (as specified in prompt)
  const getWaterQualityCorrections = (ammoniak: number, nitriet: number): { factor: number, warnings: string[] } => {
    const warnings: string[] = []
    let factor = 1.0

    if (ammoniak > 0.10) {
      factor *= 0.75
      warnings.push('⚠️ NH3 > 0.10 mg/L – voer –25%')
    }
    if (nitriet > 0.50) {
      factor *= 0.85
      warnings.push('⚠️ NO2 > 0.50 mg/L – voer –15%')
    }

    return { factor, warnings }
  }


  // Get number of meals based on temperature
  const getNumMeals = (temp: number): number => {
    if (temp < 15) return 2
    if (temp < 20) return 3
    return 4
  }

  // Generate feeding schedule with proper time windows
  const generateFeedSchedule = (totalFeed: number, numMeals: number, temp: number): Array<{time: string, amount: number, label: string}> => {
    if (totalFeed === 0) return []

    const feedPerMeal = totalFeed / numMeals
    const schedule: Array<{time: string, amount: number, label: string}> = []

    // Time windows as specified: <15°C: ≥11:00, ≤17:30; ≥15°C: 08:00-20:00
    let startHour: number, endHour: number
    if (temp < 15) {
      startHour = 11.0  // 11:00
      endHour = 17.5    // 17:30
    } else {
      startHour = 8.0   // 08:00
      endHour = 20.0    // 20:00
    }

    // Distribute meals evenly within the time window
    const timeSpan = endHour - startHour
    const interval = numMeals > 1 ? timeSpan / (numMeals - 1) : 0

    for (let i = 0; i < numMeals; i++) {
      const hour = startHour + (i * interval)
      const timeString = `${Math.floor(hour).toString().padStart(2, '0')}:${Math.floor((hour % 1) * 60).toString().padStart(2, '0')}`
      
      schedule.push({
        time: timeString,
        amount: Math.round(feedPerMeal * 100) / 100,
        label: `${timeString} — ${Math.round(feedPerMeal * 100) / 100}g`
      })
    }

    return schedule
  }

  // Main calculation function - Cohort-weighted approach
  const calculateFeed = async (pondTemp: number, ambientTemp: number): Promise<FeedCalculation> => {
    const warnings: string[] = []
    let status: 'good' | 'warning' | 'critical' = 'good'
    let statusMessage = ''

    // Early exit: too cold
    if (pondTemp < 6) {
      return {
        totalFeed: 0,
        feedPerMeal: 0,
        numMeals: 0,
        feedSchedule: [],
        warnings: ['❄️ Water < 6°C: koi in rust, niet voeren.'],
        status: 'critical',
        statusMessage: 'Geen voeren - temperatuur te laag',
        temperatureFactor: 0,
        filterFactor: 1,
        waterQualityFactor: 1,
        feedBrandFactor: 1,
        baseBiomass: 0
      }
    }

    // 1) Calculate cohort weights and total biomass
    const bands = calculateCohortWeights(koiList)
    const totalBiomass = Object.values(bands).reduce((sum, band) => sum + band.weight, 0)
    
    if (totalBiomass === 0) {
      return {
        totalFeed: 0,
        feedPerMeal: 0,
        numMeals: 0,
        feedSchedule: [],
        warnings: ['Geen koi gevonden in collectie'],
        status: 'warning',
        statusMessage: 'Voeg koi toe aan je collectie',
        temperatureFactor: 0,
        filterFactor: 1,
        waterQualityFactor: 1,
        feedBrandFactor: 1,
        baseBiomass: 0
      }
    }

    // 2) Temperature scale factor (applied to all bands)
    const tempScale = getTemperatureScale(pondTemp)
    console.log(`🌡️ Feed Calculation: ${pondTemp}°C → tempScale: ${tempScale}`)

    // 3) Get current season and filter factor
    const seasonInfo = getSeason()
    const filterScale = pondProfile ? getFilterFactor(pondProfile.filterStatus, seasonInfo.season) : 1.0

    // 4) Calculate base feed via cohorts
    let baseFeedG = 0
    Object.values(bands).forEach(band => {
      if (band.weight > 0) {
        const effectiveBW = band.bwRef * tempScale // Effective BW% for this temp
        baseFeedG += band.weight * effectiveBW
      }
    })

    // 5) Apply corrections
    let correctionFactor = 1.0
    
    // Water quality corrections
    if (pondProfile) {
      const waterQuality = getWaterQualityCorrections(pondProfile.ammoniak, pondProfile.nitriet)
      correctionFactor *= waterQuality.factor
      warnings.push(...waterQuality.warnings)
    }

    // Feed brand efficiency - use selected feed brand from localStorage
    const selectedFeedBrand = localStorage.getItem('feed-advisor-feed-brand') || (pondProfile?.voerMerk || 'Generiek Voer')
    
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
              feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
            }
          } else {
            feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
          }
        } catch (error) {
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
          feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
        }
      }
    } catch (error) {
      // Fallback to local database
      feedBrandRendement = getFeedBrandRendement(selectedFeedBrand)
    }
    
    // Higher rendement means less feed needed (divide by rendement)
    const feedBrandFactor = 1.0 / feedBrandRendement
    correctionFactor *= feedBrandFactor

    // 6) Final calculation
    const totalFeedG = baseFeedG * filterScale * correctionFactor

    // 7) Check for old water test
    if (pondProfile?.lastWaterTestDate) {
      const daysSinceTest = Math.floor((Date.now() - new Date(pondProfile.lastWaterTestDate).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceTest > 14) {
        warnings.push('Voer je waterwaarden opnieuw in voor een nauwkeurig advies')
        status = 'warning'
      }
    }

    // 8) Generate schedule
    const numMeals = getNumMeals(pondTemp)
    const feedPerMeal = totalFeedG / numMeals
    const feedSchedule = generateFeedSchedule(totalFeedG, numMeals, pondTemp)

    // 9) Determine status
    if (warnings.length > 0 && status !== 'warning') {
      status = 'warning'
    }

    statusMessage = `Aanbevolen: ${Math.round(totalFeedG)}g/dag (cohort-gewogen, ${seasonInfo.label}), verdeeld over ${numMeals} voerbeurten`

    return {
      totalFeed: Math.round(totalFeedG * 100) / 100,
      feedPerMeal: Math.round(feedPerMeal * 100) / 100,
      numMeals,
      feedSchedule,
      warnings,
      status,
      statusMessage,
      temperatureFactor: tempScale,
      filterFactor: filterScale,
      waterQualityFactor: correctionFactor,
      feedBrandFactor,
      baseBiomass: Math.round(totalBiomass * 100) / 100
    }
  }

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadKoiData()
      loadPondProfile()
    }
  }, [user])

  return {
    koiList,
    pondProfile,
    loading,
    error,
    loadKoiData,
    loadPondProfile,
    calculateFeed
  }
}

