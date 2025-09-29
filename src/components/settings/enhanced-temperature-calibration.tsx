import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { 
  Thermometer, 
  Settings, 
  Save, 
  RotateCcw, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Target,
  Zap
} from "lucide-react"
import { IndividualSensorConfig } from "@/types/esp32-config"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface EnhancedSensorConfig extends IndividualSensorConfig {
  min_valid_temp: number
  max_valid_temp: number
  smoothing_samples: number
  outlier_threshold: number
  auto_calibration_enabled: boolean
  reference_sensor_id?: string
  calibration_offset: number
}

interface EnhancedSensorConfigProps {
  sensorId: string
  sensorType: string
  config: EnhancedSensorConfig
  onConfigUpdate: (sensorId: string, sensorType: string, config: EnhancedSensorConfig) => void
}

export function EnhancedTemperatureCalibration({ 
  sensorId, 
  sensorType, 
  config, 
  onConfigUpdate 
}: EnhancedSensorConfigProps) {
  const { user } = useAuth()
  const [localConfig, setLocalConfig] = useState<EnhancedSensorConfig>(config)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [latestReading, setLatestReading] = useState<any>(null)
  const [dataQuality, setDataQuality] = useState<any>(null)
  const [calibrationRecommendations, setCalibrationRecommendations] = useState<any>(null)

  // Load configuration from database on component mount
  useEffect(() => {
    loadConfigFromDatabase()
    loadLatestReading()
    loadDataQuality()
    loadCalibrationRecommendations()
  }, [sensorId, sensorType])

  // Auto-refresh data every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadLatestReading()
      loadDataQuality()
    }, 120000) // 2 minutes
    return () => clearInterval(interval)
  }, [sensorId, sensorType])

  const loadConfigFromDatabase = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('individual_sensor_configs')
        .select('*')
        .eq('sensor_id', sensorId)
        .eq('sensor_type', sensorType)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading config from database:', error)
        return
      }

      if (data) {
        const dbConfig: EnhancedSensorConfig = {
          sensor_id: data.sensor_id,
          sensor_type: data.sensor_type,
          device_id: data.device_id,
          display_name: data.display_name,
          temperature_offset: data.temperature_offset,
          temperature_scale: data.temperature_scale,
          enabled: data.enabled,
          min_valid_temp: data.min_valid_temp || 0.0,
          max_valid_temp: data.max_valid_temp || 50.0,
          smoothing_samples: data.smoothing_samples || 5,
          outlier_threshold: data.outlier_threshold || 2.0,
          auto_calibration_enabled: data.auto_calibration_enabled || false,
          reference_sensor_id: data.reference_sensor_id,
          calibration_offset: data.calibration_offset || 0.0
        }
        setLocalConfig(dbConfig)
        console.log('Loaded enhanced config from database:', dbConfig)
      } else {
        setLocalConfig(config)
        console.log('No database config found, using default config:', config)
      }
    } catch (error) {
      console.error('Error loading config:', error)
      setLocalConfig(config)
    } finally {
      setLoading(false)
    }
  }

  const loadLatestReading = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('sensor_data')
        .select('temperature, created_at, sensor_type')
        .eq('sensor_id', sensorId)
        .eq('sensor_type', sensorType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading latest reading:', error)
        return
      }

      setLatestReading(data)
    } catch (error) {
      console.error('Error loading latest reading:', error)
    }
  }

  const loadDataQuality = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .rpc('analyze_temperature_quality', {
          sensor_id_param: sensorId,
          days_back: 1
        })

      if (error) {
        console.error('Error loading data quality:', error)
        return
      }

      setDataQuality(data?.[0])
    } catch (error) {
      console.error('Error loading data quality:', error)
    }
  }

  const loadCalibrationRecommendations = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .rpc('get_sensor_calibration_recommendations', {
          target_sensor_id: sensorId
        })

      if (error) {
        console.error('Error loading calibration recommendations:', error)
        return
      }

      setCalibrationRecommendations(data?.[0])
    } catch (error) {
      console.error('Error loading calibration recommendations:', error)
    }
  }

  const formatLatestReading = (reading: any) => {
    if (!reading || !reading.created_at) return 'Geen data beschikbaar'
    
    const now = new Date()
    const readingTime = new Date(reading.created_at)
    const diffMs = now.getTime() - readingTime.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMinutes < 1) return 'Zojuist'
    if (diffMinutes < 60) return `${diffMinutes} min geleden`
    if (diffHours < 24) return `${diffHours} uur geleden`
    return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`
  }

  const handleConfigChange = (field: keyof EnhancedSensorConfig, value: any) => {
    const newConfig = { ...localConfig, [field]: value }
    setLocalConfig(newConfig)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    console.log('Starting enhanced save process...')

    try {
      const upsertData: any = {
        sensor_id: sensorId,
        sensor_type: sensorType,
        device_id: config.device_id,
        display_name: localConfig.display_name,
        temperature_offset: localConfig.temperature_offset,
        temperature_scale: localConfig.temperature_scale,
        enabled: localConfig.enabled,
        min_valid_temp: localConfig.min_valid_temp,
        max_valid_temp: localConfig.max_valid_temp,
        smoothing_samples: localConfig.smoothing_samples,
        outlier_threshold: localConfig.outlier_threshold,
        auto_calibration_enabled: localConfig.auto_calibration_enabled,
        reference_sensor_id: localConfig.reference_sensor_id,
        calibration_offset: localConfig.calibration_offset,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('individual_sensor_configs')
        .upsert(upsertData, {
          onConflict: 'sensor_id,sensor_type'
        })
        .select()

      if (error) {
        console.error('Supabase Error:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      console.log('Enhanced save result:', data)

      await loadConfigFromDatabase()
      onConfigUpdate(sensorId, sensorType, localConfig)
      setHasChanges(false)
      
      alert('Verbeterde sensor configuratie succesvol opgeslagen!')
    } catch (error) {
      console.error('Error saving enhanced sensor configuration:', error)
      alert(`Fout bij opslaan: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalConfig(config)
    setHasChanges(false)
  }

  const applyCalibrationRecommendation = () => {
    if (calibrationRecommendations) {
      handleConfigChange('temperature_offset', calibrationRecommendations.recommended_offset)
      handleConfigChange('calibration_offset', calibrationRecommendations.recommended_offset)
    }
  }

  const getSensorIcon = (sensorType: string) => {
    switch (sensorType) {
      case 'vijver_water':
        return <Thermometer className="h-4 w-4 text-blue-500" />
      case 'filter_inlaat':
        return <Thermometer className="h-4 w-4 text-green-500" />
      default:
        return <Thermometer className="h-4 w-4 text-gray-500" />
    }
  }

  const getDataQualityBadge = (quality: number) => {
    if (quality >= 90) return <Badge className="bg-green-500">Uitstekend</Badge>
    if (quality >= 75) return <Badge className="bg-yellow-500">Goed</Badge>
    if (quality >= 50) return <Badge className="bg-orange-500">Matig</Badge>
    return <Badge className="bg-red-500">Slecht</Badge>
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Laden van verbeterde sensor configuratie...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            {getSensorIcon(sensorType)}
            <span className="text-xl font-semibold">
              {sensorId.endsWith('-01') ? 'Sensor 1' : 'Sensor 2'} - Verbeterde Kalibratie
            </span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {latestReading ? `${latestReading.temperature?.toFixed(1)}°C` : '--°C'}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatLatestReading(latestReading)}
            </div>
          </div>
        </CardTitle>
        <CardDescription>
          Geavanceerde temperatuur kalibratie met automatische correctie en data filtering
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Data Quality Status */}
        {dataQuality && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">Data Kwaliteit</span>
              </div>
              {getDataQualityBadge(dataQuality.data_quality_score)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Geldige metingen:</span>
                <div className="font-medium">{dataQuality.valid_readings}/{dataQuality.total_readings}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Gemiddelde:</span>
                <div className="font-medium">{dataQuality.average_temp?.toFixed(1)}°C</div>
              </div>
              <div>
                <span className="text-muted-foreground">Bereik:</span>
                <div className="font-medium">{dataQuality.temp_range?.toFixed(1)}°C</div>
              </div>
              <div>
                <span className="text-muted-foreground">Outliers:</span>
                <div className="font-medium">{dataQuality.outlier_count}</div>
              </div>
            </div>
          </div>
        )}

        {/* Calibration Recommendations */}
        {calibrationRecommendations && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Kalibratie Aanbeveling</span>
            </div>
            <p className="text-sm text-blue-800 mb-3">
              Aanbevolen offset: {calibrationRecommendations.recommended_offset}°C
            </p>
            <Button 
              onClick={applyCalibrationRecommendation}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              Pas Aanbeveling Toe
            </Button>
          </div>
        )}

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor={`display-name-${sensorType}`}>Display Naam</Label>
          <Input
            id={`display-name-${sensorType}`}
            value={localConfig.display_name}
            onChange={(e) => handleConfigChange('display_name', e.target.value)}
            placeholder="Bijv. Sensor 1 Temperatuur"
            className="w-full"
          />
        </div>

        <Separator />

        {/* Enhanced Temperature Calibration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <h4 className="font-medium">Verbeterde Temperatuur Kalibratie</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`offset-${sensorType}`}>Temperatuur Offset (°C)</Label>
              <Input
                id={`offset-${sensorType}`}
                type="number"
                step="0.1"
                value={localConfig.temperature_offset}
                onChange={(e) => handleConfigChange('temperature_offset', parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Correctie waarde (positief = warmer, negatief = kouder)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`scale-${sensorType}`}>Temperatuur Schaal</Label>
              <Input
                id={`scale-${sensorType}`}
                type="number"
                step="0.01"
                min="0.1"
                max="2.0"
                value={localConfig.temperature_scale}
                onChange={(e) => handleConfigChange('temperature_scale', parseFloat(e.target.value) || 1.0)}
                placeholder="1.0"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Vermenigvuldigingsfactor (1.0 = geen aanpassing)
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Data Filtering Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <h4 className="font-medium">Data Filtering & Validatie</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`min-temp-${sensorType}`}>Minimum Geldige Temperatuur (°C)</Label>
              <Input
                id={`min-temp-${sensorType}`}
                type="number"
                step="0.1"
                value={localConfig.min_valid_temp}
                onChange={(e) => handleConfigChange('min_valid_temp', parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`max-temp-${sensorType}`}>Maximum Geldige Temperatuur (°C)</Label>
              <Input
                id={`max-temp-${sensorType}`}
                type="number"
                step="0.1"
                value={localConfig.max_valid_temp}
                onChange={(e) => handleConfigChange('max_valid_temp', parseFloat(e.target.value) || 50)}
                placeholder="50.0"
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`smoothing-${sensorType}`}>Gladmakende Samples ({localConfig.smoothing_samples})</Label>
            <Slider
              id={`smoothing-${sensorType}`}
              min={1}
              max={20}
              step={1}
              value={[localConfig.smoothing_samples]}
              onValueChange={(value) => handleConfigChange('smoothing_samples', value[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Aantal metingen voor gemiddelde berekening (meer = gladder, maar trager)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`outlier-${sensorType}`}>Outlier Drempelwaarde (°C)</Label>
            <Input
              id={`outlier-${sensorType}`}
              type="number"
              step="0.1"
              value={localConfig.outlier_threshold}
              onChange={(e) => handleConfigChange('outlier_threshold', parseFloat(e.target.value) || 2.0)}
              placeholder="2.0"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Maximum afwijking van gemiddelde voordat meting wordt afgewezen
            </p>
          </div>
        </div>

        <Separator />

        {/* Auto-Calibration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <h4 className="font-medium">Automatische Kalibratie</h4>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor={`auto-cal-${sensorType}`}>Automatische Kalibratie Ingeschakeld</Label>
              <p className="text-xs text-muted-foreground">
                Automatisch kalibreren ten opzichte van referentie sensor
              </p>
            </div>
            <Switch
              id={`auto-cal-${sensorType}`}
              checked={localConfig.auto_calibration_enabled}
              onCheckedChange={(checked) => handleConfigChange('auto_calibration_enabled', checked)}
            />
          </div>

          {localConfig.auto_calibration_enabled && (
            <div className="space-y-2">
              <Label htmlFor={`cal-offset-${sensorType}`}>Kalibratie Offset (°C)</Label>
              <Input
                id={`cal-offset-${sensorType}`}
                type="number"
                step="0.1"
                value={localConfig.calibration_offset}
                onChange={(e) => handleConfigChange('calibration_offset', parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Automatisch toegepaste correctie ten opzichte van referentie sensor
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor={`enabled-${sensorType}`}>Sensor Ingeschakeld</Label>
            <p className="text-xs text-muted-foreground">
              Schakel deze sensor in of uit
            </p>
          </div>
          <Switch
            id={`enabled-${sensorType}`}
            checked={localConfig.enabled}
            onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
          />
        </div>

        {/* Action Buttons */}
        {hasChanges && (
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              size="sm"
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </Button>
            <Button 
              onClick={handleReset} 
              variant="outline" 
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


