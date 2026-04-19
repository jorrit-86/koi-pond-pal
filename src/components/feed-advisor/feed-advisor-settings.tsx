import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Settings, Thermometer, RefreshCw, Utensils } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'

interface SensorData {
  pondTemp: number | null
  ambientTemp: number | null
  pondSensorConnected: boolean
  ambientSensorConnected: boolean
  lastUpdate: string | null
}

interface FeedAdvisorSettingsProps {
  onNavigate: (tab: string) => void
}

export function FeedAdvisorSettings({ onNavigate }: FeedAdvisorSettingsProps) {
  const { t } = useTranslation()
  const { user, session } = useAuth()
  const [sensorData, setSensorData] = useState<SensorData>({
    pondTemp: null,
    ambientTemp: null,
    pondSensorConnected: false,
    ambientSensorConnected: false,
    lastUpdate: null
  })
  const [sensorLoading, setSensorLoading] = useState(false)
  const [sensorError, setSensorError] = useState<string | null>(null)
  
  // Sensor selection states
  const [selectedPondSensor, setSelectedPondSensor] = useState<string>('')
  const [selectedAmbientSensor, setSelectedAmbientSensor] = useState<string>('')
  const [availableSensors, setAvailableSensors] = useState<Array<{id: string, name: string}>>([])
  
  // Feed choice states
  const [selectedFeedBrand, setSelectedFeedBrand] = useState<string>('')
  const [availableFeedBrands, setAvailableFeedBrands] = useState<Array<{merk: string, rendement: number, type: string}>>([])
  
  // Calculation preference state
  const [calculationPreference, setCalculationPreference] = useState<'stable' | 'current'>('stable')

  // Load feed brands from Supabase database
  const loadFeedBrands = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      
      const { data, error } = await supabase
        .from('feed_brands')
        .select('merk, rendement, type, eiwit, vet, description')
        .order('merk', { ascending: true })

      if (error) {
        console.error('Error loading feed brands:', error)
        // Fallback to local database if database is empty or error
        const { FEED_BRAND_DATABASE } = await import('@/lib/feed-brand-database')
        setAvailableFeedBrands(FEED_BRAND_DATABASE)
        return
      }

      // If no data from database, use local fallback
      if (!data || data.length === 0) {
        console.log('No data from database, using local fallback')
        const { FEED_BRAND_DATABASE } = await import('@/lib/feed-brand-database')
        setAvailableFeedBrands(FEED_BRAND_DATABASE)
      } else {
        console.log('Loaded feed brands from database:', data.length, 'brands')
        setAvailableFeedBrands(data)
      }
    } catch (error) {
      console.error('Error in loadFeedBrands:', error)
      // Fallback to local database
      const { FEED_BRAND_DATABASE } = await import('@/lib/feed-brand-database')
      setAvailableFeedBrands(FEED_BRAND_DATABASE)
    }
  }

  // Load sensor data
  const loadSensorData = async () => {
    if (!user || !user.id) {
      setSensorError('Gebruiker niet ingelogd')
      setSensorLoading(false)
      return
    }

    try {
      setSensorLoading(true)
      setSensorError(null)

      const { supabase } = await import('@/lib/supabase')
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let tempData: any[] = []
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading sensor data for settings using direct fetch with access token...')
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
          setSensorError('Fout bij laden van temperatuurdata')
          setSensorLoading(false)
          return
        }

        tempData = tempDataResult || []
      }

      if (!tempData || tempData.length === 0) {
        setSensorError('Geen temperatuurdata gevonden')
        setSensorLoading(false)
        return
      }

      // Group sensors by sensor_id to get the latest reading from each sensor
      const sensorMap = new Map()
      tempData.forEach(sensor => {
        if (!sensorMap.has(sensor.sensor_id) || 
            new Date(sensor.measurement_time) > new Date(sensorMap.get(sensor.sensor_id).measurement_time)) {
          sensorMap.set(sensor.sensor_id, sensor)
        }
      })
      const uniqueSensors = Array.from(sensorMap.values())

      // Create available sensors list
      const sensors = uniqueSensors.map(sensor => ({
        id: sensor.sensor_id,
        name: sensor.sensor_name || sensor.sensor_id
      }))
      setAvailableSensors(sensors)

      // Find pond and ambient sensors
      let pondSensor = null
      let ambientSensor = null
      let pondTemp = null
      let ambientTemp = null
      let pondSensorConnected = false
      let ambientSensorConnected = false
      let lastUpdate = null

      console.log('Available sensors for selection:', uniqueSensors.map(s => ({
        id: s.sensor_id,
        name: s.sensor_name,
        temp: s.temperature,
        time: s.measurement_time
      })))

      // Get saved preferences from localStorage (they should be loaded by now)
      const savedPondSensor = localStorage.getItem('feed-advisor-pond-sensor')
      const savedAmbientSensor = localStorage.getItem('feed-advisor-ambient-sensor')
      
      // Use selected state if available, otherwise use saved preference, otherwise auto-detect
      const pondSensorId = selectedPondSensor || savedPondSensor || ''
      const ambientSensorId = selectedAmbientSensor || savedAmbientSensor || ''
      
      // Try to find sensors - ALWAYS prioritize sensor -01 for pond and -02 for ambient
      if (pondSensorId) {
        pondSensor = uniqueSensors.find(s => s.sensor_id === pondSensorId)
        // Verify it's actually a pond sensor (ends with -01)
        if (pondSensor && !pondSensor.sensor_id.endsWith('-01')) {
          console.warn('Selected pond sensor is not sensor -01, using sensor -01 instead')
          pondSensor = null
        }
        console.log('Pond sensor found by selection:', pondSensor, 'ID:', pondSensorId)
      }
      
      // If no selected sensor or selected sensor is not -01, ALWAYS use sensor -01
      if (!pondSensor) {
        pondSensor = uniqueSensors.find(s => s.sensor_id.endsWith('-01'))
        if (pondSensor) {
          console.log('Using sensor -01 for vijverwatertemperatuur:', pondSensor.sensor_id)
        } else {
          console.warn('Sensor -01 (vijverwatertemperatuur) not found')
        }
      }

      if (ambientSensorId) {
        ambientSensor = uniqueSensors.find(s => s.sensor_id === ambientSensorId)
        // Verify it's actually an ambient sensor (ends with -02)
        if (ambientSensor && !ambientSensor.sensor_id.endsWith('-02')) {
          console.warn('Selected ambient sensor is not sensor -02, using sensor -02 instead')
          ambientSensor = null
        }
        console.log('Ambient sensor found by selection:', ambientSensor, 'ID:', ambientSensorId)
      }
      
      // If no selected sensor or selected sensor is not -02, ALWAYS use sensor -02
      if (!ambientSensor) {
        ambientSensor = uniqueSensors.find(s => s.sensor_id.endsWith('-02'))
        if (ambientSensor) {
          console.log('Using sensor -02 for buitentemperatuur:', ambientSensor.sensor_id)
        } else {
          console.warn('Sensor -02 (buitentemperatuur) not found')
        }
      }

      // Allow same sensor for both if that's what the user wants
      // The user can now select the same sensor for both pond and ambient if needed

      if (pondSensor) {
        pondTemp = pondSensor.temperature
        pondSensorConnected = true
        lastUpdate = pondSensor.measurement_time
        console.log('Pond sensor data:', { temp: pondTemp, connected: pondSensorConnected })
      }

      if (ambientSensor) {
        ambientTemp = ambientSensor.temperature
        ambientSensorConnected = true
        if (!lastUpdate || new Date(ambientSensor.measurement_time) > new Date(lastUpdate)) {
          lastUpdate = ambientSensor.measurement_time
        }
        console.log('Ambient sensor data:', { temp: ambientTemp, connected: ambientSensorConnected })
      }

      // Only use same sensor as fallback if we truly have only one sensor
      if (uniqueSensors.length === 1 && pondSensorConnected && !ambientSensorConnected) {
        console.log('Using single sensor for both pond and ambient')
        ambientTemp = pondTemp
        ambientSensorConnected = true
      }

      setSensorData({
        pondTemp,
        ambientTemp,
        pondSensorConnected,
        ambientSensorConnected,
        lastUpdate
      })

      // Auto-select sensors if not already selected (only if no saved preference)
      if (!selectedPondSensor && !savedPondSensor && pondSensor) {
        setSelectedPondSensor(pondSensor.sensor_id)
        localStorage.setItem('feed-advisor-pond-sensor', pondSensor.sensor_id)
        console.log('Auto-selected pond sensor:', pondSensor.sensor_id)
      } else if (savedPondSensor && !selectedPondSensor) {
        // Restore saved preference
        setSelectedPondSensor(savedPondSensor)
      }
      
      if (!selectedAmbientSensor && !savedAmbientSensor && ambientSensor) {
        setSelectedAmbientSensor(ambientSensor.sensor_id)
        localStorage.setItem('feed-advisor-ambient-sensor', ambientSensor.sensor_id)
        console.log('Auto-selected ambient sensor:', ambientSensor.sensor_id)
      } else if (savedAmbientSensor && !selectedAmbientSensor) {
        // Restore saved preference
        setSelectedAmbientSensor(savedAmbientSensor)
      }

    } catch (error) {
      console.error('Error in loadSensorData:', error)
      setSensorError('Fout bij laden van sensordata')
    } finally {
      setSensorLoading(false)
    }
  }

  // Load saved preferences FIRST, before loading sensor data
  useEffect(() => {
    const savedPondSensor = localStorage.getItem('feed-advisor-pond-sensor')
    const savedAmbientSensor = localStorage.getItem('feed-advisor-ambient-sensor')
    const savedFeedBrand = localStorage.getItem('feed-advisor-feed-brand')
    const savedCalculationPreference = localStorage.getItem('feed-advisor-calculation-preference')
    
    if (savedPondSensor) {
      setSelectedPondSensor(savedPondSensor)
    }
    if (savedAmbientSensor) {
      setSelectedAmbientSensor(savedAmbientSensor)
    }
    if (savedFeedBrand) {
      setSelectedFeedBrand(savedFeedBrand)
    }
    if (savedCalculationPreference) {
      setCalculationPreference(savedCalculationPreference as 'stable' | 'current')
    }
  }, [])

  // Load sensor data on mount and when user is available
  useEffect(() => {
    if (user) {
      loadSensorData()
      loadFeedBrands()
    }
  }, [user])

  // Save preferences when they change and reload data
  useEffect(() => {
    if (selectedPondSensor) {
      localStorage.setItem('feed-advisor-pond-sensor', selectedPondSensor)
      // Reload sensor data when selection changes
      loadSensorData()
    }
  }, [selectedPondSensor])

  useEffect(() => {
    if (selectedAmbientSensor) {
      localStorage.setItem('feed-advisor-ambient-sensor', selectedAmbientSensor)
      // Reload sensor data when selection changes
      loadSensorData()
    }
  }, [selectedAmbientSensor])

  useEffect(() => {
    if (selectedFeedBrand) {
      localStorage.setItem('feed-advisor-feed-brand', selectedFeedBrand)
    }
  }, [selectedFeedBrand])

  useEffect(() => {
    localStorage.setItem('feed-advisor-calculation-preference', calculationPreference)
  }, [calculationPreference])

  const formatTimeDifference = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Net nu'
    if (diffMins < 60) return `${diffMins} min geleden`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} uur geleden`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Feed Advisor Instellingen</h1>
          <p className="text-muted-foreground mt-2">
            Configureer sensor instellingen en andere opties voor de Feed Advisor
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => onNavigate('feed-advisor')}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Terug naar Feed Advisor
        </Button>
      </div>

      {/* Sensor Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Sensor Configuratie
          </CardTitle>
          <CardDescription>
            Kies welke sensoren gebruikt moeten worden voor temperatuurmetingen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sensor Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vijver Temperatuur Sensor</Label>
              <div className="flex items-center gap-2">
                <Badge variant={sensorData.pondSensorConnected ? "default" : "secondary"}>
                  {sensorData.pondSensorConnected ? '🟢 Verbonden' : '⚪ Niet verbonden'}
                </Badge>
                {sensorData.pondTemp && (
                  <span className="text-sm text-muted-foreground">
                    {sensorData.pondTemp.toFixed(1)}°C
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Buiten Temperatuur Sensor</Label>
              <div className="flex items-center gap-2">
                <Badge variant={sensorData.ambientSensorConnected ? "default" : "secondary"}>
                  {sensorData.ambientSensorConnected ? '🟢 Verbonden' : '⚪ Niet verbonden'}
                </Badge>
                {sensorData.ambientTemp && (
                  <span className="text-sm text-muted-foreground">
                    {sensorData.ambientTemp.toFixed(1)}°C
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sensor Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pond-sensor">Vijver Sensor</Label>
              {availableSensors.length > 0 ? (
                <Select value={selectedPondSensor} onValueChange={(value) => {
                  setSelectedPondSensor(value)
                  localStorage.setItem('feed-advisor-pond-sensor', value)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer vijver sensor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSensors.map((sensor) => (
                      <SelectItem key={sensor.id} value={sensor.id}>
                        {sensor.name || sensor.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground p-2 border rounded">
                  Geen sensoren beschikbaar. Controleer of er sensordata is.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ambient-sensor">Buiten Sensor</Label>
              {availableSensors.length > 0 ? (
                <Select value={selectedAmbientSensor} onValueChange={(value) => {
                  setSelectedAmbientSensor(value)
                  localStorage.setItem('feed-advisor-ambient-sensor', value)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer buiten sensor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSensors.map((sensor) => (
                      <SelectItem key={sensor.id} value={sensor.id}>
                        {sensor.name || sensor.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground p-2 border rounded">
                  Geen sensoren beschikbaar. Controleer of er sensordata is.
                </div>
              )}
            </div>
          </div>

          {/* Last Update & Refresh */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Laatste update: {sensorData.lastUpdate ? formatTimeDifference(sensorData.lastUpdate) : 'Onbekend'}
            </div>
            <Button 
              onClick={loadSensorData} 
              disabled={sensorLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${sensorLoading ? 'animate-spin' : ''}`} />
              Ververs sensordata
            </Button>
          </div>

          {/* Error Message */}
          {sensorError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{sensorError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feed Choice Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Voerkeuze Configuratie
          </CardTitle>
          <CardDescription>
            Kies welk voermerk gebruikt moet worden voor de berekeningen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed-brand">Voermerk</Label>
            <Select value={selectedFeedBrand} onValueChange={setSelectedFeedBrand}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer voermerk" />
              </SelectTrigger>
              <SelectContent>
                {availableFeedBrands.map((brand) => (
                  <SelectItem key={brand.merk} value={brand.merk}>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{brand.merk}</span>
                      <span className="text-xs text-muted-foreground">
                        {brand.rendement}x
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedFeedBrand && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm mb-2">
                <strong>Geselecteerd voermerk:</strong> {selectedFeedBrand}
              </div>
              
              {/* Show feed properties */}
              {(() => {
                const selectedBrand = availableFeedBrands.find(brand => brand.merk === selectedFeedBrand)
                console.log('Selected brand:', selectedBrand, 'Available brands:', availableFeedBrands)
                if (selectedBrand) {
                  return (
                    <div className="space-y-3">
                      {/* Nutritional values */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">🥩 Eiwit:</span>
                          <span className="font-medium">{selectedBrand.eiwit}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">🧈 Vet:</span>
                          <span className="font-medium">{selectedBrand.vet}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">⚡ Rendement:</span>
                          <span className="font-medium">{selectedBrand.rendement}x</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">🏷️ Type:</span>
                          <span className="font-medium">{selectedBrand.type}</span>
                        </div>
                        {selectedBrand.ruweCelstof && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">🌾 Celstof:</span>
                            <span className="font-medium">{selectedBrand.ruweCelstof}%</span>
                          </div>
                        )}
                        {selectedBrand.ruweAs && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">⚗️ As:</span>
                            <span className="font-medium">{selectedBrand.ruweAs}%</span>
                          </div>
                        )}
                        {selectedBrand.fosfor && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">🧪 Fosfor:</span>
                            <span className="font-medium">{selectedBrand.fosfor}%</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Description */}
                      {selectedBrand.description && (
                        <div className="text-xs text-muted-foreground italic border-t pt-2">
                          {selectedBrand.description}
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              })()}
              
              <div className="text-xs text-muted-foreground mt-2">
                Dit voermerk wordt gebruikt voor alle voeradvies berekeningen
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calculation Preference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Berekening Voorkeur
          </CardTitle>
          <CardDescription>
            Kies welke berekening gebruikt moet worden voor de voerplanner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calculation-preference">Voorkeur Berekening</Label>
            <Select value={calculationPreference} onValueChange={(value: 'stable' | 'current') => setCalculationPreference(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer voorkeur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stable">
                  <div className="flex flex-col">
                    <span className="font-medium">🕒 Stabiel Dagadvies</span>
                    <span className="text-xs text-muted-foreground">
                      Gebaseerd op 3-daags gemiddelde (aanbevolen)
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="current">
                  <div className="flex flex-col">
                    <span className="font-medium">⚡ Actuele Behоefte</span>
                    <span className="text-xs text-muted-foreground">
                      Gebaseerd op huidige omstandigheden
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm mb-2">
              <strong>Huidige voorkeur:</strong> {
                calculationPreference === 'stable' 
                  ? '🕒 Stabiel Dagadvies (3-daags gemiddelde)' 
                  : '⚡ Actuele Behоefte (realtime)'
              }
            </div>
            <div className="text-xs text-muted-foreground">
              {calculationPreference === 'stable' 
                ? 'De voerplanner gebruikt de stabiele 3-daags berekening voor consistente resultaten'
                : 'De voerplanner gebruikt de actuele berekening voor realtime aanpassingen'
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Future Settings Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Toekomstige Instellingen</CardTitle>
          <CardDescription>
            Hier kunnen in de toekomst extra instellingen voor de Feed Advisor worden toegevoegd
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Denk aan: voerprofielen, aangepaste berekeningen, notificaties, en meer.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
