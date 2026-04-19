import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export interface KoiFish {
  id: string
  name: string
  length: number
  age: number
  variety?: string
}

export interface FeedCalculation {
  koi: KoiFish
  weight: number
  bodyWeightPercentage: number
  ageFactor: number
  temperatureFactor: number
  seasonFactor: number
  filterReadiness: number
  dailyFeed: number
}

export interface SeasonInfo {
  season: 'winter' | 'spring' | 'summer' | 'autumn'
  label: string
  emoji: string
  baseFactor: number
}

export interface FeedSchedule {
  time: string
  amount: number
  label: string
}

export function useFeedLogic() {
  const { user } = useAuth()
  const [koiList, setKoiList] = useState<KoiFish[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load koi data from database
  const loadKoiData = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('koi')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading koi data:', error)
        setError('Kon koi gegevens niet laden')
        return
      }

      // Transform data to our interface
      const transformedData: KoiFish[] = data.map((koi: any) => ({
        id: koi.id,
        name: koi.name || koi.species || 'Onbekend',
        length: koi.size_cm || 0,
        age: koi.age_years || 0,
        variety: koi.species || 'Onbekend'
      }))

      setKoiList(transformedData)
    } catch (error) {
      console.error('Error in loadKoiData:', error)
      setError('Fout bij laden van koi gegevens')
    } finally {
      setLoading(false)
    }
  }

  // Calculate fish weight based on length (L³ formula)
  const calculateWeight = (length: number): number => {
    return 0.014 * Math.pow(length, 3)
  }

  // Get body weight percentage based on length
  const getBodyWeightPercentage = (length: number): number => {
    if (length <= 30) return 0.035 // Tosai average
    if (length <= 55) return 0.015 // Nisai
    if (length <= 70) return 0.01  // Sansai
    return 0.003 // Ouder
  }

  // Get age factor
  const getAgeFactor = (age: number): number => {
    return age >= 7 ? 0.4 : 1.0
  }

  // Get temperature factor
  const getTemperatureFactor = (temperature: number): number => {
    if (temperature < 6) return 0.0
    if (temperature < 8) return 0.20
    if (temperature < 10) return 0.35
    if (temperature < 12) return 0.50
    if (temperature < 15) return 0.65
    if (temperature < 18) return 0.80
    if (temperature < 22) return 0.95
    if (temperature < 26) return 1.00
    if (temperature < 28) return 0.90
    return 0.75
  }

  // Determine season based on date and temperature trend
  const getSeasonInfo = (date: Date, pondTemp: number, ambientTemp: number): SeasonInfo => {
    const month = date.getMonth() + 1
    const tempDifference = pondTemp - ambientTemp

    // Adjust season based on temperature trend
    let season: 'winter' | 'spring' | 'summer' | 'autumn'
    
    // Corrected season logic
    if (month >= 12 || month <= 2) {
      season = 'winter'
    } else if (month >= 3 && month <= 5) {
      season = 'spring'
    } else if (month >= 6 && month <= 8) {
      season = 'summer'
    } else if (month >= 9 && month <= 11) {
      season = 'autumn'
    } else {
      season = 'autumn' // Default fallback
    }

    // Adjust for temperature trend (more conservative)
    if (tempDifference > 3 && season === 'spring' && pondTemp > 15) {
      season = 'summer' // Early spring with warm water
    } else if (tempDifference < -3 && season === 'autumn' && pondTemp < 10) {
      season = 'winter' // Early autumn with cool water
    }

    const seasonData = {
      winter: { label: 'Winter', emoji: '❄️', baseFactor: 0.3 },
      spring: { label: 'Voorjaar', emoji: '🌱', baseFactor: 0.5 },
      summer: { label: 'Zomer', emoji: '☀️', baseFactor: 1.0 },
      autumn: { label: 'Najaar', emoji: '🍂', baseFactor: 0.8 }
    }

    return {
      season,
      ...seasonData[season]
    }
  }

  // Get filter readiness factor
  const getFilterReadiness = (filterStatus: string, season: string): number => {
    const baseFactors = {
      'winter': 0.3,
      'spring': 0.5,
      'summer': 1.0,
      'autumn': 0.8
    }

    const filterAdjustments = {
      'Auto': 0,
      'Voorjaar (opstartend)': -0.2,
      'Actief': 0.1,
      'Rust': -0.3
    }

    const baseFactor = baseFactors[season as keyof typeof baseFactors] || 0.5
    const adjustment = filterAdjustments[filterStatus as keyof typeof filterAdjustments] || 0

    return Math.max(0.1, Math.min(1.0, baseFactor + adjustment))
  }

  // Suggest feeding times based on temperature and season
  const suggestTimes = (numFeeds: number, pondTemp: number, season: string): Date[] => {
    const now = new Date()
    const start = new Date(now)
    const end = new Date(now)

    // No feeding below 8°C
    if (pondTemp < 8) return []

    // Determine time window based on temperature and season
    if (pondTemp < 15 && (season === 'spring' || season === 'autumn')) {
      // Cold spring/autumn: 11:00 - 17:00
      start.setHours(11, 0, 0, 0)
      end.setHours(17, 0, 0, 0)
    } else if (pondTemp < 20) {
      // Moderate temperature: 10:00 - 18:00
      start.setHours(10, 0, 0, 0)
      end.setHours(18, 0, 0, 0)
    } else {
      // Summer conditions: 08:00 - 20:00
      start.setHours(8, 0, 0, 0)
      end.setHours(20, 0, 0, 0)
    }

    // Distribute feeds evenly across the time window
    const span = end.getTime() - start.getTime()
    const step = span / (numFeeds - 1)
    
    return Array.from({ length: numFeeds }, (_, i) => 
      new Date(start.getTime() + i * step)
    )
  }

  // Calculate feed for a single koi
  const calculateKoiFeed = (
    koi: KoiFish,
    pondTemp: number,
    ambientTemp: number,
    filterStatus: string,
    date: Date = new Date()
  ): FeedCalculation => {
    const weight = calculateWeight(koi.length)
    const bodyWeightPercentage = getBodyWeightPercentage(koi.length)
    const ageFactor = getAgeFactor(koi.age)
    const temperatureFactor = getTemperatureFactor(pondTemp)
    
    const seasonInfo = getSeasonInfo(date, pondTemp, ambientTemp)
    const filterReadiness = getFilterReadiness(filterStatus, seasonInfo.season)

    const dailyFeed = weight * bodyWeightPercentage * ageFactor * temperatureFactor * filterReadiness

    return {
      koi,
      weight,
      bodyWeightPercentage,
      ageFactor,
      temperatureFactor,
      seasonFactor: seasonInfo.baseFactor,
      filterReadiness,
      dailyFeed: Math.round(dailyFeed * 100) / 100 // Round to 2 decimals
    }
  }

  // Calculate total feed for all koi
  const calculateTotalFeed = (
    koiList: KoiFish[],
    pondTemp: number,
    ambientTemp: number,
    filterStatus: string,
    date: Date = new Date()
  ): {
    calculations: FeedCalculation[]
    totalFeed: number
    seasonInfo: SeasonInfo
    feedSchedule: FeedSchedule[]
    noFeeding: boolean
    noFeedingMessage: string
  } => {
    // Check for no feeding condition (temperature < 6°C)
    if (pondTemp < 6) {
      return {
        calculations: [],
        totalFeed: 0,
        seasonInfo: getSeasonInfo(date, pondTemp, ambientTemp),
        feedSchedule: [],
        noFeeding: true,
        noFeedingMessage: "De watertemperatuur is lager dan 6 °C. De koi zijn in rust en hoeven niet gevoerd te worden."
      }
    }

    const calculations = koiList.map(koi => 
      calculateKoiFeed(koi, pondTemp, ambientTemp, filterStatus, date)
    )

    const totalFeed = calculations.reduce((sum, calc) => sum + calc.dailyFeed, 0)
    const seasonInfo = getSeasonInfo(date, pondTemp, ambientTemp)
    
    // Generate feeding schedule
    const feedSchedule = generateFeedSchedule(totalFeed, pondTemp, seasonInfo.season)

    return {
      calculations,
      totalFeed: Math.round(totalFeed * 100) / 100,
      seasonInfo,
      feedSchedule,
      noFeeding: false,
      noFeedingMessage: ""
    }
  }

  // Generate feeding schedule based on temperature and season
  const generateFeedSchedule = (totalFeed: number, temperature: number, season: string): FeedSchedule[] => {
    let numFeeds: number

    if (temperature < 15) {
      numFeeds = 2
    } else if (temperature < 20) {
      numFeeds = 3
    } else {
      numFeeds = 4
    }

    // Use the new suggestTimes function
    const suggestedTimes = suggestTimes(numFeeds, temperature, season)
    
    if (suggestedTimes.length === 0) {
      return [] // No feeding below 8°C
    }

    const feedAmount = totalFeed / numFeeds
    const schedule: FeedSchedule[] = []

    suggestedTimes.forEach((time, index) => {
      const timeString = time.toLocaleTimeString('nl-NL', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      
      schedule.push({
        time: timeString,
        amount: Math.round(feedAmount * 100) / 100,
        label: `${timeString} - ${Math.round(feedAmount * 100) / 100}g`
      })
    })

    return schedule
  }

  // Get number of feeds based on temperature
  const getNumberOfFeeds = (temperature: number): number => {
    if (temperature < 15) return 2
    if (temperature < 20) return 3
    return 4
  }

  useEffect(() => {
    if (user) {
      loadKoiData()
    }
  }, [user])

  return {
    koiList,
    loading,
    error,
    loadKoiData,
    calculateKoiFeed,
    calculateTotalFeed,
    generateFeedSchedule,
    getNumberOfFeeds,
    getSeasonInfo,
    getTemperatureFactor,
    getFilterReadiness
  }
}
