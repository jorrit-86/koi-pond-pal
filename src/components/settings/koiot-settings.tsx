import { useState, useEffect } from "react"
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
import { SensorQrScanner } from "./sensor-qr-scanner"
import { KoiotDevicePanel } from "./koiot-device-panel"
// import { SensorTransferDialog } from "./sensor-transfer-dialog"
// import { SensorStatusCard } from "./sensor-status-card"

export function KOIoTSettings() {
  const { _t } = useTranslation()
  const {
    sensors,
    transferRequests,
    loading,
    error,
    addSensor,
    removeSensor,
    respondToTransferRequest,
    updateSensorName,
    refreshSensors: _refreshSensors,
    refreshTransferRequests: _refreshTransferRequests
  } = useSensorManagement()

  const {
    sensors: configSensors,
    loading: configLoading,
    error: configError,
    loadSensors: refreshConfigSensors,
    updateSensorConfiguration,
    requestSensorRestart,
    formatMeasurementInterval,
    validateConfiguration,
    getSensorDisplayName: _getSensorDisplayName,
    formatLatestReading: _formatLatestReading
  } = useKOIoTConfig()

  const [newSensorId, setNewSensorId] = useState("")
  const [newSensorName, setNewSensorName] = useState("")
  const [isAddingSensor, setIsAddingSensor] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [qrScanActive, setQrScanActive] = useState(false)
  const [editingSensor, setEditingSensor] = useState<UserSensor | null>(null)
  const [editingName, setEditingName] = useState("")
  const [_showTransferDialog, setShowTransferDialog] = useState(false)
  const [expandedSensors, setExpandedSensors] = useState<Record<string, boolean>>({})
  const [expandedDevices, setExpandedDevices] = useState<Record<string, boolean>>({})
  const [expandedDeviceConfig, setExpandedDeviceConfig] = useState<Record<string, boolean>>({})
  const [_individualSensorConfigs, setIndividualSensorConfigs] = useState<Record<string, Record<string, IndividualSensorConfig>>>({})
  
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

  // After ownership heal/provision, refresh the overview list from sensor_configurations
  useEffect(() => {
    if (!loading) {
      void refreshConfigSensors()
    }
    // Only re-run when management loading finishes / sensor list size changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sensors.length])

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
        await refreshConfigSensors()
        toast.success(
          result.healed
            ? "Sensor opnieuw gekoppeld en zichtbaar gemaakt in het overzicht!"
            : "Sensor succesvol toegevoegd!"
        )
        setNewSensorId("")
        setNewSensorName("")
        setQrScanActive(false)
        setShowAddDialog(false)
      } else if (result.requiresTransfer) {
        toast.info(result.error)
        setNewSensorId("")
        setNewSensorName("")
        setQrScanActive(false)
        setShowAddDialog(false)
      } else {
        toast.error(result.error)
      }
    } catch (_error) {
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
        await refreshConfigSensors()
        toast.success("Sensor succesvol verwijderd!")
      } else {
        toast.error(result.error)
      }
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (err) {
      toast.error('Fout bij opslaan configuratie: ' + err.message)
    } finally {
      setSavingConfig(false)
    }
  }

  const handleRequestRestart = async (sensorId: string) => {
    try {
      await requestSensorRestart(sensorId)
      toast.success('Herstart aangevraagd! De ESP32 zal binnenkort herstarten.')
    } catch (error) {
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
  }

  const _toggleSensorExpansion = (sensorId: string) => {
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
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) setQrScanActive(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Sensor Toevoegen</DialogTitle>
            <DialogDescription>
              Voer de sensor ID handmatig in of scan de QR-code op de sensor.
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">of</span>
              </div>
            </div>

            <SensorQrScanner
              active={qrScanActive}
              onActiveChange={setQrScanActive}
              onScan={(id) => {
                setNewSensorId(id)
                toast.success("Sensor ID gescand")
              }}
            />

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
            <Button
              variant="outline"
              onClick={() => {
                setQrScanActive(false)
                setShowAddDialog(false)
              }}
            >
              Annuleren
            </Button>
            <Button onClick={handleAddSensor} disabled={isAddingSensor}>
              {isAddingSensor ? "Toevoegen..." : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Devices with nested sensor configuration */}
      <div className="space-y-4">
        {configSensors.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Wifi className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Geen devices gekoppeld</h3>
                <p className="text-muted-foreground mb-4">
                  Voeg je eerste KOIoT device toe om automatische monitoring te starten.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Eerste Device Toevoegen
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ErrorBoundary>
            {configSensors.map((device) => (
              <KoiotDevicePanel
                key={device.sensor_id}
                device={device}
                isDeviceOpen={expandedDevices[device.sensor_id] !== false}
                isConfigOpen={
                  expandedDeviceConfig[device.sensor_id] === true ||
                  editingConfig === device.sensor_id
                }
                isSensorsOpen={expandedSensors[device.sensor_id] !== false}
                isEditingConfig={editingConfig === device.sensor_id}
                editingSensor={editingSensor}
                editingName={editingName}
                configFormData={configFormData}
                savingConfig={savingConfig}
                statusIcon={getStatusIcon('active')}
                statusBadge={getStatusBadge('active')}
                formatMeasurementInterval={formatMeasurementInterval}
                onToggleDevice={() =>
                  setExpandedDevices((prev) => ({
                    ...prev,
                    [device.sensor_id]: !(prev[device.sensor_id] !== false),
                  }))
                }
                onToggleConfig={() => {
                  const currentlyOpen =
                    expandedDeviceConfig[device.sensor_id] === true ||
                    editingConfig === device.sensor_id
                  if (currentlyOpen) {
                    setEditingConfig(null)
                    setExpandedDeviceConfig((prev) => ({
                      ...prev,
                      [device.sensor_id]: false,
                    }))
                  } else {
                    setExpandedDeviceConfig((prev) => ({
                      ...prev,
                      [device.sensor_id]: true,
                    }))
                  }
                }}
                onToggleSensors={() =>
                  setExpandedSensors((prev) => ({
                    ...prev,
                    [device.sensor_id]: !(prev[device.sensor_id] !== false),
                  }))
                }
                onEditingNameChange={setEditingName}
                onStartRename={() => {
                  setEditingSensor({
                    id: device.sensor_id,
                    sensor_id: device.sensor_id,
                    sensor_name: device.sensor_name || device.sensor_id,
                    status: 'active',
                    user_id: '',
                    created_at: '',
                    updated_at: '',
                  })
                  setEditingName(device.sensor_name || device.sensor_id)
                }}
                onSaveRename={() =>
                  handleUpdateSensorName(device.sensor_id, editingName)
                }
                onCancelRename={() => {
                  setEditingSensor(null)
                  setEditingName('')
                }}
                onRemoveDevice={() => handleRemoveSensor(device.sensor_id)}
                onEditConfig={() => {
                  setExpandedDeviceConfig((prev) => ({
                    ...prev,
                    [device.sensor_id]: true,
                  }))
                  handleEditConfig(device.sensor_id)
                }}
                onCancelEditConfig={() => setEditingConfig(null)}
                onSaveConfig={() => handleSaveConfig(device.sensor_id)}
                onConfigFormChange={setConfigFormData}
                onRequestRestart={() => handleRequestRestart(device.sensor_id)}
                onIndividualConfigUpdate={handleIndividualSensorConfigUpdate}
              />
            ))}
          </ErrorBoundary>
        )}
      </div>

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
