import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Thermometer, Droplets, AlertTriangle } from "lucide-react"
import { useMultipleSensorData } from "@/hooks/use-multiple-sensor-data"

interface MultipleSensorDisplayProps {
  className?: string
}

export function MultipleSensorDisplay({ className }: MultipleSensorDisplayProps) {
  const { vijverWater, filterInlaat, loading, error, refresh } = useMultipleSensorData()

  const getStatusColor = (temperature: number | null): string => {
    if (temperature === null) return "bg-gray-100 text-gray-800"
    
    if (temperature < 4) return "bg-red-100 text-red-800"
    if (temperature > 30) return "bg-red-100 text-red-800"
    if (temperature >= 18 && temperature <= 25) return "bg-green-100 text-green-800"
    return "bg-yellow-100 text-yellow-800"
  }

  const getStatusText = (temperature: number | null): string => {
    if (temperature === null) return "Geen data"
    
    if (temperature < 4) return "Te koud"
    if (temperature > 30) return "Te warm"
    if (temperature >= 18 && temperature <= 25) return "Ideaal"
    return "Acceptabel"
  }

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Laden van sensor data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Error loading sensor data: {error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">IoT Sensoren</h3>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Vernieuwen
        </Button>
      </div>

      {/* Sensor 1 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Droplets className="h-4 w-4 text-blue-500" />
{vijverWater.sensorName}
          </CardTitle>
          <CardDescription>
            {vijverWater.lastUpdate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Thermometer className="h-6 w-6 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">
                  {vijverWater.temperature !== null ? `${vijverWater.temperature.toFixed(1)}°C` : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Temperatuur sensor
                </div>
              </div>
            </div>
            <Badge className={getStatusColor(vijverWater.temperature)}>
              {getStatusText(vijverWater.temperature)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sensor 2 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Droplets className="h-4 w-4 text-orange-500" />
{filterInlaat.sensorName}
          </CardTitle>
          <CardDescription>
            {filterInlaat.lastUpdate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Thermometer className="h-6 w-6 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">
                  {filterInlaat.temperature !== null ? `${filterInlaat.temperature.toFixed(1)}°C` : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Temperatuur sensor
                </div>
              </div>
            </div>
            <Badge className={getStatusColor(filterInlaat.temperature)}>
              {getStatusText(filterInlaat.temperature)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Temperatuur Interpretatie:</span>
            </div>
            <div className="space-y-1 text-xs">
              <div>• <span className="text-green-600">18-25°C:</span> Ideale temperatuur voor koi</div>
              <div>• <span className="text-yellow-600">10-17°C of 26-30°C:</span> Acceptabele temperatuur</div>
              <div>• <span className="text-red-600">&lt;10°C of &gt;30°C:</span> Te koud/warm voor koi</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
