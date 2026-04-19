import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Thermometer, Calendar, Filter, Info, Settings } from 'lucide-react'
import { useFeedLogic, KoiFish } from '@/hooks/use-feed-logic'
import { FeedAdvisorTable } from './feed-advisor-table'
import { FeedPlanner } from './feed-planner'
import { InfoModal } from './info-modal'

interface FeedAdvisorProps {
  onNavigate?: (tab: string) => void
}

export function FeedAdvisor({ onNavigate }: FeedAdvisorProps) {
  const { koiList, loading, error, loadKoiData, calculateTotalFeed } = useFeedLogic()
  
  // Input states
  const [pondTemp, setPondTemp] = useState<number>(20)
  const [ambientTemp, setAmbientTemp] = useState<number>(15)
  const [filterStatus, setFilterStatus] = useState<string>('Auto')
  
  // Sensor mode states
  const [usePondSensor, setUsePondSensor] = useState<boolean>(false)
  const [useAmbientSensor, setUseAmbientSensor] = useState<boolean>(false)
  
  // Sensor data state
  const [sensorData, setSensorData] = useState({
    pondTemp: null as number | null,
    ambientTemp: null as number | null,
    pondSensorConnected: false,
    ambientSensorConnected: false,
    lastUpdate: null as string | null
  })
  const [sensorLoading, setSensorLoading] = useState(false)
  const [sensorError, setSensorError] = useState<string | null>(null)
  
  // Local koi list for editing
  const [localKoiList, setLocalKoiList] = useState<KoiFish[]>([])
  
  // Calculation results
  const [calculation, setCalculation] = useState<{
    calculations: any[]
    totalFeed: number
    seasonInfo: any
    feedSchedule: any[]
    noFeeding: boolean
    noFeedingMessage: string
  } | null>(null)

  // Load koi data on mount
  useEffect(() => {
    if (koiList.length > 0) {
      setLocalKoiList(koiList)
    }
  }, [koiList])

  // Load sensor data
  const loadSensorData = async () => {
    try {
      setSensorLoading(true)
      setSensorError(null)

      const { supabase } = await import('@/lib/supabase')
      
      // Get latest temperature data from sensors
      const { data: tempData, error: tempError } = await supabase
        .from('sensor_data')
        .select('sensor_id, temperature, measurement_time, sensor_name, sensor_type')
        .eq('sensor_type', 'temperatuurmeter')
        .order('measurement_time', { ascending: false })
        .limit(20)

      if (tempError) {
        console.error('Error loading temperature data:', tempError)
        setSensorError('Kon sensordata niet laden')
        return
      }

      if (!tempData || tempData.length === 0) {
        setSensorError('Geen temperatuurdata gevonden')
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

      // Load saved sensor preferences
      const savedPondSensor = localStorage.getItem('feed-advisor-pond-sensor')
      const savedAmbientSensor = localStorage.getItem('feed-advisor-ambient-sensor')

      // Find pond and ambient sensors
      let pondSensor = null
      let ambientSensor = null
      let pondTemp = null
      let ambientTemp = null
      let pondSensorConnected = false
      let ambientSensorConnected = false
      let lastUpdate = null

      // Try to find sensors based on saved preferences or auto-detect
      if (savedPondSensor) {
        pondSensor = uniqueSensors.find(s => s.sensor_id === savedPondSensor)
      } else {
        // Auto-detect pond sensor
        pondSensor = uniqueSensors.find(s => 
          s.sensor_id.includes('-01') || 
          s.sensor_id.includes('KOIoT') ||
          s.sensor_name?.toLowerCase().includes('vijver') ||
          s.sensor_name?.toLowerCase().includes('pond')
        )
      }

      if (savedAmbientSensor) {
        ambientSensor = uniqueSensors.find(s => s.sensor_id === savedAmbientSensor)
      } else {
        // Auto-detect ambient sensor
        ambientSensor = uniqueSensors.find(s => 
          s.sensor_id.includes('-02') ||
          s.sensor_name?.toLowerCase().includes('buiten') ||
          s.sensor_name?.toLowerCase().includes('ambient')
        )
      }

      // Ensure we don't use the same sensor for both
      if (pondSensor && ambientSensor && pondSensor.sensor_id === ambientSensor.sensor_id) {
        if (uniqueSensors.length > 1) {
          const sortedSensors = uniqueSensors.sort((a, b) => 
            new Date(b.measurement_time).getTime() - new Date(a.measurement_time).getTime()
          )
          if (sortedSensors.length >= 2) {
            pondSensor = sortedSensors[0]
            ambientSensor = sortedSensors[1]
          }
        }
      }

      if (pondSensor) {
        pondTemp = pondSensor.temperature
        pondSensorConnected = true
        lastUpdate = pondSensor.measurement_time
      }

      if (ambientSensor) {
        ambientTemp = ambientSensor.temperature
        ambientSensorConnected = true
        if (!lastUpdate || new Date(ambientSensor.measurement_time) > new Date(lastUpdate)) {
          lastUpdate = ambientSensor.measurement_time
        }
      }

      setSensorData({
        pondTemp,
        ambientTemp,
        pondSensorConnected,
        ambientSensorConnected,
        lastUpdate
      })

    } catch (error) {
      console.error('Error in loadSensorData:', error)
      setSensorError('Fout bij laden van sensordata')
    } finally {
      setSensorLoading(false)
    }
  }

  // Load sensor data on mount
  useEffect(() => {
    loadSensorData()
  }, [])

  // Update temperatures when sensor data changes
  useEffect(() => {
    if (usePondSensor && sensorData.pondTemp !== null) {
      setPondTemp(sensorData.pondTemp)
    }
    if (useAmbientSensor && sensorData.ambientTemp !== null) {
      setAmbientTemp(sensorData.ambientTemp)
    }
  }, [sensorData, usePondSensor, useAmbientSensor])

  // Auto-enable sensor mode if sensors are connected
  useEffect(() => {
    if (sensorData.pondSensorConnected) {
      setUsePondSensor(true)
    }
    if (sensorData.ambientSensorConnected) {
      setUseAmbientSensor(true)
    }
  }, [sensorData.pondSensorConnected, sensorData.ambientSensorConnected])

  // Recalculate when inputs change
  useEffect(() => {
    if (localKoiList.length > 0) {
      const result = calculateTotalFeed(
        localKoiList,
        pondTemp,
        ambientTemp,
        filterStatus,
        new Date()
      )
      setCalculation(result)
    }
  }, [localKoiList, pondTemp, ambientTemp, filterStatus, calculateTotalFeed])

  const getTemperatureStatus = (temp: number) => {
    if (temp < 6) return { status: 'critical', label: 'Geen voeren', color: 'text-red-600' }
    if (temp < 8) return { status: 'warning', label: 'Beperkt voeren', color: 'text-orange-600' }
    if (temp < 15) return { status: 'warning', label: 'Koud', color: 'text-blue-600' }
    if (temp < 20) return { status: 'good', label: 'Matig', color: 'text-green-600' }
    if (temp <= 28) return { status: 'excellent', label: 'Ideaal', color: 'text-green-600' }
    return { status: 'warning', label: 'Te warm', color: 'text-orange-600' }
  }

  const pondTempStatus = getTemperatureStatus(pondTemp)
  const ambientTempStatus = getTemperatureStatus(ambientTemp)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feed Advisor</h1>
          <p className="text-muted-foreground">
            Bereken het optimale dagvoer voor je koi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate?.('feed-advisor-settings')}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Instellingen
          </Button>
          <InfoModal />
        </div>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Omgevingsfactoren
          </CardTitle>
          <CardDescription>
            Voer de huidige omstandigheden in voor een nauwkeurig advies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pond Temperature */}
            <div className="space-y-2">
              <Label htmlFor="pond-temp" className="flex items-center gap-2">
                Vijvertemperatuur
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsePondSensor(!usePondSensor)}
                  className="h-6 px-2 text-xs"
                >
                  {sensorData.pondSensorConnected && usePondSensor ? '🟢 Sensor' : '⚪ Handmatig'}
                </Button>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pond-temp"
                  type="number"
                  value={pondTemp}
                  onChange={(e) => setPondTemp(parseFloat(e.target.value) || 0)}
                  className="flex-1"
                  min="0"
                  max="40"
                  step="0.1"
                  disabled={usePondSensor && sensorData.pondSensorConnected}
                  placeholder={usePondSensor && sensorData.pondSensorConnected ? "Van sensor" : "Handmatig invoeren"}
                />
                <span className="text-sm text-muted-foreground">°C</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${pondTempStatus.color}`}>
                  {pondTempStatus.label}
                </span>
                {usePondSensor && sensorData.pondSensorConnected && (
                  <span className="text-xs text-muted-foreground">
                    Van sensor
                  </span>
                )}
              </div>
            </div>

            {/* Ambient Temperature */}
            <div className="space-y-2">
              <Label htmlFor="ambient-temp" className="flex items-center gap-2">
                Buitentemperatuur
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseAmbientSensor(!useAmbientSensor)}
                  className="h-6 px-2 text-xs"
                >
                  {sensorData.ambientSensorConnected && useAmbientSensor ? '🟢 Sensor' : '⚪ Handmatig'}
                </Button>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ambient-temp"
                  type="number"
                  value={ambientTemp}
                  onChange={(e) => setAmbientTemp(parseFloat(e.target.value) || 0)}
                  className="flex-1"
                  min="-10"
                  max="40"
                  step="0.1"
                  disabled={useAmbientSensor && sensorData.ambientSensorConnected}
                  placeholder={useAmbientSensor && sensorData.ambientSensorConnected ? "Van sensor" : "Handmatig invoeren"}
                />
                <span className="text-sm text-muted-foreground">°C</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${ambientTempStatus.color}`}>
                  {ambientTempStatus.label}
                </span>
                {useAmbientSensor && sensorData.ambientSensorConnected && (
                  <span className="text-xs text-muted-foreground">
                    Van sensor
                  </span>
                )}
              </div>
            </div>

            {/* Date & Season */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Datum & Seizoen
              </Label>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium">
                  {new Date().toLocaleDateString('nl-NL', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                {calculation && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg">{calculation.seasonInfo.emoji}</span>
                    <span className="text-sm text-muted-foreground">
                      {calculation.seasonInfo.label}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Filter Status & Sensor Actions */}
            <div className="space-y-4">
              {/* Filter Status */}
              <div className="space-y-2">
                <Label htmlFor="filter-status" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filterstatus
                </Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Auto">Auto (aanbevolen)</SelectItem>
                    <SelectItem value="Voorjaar (opstartend)">Voorjaar (opstartend)</SelectItem>
                    <SelectItem value="Actief">Actief</SelectItem>
                    <SelectItem value="Rust">Rust</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sensor Actions */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sensor acties</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSensorData}
                  disabled={sensorLoading}
                  className="w-full flex items-center gap-2"
                >
                  {sensorLoading ? 'Laden...' : 'Ververs sensordata'}
                </Button>
              </div>

            </div>
          </div>

          {/* Sensor Error */}
          {sensorError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {sensorError}
              </p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Results Section */}
      {calculation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Koi Table */}
          <FeedAdvisorTable
            koiList={localKoiList}
            calculations={calculation.calculations}
            totalFeed={calculation.totalFeed}
            noFeeding={calculation.noFeeding}
            noFeedingMessage={calculation.noFeedingMessage}
          />

          {/* Feed Planner */}
          <FeedPlanner
            feedSchedule={calculation.feedSchedule}
            totalFeed={calculation.totalFeed}
            temperature={pondTemp}
            seasonInfo={calculation.seasonInfo}
            noFeeding={calculation.noFeeding}
            noFeedingMessage={calculation.noFeedingMessage}
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Koi data laden...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <CardContent className="p-6">
            <p className="text-red-600 dark:text-red-400">
              Fout bij laden van koi data: {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* No Koi State */}
      {!loading && !error && localKoiList.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Er zijn nog geen koi in je collectie. Voeg ze toe via de pagina 'Mijn Koi Collectie' om een voeradvies te ontvangen.
              </p>
              <Button 
                onClick={() => onNavigate?.('koi')}
                variant="outline"
              >
                Naar Koi Collectie
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}