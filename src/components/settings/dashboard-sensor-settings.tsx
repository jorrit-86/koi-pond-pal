import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Thermometer, RefreshCw } from "lucide-react"
import { useUserPreferences } from "@/hooks/use-user-preferences"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

export const DashboardSensorSettings = () => {
  const { preferences, updatePreferences, loading } = useUserPreferences()
  const { user } = useAuth()
  const [selectedSensor, setSelectedSensor] = useState('sensor_1') // Initialize with default, will be updated by useEffect
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sensorDisplayNames, setSensorDisplayNames] = useState({
    sensor_1: 'Vijver Water Temperatuur',
    sensor_2: 'Filter Inlaat Temperatuur'
  })

  const getSensorDisplayName = (sensorType: string) => {
    switch (sensorType) {
      case 'sensor_1':
        return `${sensorDisplayNames.sensor_1} (Sensor 1)`
      case 'sensor_2':
        return `${sensorDisplayNames.sensor_2} (Sensor 2)`
      case 'latest':
        return 'Meest Recente Sensor'
      default:
        return sensorType
    }
  }

  const loadSensorDisplayNames = async () => {
    if (!user) return

    try {
      
      // First try to get from individual_sensor_configs
      const { data: configData, error: configError } = await supabase
        .from('individual_sensor_configs')
        .select('sensor_type, display_name, sensor_id')
        .eq('user_id', user.id)
        .eq('sensor_type', 'temperatuurmeter')


      const names = {
        sensor_1: 'Vijver Water Temperatuur',
        sensor_2: 'Filter Inlaat Temperatuur'
      }

      // If we have config data, use it
      if (configData && configData.length > 0) {
        configData.forEach(config => {
          if (config.display_name && config.sensor_id) {
            // Use sensor_id to determine if it's sensor 1 or 2
            if (config.sensor_id.endsWith('-01')) {
              names.sensor_1 = config.display_name
            } else if (config.sensor_id.endsWith('-02')) {
              names.sensor_2 = config.display_name
            }
          }
        })
      } else {
        // Fallback: try to get from sensor_data table
        
        const { data: sensorData, error: sensorError } = await supabase
          .from('sensor_data')
          .select('sensor_type, sensor_name, sensor_id')
          .eq('user_id', user.id)
          .eq('sensor_type', 'temperatuurmeter')
          .not('sensor_name', 'is', null)
          .limit(2)


        if (sensorData && sensorData.length > 0) {
          sensorData.forEach(sensor => {
            if (sensor.sensor_name && sensor.sensor_id) {
              // Use sensor_id to determine if it's sensor 1 or 2
              if (sensor.sensor_id.endsWith('-01')) {
                names.sensor_1 = sensor.sensor_name
              } else if (sensor.sensor_id.endsWith('-02')) {
                names.sensor_2 = sensor.sensor_name
              }
            }
          })
        } else {
          // Final fallback: use sensor_id to determine names
          
          const { data: idData, error: idError } = await supabase
            .from('sensor_data')
            .select('sensor_id, sensor_type')
            .eq('user_id', user.id)
            .eq('sensor_type', 'temperatuurmeter')
            .limit(2)


          if (idData && idData.length > 0) {
            idData.forEach(sensor => {
              // Use sensor_id to determine if it's sensor 1 or 2
              if (sensor.sensor_id && sensor.sensor_id.endsWith('-01')) {
                names.sensor_1 = 'Vijver Water Temperatuur'
              } else if (sensor.sensor_id && sensor.sensor_id.endsWith('-02')) {
                names.sensor_2 = 'Filter Inlaat Temperatuur'
              }
            })
          }
        }
      }

      setSensorDisplayNames(names)
    } catch (error) {
      console.error('Error loading sensor display names:', error)
    }
  }

  useEffect(() => {
    loadSensorDisplayNames()
    
  }, [user])

  // Initialize selectedSensor when preferences are first loaded
  useEffect(() => {
    if (!loading && preferences.dashboard_sensor_selection) {
      setSelectedSensor(preferences.dashboard_sensor_selection)
    }
  }, [loading, preferences.dashboard_sensor_selection])

  // Sync selectedSensor with preferences when they change
  useEffect(() => {
    setSelectedSensor(preferences.dashboard_sensor_selection)
  }, [preferences.dashboard_sensor_selection])

  // Auto-refresh display names when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSensorDisplayNames()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadSensorDisplayNames()
      toast.success("Display namen bijgewerkt!")
    } catch (error) {
      console.error('Error refreshing display names:', error)
      toast.error("Fout bij bijwerken van display namen")
    } finally {
      setRefreshing(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const success = await updatePreferences({
        dashboard_sensor_selection: selectedSensor
      })
      
      if (success) {
        toast.success("Dashboard sensor instelling opgeslagen!")
      } else {
        toast.error("Fout bij opslaan van instelling")
      }
    } catch (error) {
      console.error('Error saving dashboard sensor setting:', error)
      toast.error("Fout bij opslaan van instelling")
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Dashboard Sensor Instelling
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Bijwerken...' : 'Bijwerken'}
            </Button>
          </CardTitle>
          <CardDescription>
            Kies welke sensor wordt weergegeven in de bovenste temperatuur kaart op het dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Laden...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Dashboard Sensor Instelling
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Bijwerken...' : 'Bijwerken'}
            </Button>
          </CardTitle>
          <CardDescription>
            Kies welke sensor wordt weergegeven in de bovenste temperatuur kaart op het dashboard
          </CardDescription>
        </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Sensor Selectie</label>
          <Select value={selectedSensor} onValueChange={setSelectedSensor}>
            <SelectTrigger>
              <SelectValue placeholder="Selecteer een sensor" />
            </SelectTrigger>
                   <SelectContent className="z-50">
                     <SelectItem value="sensor_1">
                       {getSensorDisplayName('sensor_1')}
                     </SelectItem>
                     <SelectItem value="sensor_2">
                       {getSensorDisplayName('sensor_2')}
                     </SelectItem>
                     <SelectItem value="latest">
                       {getSensorDisplayName('latest')}
                     </SelectItem>
                   </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          <p><strong>{sensorDisplayNames.sensor_1}:</strong> Toont altijd de temperatuur van Sensor 1</p>
          <p><strong>{sensorDisplayNames.sensor_2}:</strong> Toont altijd de temperatuur van Sensor 2</p>
          <p><strong>Meest Recente Sensor:</strong> Toont de temperatuur van de sensor met de meest recente meting</p>
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleSave} 
            disabled={saving || selectedSensor === preferences.dashboard_sensor_selection}
            className="w-full"
          >
            {saving ? "Opslaan..." : "Instelling Opslaan"}
          </Button>
          
        </div>
      </CardContent>
    </Card>
  )
}
