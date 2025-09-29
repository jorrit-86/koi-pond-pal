import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useSensorManagement, UserSensor, SensorTransferRequest } from "@/hooks/use-sensor-management"
import { useKOIoTConfig } from "@/hooks/use-esp32-config"
import { useTranslation } from "react-i18next"
import { Wifi, WifiOff, Plus, Trash2, AlertTriangle, CheckCircle, XCircle, Clock, Settings, Bell, Thermometer, Power, Bug, ChevronDown, ChevronRight } from "lucide-react"
import { IndividualSensorConfigComponent } from "./individual-sensor-config"
import { IndividualSensorConfig } from "@/types/esp32-config"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ErrorBoundary } from "@/components/ErrorBoundary"
// import { SensorTransferDialog } from "./sensor-transfer-dialog"
// import { SensorStatusCard } from "./sensor-status-card"

export function KOIoTSettings() {
  const { t } = useTranslation()
  const {
    sensors,
    transferRequests,
    loading,
    error,
    addSensor,
    removeSensor,
    respondToTransferRequest,
    updateSensorName,
    refreshSensors,
    refreshTransferRequests
  } = useSensorManagement()

  const {
    sensors: configSensors,
    loading: configLoading,
    error: configError,
    updateSensorConfiguration,
    requestSensorRestart,
    formatMeasurementInterval,
    validateConfiguration,
    getSensorDisplayName,
    formatLatestReading
  } = useKOIoTConfig()

  const [newSensorId, setNewSensorId] = useState("")
  const [newSensorName, setNewSensorName] = useState("")
  const [isAddingSensor, setIsAddingSensor] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSensor, setEditingSensor] = useState<UserSensor | null>(null)
  const [editingName, setEditingName] = useState("")
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [expandedSensors, setExpandedSensors] = useState<Record<string, boolean>>({})
  const [individualSensorConfigs, setIndividualSensorConfigs] = useState<Record<string, Record<string, IndividualSensorConfig>>>({})
  
  // Configuration state
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [configFormData, setConfigFormData] = useState({
    measurement_interval: 300,
    wifi_ssid: '',
    wifi_password: '',
    wifi_auto_connect: true,
    temperature_offset: 0.0,
    temperature_scale: 1.0,
    deep_sleep_enabled: false,
    deep_sleep_duration: 3600,
    debug_mode: false,
    log_level: 'info' as 'error' | 'warn' | 'info' | 'debug'
  })
  const [savingConfig, setSavingConfig] = useState(false)

  const handleAddSensor = async () => {
    if (!newSensorId.trim()) {
      toast.error("Sensor ID is verplicht")
      return
    }

    // Validate sensor ID format (should be 6 characters after KOIoT-)
    if (newSensorId.length !== 6) {
      toast.error("Sensor ID moet 6 tekens zijn (letters, cijfers, leestekens)")
      return
    }

    setIsAddingSensor(true)
    try {
      const fullSensorId = `KOIoT-${newSensorId.trim()}`
      const result = await addSensor(fullSensorId, newSensorName.trim() || undefined)
      
      if (result.success) {
        toast.success("Sensor succesvol toegevoegd!")
        setNewSensorId("")
        setNewSensorName("")
        setShowAddDialog(false)
      } else if (result.requiresTransfer) {
        toast.info(result.error)
        setNewSensorId("")
        setNewSensorName("")
        setShowAddDialog(false)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het toevoegen van de sensor")
    } finally {
      setIsAddingSensor(false)
    }
  }

  const handleRemoveSensor = async (sensorId: string) => {
    if (!confirm("Weet je zeker dat je deze sensor wilt verwijderen?")) {
      return
    }

    try {
      const result = await removeSensor(sensorId)
      if (result.success) {
        toast.success("Sensor succesvol verwijderd!")
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het verwijderen van de sensor")
    }
  }

  const handleRespondToTransfer = async (request: SensorTransferRequest, accept: boolean) => {
    try {
      const result = await respondToTransferRequest(
        request.id,
        request.sensor_id,
        request.from_user_id,
        request.to_user_id,
        accept
      )
      
      if (result.success) {
        toast.success(accept ? "Transfer verzoek geaccepteerd!" : "Transfer verzoek geweigerd!")
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het verwerken van het transfer verzoek")
    }
  }

  const handleUpdateSensorName = async (sensorId: string, newName: string) => {
    try {
      const result = await updateSensorName(sensorId, newName)
      if (result.success) {
        toast.success("Sensor naam bijgewerkt!")
        setEditingSensor(null)
        setEditingName("")
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het bijwerken van de sensor naam")
    }
  }

  // Configuration functions
  const handleEditConfig = (sensorId: string) => {
    const sensor = configSensors.find(s => s.sensor_id === sensorId)
    if (sensor) {
      setEditingConfig(sensorId)
      setConfigFormData({
        measurement_interval: sensor.measurement_interval || 300,
        wifi_ssid: sensor.wifi_ssid || '',
        wifi_password: sensor.wifi_password || '',
        wifi_auto_connect: sensor.wifi_auto_connect || true,
        temperature_offset: sensor.temperature_offset || 0.0,
        temperature_scale: sensor.temperature_scale || 1.0,
        deep_sleep_enabled: sensor.deep_sleep_enabled || false,
        deep_sleep_duration: sensor.deep_sleep_duration || 3600,
        debug_mode: sensor.debug_mode || false,
        log_level: sensor.log_level || 'info'
      })
    }
  }

  const handleSaveConfig = async (sensorId: string) => {
    const errors = validateConfiguration(configFormData)
    if (errors.length > 0) {
      toast.error(errors.join(', '))
      return
    }

    setSavingConfig(true)
    try {
      await updateSensorConfiguration(sensorId, configFormData)
      setEditingConfig(null)
      toast.success('Configuratie opgeslagen! ESP32 zal de nieuwe instellingen ophalen bij de volgende verbinding.')
    } catch (err: any) {
      toast.error('Fout bij opslaan configuratie: ' + err.message)
    } finally {
      setSavingConfig(false)
    }
  }

  const handleRequestRestart = async (sensorId: string) => {
    try {
      await requestSensorRestart(sensorId)
      toast.success('Herstart aangevraagd! De ESP32 zal binnenkort herstarten.')
    } catch (error: any) {
      toast.error(`Fout bij aanvragen herstart: ${error.message}`)
    }
  }

  const handleIndividualSensorConfigUpdate = (sensorId: string, sensorType: string, config: IndividualSensorConfig) => {
    setIndividualSensorConfigs(prev => ({
      ...prev,
      [sensorId]: {
        ...prev[sensorId],
        [sensorType]: config
      }
    }))
    
    // Show success message
    toast.success(`Sensor configuratie voor ${config.display_name} opgeslagen!`)
  }

  const toggleSensorExpansion = (sensorId: string) => {
    setExpandedSensors(prev => ({
      ...prev,
      [sensorId]: !prev[sensorId]
    }))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Wifi className="h-4 w-4 text-green-600" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-600" />
      case 'pending_transfer':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'transferred':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Online</Badge>
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>
      case 'pending_transfer':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Transfer</Badge>
      case 'transferred':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Overgedragen</Badge>
      default:
        return <Badge variant="outline">Onbekend</Badge>
    }
  }

  if (loading || configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Sensoren laden...</p>
        </div>
      </div>
    )
  }


  // Show error if there's a critical error
  if (error || configError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">KOIoT Sensoren</h1>
          <p className="text-muted-foreground">Beheer je IoT sensoren voor automatische waterkwaliteit monitoring</p>
        </div>
        
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2">Fout bij laden van sensoren</h3>
          <p className="text-red-700 text-sm mb-2">Er is een fout opgetreden bij het laden van de sensor gegevens:</p>
          <p className="text-red-600 text-xs font-mono">{error || configError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Pagina Herladen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">KOIoT Sensoren</h1>
        <p className="text-muted-foreground">Beheer je IoT sensoren voor automatische waterkwaliteit monitoring</p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Sensor Toevoegen
            </Button>
          </DialogTrigger>
        </Dialog>
        
        {transferRequests.length > 0 && (
          <Button 
            variant="outline" 
            onClick={() => setShowTransferDialog(true)}
            className="w-full sm:w-auto"
          >
            <Bell className="h-4 w-4 mr-2" />
            Transfer Verzoeken ({transferRequests.length})
          </Button>
        )}
      </div>

      {/* Add Sensor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Sensor Toevoegen</DialogTitle>
            <DialogDescription>
              Voer de unieke sensor ID in die op je ESP32 staat geprogrammeerd.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sensorId">Sensor ID</Label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">KOIoT-</span>
                <Input
                  id="sensorId"
                  placeholder="A1b2C3"
                  value={newSensorId}
                  onChange={(e) => setNewSensorId(e.target.value)}
                  maxLength={6}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Voer de 6 tekens in na "KOIoT-" (letters, cijfers, leestekens)
              </p>
            </div>
            <div>
              <Label htmlFor="sensorName">Sensor Naam (optioneel)</Label>
              <Input
                id="sensorName"
                placeholder="Bijv. Vijver Sensor, Filter Sensor"
                value={newSensorName}
                onChange={(e) => setNewSensorName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleAddSensor} disabled={isAddingSensor}>
              {isAddingSensor ? "Toevoegen..." : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sensors List */}
      <div className="grid gap-4">
        {configSensors.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Wifi className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Geen sensoren gekoppeld</h3>
                <p className="text-muted-foreground mb-4">
                  Voeg je eerste KOIoT sensor toe om automatische waterkwaliteit monitoring te starten.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Eerste Sensor Toevoegen
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {configSensors.map((device) => (
              <div key={device.sensor_id} className="space-y-2">
                {/* Sensor Status Card - Temporarily disabled */}
                {/* <SensorStatusCard 
                  sensorId={device.sensor_id} 
                  sensorName={sensor.sensor_name || undefined}
                /> */}
                
                {/* Sensor Management Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon('active')}
                        <div>
                          <CardTitle className="text-lg">
                            {editingSensor?.id === device.sensor_id ? (
                              <div className="flex items-center space-x-2">
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="h-8 w-48"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateSensorName(device.sensor_id, editingName)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingSensor(null)
                                    setEditingName("")
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span>{device.sensor_name || device.sensor_id}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingSensor({id: device.sensor_id, sensor_id: device.sensor_id, sensor_name: device.sensor_name || device.sensor_id, status: 'active'})
                                    setEditingName(device.sensor_name || device.sensor_id)
                                  }}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </CardTitle>
                          <CardDescription>
                            ID: {device.sensor_id}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge('active')}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveSensor(device.sensor_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      Device: {device.sensor_id}
                      {device.individual_sensors && device.individual_sensors.length > 0 && (
                        <span> • {device.individual_sensors.length} sensor(s) gekoppeld</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sensor Configuration */}
      {configSensors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Sensor Configuratie
            </CardTitle>
            <CardDescription>
              Configureer ESP32 instellingen voor je sensoren
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ErrorBoundary>
              {configSensors.map((device) => {
                const isEditing = editingConfig === device.sensor_id
                
                return (
                  <div key={device.sensor_id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold">{device.sensor_name || device.sensor_id}</h4>
                      <p className="text-sm text-muted-foreground">Device ID: {device.sensor_id}</p>
                      {device.individual_sensors && device.individual_sensors.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {device.individual_sensors.length} sensor(s) gekoppeld
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {device.pending_changes && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          Pending Changes
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => isEditing ? setEditingConfig(null) : handleEditConfig(device.sensor_id)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        {isEditing ? 'Annuleren' : 'Configureren'}
                      </Button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-6">
                      {/* Measurement Settings */}
                      <div className="space-y-4">
                        <h5 className="font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Meetinstellingen
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`measurement_interval_${device.sensor_id}`}>Meetinterval (seconden)</Label>
                            <Input
                              id={`measurement_interval_${device.sensor_id}`}
                              type="number"
                              min="60"
                              max="3600"
                              value={configFormData.measurement_interval}
                              onChange={(e) => setConfigFormData({
                                ...configFormData,
                                measurement_interval: parseInt(e.target.value) || 300
                              })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Huidig: {formatMeasurementInterval(configFormData.measurement_interval)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* WiFi Settings */}
                      <div className="space-y-4">
                        <h5 className="font-medium flex items-center gap-2">
                          <Wifi className="h-4 w-4" />
                          WiFi Instellingen
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`wifi_ssid_${device.sensor_id}`}>WiFi SSID</Label>
                            <Input
                              id={`wifi_ssid_${device.sensor_id}`}
                              value={configFormData.wifi_ssid}
                              onChange={(e) => setConfigFormData({
                                ...configFormData,
                                wifi_ssid: e.target.value
                              })}
                              placeholder="WiFi netwerk naam"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`wifi_password_${device.sensor_id}`}>WiFi Wachtwoord</Label>
                            <Input
                              id={`wifi_password_${device.sensor_id}`}
                              type="password"
                              value={configFormData.wifi_password}
                              onChange={(e) => setConfigFormData({
                                ...configFormData,
                                wifi_password: e.target.value
                              })}
                              placeholder="WiFi wachtwoord"
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`wifi_auto_connect_${device.sensor_id}`}
                            checked={configFormData.wifi_auto_connect}
                            onCheckedChange={(checked) => setConfigFormData({
                              ...configFormData,
                              wifi_auto_connect: checked
                            })}
                          />
                          <Label htmlFor={`wifi_auto_connect_${device.sensor_id}`}>Automatisch verbinden</Label>
                        </div>
                      </div>

                      {/* Sensor Settings */}
                      <div className="space-y-4">
                        <h5 className="font-medium flex items-center gap-2">
                          <Thermometer className="h-4 w-4" />
                          Sensor Instellingen
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`temperature_offset_${device.sensor_id}`}>Temperatuur Offset (°C)</Label>
                            <Input
                              id={`temperature_offset_${device.sensor_id}`}
                              type="number"
                              step="0.1"
                              value={configFormData.temperature_offset}
                              onChange={(e) => setConfigFormData({
                                ...configFormData,
                                temperature_offset: parseFloat(e.target.value) || 0
                              })}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`temperature_scale_${device.sensor_id}`}>Temperatuur Schaal</Label>
                            <Input
                              id={`temperature_scale_${device.sensor_id}`}
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={configFormData.temperature_scale}
                              onChange={(e) => setConfigFormData({
                                ...configFormData,
                                temperature_scale: parseFloat(e.target.value) || 1.0
                              })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Power Management */}
                      <div className="space-y-4">
                        <h5 className="font-medium flex items-center gap-2">
                          <Power className="h-4 w-4" />
                          Energiebeheer
                        </h5>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`deep_sleep_enabled_${device.sensor_id}`}
                            checked={configFormData.deep_sleep_enabled}
                            onCheckedChange={(checked) => setConfigFormData({
                              ...configFormData,
                              deep_sleep_enabled: checked
                            })}
                          />
                          <Label htmlFor={`deep_sleep_enabled_${device.sensor_id}`}>Deep Sleep inschakelen</Label>
                        </div>
                        {configFormData.deep_sleep_enabled && (
                          <div>
                            <Label htmlFor={`deep_sleep_duration_${device.sensor_id}`}>Deep Sleep Duur (seconden)</Label>
                            <Input
                              id={`deep_sleep_duration_${device.sensor_id}`}
                              type="number"
                              min="60"
                              value={configFormData.deep_sleep_duration}
                              onChange={(e) => setConfigFormData({
                                ...configFormData,
                                deep_sleep_duration: parseInt(e.target.value) || 3600
                              })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Debug Settings */}
                      <div className="space-y-4">
                        <h5 className="font-medium flex items-center gap-2">
                          <Bug className="h-4 w-4" />
                          Debug Instellingen
                        </h5>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`debug_mode_${device.sensor_id}`}
                            checked={configFormData.debug_mode}
                            onCheckedChange={(checked) => setConfigFormData({
                              ...configFormData,
                              debug_mode: checked
                            })}
                          />
                          <Label htmlFor={`debug_mode_${device.sensor_id}`}>Debug Mode</Label>
                        </div>
                        <div>
                          <Label htmlFor={`log_level_${device.sensor_id}`}>Log Level</Label>
                          <Select
                            value={configFormData.log_level}
                            onValueChange={(value: 'error' | 'warn' | 'info' | 'debug') => setConfigFormData({
                              ...configFormData,
                              log_level: value
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="error">Error</SelectItem>
                              <SelectItem value="warn">Warning</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                              <SelectItem value="debug">Debug</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-4 border-t">
                        <Button 
                          onClick={() => handleSaveConfig(device.sensor_id)}
                          disabled={savingConfig}
                        >
                          {savingConfig ? 'Opslaan...' : 'Opslaan'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setEditingConfig(null)}
                        >
                          Annuleren
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => handleRequestRestart(device.sensor_id)}
                          className="ml-auto"
                        >
                          <Power className="h-4 w-4 mr-2" />
                          Herstart ESP32
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Latest Readings Section */}

                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="font-medium">Meetinterval:</span>
                          <p className="text-muted-foreground">
                            {device ? formatMeasurementInterval(device.measurement_interval) : '300 seconden'}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">WiFi:</span>
                          <p className="text-muted-foreground">
                            {device?.wifi_ssid || 'Niet ingesteld'}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Temperatuur Offset:</span>
                          <p className="text-muted-foreground">
                            {device?.temperature_offset || 0}°C
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Deep Sleep:</span>
                          <p className="text-muted-foreground">
                            {device?.deep_sleep_enabled ? 'Ingeschakeld' : 'Uitgeschakeld'}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleRequestRestart(device.sensor_id)}
                        >
                          <Power className="h-4 w-4 mr-2" />
                          Herstart ESP32
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Individual Sensor Configurations */}
                  {/* Individual Sensors */}
                  {device.individual_sensors && device.individual_sensors.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium flex items-center gap-2">
                          <Thermometer className="h-4 w-4" />
                          Individuele Sensoren
                        </h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedSensors(prev => ({
                            ...prev,
                            [device.sensor_id]: !prev[device.sensor_id]
                          }))}
                        >
                          {expandedSensors[device.sensor_id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {expandedSensors[device.sensor_id] ? 'Inklappen' : 'Uitklappen'}
                        </Button>
                      </div>

                      {expandedSensors[device.sensor_id] && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {device.individual_sensors.map((individualSensor) => (
                            <IndividualSensorConfigComponent
                              key={individualSensor.sensor_id}
                              sensorId={individualSensor.sensor_id}
                              sensorType={individualSensor.sensor_type}
                              config={individualSensor}
                              onConfigUpdate={(sensorId, sensorType, config) => handleIndividualSensorConfigUpdate(sensorId, sensorType, config)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            </ErrorBoundary>
          </CardContent>
        </Card>
      )}

      {/* Transfer Requests */}
      {transferRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Sensor Transfer Verzoeken
            </CardTitle>
            <CardDescription>
              Er zijn verzoeken om sensoren over te nemen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {transferRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Sensor: {request.sensor_id}</p>
                  <p className="text-sm text-muted-foreground">
                    Verzoek van: {request.from_user_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Verloopt: {new Date(request.expires_at).toLocaleDateString('nl-NL')}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => handleRespondToTransfer(request, true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Toestaan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespondToTransfer(request, false)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Weigeren
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transfer Dialog - Temporarily disabled */}
      {/* <SensorTransferDialog 
        isOpen={showTransferDialog} 
        onClose={() => setShowTransferDialog(false)} 
      /> */}
    </div>
  )
}
