import { useState, useEffect } from "react"
import { ParameterPageTemplate } from "./parameter-page-template"
import { useMultiSensorTemperatureData } from "@/hooks/use-multi-sensor-temperature-data"
import { Card, CardContent } from "@/components/ui/card"

interface TemperatureSensorPageProps {
  onNavigate: (tab: string) => void
  sensorId: string
}

export const TemperatureSensorPage = ({ onNavigate, sensorId }: TemperatureSensorPageProps) => {
  const [timeRange, setTimeRange] = useState("7d")
  const [selectedSensors, setSelectedSensors] = useState<string[]>([])
  
  const { 
    combinedData, 
    sensors, 
    loading, 
    error,
    hasDataInTimeRange,
    timeRangeInfo
  } = useMultiSensorTemperatureData(timeRange)

  // Initialize selected sensors when sensors are loaded
  useEffect(() => {
    if (sensors.length > 0 && selectedSensors.length === 0) {
      // If a specific sensorId is provided, select only that sensor
      if (sensorId && sensors.some(s => s.sensor_id === sensorId)) {
        setSelectedSensors([sensorId])
      } else {
        setSelectedSensors(sensors.map(s => s.sensor_id))
      }
    }
  }, [sensors, selectedSensors.length, sensorId])

  // Filter data based on selected sensors
  const filteredData = combinedData.filter(dataPoint => 
    selectedSensors.includes(dataPoint.sensor_id || '')
  )

  // Get current value from the most recent data point
  const currentValue = filteredData.length > 0 ? filteredData[filteredData.length - 1].value : 0

  // Determine status based on current value
  const getStatus = (value: number): "optimal" | "warning" | "critical" => {
    if (value >= 15 && value <= 25) return "optimal"
    if (value >= 10 && value <= 30) return "warning"
    return "critical"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading temperature data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <span className="text-sm">⚠️ Error loading temperature data: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-Sensor Temperature Chart */}
      <ParameterPageTemplate
        onNavigate={onNavigate}
        parameterName="Temperatuursensoren"
        parameterKey="temperature"
        currentValue={currentValue}
        unit="°C"
        idealRange="15 - 25°C"
        status={getStatus(currentValue)}
        historicData={filteredData}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        hasDataInTimeRange={hasDataInTimeRange}
        timeRangeInfo={timeRangeInfo}
        sensorData={{
          value: currentValue,
          lastUpdate: filteredData.length > 0 ? filteredData[filteredData.length - 1].timestamp : "No data"
        }}
        infoContent={{
          description: "Multi-sensor temperatuur monitoring",
          importance: "Vergelijk temperatuurmetingen van verschillende sensoren",
          effects: [
            "Vergelijking: Zie temperatuurverschillen tussen verschillende locaties",
            "Trends: Identificeer patronen in temperatuurveranderingen",
            "Monitoring: Houd alle temperatuursensoren in de gaten",
            "Analyse: Begrijp temperatuurverschillen in je vijver"
          ],
          management: [
            "Selecteer de sensoren die je wilt vergelijken",
            "Gebruik verschillende tijd ranges voor verschillende analyses",
            "Let op temperatuurverschillen tussen sensoren",
            "Monitor trends over langere periodes"
          ]
        }}
        customContent={
          sensors.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Sensor Selectie</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sensors.map((sensor) => (
                    <div
                      key={sensor.sensor_id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSensors.includes(sensor.sensor_id)
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setSelectedSensors(prev => 
                          prev.includes(sensor.sensor_id)
                            ? prev.filter(id => id !== sensor.sensor_id)
                            : [...prev, sensor.sensor_id]
                        )
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: sensor.color }}
                        />
                        <div>
                          <p className="font-medium text-sm">{sensor.display_name}</p>
                          {sensor.location && (
                            <p className="text-xs text-muted-foreground">{sensor.location}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        }
      />
    </div>
  )
}
