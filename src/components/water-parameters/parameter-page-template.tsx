import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Info, Timer, Play, Pause, RotateCcw, Clock } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts"
import { useParameterTimers } from "@/hooks/use-parameter-timers"
import { useTranslation } from "react-i18next"

interface ParameterPageProps {
  onNavigate: (tab: string) => void
  parameterName: string
  parameterKey: string
  currentValue: number | string
  unit: string
  idealRange: string
  status: "optimal" | "warning" | "critical"
  historicData: Array<{ date: string; value: number; time: string; source?: 'manual' | 'sensor'; timestamp?: string; sensor_type?: string; sensor_id?: string; sensor_name?: string }>
  infoContent: {
    description: string
    importance: string
    effects: string[]
    management: string[]
  }
  sensorData?: {
    value: number | null
    lastUpdate: string | null
  }
  hasDataInTimeRange?: boolean
  hasAnyDataInDatabase?: boolean
  timeRangeInfo?: {
    range: string
    startDate: string
    endDate: string
  }
  timeRange?: string
  onTimeRangeChange?: (range: string) => void
  customContent?: React.ReactNode
  multiSensorColors?: { [key: string]: string }
}

const chartConfig = {
  value: {
    label: "Waarde",
    color: "hsl(var(--primary))",
  },
  sensorValue: {
    label: "Sensor",
    color: "hsl(142, 76%, 36%)", // Green for sensor data
  },
  manualValue: {
    label: "Handmatig",
    color: "hsl(var(--primary))", // Primary color for manual data
  },
  sensor1: {
    label: "Sensor 1",
    color: "hsl(200, 100%, 50%)", // Blue for sensor 1
  },
  sensor2: {
    label: "Sensor 2", 
    color: "hsl(30, 100%, 50%)", // Orange for sensor 2
  },
}

// Transform function that handles multiple sensors by grouping by timestamp
const transformDataForChart = (
  data: Array<{ 
    date: string; 
    value: number; 
    time: string; 
    timestamp?: string; 
    source?: 'manual' | 'sensor';
    sensor_id?: string;
    sensor_name?: string;
  }>, 
  timeRangeInfo?: { range: string; startDate: string; endDate: string }
) => {
  if (!data || data.length === 0) {
    return []
  }
  
  // Check if we have multiple sensors (for temperature)
  const hasMultipleSensors = data.some(d => d.sensor_id || d.sensor_name)
  
  if (hasMultipleSensors) {
    // First, identify all unique sensors and their keys
    const sensorKeys = new Set<string>()
    data.forEach(point => {
      const normalizedKey = point.sensor_id 
        ? point.sensor_id.toLowerCase().replace(/\s+/g, '_')
        : (point.sensor_name || 'value').toLowerCase().replace(/\s+/g, '_')
      sensorKeys.add(normalizedKey)
    })
    
    // Get all unique timestamps from all sensors
    const allTimestamps = new Set<number>()
    data.forEach(point => {
      const timestamp = point.timestamp ? new Date(point.timestamp).getTime() : new Date(point.date).getTime()
      allTimestamps.add(timestamp)
    })
    
    // Create a map to store values per timestamp and sensor
    const dataMap = new Map<number, Map<string, number>>()
    data.forEach(point => {
      const timestamp = point.timestamp ? new Date(point.timestamp).getTime() : new Date(point.date).getTime()
      const normalizedKey = point.sensor_id 
        ? point.sensor_id.toLowerCase().replace(/\s+/g, '_')
        : (point.sensor_name || 'value').toLowerCase().replace(/\s+/g, '_')
      
      if (!dataMap.has(timestamp)) {
        dataMap.set(timestamp, new Map())
      }
      dataMap.get(timestamp)!.set(normalizedKey, point.value)
    })
    
    // Create combined data points - each timestamp gets all sensor values
    const chartData = Array.from(allTimestamps).sort((a, b) => a - b).map(timestamp => {
      const pointData = dataMap.get(timestamp)
      const firstPoint = data.find(p => {
        const ts = p.timestamp ? new Date(p.timestamp).getTime() : new Date(p.date).getTime()
        return ts === timestamp
      })
      
      const dataPoint: any = {
        date: firstPoint?.date || new Date(timestamp).toISOString().split('T')[0],
        time: firstPoint?.time || new Date(timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        timestamp: timestamp,
      }
      
      // Set value for each sensor (null if not present at this timestamp)
      sensorKeys.forEach(key => {
        dataPoint[key] = pointData?.get(key) ?? null
      })
      
      return dataPoint
    })
    
    return chartData
  } else {
    // Single sensor or manual data - use simple format
    const chartData = data.map(point => {
      const timestamp = point.timestamp ? new Date(point.timestamp).getTime() : new Date(point.date).getTime()
      return {
        date: point.date,
        time: point.time,
        timestamp,
        value: point.value,
        manualValue: point.value
      }
    })
    
    // Sort by timestamp
    chartData.sort((a, b) => a.timestamp - b.timestamp)
    
    return chartData
  }
}

export const ParameterPageTemplate = ({
  onNavigate,
  parameterName,
  parameterKey,
  currentValue,
  unit,
  idealRange,
  status,
  historicData,
  infoContent,
  sensorData,
  hasDataInTimeRange = true,
  hasAnyDataInDatabase = false,
  timeRangeInfo,
  timeRange = "30d",
  onTimeRangeChange,
  customContent,
  multiSensorColors
}: ParameterPageProps) => {
  const { t } = useTranslation()
  const [showInfo, setShowInfo] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Detect available sensors from data
  const availableSensors = useMemo(() => {
    const sensors = new Map<string, { name: string; id?: string; color: string }>()
    
    historicData.forEach(point => {
      if (point.sensor_id || point.sensor_name) {
        // Use sensor_id as primary key if available, otherwise use sensor_name
        // Normalize the key to be consistent
        const sensorKey = point.sensor_id 
          ? point.sensor_id.toLowerCase().replace(/\s+/g, '_')
          : (point.sensor_name || 'value').toLowerCase().replace(/\s+/g, '_')
        const sensorName = point.sensor_name || point.sensor_id || 'Waarde'
        
        if (!sensors.has(sensorKey)) {
          // Assign colors based on sensor name or use default
          let color = chartConfig.value.color
          if (sensorName.toLowerCase().includes('water') || sensorName.toLowerCase().includes('vijver')) {
            color = "hsl(200, 100%, 50%)" // Blue for water temperature
          } else if (sensorName.toLowerCase().includes('buiten') || sensorName.toLowerCase().includes('ambient')) {
            color = "hsl(30, 100%, 50%)" // Orange for ambient temperature
          } else if (sensors.size === 0) {
            color = chartConfig.sensor1.color
          } else {
            color = chartConfig.sensor2.color
          }
          
          sensors.set(sensorKey, {
            name: sensorName,
            id: point.sensor_id,
            color: multiSensorColors?.[sensorKey] || color
          })
        }
      }
    })
    
    return Array.from(sensors.entries()).map(([key, info]) => ({ key, ...info }))
  }, [historicData, multiSensorColors])
  
  // State to track which sensors are visible (default: all visible)
  const [visibleSensors, setVisibleSensors] = useState<Set<string>>(new Set())
  
  // Create a stable string representation of available sensor keys
  const availableSensorKeysStr = useMemo(() => 
    availableSensors.map(s => s.key).sort().join(','), 
    [availableSensors]
  )
  
  // Track if we've initialized visible sensors
  const initializedRef = useRef<string>('')
  
  // Initialize/update visible sensors when available sensors change
  useEffect(() => {
    if (availableSensors.length > 0) {
      const availableKeys = new Set(availableSensors.map(s => s.key))
      const availableKeysStr = Array.from(availableKeys).sort().join(',')
      
      // Only update if the available sensors have changed
      if (initializedRef.current !== availableKeysStr) {
        console.log('Initializing/updating visible sensors:', {
          previous: initializedRef.current,
          new: availableKeysStr,
          availableSensors: availableSensors.map(s => ({ key: s.key, name: s.name }))
        })
        setVisibleSensors(availableKeys)
        initializedRef.current = availableKeysStr
      }
    }
  }, [availableSensorKeysStr, availableSensors])
  
  // Debug logging
  useEffect(() => {
    console.log(`ParameterPageTemplate for ${parameterName}:`, {
      historicDataLength: historicData?.length || 0,
      currentValue,
      hasDataInTimeRange,
      availableSensors: availableSensors.length,
      availableSensorKeys: availableSensors.map(s => ({ key: s.key, name: s.name, id: s.id })),
      visibleSensors: Array.from(visibleSensors),
      sampleData: historicData?.slice(0, 5).map(d => ({
        sensor_id: d.sensor_id,
        sensor_name: d.sensor_name,
        value: d.value,
        timestamp: d.timestamp
      }))
    })
  }, [parameterName, historicData, currentValue, hasDataInTimeRange, availableSensors, visibleSensors])
  
  
  // For now, we only show manual data (simplified)
  const hasSensor1Data = false
  const hasSensor2Data = false
  const { timerConfigs, timerStates, startTimer, stopTimer, resetTimer } = useParameterTimers()

  // Detect screen size for mobile/desktop
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])
  
  const timerConfig = timerConfigs[parameterKey]
  const timerState = timerStates[parameterKey]
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }


  const getTimeRangeDescription = (range: string) => {
    switch (range) {
      case "7d": return "Laatste 7 dagen"
      case "30d": return "Laatste 30 dagen"
      case "90d": return "Laatste 90 dagen"
      case "365d": return "Laatste 365 dagen"
      default: return "Laatste 30 dagen"
    }
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    const startFormatted = start.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    const endFormatted = end.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    return `${startFormatted} tot ${endFormatted}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "bg-emerald-500/10 text-emerald-600 border-emerald-200"
      case "warning": return "bg-amber-500/10 text-amber-600 border-amber-200"
      case "critical": return "bg-red-500/10 text-red-600 border-red-200"
      default: return "bg-gray-500/10 text-gray-600 border-gray-200"
    }
  }

  const getYAxisDomain = () => {
    // For all parameters, calculate domain based on data
    if (historicData.length === 0) {
      return [0, 10] // Default range for all parameters
    }
    
    // Get all values from the transformed data (handles both single and multi-sensor)
    const transformedData = transformDataForChart(historicData, timeRangeInfo)
    const allValues: number[] = []
    
    transformedData.forEach(point => {
      // If multiple sensors, collect values from all sensor keys
      if (availableSensors.length > 0) {
        availableSensors.forEach(sensor => {
          const value = point[sensor.key]
          if (value !== undefined && value !== null && !isNaN(value)) {
            allValues.push(value)
          }
        })
      } else {
        // Single sensor or manual data
        if (point.value !== undefined && point.value !== null && !isNaN(point.value)) {
          allValues.push(point.value)
        }
      }
    })
    
    if (allValues.length === 0) {
      return [0, 10]
    }
    
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    
    // Add 2.0 margin above and below the data range
    const margin = 2.0
    const domainMin = Math.max(0, min - margin)
    const domainMax = max + margin
    
    return [domainMin, domainMax]
  }

  const getXAxisDomain = () => {
    // Always use actual data to determine domain (start from first data point)
    if (historicData.length > 0) {
      const transformedData = transformDataForChart(historicData)
      if (transformedData.length > 0) {
        const dates = transformedData.map(d => {
          // Timestamp is now a number, so use it directly
          if (d.timestamp && typeof d.timestamp === 'number') {
            return d.timestamp
          } else if (d.timestamp && typeof d.timestamp === 'string') {
            return new Date(d.timestamp).getTime()
          } else if (d.date && d.time) {
            const dateTime = `${d.date}T${d.time}:00`
            return new Date(dateTime).getTime()
          }
          return null
        }).filter(d => d !== null) as number[]
        
        if (dates.length > 0) {
          const minDate = Math.min(...dates)
          const maxDate = Math.max(...dates)
          
          // Use timeRangeInfo endDate as maximum if available, otherwise use maxDate
          let endDate = maxDate
          if (timeRangeInfo && timeRangeInfo.endDate) {
            const rangeEndDate = new Date(timeRangeInfo.endDate).getTime()
            // Use the later of the two (data max or range end)
            endDate = Math.max(maxDate, rangeEndDate)
          }
          
          // Add small padding (5% on each side) for better visualization
          const padding = (endDate - minDate) * 0.05
          const domainStart = minDate - padding
          const domainEnd = endDate + padding
          
          console.log('XAxis domain from data:', {
            minDate: new Date(minDate).toLocaleDateString('nl-NL'),
            maxDate: new Date(maxDate).toLocaleDateString('nl-NL'),
            domainStart: new Date(domainStart).toLocaleDateString('nl-NL'),
            domainEnd: new Date(domainEnd).toLocaleDateString('nl-NL')
          })
          
          return [domainStart, domainEnd]
        }
      }
    }
    
    // Fallback: use timeRangeInfo if no data
    if (timeRangeInfo && timeRangeInfo.startDate && timeRangeInfo.endDate) {
      const startDate = new Date(timeRangeInfo.startDate)
      const endDate = new Date(timeRangeInfo.endDate)
      return [startDate.getTime(), endDate.getTime()]
    }
    
    // Default: last 7 days
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)
    return [sevenDaysAgo.getTime(), now.getTime()]
  }



  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")} className="h-8 w-8 sm:h-10 sm:w-10">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">{parameterName}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{infoContent.description}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowInfo(!showInfo)} className="h-8 sm:h-9 text-xs sm:text-sm">
          <Info className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Info
        </Button>
      </div>

      {/* Current Value Card */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Huidige Meting</CardTitle>
          <CardDescription className="text-sm">
            {sensorData?.value !== null && sensorData?.value !== undefined ? 
              "ESP32 Sensor - Live Data" : 
              `Laatste handmatige ${parameterName.toLowerCase()} meting`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">
                {sensorData?.value !== null && sensorData?.value !== undefined ? sensorData.value : currentValue}{unit}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                <div>Ideaal: {idealRange}</div>
                <div className="text-xs">
                  {sensorData?.lastUpdate ? 
                    `Sensor data: ${sensorData.lastUpdate}` : 
                    historicData.length > 0 ? 
                      (() => {
                        const lastMeasurement = historicData[historicData.length - 1]
                        const date = lastMeasurement.timestamp
                        if (date) {
                          return `Laatste handmatige meting: ${new Date(date).toLocaleString('nl-NL', {
                            day: '2-digit',
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}`
                        } else {
                          return `Laatste handmatige meting: ${lastMeasurement.date || 'Onbekend'}`
                        }
                      })() :
                      "Geen metingen beschikbaar"
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${getStatusColor(status)}`}>
                {t(`waterParameters.${status}`)}
              </Badge>
              {sensorData?.value !== null && sensorData?.value !== undefined ? (
                <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">
                  📡 Sensor
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                  ✋ Handmatig
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timer Card */}
      {timerConfig?.enabled && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Timer className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Test Timer
            </CardTitle>
            <CardDescription className="text-sm">
              {timerState?.isRunning 
                ? `Tijd tot volgende ${parameterName.toLowerCase()} test`
                : `Start aftelling voor ${parameterName.toLowerCase()} test herinnering`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="text-2xl sm:text-3xl font-bold text-primary">
                  {timerState ? formatTime(timerState.timeLeft) : formatTime(timerConfig.duration * 60)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  <div>Duur: {timerConfig.duration} minuten</div>
                  {timerState?.startTime && (
                    <div className="text-xs">Gestart: {timerState.startTime.toLocaleTimeString()}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {!timerState?.isRunning ? (
                  <Button 
                    onClick={() => startTimer(parameterKey)}
                    size="sm"
                    className="flex items-center gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                    Start
                  </Button>
                ) : (
                  <Button 
                    onClick={() => stopTimer(parameterKey)}
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <Pause className="h-3 w-3 sm:h-4 sm:w-4" />
                    Pauzeer
                  </Button>
                )}
                <Button
                  onClick={() => resetTimer(parameterKey)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Content */}
      {customContent}

      {/* Historic Chart */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-lg sm:text-xl">{parameterName} Geschiedenis</CardTitle>
              <CardDescription className="text-sm">
                {getTimeRangeDescription(timeRange)} {parameterName.toLowerCase()} metingen
              </CardDescription>
            </div>
            {onTimeRangeChange && (
              <Select value={timeRange} onValueChange={onTimeRangeChange}>
                <SelectTrigger className="w-[140px] h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 dagen</SelectItem>
                  <SelectItem value="30d">30 dagen</SelectItem>
                  <SelectItem value="90d">90 dagen</SelectItem>
                  <SelectItem value="365d">365 dagen</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {historicData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-center">
              <div>
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📊</div>
                {hasAnyDataInDatabase && !hasDataInTimeRange && timeRangeInfo ? (
                  // Scenario 2: Data exists in database but not in selected time range
                  <>
                    <h3 className="text-base sm:text-lg font-semibold mb-2">Geen data in gekozen tijdsbestek</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                      Er zijn wel {parameterName.toLowerCase()} metingen in de database, maar geen in de {getTimeRangeDescription(timeRange).toLowerCase()}.
                    </p>
                    <div className="space-y-2">
                      <Button 
                        onClick={() => onNavigate("parameters")}
                        variant="outline"
                        className="h-8 sm:h-9 text-xs sm:text-sm"
                      >
                        Voeg nieuwe meting toe
                      </Button>
                    </div>
                  </>
                ) : (
                  // Scenario 1: No data in database at all
                  <>
                    <h3 className="text-base sm:text-lg font-semibold mb-2">Geen handmatige metingen</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                      Er zijn nog geen handmatige {parameterName.toLowerCase()} metingen opgeslagen.
                      {sensorData?.value !== null && sensorData?.value !== undefined && (
                        <span className="block mt-2 text-xs sm:text-sm">
                          Wel beschikbaar: Live sensor data ({sensorData.value}{unit})
                        </span>
                      )}
                    </p>
                    <Button 
                      onClick={() => onNavigate("parameters")}
                      variant="outline"
                      className="h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      Voeg eerste handmatige meting toe
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={transformDataForChart(historicData, timeRangeInfo)}>
                <XAxis 
                  dataKey="timestamp" 
                  type="number"
                  domain={getXAxisDomain()}
                  tick={{ fontSize: 12 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  interval="preserveStartEnd"
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    if (isNaN(date.getTime())) return ""
                    // Show date in DD-MM format
                    const [year, month, day] = date.toISOString().split('T')[0].split('-')
                    return `${day}-${month}`
                  }}
                />
                <YAxis 
                  domain={getYAxisDomain()}
                  tick={{ fontSize: 12 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  tickFormatter={(value) => {
                    // Format values based on parameter type
                    if (typeof value === 'number') {
                      if (parameterKey === 'temperature') {
                        return value.toFixed(1)
                      } else {
                        return value.toFixed(parameterKey === 'ph' ? 1 : 0)
                      }
                    }
                    return ''
                  }}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      
                      // Use timestamp if available (now a number), otherwise construct from date + time
                      let date: Date
                      if (data.timestamp) {
                        // Timestamp is now a number (milliseconds since epoch)
                        date = new Date(data.timestamp)
                      } else if (data.date && data.time) {
                        // Ensure proper ISO format
                        const dateTimeString = `${data.date}T${data.time}:00`
                        date = new Date(dateTimeString)
                      } else {
                        date = new Date()
                      }
                      
                      // Validate the date
                      if (isNaN(date.getTime())) {
                        console.warn('Invalid date parsed:', { data, dateTimeString: data.date + 'T' + data.time })
                        date = new Date()
                      }
                      
                      
                      const fullDateTime = date.toLocaleString('nl-NL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                      
                      // Show all sensor values if multiple sensors exist
                      const hasMultipleSensors = availableSensors.length > 0
                      
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Datum & Tijd
                              </span>
                              <span className="font-bold text-muted-foreground">
                                {fullDateTime}
                              </span>
                            </div>
                            
                            {/* Show all sensor values if multiple sensors, otherwise show single value */}
                            {hasMultipleSensors ? (
                              availableSensors.map(sensor => {
                                const value = data[sensor.key]
                                if (value === undefined || value === null) return null
                                return (
                                  <div key={sensor.key} className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                      {sensor.name}
                                    </span>
                                    <span className="font-bold" style={{ color: sensor.color }}>
                                      {value}{unit}
                                    </span>
                                  </div>
                                )
                              })
                            ) : (
                              data.value !== undefined && (
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    {parameterName}
                                  </span>
                                  <span className="font-bold" style={{ color: chartConfig.value.color }}>
                                    {data.value}{unit}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                
                {/* Render lines for each sensor if multiple sensors exist */}
                {availableSensors.length > 0 ? (
                  availableSensors.map(sensor => (
                    <Line 
                      key={sensor.key}
                      type="monotone" 
                      dataKey={sensor.key}
                      stroke={sensor.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                      activeDot={{ r: 6, fill: sensor.color, strokeWidth: 2, stroke: '#fff' }}
                      name={sensor.name}
                      hide={!visibleSensors.has(sensor.key)}
                    />
                  ))
                ) : (
                  /* Single sensor or manual data - show single line */
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={chartConfig.value.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    activeDot={{ r: 6, fill: chartConfig.value.color, strokeWidth: 2, stroke: '#fff' }}
                    name={parameterName}
                  />
                )}
                
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
          )}
          
          {/* Legend - show all sensors with clickable toggles */}
          {historicData.length > 0 && (
            <div className="flex items-center justify-center gap-4 sm:gap-6 mt-4 text-sm flex-wrap">
              {availableSensors.length > 0 ? (
                availableSensors.map(sensor => (
                  <div
                    key={sensor.key}
                    className="flex items-center gap-2 cursor-pointer transition-opacity"
                    style={{ opacity: visibleSensors.has(sensor.key) ? 1 : 0.4 }}
                    onClick={() => {
                      setVisibleSensors(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has(sensor.key)) {
                          newSet.delete(sensor.key)
                        } else {
                          newSet.add(sensor.key)
                        }
                        return newSet
                      })
                    }}
                  >
                    <div 
                      className="w-3 h-3 rounded-full border-2 border-white shadow-sm" 
                      style={{ backgroundColor: sensor.color }}
                    ></div>
                    <span className={visibleSensors.has(sensor.key) ? 'font-medium' : 'text-muted-foreground'}>
                      {sensor.name}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartConfig.value.color }}></div>
                  <span>{parameterName}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Panel */}
      {showInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Over {parameterName}</CardTitle>
            <CardDescription>{infoContent.importance}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Effecten</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {infoContent.effects.map((effect, index) => (
                  <li key={index}>• {effect}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Beheer Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {infoContent.management.map((tip, index) => (
                  <li key={index}>• {tip}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}