import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Thermometer, Settings, Save, RotateCcw, Clock } from "lucide-react"
import { IndividualSensorConfig } from "@/types/esp32-config"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface IndividualSensorConfigProps {
  sensorId: string
  sensorType: string
  config: IndividualSensorConfig
  onConfigUpdate: (sensorId: string, sensorType: string, config: IndividualSensorConfig) => void
}

export function IndividualSensorConfigComponent({ 
  sensorId, 
  sensorType, 
  config, 
  onConfigUpdate 
}: IndividualSensorConfigProps) {
  const { user } = useAuth()
  const [localConfig, setLocalConfig] = useState<IndividualSensorConfig>(config)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [latestReading, setLatestReading] = useState<any>(null)

  // Load configuration from database on component mount
  useEffect(() => {
    loadConfigFromDatabase()
    loadLatestReading()
  }, [sensorId, sensorType])

  // Auto-refresh latest reading every 2 minutes
  useEffect(() => {
    const interval = setInterval(loadLatestReading, 120000) // 2 minutes
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

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error loading config from database:', error)
        return
      }

      if (data) {
        const dbConfig: IndividualSensorConfig = {
          sensor_id: data.sensor_id,
          sensor_type: data.sensor_type,
          device_id: data.device_id,
          display_name: data.display_name,
          temperature_offset: data.temperature_offset,
          temperature_scale: data.temperature_scale,
          enabled: data.enabled
        }
        setLocalConfig(dbConfig)
        console.log('Loaded config from database:', dbConfig)
      } else {
        // If no data found, use the passed config as default
        setLocalConfig(config)
        console.log('No database config found, using default config:', config)
      }
    } catch (error) {
      console.error('Error loading config:', error)
      // Fallback to passed config if database fails
      setLocalConfig(config)
    } finally {
      setLoading(false)
    }
  }

  const loadLatestReading = async () => {
    if (!user) return

    try {
      // Use the sensor_type directly (already in correct format)
      const dbSensorType = sensorType

      const { data, error } = await supabase
        .from('sensor_data')
        .select('temperature, created_at, sensor_type')
        .eq('sensor_id', sensorId)
        .eq('sensor_type', dbSensorType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error loading latest reading:', error)
        return
      }

      setLatestReading(data)
    } catch (error) {
      console.error('Error loading latest reading:', error)
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

  const handleConfigChange = (field: keyof IndividualSensorConfig, value: any) => {
    const newConfig = { ...localConfig, [field]: value }
    setLocalConfig(newConfig)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    console.log('Starting save process...')
    console.log('Sensor ID:', sensorId)
    console.log('Sensor Type:', sensorType)
    console.log('Config:', localConfig)

    try {
      // First try to update existing record
      console.log('Attempting UPDATE with:', {
        sensor_id: sensorId,
        sensor_type: sensorType,
        user_id: user.id
      })
      
      // Check current user context
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      console.log('Current Supabase user:', currentUser)
      
      // Use UPSERT instead of UPDATE/INSERT
      const upsertData: any = {
        sensor_id: sensorId,
        sensor_type: sensorType,
        device_id: config.device_id,
        display_name: localConfig.display_name,
        temperature_offset: localConfig.temperature_offset,
        temperature_scale: localConfig.temperature_scale,
        enabled: localConfig.enabled,
        updated_at: new Date().toISOString()
      }

      // Try to upsert without user_id first
      const { data, error } = await supabase
        .from('individual_sensor_configs')
        .upsert(upsertData, {
          onConflict: 'sensor_id,sensor_type'
        })
        .select()

      console.log('UPSERT result:', { data, error })

      if (error) {
        console.error('Supabase Error:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      console.log('Save result:', data)

      // Reload config from database to ensure we have the latest data
      await loadConfigFromDatabase()

      // Update parent component
      onConfigUpdate(sensorId, sensorType, localConfig)
      setHasChanges(false)
      
      // Show success message
      alert('Sensor configuratie succesvol opgeslagen!')
    } catch (error) {
      console.error('Error saving sensor configuration:', error)
      alert(`Fout bij opslaan: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalConfig(config)
    setHasChanges(false)
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

  const getSensorDescription = (sensorType: string) => {
    switch (sensorType) {
      case 'vijver_water':
        return 'Sensor 1 - Temperatuursensor voor het vijver water'
      case 'filter_inlaat':
        return 'Sensor 2 - Temperatuursensor voor de filter inlaat'
      default:
        return 'Temperatuursensor configuratie'
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Laden van sensor configuratie...</p>
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
            <span className="text-xl font-semibold">{sensorId.endsWith('-01') ? 'Sensor 1' : 'Sensor 2'}</span>
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
          {getSensorDescription(sensorType)}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status Indicator */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${latestReading ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {latestReading ? 'Actief' : 'Geen data'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {latestReading ? `Laatste meting: ${new Date(latestReading.created_at).toLocaleString('nl-NL')}` : 'Geen recente metingen'}
          </div>
        </div>

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
          <p className="text-xs text-muted-foreground">
            Deze naam wordt getoond in de app interface
          </p>
        </div>

        <Separator />

        {/* Temperature Calibration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <h4 className="font-medium">Temperatuur Kalibratie</h4>
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
