import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Thermometer, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Target,
  BarChart3,
  Activity,
  Zap
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface TemperatureAnalysis {
  sensor_id: string
  sensor_type: string
  total_readings: number
  valid_readings: number
  invalid_readings: number
  average_temp: number
  min_temp: number
  max_temp: number
  temp_range: number
  outlier_count: number
  data_quality_score: number
}

interface SensorComparison {
  sensor1_temp: number
  sensor2_temp: number
  temperature_difference: number
  calibration_needed: boolean
  recommended_offset: number
}

export function TemperatureAnalysisDashboard() {
  const { user } = useAuth()
  const [analysis, setAnalysis] = useState<TemperatureAnalysis[]>([])
  const [comparison, setComparison] = useState<SensorComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadTemperatureAnalysis()
    }
  }, [user])

  const loadTemperatureAnalysis = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // Get analysis for all temperature sensors
      const { data: analysisData, error: analysisError } = await supabase
        .rpc('analyze_temperature_quality', {
          sensor_id_param: 'KOIoT-A1b2C3',
          days_back: 1
        })

      if (analysisError) {
        console.error('Error loading temperature analysis:', analysisError)
        setError('Fout bij laden van temperatuur analyse')
        return
      }

      setAnalysis(analysisData || [])

      // Get sensor comparison data
      await loadSensorComparison()

    } catch (error) {
      console.error('Error loading temperature analysis:', error)
      setError('Fout bij laden van temperatuur analyse')
    } finally {
      setLoading(false)
    }
  }

  const loadSensorComparison = async () => {
    if (!user) return

    try {
      // Get recent readings from both sensors
      const { data: sensor1Data, error: sensor1Error } = await supabase
        .from('sensor_data')
        .select('temperature, created_at')
        .eq('sensor_id', 'KOIoT-001122-01')
        .eq('sensor_type', 'temperatuurmeter')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const { data: sensor2Data, error: sensor2Error } = await supabase
        .from('sensor_data')
        .select('temperature, created_at')
        .eq('sensor_id', 'KOIoT-001122-02')
        .eq('sensor_type', 'temperatuurmeter')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (sensor1Data && sensor2Data) {
        const temp1 = parseFloat(sensor1Data.temperature)
        const temp2 = parseFloat(sensor2Data.temperature)
        const diff = Math.abs(temp1 - temp2)
        
        setComparison({
          sensor1_temp: temp1,
          sensor2_temp: temp2,
          temperature_difference: diff,
          calibration_needed: diff > 2.0,
          recommended_offset: temp1 - temp2
        })
      }
    } catch (error) {
      console.error('Error loading sensor comparison:', error)
    }
  }

  const getQualityBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">Uitstekend</Badge>
    if (score >= 75) return <Badge className="bg-yellow-500">Goed</Badge>
    if (score >= 50) return <Badge className="bg-orange-500">Matig</Badge>
    return <Badge className="bg-red-500">Slecht</Badge>
  }

  const getQualityColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 75) return "text-yellow-600"
    if (score >= 50) return "text-orange-600"
    return "text-red-600"
  }

  const getSensorName = (sensorId: string) => {
    if (sensorId.includes('-01')) return 'Vijver Water'
    if (sensorId.includes('-02')) return 'Filter Inlaat'
    return 'Onbekende Sensor'
  }

  const getSensorIcon = (sensorId: string) => {
    if (sensorId.includes('-01')) return <Thermometer className="h-4 w-4 text-blue-500" />
    if (sensorId.includes('-02')) return <Thermometer className="h-4 w-4 text-green-500" />
    return <Thermometer className="h-4 w-4 text-gray-500" />
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Laden van temperatuur analyse...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
            <Button onClick={loadTemperatureAnalysis} className="mt-4">
              Opnieuw Proberen
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Temperatuur Analyse Dashboard
          </h2>
          <p className="text-muted-foreground">
            Geavanceerde analyse van temperatuursensor prestaties
          </p>
        </div>
        <Button onClick={loadTemperatureAnalysis} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Vernieuwen
        </Button>
      </div>

      {/* Sensor Comparison */}
      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Sensor Vergelijking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {comparison.sensor1_temp.toFixed(1)}°C
                </div>
                <div className="text-sm text-muted-foreground">Vijver Water</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {comparison.sensor2_temp.toFixed(1)}°C
                </div>
                <div className="text-sm text-muted-foreground">Filter Inlaat</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {comparison.temperature_difference.toFixed(1)}°C
                </div>
                <div className="text-sm text-muted-foreground">Verschil</div>
              </div>
            </div>
            
            {comparison.calibration_needed && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Kalibratie Aanbevolen</span>
                </div>
                <p className="text-sm text-yellow-700 mb-2">
                  De temperatuursensoren vertonen een significant verschil. 
                  Aanbevolen offset: {comparison.recommended_offset.toFixed(1)}°C
                </p>
                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Kalibratie Toepassen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual Sensor Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analysis.map((sensor, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getSensorIcon(sensor.sensor_id)}
                  <span>{getSensorName(sensor.sensor_id)}</span>
                </div>
                {getQualityBadge(sensor.data_quality_score)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Data Quality Score */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Data Kwaliteit</span>
                  <span className={`text-lg font-bold ${getQualityColor(sensor.data_quality_score)}`}>
                    {sensor.data_quality_score.toFixed(1)}%
                  </span>
                </div>

                {/* Temperature Statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-xl font-bold text-primary">
                      {sensor.average_temp.toFixed(1)}°C
                    </div>
                    <div className="text-xs text-muted-foreground">Gemiddeld</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-xl font-bold text-orange-600">
                      {sensor.temp_range.toFixed(1)}°C
                    </div>
                    <div className="text-xs text-muted-foreground">Bereik</div>
                  </div>
                </div>

                {/* Reading Statistics */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Totale metingen:</span>
                    <span className="font-medium">{sensor.total_readings}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Geldige metingen:</span>
                    <span className="font-medium text-green-600">{sensor.valid_readings}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ongeldige metingen:</span>
                    <span className="font-medium text-red-600">{sensor.invalid_readings}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Outliers:</span>
                    <span className="font-medium text-orange-600">{sensor.outlier_count}</span>
                  </div>
                </div>

                {/* Temperature Range */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Min temperatuur:</span>
                    <span className="font-medium">{sensor.min_temp.toFixed(1)}°C</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Max temperatuur:</span>
                    <span className="font-medium">{sensor.max_temp.toFixed(1)}°C</span>
                  </div>
                </div>

                {/* Recommendations */}
                {sensor.data_quality_score < 75 && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">Aanbevelingen</span>
                    </div>
                    <ul className="text-xs text-yellow-700 space-y-1">
                      {sensor.outlier_count > 5 && (
                        <li>• Verhoog de outlier drempelwaarde</li>
                      )}
                      {sensor.invalid_readings > sensor.valid_readings * 0.1 && (
                        <li>• Controleer sensor verbinding</li>
                      )}
                      {sensor.temp_range > 10 && (
                        <li>• Verhoog het aantal gladmakende samples</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Statistics */}
      {analysis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Samenvatting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {analysis.reduce((sum, sensor) => sum + sensor.total_readings, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Totale Metingen</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {analysis.reduce((sum, sensor) => sum + sensor.valid_readings, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Geldige Metingen</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {analysis.reduce((sum, sensor) => sum + sensor.outlier_count, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Outliers</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {(analysis.reduce((sum, sensor) => sum + sensor.data_quality_score, 0) / analysis.length).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Gemiddelde Kwaliteit</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


