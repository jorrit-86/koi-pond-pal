import { useState, useEffect } from "react"
import { ParameterPageTemplate } from "./parameter-page-template"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface WaterChangePageProps {
  onNavigate: (tab: string) => void
}

export const WaterChangePage = ({ onNavigate }: WaterChangePageProps) => {
  const { user, session } = useAuth()
  const [timeRange, setTimeRange] = useState("7d")
  const [historicData, setHistoricData] = useState<Array<{ date: string; value: number; time: string; timestamp?: string; source?: 'manual' | 'sensor' }>>([])
  const [currentValue, setCurrentValue] = useState<number>(0)
  const [status, setStatus] = useState<"optimal" | "warning" | "critical">("optimal")
  const [loading, setLoading] = useState(true)
  const [hasDataInTimeRange, setHasDataInTimeRange] = useState<boolean>(false)
  const [timeRangeInfo, setTimeRangeInfo] = useState<{ range: string; startDate: string; endDate: string }>({
    range: timeRange,
    startDate: '',
    endDate: ''
  })
  
  const getWaterChangeStatus = (value: number): "optimal" | "warning" | "critical" => {
    // For water changes, we consider frequency rather than value
    // More frequent changes are generally better
    if (value <= 7) return "optimal" // Weekly or more frequent
    if (value <= 14) return "warning" // Bi-weekly
    return "critical" // Less frequent than bi-weekly
  }

  const getDateRange = (timeRange: string) => {
    const now = new Date()
    const startDate = new Date(now)
    
    switch (timeRange) {
      case "1h":
        startDate.setTime(now.getTime() - (1 * 60 * 60 * 1000))
        break
      case "4h":
        startDate.setTime(now.getTime() - (4 * 60 * 60 * 1000))
        break
      case "24h":
        startDate.setTime(now.getTime() - (24 * 60 * 60 * 1000))
        break
      case "7d":
        // 7 days ago - use date calculation for consistency
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0) // Start of day 7 days ago
        startDate.setTime(sevenDaysAgo.getTime())
        break
      case "14d":
        // 14 days ago - use date calculation for consistency
        const fourteenDaysAgo = new Date(now)
        fourteenDaysAgo.setDate(now.getDate() - 14)
        fourteenDaysAgo.setHours(0, 0, 0, 0) // Start of day 14 days ago
        startDate.setTime(fourteenDaysAgo.getTime())
        break
      case "30d":
        // 30 days ago - use date calculation for consistency
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(now.getDate() - 30)
        thirtyDaysAgo.setHours(0, 0, 0, 0) // Start of day 30 days ago
        startDate.setTime(thirtyDaysAgo.getTime())
        break
      case "90d":
        // 90 days ago - use date calculation for consistency
        const ninetyDaysAgo = new Date(now)
        ninetyDaysAgo.setDate(now.getDate() - 90)
        ninetyDaysAgo.setHours(0, 0, 0, 0) // Start of day 90 days ago
        startDate.setTime(ninetyDaysAgo.getTime())
        break
      case "365d":
        // 365 days ago - use date calculation for consistency
        const threeSixtyFiveDaysAgo = new Date(now)
        threeSixtyFiveDaysAgo.setDate(now.getDate() - 365)
        threeSixtyFiveDaysAgo.setHours(0, 0, 0, 0) // Start of day 365 days ago
        startDate.setTime(threeSixtyFiveDaysAgo.getTime())
        break
      default:
        // Default to 7 days ago
        const defaultDaysAgo = new Date(now)
        defaultDaysAgo.setDate(now.getDate() - 7)
        defaultDaysAgo.setHours(0, 0, 0, 0) // Start of day 7 days ago
        startDate.setTime(defaultDaysAgo.getTime())
    }
    
    return startDate.toISOString()
  }

  const loadWaterChangeData = async () => {
    if (!user || !user.id) return

    try {
      setLoading(true)
      
      const now = new Date()
      const startDate = getDateRange(timeRange)
      
      setTimeRangeInfo({
        range: timeRange,
        startDate: startDate,
        endDate: now.toISOString()
      })
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let waterChanges: any[] = []
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading water changes using direct fetch with access token...', { timeRange, startDate })
          const encodedStartDate = encodeURIComponent(startDate)
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_changes?user_id=eq.${user.id}&changed_at=gte.${encodedStartDate}&select=*&order=changed_at.desc`,
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
            waterChanges = Array.isArray(data) ? data : [data]
            console.log('Loaded water changes (direct fetch):', waterChanges.length, 'records')
          } else if (response.status === 406 || response.status === 404) {
            // Table doesn't exist or not accessible - silently ignore
            setHistoricData([])
            setHasDataInTimeRange(false)
            setCurrentValue(0)
            setStatus("critical")
            return
          }
        } catch (error: any) {
          console.error('Error loading water changes with direct fetch:', error)
          // Fall through to try normal Supabase query
        }
      }
      
      // If we don't have data yet, try normal Supabase query
      if (waterChanges.length === 0) {
        const { data, error } = await supabase
          .from('water_changes')
          .select('*')
          .eq('user_id', user.id)
          .gte('changed_at', startDate)
          .order('changed_at', { ascending: false })

        if (error) {
          console.error('Error loading water changes:', error)
          setHistoricData([])
          setHasDataInTimeRange(false)
          setCurrentValue(0)
          setStatus("critical")
          return
        }
        
        waterChanges = data || []
      }

      if (waterChanges && waterChanges.length > 0) {
        // Transform data for chart
        const chartData = waterChanges.map(change => {
          const date = new Date(change.changed_at)
          return {
            date: date.toISOString().split('T')[0],
            value: change.liters_added,
            time: date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
            timestamp: change.changed_at,
            source: 'manual' as const
          }
        })

        // Sort data from old to new for proper chart display
        const sortedChartData = chartData.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime())
        setHistoricData(sortedChartData)
        setHasDataInTimeRange(true)
        
        // Calculate time since last water change
        const lastChange = waterChanges[0]
        const timeDiff = now.getTime() - new Date(lastChange.changed_at).getTime()
        const daysSinceLastChange = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
        const hoursSinceLastChange = Math.floor(timeDiff / (1000 * 60 * 60))
        const minutesSinceLastChange = Math.floor(timeDiff / (1000 * 60))
        
        console.log('Water change calculation:', {
          now: now.toISOString(),
          lastChange: lastChange.changed_at,
          timeDiff: timeDiff,
          daysSinceLastChange: daysSinceLastChange,
          hoursSinceLastChange: hoursSinceLastChange,
          minutesSinceLastChange: minutesSinceLastChange
        })
        
        // Store the raw time difference for proper formatting
        setCurrentValue(timeDiff)
        setStatus(getWaterChangeStatus(daysSinceLastChange))
      } else {
        setHistoricData([])
        setHasDataInTimeRange(false)
        setCurrentValue(0)
        setStatus("critical")
      }
    } catch (error) {
      console.error('Error in loadWaterChangeData:', error)
      setHistoricData([])
      setHasDataInTimeRange(false)
      setCurrentValue(0)
      setStatus("critical")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && user.id) {
      loadWaterChangeData()
    }
  }, [user, session, timeRange])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading water change data...</p>
        </div>
      </div>
    )
  }

  // Format the display value with appropriate unit
  const formatDisplayValue = (timeDiffMs: number) => {
    const days = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor(timeDiffMs / (1000 * 60 * 60))
    const minutes = Math.floor(timeDiffMs / (1000 * 60))
    
    console.log('Format display calculation:', {
      timeDiffMs: timeDiffMs,
      days: days,
      hours: hours,
      minutes: minutes
    })
    
    if (days === 0) {
      if (hours === 0) {
        return `${minutes} minuten geleden`
      } else {
        return `${hours} uur geleden`
      }
    }
    return `${days} dagen geleden`
  }

  return (
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="Waterwissel"
      parameterKey="water_change"
      currentValue={formatDisplayValue(currentValue)}
      unit=""
      idealRange="≤ 7 dagen"
      status={status}
      historicData={historicData}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      hasDataInTimeRange={hasDataInTimeRange}
      timeRangeInfo={timeRangeInfo}
      infoContent={{
        description: "Regelmatige waterwissels zijn essentieel voor een gezonde vijver. Ze verwijderen afvalstoffen en voorzien de vijver van verse, schone water.",
        importance: "Waterwissels zijn cruciaal voor het handhaven van waterkwaliteit en visgezondheid.",
        effects: [
          "Te weinig waterwissels: Ophoping van afvalstoffen, slechte waterkwaliteit, stress bij vissen",
          "Regelmatige waterwissels: Schoon water, gezonde vissen, stabiele waterkwaliteit",
          "Te veel waterwissels: Stress door plotselinge veranderingen, verstoring van biologische balans"
        ],
        management: [
          "Frequentie: 10-20% wekelijks of 25-50% maandelijks",
          "Waterkwaliteit: Gebruik geconditioneerd water (kraanwater met conditioner)",
          "Temperatuur: Zorg dat nieuw water dezelfde temperatuur heeft",
          "Timing: Voer waterwissels uit tijdens rustige momenten",
          "Monitoring: Test water parameters na waterwissel"
        ]
      }}
    />
  )
}
