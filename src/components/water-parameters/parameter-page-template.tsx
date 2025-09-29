import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Info, Timer, Play, Pause, RotateCcw, Clock } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts"
import { useParameterTimers } from "@/hooks/use-parameter-timers"

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
  onTimeRangeChange?: (range: string) => void
  timeRange?: string
  sensorData?: {
    value: number | null
    lastUpdate: string | null
  }
  hasDataInTimeRange?: boolean
  timeRangeInfo?: {
    range: string
    startDate: string
    endDate: string
  }
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

// Transform data for chart to separate sensors
const transformDataForChart = (data: Array<{ date: string; value: number; time: string; source?: 'manual' | 'sensor'; timestamp?: string; sensor_type?: string; sensor_id?: string; sensor_name?: string; sensor1_value?: number; sensor1_timestamp?: string; sensor2_value?: number; sensor2_timestamp?: string }>) => {
  
  const chartData: any[] = []
  
  // Group data by timestamp
  const groupedData = new Map<string, any>()
  
  data.forEach(point => {
    // Create a more robust timestamp key
    let timestamp: string
    if (point.timestamp) {
      timestamp = point.timestamp
    } else if (point.date && point.time) {
      // Ensure proper ISO format for timestamp
      const dateTime = `${point.date}T${point.time}:00`
      timestamp = new Date(dateTime).toISOString()
    } else {
      timestamp = new Date().toISOString()
    }
    
    const key = timestamp
    if (!groupedData.has(key)) {
      groupedData.set(key, {
        date: point.date,
        time: point.time,
        timestamp: timestamp
      })
    }
    
    const entry = groupedData.get(key)
    
    if (!entry) {
      console.error('Entry is undefined for key:', key)
      return
    }
    
    // Handle combined data points (for 24h filtering)
    if (point.sensor_type === 'combined') {
      if (point.sensor1_value !== undefined) {
        entry.sensor1 = point.sensor1_value
        entry.sensor1Name = 'Sensor 1'
      }
      if (point.sensor2_value !== undefined) {
        entry.sensor2 = point.sensor2_value
        entry.sensor2Name = 'Sensor 2'
      }
    } else {
      // Handle individual sensor data points
      if (point.sensor_type === 'sensor_1' || point.sensor_type === 'vijver_water' || (point.sensor_id && point.sensor_id.endsWith('-01'))) {
        entry.sensor1 = point.value
        entry.sensor1Name = point.sensor_name || 'Vijver Water Temperatuur'
        entry.sensor1Source = 'sensor'
      } else if (point.sensor_type === 'sensor_2' || point.sensor_type === 'filter_inlaat' || (point.sensor_id && point.sensor_id.endsWith('-02'))) {
        entry.sensor2 = point.value
        entry.sensor2Name = point.sensor_name || 'Filter Inlaat Temperatuur'
        entry.sensor2Source = 'sensor'
      } else {
        // Handle manual data points (for non-temperature parameters or manual temperature readings)
        entry.value = point.value
        entry.source = point.source || 'manual'
        entry.manualValue = point.value
        entry.manualSource = 'manual'
      }
    }
  })
  
  const result = Array.from(groupedData.values())
  
  // Check if sensor1 and sensor2 values are present
  const hasSensor1Data = result.some(r => r.sensor1 !== undefined)
  const hasSensor2Data = result.some(r => r.sensor2 !== undefined)
  
  
  return result
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
  onTimeRangeChange,
  timeRange = "7d",
  sensorData,
  hasDataInTimeRange = true,
  timeRangeInfo,
  customContent,
  multiSensorColors
}: ParameterPageProps) => {
  const [showInfo, setShowInfo] = useState(false)
  
  
  // Get display names and check which sensors have data
  const getDisplayNamesAndData = () => {
    const sensor1Name = historicData.find(d => d.sensor_type === 'sensor_1' || d.sensor_type === 'vijver_water' || (d.sensor_id && d.sensor_id.endsWith('-01')))?.sensor_name || 'Vijver Water Temperatuur'
    const sensor2Name = historicData.find(d => d.sensor_type === 'sensor_2' || d.sensor_type === 'filter_inlaat' || (d.sensor_id && d.sensor_id.endsWith('-02')))?.sensor_name || 'Filter Inlaat Temperatuur'
    
    // Check for data in the transformed data instead of raw historicData
    const transformedData = transformDataForChart(historicData)
    const hasSensor1Data = transformedData.some(d => d.sensor1 !== undefined)
    const hasSensor2Data = transformedData.some(d => d.sensor2 !== undefined)
    
    return { 
      sensor1Name, 
      sensor2Name, 
      hasSensor1Data, 
      hasSensor2Data 
    }
  }
  
  const { sensor1Name, sensor2Name, hasSensor1Data, hasSensor2Data } = getDisplayNamesAndData()
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange)
  const { timerConfigs, timerStates, startTimer, stopTimer, resetTimer } = useParameterTimers()
  
  // Sync selectedTimeRange with timeRange prop
  useEffect(() => {
    setSelectedTimeRange(timeRange)
  }, [timeRange])
  
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

  const handleTimeRangeChange = (range: string) => {
    setSelectedTimeRange(range)
    if (onTimeRangeChange) {
      onTimeRangeChange(range)
    }
  }

  const getTimeRangeDescription = (range: string) => {
    switch (range) {
      case "1h": return "Laatste uur van"
      case "4h": return "Laatste 4 uur van"
      case "24h": return "Laatste dag van"
      case "7d": return "Laatste 7 dagen van"
      case "14d": return "Laatste 14 dagen van"
      case "30d": return "Laatste 30 dagen van"
      case "90d": return "Laatste 90 dagen van"
      case "365d": return "Laatste 365 dagen van"
      default: return "Laatste 7 dagen van"
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
    // For temperature parameters, use fixed domain
    if (parameterKey === 'temperature') {
      return [0, 30]
    }
    
    // For other parameters, calculate domain based on data
    if (historicData.length === 0) {
      return [0, 10] // Default range for other parameters
    }
    
    const values = historicData.map(d => d.value).filter(v => !isNaN(v))
    if (values.length === 0) {
      return [0, 10]
    }
    
    const min = Math.min(...values)
    const max = Math.max(...values)
    const padding = (max - min) * 0.1 || 1
    
    return [Math.max(0, min - padding), max + padding]
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{parameterName}</h1>
            <p className="text-muted-foreground">{infoContent.description}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowInfo(!showInfo)}>
          <Info className="h-4 w-4 mr-2" />
          Info
        </Button>
      </div>

      {/* Current Value Card */}
      <Card>
        <CardHeader>
          <CardTitle>Huidige Meting</CardTitle>
          <CardDescription>
            {sensorData?.value !== null && sensorData?.value !== undefined ? 
              "ESP32 Sensor - Live Data" : 
              `Laatste handmatige ${parameterName.toLowerCase()} meting`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl font-bold text-primary">
                {sensorData?.value !== null && sensorData?.value !== undefined ? sensorData.value : currentValue}{unit}
              </div>
              <div className="text-sm text-muted-foreground">
                <div>Ideaal: {idealRange}</div>
                <div className="text-xs">
                  {sensorData?.lastUpdate ? 
                    `Sensor data: ${sensorData.lastUpdate}` : 
                    historicData.length > 0 ? 
                      (() => {
                        const lastMeasurement = historicData[historicData.length - 1]
                        const date = lastMeasurement.timestamp || lastMeasurement.measured_at
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
              <Badge className={getStatusColor(status)}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
              {sensorData?.value !== null && sensorData?.value !== undefined ? (
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  📡 Sensor
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-200">
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              Test Timer
            </CardTitle>
            <CardDescription>
              {timerState?.isRunning 
                ? `Tijd tot volgende ${parameterName.toLowerCase()} test`
                : `Start aftelling voor ${parameterName.toLowerCase()} test herinnering`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-3xl font-bold text-primary">
                  {timerState ? formatTime(timerState.timeLeft) : formatTime(timerConfig.duration * 60)}
                </div>
                <div className="text-sm text-muted-foreground">
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
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start
                  </Button>
                ) : (
                  <Button 
                    onClick={() => stopTimer(parameterKey)}
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Pauzeer
                  </Button>
                )}
                <Button
                  onClick={() => resetTimer(parameterKey)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
          <CardTitle>{parameterName} Geschiedenis</CardTitle>
              <CardDescription>
                {getTimeRangeDescription(selectedTimeRange)} {parameterName.toLowerCase()} metingen
                {hasSensor1Data || hasSensor2Data ? 
                  (transformDataForChart(historicData).some(r => r.manualValue !== undefined) ? 
                    " (Sensor + Handmatig)" : 
                    " (Sensor data)"
                  ) : 
                  " (Handmatige metingen)"
                }
              </CardDescription>
            </div>
            <Select value={selectedTimeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 uur</SelectItem>
                <SelectItem value="4h">4 uur</SelectItem>
                <SelectItem value="24h">1 dag</SelectItem>
                <SelectItem value="7d">7 dagen</SelectItem>
                <SelectItem value="14d">14 dagen</SelectItem>
                <SelectItem value="30d">30 dagen</SelectItem>
                <SelectItem value="90d">90 dagen</SelectItem>
                <SelectItem value="365d">365 dagen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {historicData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-center">
              <div>
                <div className="text-4xl mb-4">📊</div>
                {!hasDataInTimeRange && timeRangeInfo ? (
                  <>
                    <h3 className="text-lg font-semibold mb-2">Geen data in gekozen tijdsbestek</h3>
                    <p className="text-muted-foreground mb-4">
                      Er zijn geen {parameterName.toLowerCase()} metingen gevonden in de periode van {getTimeRangeDescription(timeRangeInfo.range).toLowerCase()}{' '}
                      {formatDateRange(timeRangeInfo.startDate, timeRangeInfo.endDate)}.
                    </p>
                    <div className="space-y-2">
                      <Button 
                        onClick={() => onNavigate("parameters")}
                        variant="outline"
                      >
                        Voeg nieuwe meting toe
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        Probeer een ander tijdsbestek of voeg nieuwe metingen toe
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold mb-2">Geen handmatige metingen</h3>
                    <p className="text-muted-foreground mb-4">
                      Er zijn nog geen handmatige {parameterName.toLowerCase()} metingen opgeslagen.
                      {sensorData?.value !== null && sensorData?.value !== undefined && (
                        <span className="block mt-2 text-sm">
                          Wel beschikbaar: Live sensor data ({sensorData.value}{unit})
                        </span>
                      )}
                    </p>
                    <Button 
                      onClick={() => onNavigate("parameters")}
                      variant="outline"
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
              <LineChart data={transformDataForChart(historicData)}>
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  interval={selectedTimeRange === "1h" ? 0 : selectedTimeRange === "4h" ? 0 : selectedTimeRange === "24h" ? 0 : "preserveStartEnd"}
                  tickFormatter={(value, index) => {
                    const transformedData = transformDataForChart(historicData)
                    const dataPoint = transformedData[index]
                    if (!dataPoint) return value
                    
                    // For periods < 24h, show time in hours
                    if (selectedTimeRange === "1h" || selectedTimeRange === "4h" || selectedTimeRange === "24h") {
                      const dateTimeString = `${dataPoint.date}T${dataPoint.time}:00`
                      const date = new Date(dateTimeString)
                      
                      // Validate date
                      if (isNaN(date.getTime())) {
                        console.warn('Invalid date in XAxis formatter:', { dataPoint, dateTimeString })
                        return value
                      }
                      
                      const currentHour = date.getHours()
                      
                      // Check if this is the first occurrence of this hour
                      const isFirstOccurrence = index === 0 || 
                        (() => {
                          const prevDataPoint = transformedData[index - 1]
                          if (!prevDataPoint) return true
                          const prevDateTimeString = `${prevDataPoint.date}T${prevDataPoint.time}:00`
                          const prevDate = new Date(prevDateTimeString)
                          
                          // Validate prev date
                          if (isNaN(prevDate.getTime())) {
                            console.warn('Invalid prev date in XAxis formatter:', { prevDataPoint, prevDateTimeString })
                            return true
                          }
                          
                          return prevDate.getHours() !== currentHour
                        })()
                      
                      if (isFirstOccurrence) {
                        return date.toLocaleTimeString('nl-NL', { 
                          hour: '2-digit'
                        })
                      }
                      
                      return ""
                    }
                    
                    // For periods >= 24h, show date only once per day in the middle of the day
                    const currentDate = dataPoint.date
                    const isFirstOccurrence = index === 0 || transformedData[index - 1].date !== currentDate
                    
                    if (isFirstOccurrence) {
                      // Convert YYYY-MM-DD to dd-mm format
                      const [year, month, day] = currentDate.split('-')
                      return `${day}-${month}`
                    }
                    
                    return ""
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
                      
                      // Use timestamp if available, otherwise construct from date + time
                      let date: Date
                      if (data.timestamp) {
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
                            
                            {/* Show all available sensor values */}
                            {data.sensor1 !== undefined && hasSensor1Data && (
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  {data.sensor1Name || 'Sensor 1'}
                                </span>
                                <span className="font-bold" style={{ color: chartConfig.sensor1.color }}>
                                  {data.sensor1}°C
                                </span>
                              </div>
                            )}
                            
                            {data.sensor2 !== undefined && hasSensor2Data && (
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  {data.sensor2Name || 'Sensor 2'}
                                </span>
                                <span className="font-bold" style={{ color: chartConfig.sensor2.color }}>
                                  {data.sensor2}°C
                                </span>
                              </div>
                            )}
                            
                            {/* Show manual data values */}
                            {data.manualValue !== undefined && (
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  {parameterName} (Handmatig)
                                </span>
                                <span className="font-bold" style={{ color: chartConfig.value.color }}>
                                  {data.manualValue}{unit}
                                </span>
                              </div>
                            )}
                            
                            {/* Show fallback manual data values for non-temperature parameters */}
                            {data.value !== undefined && !hasSensor1Data && !hasSensor2Data && !data.manualValue && (
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  {parameterName}
                                </span>
                                <span className="font-bold" style={{ color: chartConfig.value.color }}>
                                  {data.value}{unit}
                                </span>
                              </div>
                            )}
                            
                            
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                
                
                {/* Sensor 1 line - only show if has data */}
                {hasSensor1Data && (
                  <Line 
                    type="monotone" 
                    dataKey="sensor1" 
                    stroke={chartConfig.sensor1.color}
                    strokeWidth={2}
                    dot={selectedTimeRange === "7d" || selectedTimeRange === "14d" || selectedTimeRange === "30d" || selectedTimeRange === "90d" || selectedTimeRange === "365d" ? false : { fill: chartConfig.sensor1.color, strokeWidth: 2, r: 4 }}
                    connectNulls={true}
                    activeDot={{ r: 6 }}
                    name={sensor1Name}
                  />
                )}
                
                {/* Sensor 2 line - only show if has data */}
                {hasSensor2Data && (
                  <Line 
                    type="monotone" 
                    dataKey="sensor2" 
                    stroke={chartConfig.sensor2.color}
                    strokeWidth={2}
                    dot={selectedTimeRange === "7d" || selectedTimeRange === "14d" || selectedTimeRange === "30d" || selectedTimeRange === "90d" || selectedTimeRange === "365d" ? false : { fill: chartConfig.sensor2.color, strokeWidth: 2, r: 4 }}
                    connectNulls={true}
                    activeDot={{ r: 6 }}
                    name={sensor2Name}
                  />
                )}
                
                {/* Manual data line - always show if there's manual data */}
                {transformDataForChart(historicData).some(r => r.manualValue !== undefined) && (
                  <Line 
                    type="monotone" 
                    dataKey="manualValue" 
                    stroke={chartConfig.value.color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={selectedTimeRange === "7d" || selectedTimeRange === "14d" || selectedTimeRange === "30d" || selectedTimeRange === "90d" || selectedTimeRange === "365d" ? false : { fill: chartConfig.value.color, strokeWidth: 2, r: 4 }}
                    connectNulls={true}
                    activeDot={{ r: 6 }}
                    name={`${parameterName} (Handmatig)`}
                  />
                )}
                
                {/* Fallback line for when there's no sensor data but there is manual data */}
                {!hasSensor1Data && !hasSensor2Data && transformDataForChart(historicData).some(r => r.value !== undefined) && (
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={chartConfig.value.color}
                    strokeWidth={2}
                    dot={selectedTimeRange === "7d" || selectedTimeRange === "14d" || selectedTimeRange === "30d" || selectedTimeRange === "90d" || selectedTimeRange === "365d" ? false : { fill: chartConfig.value.color, strokeWidth: 2, r: 4 }}
                    connectNulls={true}
                    activeDot={{ r: 6 }}
                    name={parameterName}
                  />
                )}
                
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
          )}
          
          {/* Legend - only show if there's data */}
          {historicData.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              {hasSensor1Data && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartConfig.sensor1.color }}></div>
                  <span>{sensor1Name}</span>
                </div>
              )}
              {hasSensor2Data && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartConfig.sensor2.color }}></div>
                  <span>{sensor2Name}</span>
                </div>
              )}
              {transformDataForChart(historicData).some(r => r.manualValue !== undefined) && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ backgroundColor: chartConfig.value.color, borderColor: chartConfig.value.color }}></div>
                  <span>{parameterName} (Handmatig)</span>
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