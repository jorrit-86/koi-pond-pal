import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Thermometer, Calendar, Filter, Info, Settings, AlertTriangle, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useEnhancedFeedLogic, FeedCalculation } from '@/hooks/use-enhanced-feed-logic'
import { useAutoFeedCalculation } from '@/hooks/use-auto-feed-calculation'
import { useAutomaticFeedCalculation } from '@/hooks/use-automatic-feed-calculation'
import { use3DayAverage } from '@/hooks/use-3day-average'
import { FeedAdvisorTable } from './feed-advisor-table'
import { FeedPlanner } from './feed-planner'
import { InfoModal } from './info-modal'

interface EnhancedFeedAdvisorProps {
  onNavigate?: (tab: string) => void
}

export function EnhancedFeedAdvisor({ onNavigate }: EnhancedFeedAdvisorProps) {
  const { user, session } = useAuth()
  const { koiList, pondProfile, loading, error, loadKoiData, loadPondProfile, calculateFeed } = useEnhancedFeedLogic()
  const { 
    lastCalculation, 
    schedule, 
    isCalculating, 
    error: autoError, 
    triggerManualCalculation, 
    checkCalculationDue 
  } = useAutoFeedCalculation()
  
  // New 3-day average and automatic calculation hooks
  const { pondTemp: pondTempAvg, ambientTemp: ambientTempAvg, loading: avgLoading, error: avgError, refreshAverages } = use3DayAverage()
  const { 
    lastAutoCalculation, 
    loading: autoCalcLoading, 
    error: autoCalcError, 
    triggerManualCalculation: triggerNewManualCalc, 
    isCalculating: isAutoCalculating 
  } = useAutomaticFeedCalculation()
  
  // Input states
  const [pondTemp, setPondTemp] = useState<number>(20)
  const [ambientTemp, setAmbientTemp] = useState<number>(15)
  
  // Sensor mode states
  const [usePondSensor, setUsePondSensor] = useState<boolean>(false)
  const [useAmbientSensor, setUseAmbientSensor] = useState<boolean>(false)
  
  // Sensor data state
  const [sensorData, setSensorData] = useState({
    pondTemp: null as number | null,
    ambientTemp: null as number | null,
    pondSensorConnected: false,
    ambientSensorConnected: false,
    lastUpdate: null as string | null
  })
  const [sensorLoading, setSensorLoading] = useState(false)
  const [sensorError, setSensorError] = useState<string | null>(null)
  
  // Calculation results
  const [calculation, setCalculation] = useState<FeedCalculation | null>(null)
  
  // Feed choice state
  const [selectedFeedBrand, setSelectedFeedBrand] = useState<string>('Generiek Voer')
  const [selectedFeedRendement, setSelectedFeedRendement] = useState<number>(1.0)
  
  // Countdown timer state
  const [timeToNextCalculation, setTimeToNextCalculation] = useState<string>('')
  
  // Calculation preference state
  const [calculationPreference, setCalculationPreference] = useState<'stable' | 'current'>('stable')

  // Generate feed schedule helper function
  const generateFeedScheduleFromTotal = (totalFeed: number, temp: number): Array<{time: string, amount: number, label: string}> => {
    if (totalFeed === 0) return []

    // Get number of meals based on temperature
    const getNumMeals = (temp: number): number => {
      if (temp < 15) return 2
      if (temp < 20) return 3
      return 4
    }

    const numMeals = getNumMeals(temp)
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

    // Calculate rounded amounts ensuring they sum to totalFeed
    const roundedAmounts: number[] = []
    let roundedSum = 0
    
    // Round each meal amount
    for (let i = 0; i < numMeals; i++) {
      const rounded = Math.round(feedPerMeal * 100) / 100
      roundedAmounts.push(rounded)
      roundedSum += rounded
    }
    
    // Adjust for rounding errors to ensure exact match with totalFeed
    const difference = totalFeed - roundedSum
    if (Math.abs(difference) > 0.001) {
      // Distribute the difference across meals (add to first meal(s) if positive, subtract if negative)
      const adjustmentPerMeal = difference / numMeals
      for (let i = 0; i < numMeals; i++) {
        roundedAmounts[i] = Math.round((roundedAmounts[i] + adjustmentPerMeal) * 100) / 100
      }
      
      // Final check: ensure sum is exactly totalFeed
      const finalSum = roundedAmounts.reduce((sum, amount) => sum + amount, 0)
      const finalDifference = totalFeed - finalSum
      if (Math.abs(finalDifference) > 0.001 && numMeals > 0) {
        // Add remaining difference to the last meal
        roundedAmounts[numMeals - 1] = Math.round((roundedAmounts[numMeals - 1] + finalDifference) * 100) / 100
      }
    }

    for (let i = 0; i < numMeals; i++) {
      const hour = startHour + (i * interval)
      const timeString = `${Math.floor(hour).toString().padStart(2, '0')}:${Math.floor((hour % 1) * 60).toString().padStart(2, '0')}`
      
      schedule.push({
        time: timeString,
        amount: roundedAmounts[i],
        label: `${timeString} — ${roundedAmounts[i].toFixed(1)}g`
      })
    }

    return schedule
  }

  // Get the preferred calculation data
  const getPreferredCalculation = () => {
    if (calculationPreference === 'stable' && lastAutoCalculation) {
      // Use stable calculation (3-day average)
      const totalFeed = lastAutoCalculation.feed_advice_g || 0
      const temp = lastAutoCalculation.avg_water_temp || pondTemp
      const feedSchedule = generateFeedScheduleFromTotal(totalFeed, temp)
      
      return {
        totalFeed,
        feedSchedule,
        temperature: temp,
        seasonInfo: lastAutoCalculation.calculation_details?.season || 'unknown'
      }
    } else {
      // Use current calculation (realtime)
      const totalFeed = calculation?.totalFeed || 0
      const temp = pondTemp
      // Regenerate schedule to ensure it matches the totalFeed
      const feedSchedule = generateFeedScheduleFromTotal(totalFeed, temp)
      
      return {
        totalFeed,
        feedSchedule,
        temperature: temp,
        seasonInfo: (() => {
          const now = new Date()
          const month = now.getMonth() + 1
          
          if (month === 10 || month === 11) {
            return { season: 'autumn', emoji: '🍂', label: 'Najaar' }
          } else if (month === 12 || month === 1 || month === 2) {
            return { season: 'winter', emoji: '❄️', label: 'Winter' }
          } else if (month === 3 || month === 4 || month === 5) {
            return { season: 'spring', emoji: '🌱', label: 'Voorjaar' }
          } else {
            return { season: 'summer', emoji: '☀️', label: 'Zomer' }
          }
        })()
      }
    }
  }

  // Calculate time until next automatic calculation (00:01 AM)
  const calculateTimeToNextCalculation = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 1, 0, 0) // 00:01 AM tomorrow
    
    const timeDiff = tomorrow.getTime() - now.getTime()
    
    if (timeDiff <= 0) {
      // If it's past 00:01 today, calculate for tomorrow
      const nextDay = new Date(now)
      nextDay.setDate(nextDay.getDate() + 1)
      nextDay.setHours(0, 1, 0, 0)
      const nextDayDiff = nextDay.getTime() - now.getTime()
      
      const hours = Math.floor(nextDayDiff / (1000 * 60 * 60))
      const minutes = Math.floor((nextDayDiff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((nextDayDiff % (1000 * 60)) / 1000)
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60))
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Load sensor data
  const loadSensorData = async () => {
    try {
      setSensorLoading(true)
      setSensorError(null)

      const { supabase } = await import('@/lib/supabase')
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let tempData: any[] = []
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token && user?.id) {
        try {
          console.log('Loading sensor data using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/sensor_data?user_id=eq.${user.id}&sensor_type=eq.temperatuurmeter&select=sensor_id,temperature,measurement_time,sensor_name,sensor_type&order=measurement_time.desc&limit=20`,
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
            tempData = Array.isArray(data) ? data : [data]
            console.log('Loaded sensor data (direct fetch):', tempData.length, 'records')
          }
        } catch (error: any) {
          console.error('Error loading sensor data with direct fetch:', error)
          // Fall through to try normal Supabase query
        }
      }
      
      // If we don't have data yet, try normal Supabase query
      if (tempData.length === 0) {
        const { data: tempDataResult, error: tempError } = await supabase
          .from('sensor_data')
          .select('sensor_id, temperature, measurement_time, sensor_name, sensor_type')
          .eq('sensor_type', 'temperatuurmeter')
          .order('measurement_time', { ascending: false })
          .limit(20)
        
        if (tempError) {
          console.error('Error loading temperature data:', tempError)
          setSensorError('Kon sensordata niet laden')
          setSensorLoading(false)
          return
        }
        
        tempData = tempDataResult || []
      }

      if (!tempData || tempData.length === 0) {
        setSensorError('Geen temperatuurdata gevonden')
        return
      }

      // Group sensors by sensor_id
      const sensorMap = new Map()
      tempData.forEach(sensor => {
        if (!sensorMap.has(sensor.sensor_id) || 
            new Date(sensor.measurement_time) > new Date(sensorMap.get(sensor.sensor_id).measurement_time)) {
          sensorMap.set(sensor.sensor_id, sensor)
        }
      })
      const uniqueSensors = Array.from(sensorMap.values())

      // Load saved sensor preferences
      const savedPondSensor = localStorage.getItem('feed-advisor-pond-sensor')
      const savedAmbientSensor = localStorage.getItem('feed-advisor-ambient-sensor')

      // Find sensors - ALWAYS use sensor -01 for pond and -02 for ambient
      let pondSensor = null
      let ambientSensor = null
      let pondTemp = null
      let ambientTemp = null
      let pondSensorConnected = false
      let ambientSensorConnected = false
      let lastUpdate = null

      // PRIORITY 1: Always look for sensor ending in -01 for pond (vijverwatertemperatuur)
      if (savedPondSensor) {
        pondSensor = uniqueSensors.find(s => s.sensor_id === savedPondSensor)
        // Verify it's actually a pond sensor (ends with -01)
        if (pondSensor && !pondSensor.sensor_id.endsWith('-01')) {
          console.warn('Saved pond sensor is not sensor -01, using sensor -01 instead')
          pondSensor = null
        }
      }
      
      // If no saved preference or saved sensor is not -01, ALWAYS use sensor -01
      if (!pondSensor) {
        pondSensor = uniqueSensors.find(s => s.sensor_id.endsWith('-01'))
        if (pondSensor) {
          console.log('Using sensor -01 for vijverwatertemperatuur:', pondSensor.sensor_id)
        }
      }

      // PRIORITY 1: Always look for sensor ending in -02 for ambient (buitentemperatuur)
      if (savedAmbientSensor) {
        ambientSensor = uniqueSensors.find(s => s.sensor_id === savedAmbientSensor)
        // Verify it's actually an ambient sensor (ends with -02)
        if (ambientSensor && !ambientSensor.sensor_id.endsWith('-02')) {
          console.warn('Saved ambient sensor is not sensor -02, using sensor -02 instead')
          ambientSensor = null
        }
      }
      
      // If no saved preference or saved sensor is not -02, ALWAYS use sensor -02
      if (!ambientSensor) {
        ambientSensor = uniqueSensors.find(s => s.sensor_id.endsWith('-02'))
        if (ambientSensor) {
          console.log('Using sensor -02 for buitentemperatuur:', ambientSensor.sensor_id)
        }
      }

      if (pondSensor) {
        pondTemp = pondSensor.temperature
        pondSensorConnected = true
        lastUpdate = pondSensor.measurement_time
        console.log('Selected pond sensor:', pondSensor.sensor_id, pondSensor.sensor_name, 'temp:', pondTemp)
      }

      if (ambientSensor) {
        ambientTemp = ambientSensor.temperature
        ambientSensorConnected = true
        if (!lastUpdate || new Date(ambientSensor.measurement_time) > new Date(lastUpdate)) {
          lastUpdate = ambientSensor.measurement_time
        }
        console.log('Selected ambient sensor:', ambientSensor.sensor_id, ambientSensor.sensor_name, 'temp:', ambientTemp)
      }

      setSensorData({
        pondTemp,
        ambientTemp,
        pondSensorConnected,
        ambientSensorConnected,
        lastUpdate
      })

    } catch (error) {
      console.error('Error in loadSensorData:', error)
      setSensorError('Fout bij laden van sensordata')
    } finally {
      setSensorLoading(false)
    }
  }

  // Load sensor data on mount
  useEffect(() => {
    loadSensorData()
  }, [])

  // Load selected feed brand and calculation preference from localStorage
  useEffect(() => {
    const savedFeedBrand = localStorage.getItem('feed-advisor-feed-brand')
    const savedCalculationPreference = localStorage.getItem('feed-advisor-calculation-preference')
    
    if (savedFeedBrand) {
      setSelectedFeedBrand(savedFeedBrand)
    }
    if (savedCalculationPreference) {
      setCalculationPreference(savedCalculationPreference as 'stable' | 'current')
    }
    
    // Listen for changes in localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feed-advisor-feed-brand' && e.newValue) {
        setSelectedFeedBrand(e.newValue)
      }
      if (e.key === 'feed-advisor-calculation-preference' && e.newValue) {
        setCalculationPreference(e.newValue as 'stable' | 'current')
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Also check localStorage on focus (when returning from settings)
  useEffect(() => {
    const handleFocus = () => {
      const savedFeedBrand = localStorage.getItem('feed-advisor-feed-brand')
      if (savedFeedBrand && savedFeedBrand !== selectedFeedBrand) {
        setSelectedFeedBrand(savedFeedBrand)
      }
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedFeedBrand])

  // Update feed rendement when brand changes
  useEffect(() => {
    const updateFeedRendement = async () => {
      console.log('Badge update: Starting for brand:', selectedFeedBrand)
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: feedBrandData, error } = await supabase
          .from('feed_brands')
          .select('rendement')
          .eq('merk', selectedFeedBrand)
          .single()
        
        if (!error && feedBrandData) {
          console.log('Badge update: Supabase data found:', feedBrandData.rendement)
          setSelectedFeedRendement(feedBrandData.rendement)
        } else {
          console.log('Badge update: Supabase error, using fallback')
          // Fallback to local database
          const { getFeedBrandRendement } = await import('@/lib/feed-brand-database')
          const rendement = getFeedBrandRendement(selectedFeedBrand)
          console.log('Badge update: Local fallback:', rendement)
          setSelectedFeedRendement(rendement)
        }
      } catch (error) {
        // Fallback to local database
        const { getFeedBrandRendement } = await import('@/lib/feed-brand-database')
        const rendement = getFeedBrandRendement(selectedFeedBrand)
        setSelectedFeedRendement(rendement)
      }
    }
    updateFeedRendement()
  }, [selectedFeedBrand])

  // Update countdown timer every second
  useEffect(() => {
    const updateTimer = () => {
      setTimeToNextCalculation(calculateTimeToNextCalculation())
    }
    
    // Update immediately
    updateTimer()
    
    // Update every second
    const interval = setInterval(updateTimer, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Update temperatures when sensor data changes
  useEffect(() => {
    if (usePondSensor && sensorData.pondTemp !== null) {
      setPondTemp(sensorData.pondTemp)
    }
    if (useAmbientSensor && sensorData.ambientTemp !== null) {
      setAmbientTemp(sensorData.ambientTemp)
    }
  }, [sensorData, usePondSensor, useAmbientSensor])

  // Auto-enable sensor mode if sensors are connected
  useEffect(() => {
    if (sensorData.pondSensorConnected) {
      setUsePondSensor(true)
    }
    if (sensorData.ambientSensorConnected) {
      setUseAmbientSensor(true)
    }
  }, [sensorData.pondSensorConnected, sensorData.ambientSensorConnected])

  // Recalculate when inputs change
  useEffect(() => {
    if (koiList.length > 0) {
      const runCalculation = async () => {
        const result = await calculateFeed(pondTemp, ambientTemp)
        setCalculation(result)
      }
      runCalculation()
    }
  }, [koiList, pondTemp, ambientTemp, pondProfile, selectedFeedBrand])

  const getTemperatureStatus = (temp: number) => {
    if (temp < 6) return { status: 'critical', label: 'Geen voeren', color: 'text-red-600' }
    if (temp < 8) return { status: 'warning', label: 'Beperkt voeren', color: 'text-orange-600' }
    if (temp < 15) return { status: 'warning', label: 'Koud', color: 'text-blue-600' }
    if (temp < 20) return { status: 'good', label: 'Matig', color: 'text-green-600' }
    if (temp <= 28) return { status: 'excellent', label: 'Ideaal', color: 'text-green-600' }
    return { status: 'warning', label: 'Te warm', color: 'text-orange-600' }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />
    }
  }

  const getWaterQualityStatus = () => {
    if (!pondProfile) return { status: 'unknown', message: 'Geen vijverprofiel', color: 'text-gray-500' }
    
    const daysSinceTest = pondProfile.lastWaterTestDate 
      ? Math.floor((Date.now() - new Date(pondProfile.lastWaterTestDate).getTime()) / (1000 * 60 * 60 * 24))
      : null

    if (daysSinceTest === null) return { status: 'unknown', message: 'Geen watertest', color: 'text-gray-500' }
    if (daysSinceTest > 14) return { status: 'warning', message: `${daysSinceTest} dagen geleden`, color: 'text-orange-600' }
    if (daysSinceTest > 7) return { status: 'warning', message: `${daysSinceTest} dagen geleden`, color: 'text-yellow-600' }
    return { status: 'good', message: `${daysSinceTest} dagen geleden`, color: 'text-green-600' }
  }

  const pondTempStatus = getTemperatureStatus(pondTemp)
  const ambientTempStatus = getTemperatureStatus(ambientTemp)
  const waterQualityStatus = getWaterQualityStatus()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feed Advisor</h1>
          <p className="text-muted-foreground">
            Bereken het optimale dagvoer voor je koi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate?.('feed-advisor-settings')}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Instellingen
          </Button>
          <InfoModal />
        </div>
      </div>


      {/* Status Bar - Cohort-weighted info */}
      {pondProfile && (
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 text-sm">
              <div className="flex flex-col items-center text-center">
                <span className="text-muted-foreground text-xs mb-1">📅 Datum</span>
                <span className="font-medium text-sm">
                  {new Date().toLocaleDateString('nl-NL', { 
                    day: 'numeric', 
                    month: 'short' 
                  })}
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="text-muted-foreground text-xs mb-1">Temperatuur</span>
                <span className="font-medium">{pondTemp.toFixed(1)}°C</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="text-muted-foreground text-xs mb-1">Seizoen</span>
                <span className="font-medium text-sm">
                  {(() => {
                    const now = new Date()
                    const month = now.getMonth() + 1
                    
                    if (month === 10 || month === 11) {
                      return '🍂 Najaar'
                    } else if (month === 12 || month === 1 || month === 2) {
                      return '❄️ Winter'
                    } else if (month === 3 || month === 4 || month === 5) {
                      return '🌱 Voorjaar'
                    } else if (month === 6 || month === 7 || month === 8 || month === 9) {
                      return '☀️ Zomer'
                    } else {
                      return '🍂 Najaar'
                    }
                  })()}
                </span>
                <span className="text-xs text-muted-foreground">({pondProfile.filterStatus})</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="text-muted-foreground text-xs mb-1">💧 Waterkwaliteit</span>
                <span className={`font-medium text-sm ${waterQualityStatus.color}`}>
                  {waterQualityStatus.message}
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="text-muted-foreground text-xs mb-1">🥣 Voermerk</span>
                <div className="flex flex-col items-center gap-1">
                  <span className="font-medium text-sm">{selectedFeedBrand}</span>
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    {selectedFeedRendement.toFixed(2)}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="text-muted-foreground text-xs mb-1">📊 Berekening</span>
                <span className="font-medium text-sm">
                  {calculationPreference === 'stable' ? '🕒 Stabiel' : '⚡ Actueel'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input Section - Only show for current preference */}
      {calculationPreference === 'current' && (
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Omgevingsfactoren
          </CardTitle>
          <CardDescription>
            Voer de huidige omstandigheden in voor een nauwkeurig advies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pond Temperature */}
            <div className="space-y-2">
              <Label htmlFor="pond-temp" className="flex items-center gap-2">
                Vijvertemperatuur
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsePondSensor(!usePondSensor)}
                  className="h-6 px-2 text-xs"
                >
                  {sensorData.pondSensorConnected && usePondSensor ? '🟢 Sensor' : '⚪ Handmatig'}
                </Button>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pond-temp"
                  type="number"
                  value={pondTemp}
                  onChange={(e) => setPondTemp(parseFloat(e.target.value) || 0)}
                  className="flex-1"
                  min="0"
                  max="40"
                  step="0.1"
                  disabled={usePondSensor && sensorData.pondSensorConnected}
                  placeholder={usePondSensor && sensorData.pondSensorConnected ? "Van sensor" : "Handmatig invoeren"}
                />
                <span className="text-sm text-muted-foreground">°C</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${pondTempStatus.color}`}>
                  {pondTempStatus.label}
                </span>
                {usePondSensor && sensorData.pondSensorConnected && (
                  <span className="text-xs text-muted-foreground">
                    Van sensor
                  </span>
                )}
              </div>
            </div>

            {/* Ambient Temperature */}
            <div className="space-y-2">
              <Label htmlFor="ambient-temp" className="flex items-center gap-2">
                Buitentemperatuur
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseAmbientSensor(!useAmbientSensor)}
                  className="h-6 px-2 text-xs"
                >
                  {sensorData.ambientSensorConnected && useAmbientSensor ? '🟢 Sensor' : '⚪ Handmatig'}
                </Button>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ambient-temp"
                  type="number"
                  value={ambientTemp}
                  onChange={(e) => setAmbientTemp(parseFloat(e.target.value) || 0)}
                  className="flex-1"
                  min="-10"
                  max="40"
                  step="0.1"
                  disabled={useAmbientSensor && sensorData.ambientSensorConnected}
                  placeholder={useAmbientSensor && sensorData.ambientSensorConnected ? "Van sensor" : "Handmatig invoeren"}
                />
                <span className="text-sm text-muted-foreground">°C</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${ambientTempStatus.color}`}>
                  {ambientTempStatus.label}
                </span>
                {useAmbientSensor && sensorData.ambientSensorConnected && (
                  <span className="text-xs text-muted-foreground">
                    Van sensor
                  </span>
                )}
              </div>
            </div>


            {/* Sensor Actions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sensor acties</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSensorData}
                disabled={sensorLoading}
                className="w-full flex items-center gap-2"
              >
                {sensorLoading ? 'Laden...' : 'Ververs sensordata'}
              </Button>
            </div>
          </div>

          {/* Sensor Error */}
          {sensorError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {sensorError}
              </p>
            </div>
          )}
        </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {calculation && (
        <div className="space-y-6">
          {/* Main Result Card */}
          {/* New Dual Display: Current vs 3-Day Advice */}
          <div className="space-y-6">
            {/* 3-Day Stable Advice (Prominent) - Only show if stable preference */}
            {calculationPreference === 'stable' && (
              <Card className="border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Clock className="h-5 w-5" />
                  🕒 Stabiel Dagadvies
                </CardTitle>
                <CardDescription className="text-blue-700 dark:text-blue-300">
                  Berekend op basis van gemiddelde omstandigheden van de laatste 3 dagen
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lastAutoCalculation ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                        {lastAutoCalculation.feed_advice_g?.toFixed(1) || '0.0'}g/dag
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Gemiddelde temperatuur afgelopen 3 dagen: {lastAutoCalculation.avg_water_temp?.toFixed(1) || '0.0'}°C
                      </p>
                      
                      {/* Countdown timer */}
                      <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center justify-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">Volgende automatische berekening over:</span>
                        </div>
                        <div className="text-center mt-2">
                          <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">
                            {timeToNextCalculation}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            (om 00:01 uur)
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                          <div className="font-medium">Seizoen</div>
                          <div className="text-muted-foreground capitalize">
                            {lastAutoCalculation.calculation_details?.season || 'Onbekend'}
                          </div>
                        </div>
                        <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                          <div className="font-medium">Filter Status</div>
                          <div className="text-muted-foreground">
                            {lastAutoCalculation.calculation_details?.filterStatus || 'Onbekend'}
                          </div>
                        </div>
                        <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                          <div className="font-medium">Waterkwaliteit</div>
                          <div className="text-muted-foreground">
                            NH₃: {lastAutoCalculation.calculation_details?.ammoniak?.toFixed(2) || '0.00'} mg/L
                          </div>
                        </div>
                        <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                          <div className="font-medium">Voermerk</div>
                          <div className="text-muted-foreground">
                            {lastAutoCalculation.calculation_details?.feedBrand || selectedFeedBrand}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mt-4">
                        Laatst bijgewerkt: {new Date(lastAutoCalculation.calculation_date).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      
                      {/* Update button */}
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={triggerNewManualCalc}
                          disabled={isAutoCalculating}
                          className="w-full flex items-center gap-2"
                        >
                          <Clock className={`h-4 w-4 ${isAutoCalculating ? 'animate-spin' : ''}`} />
                          {isAutoCalculating ? 'Berekenen...' : 'Update 3-daags advies'}
                        </Button>
                      </div>
                      
                      {/* Fallback warning */}
                      {lastAutoCalculation.calculation_details?.fallbackUsed && (
                        <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-700 dark:text-orange-300">
                          ⚠️ Nog onvoldoende data voor 3 dagen — berekening is gebaseerd op {lastAutoCalculation.calculation_details?.daysUsed || 0} dag(en)
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-muted-foreground mb-2">--</div>
                      <div className="text-sm text-muted-foreground mb-4">Nog geen automatische berekening</div>
                    </div>
                    
                    {/* Show current feed brand selection */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                        <div className="font-medium">Voermerk</div>
                        <div className="text-muted-foreground">
                          {selectedFeedBrand}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                        <div className="font-medium">Rendement</div>
                        <div className="text-muted-foreground">
                          {selectedFeedRendement.toFixed(2)}x
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await triggerNewManualCalc()
                        } catch (error) {
                          console.error('Error triggering calculation:', error)
                        }
                      }}
                      disabled={isAutoCalculating}
                      className="w-full flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isAutoCalculating ? 'animate-spin' : ''}`} />
                      {isAutoCalculating ? 'Berekenen...' : 'Start Automatische Berekening'}
                    </Button>
                    
                    {/* Show error if calculation failed */}
                    {autoCalcError && (
                      <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm text-destructive">{autoCalcError}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              </Card>
            )}

            {/* Current Calculation (Informational) - Only show if current preference */}
            {calculationPreference === 'current' && (
            <Card className={`border-2 ${
              calculation.status === 'good' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' :
              calculation.status === 'warning' ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20' :
              'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
            }`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(calculation.status)}
                  Actuele Behоefte
                </CardTitle>
                <CardDescription>
                  Gebaseerd op huidige temperatuur ({pondTemp}°C) - Dit is een handmatige berekening gebaseerd op de huidige omstandigheden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-2">
                      {calculation.totalFeed}g/dag
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {calculation.statusMessage}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="text-center">
                        <div className="font-medium">Biomassa</div>
                        <div className="text-muted-foreground">{calculation.baseBiomass}g</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">Temp Factor</div>
                        <div className="text-muted-foreground">{calculation.temperatureFactor.toFixed(2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">Filter</div>
                        <div className="text-muted-foreground">×{calculation.filterFactor.toFixed(2)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">Voermerk</div>
                        <div className="text-muted-foreground">×{calculation.feedBrandFactor.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const result = await calculateFeed(pondTemp, ambientTemp)
                      setCalculation(result)
                    }}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Voer nieuwe berekening uit
                  </Button>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Cohort-gewogen:</strong> Berekening per lengte-band met temperatuur en filterstatus.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Warnings */}
          {calculation.warnings.length > 0 && (
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                  <AlertTriangle className="h-5 w-5" />
                  Waarschuwingen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {calculation.warnings.map((warning, index) => (
                    <li key={index} className="text-sm text-orange-600 dark:text-orange-400">
                      {warning}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Feed Schedule */}
          {(() => {
            const preferredCalc = getPreferredCalculation()
            return preferredCalc.feedSchedule.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FeedPlanner
                  feedSchedule={preferredCalc.feedSchedule}
                  totalFeed={preferredCalc.totalFeed}
                  temperature={preferredCalc.temperature}
                  seasonInfo={preferredCalc.seasonInfo}
                  noFeeding={preferredCalc.totalFeed === 0}
                  noFeedingMessage={calculation?.warnings[0] || ''}
                />
                <FeedAdvisorTable
                  koiList={koiList}
                  totalFeed={preferredCalc.totalFeed}
                  noFeeding={preferredCalc.totalFeed === 0}
                  noFeedingMessage={calculation?.warnings[0] || ''}
                  baseBiomass={calculation?.baseBiomass || 0}
                />
              </div>
            )
          })()}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Koi data laden...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <CardContent className="p-6">
            <p className="text-red-600 dark:text-red-400">
              Fout bij laden van koi data: {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* No Koi State */}
      {!loading && !error && koiList.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Er zijn nog geen koi in je collectie. Voeg ze toe via de pagina 'Mijn Koi Collectie' om een voeradvies te ontvangen.
              </p>
              <Button 
                onClick={() => onNavigate?.('koi')}
                variant="outline"
              >
                Naar Koi Collectie
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
