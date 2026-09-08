import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Wifi,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Thermometer,
  Power,
  Bug,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { IndividualSensorConfigComponent } from "./individual-sensor-config"
import { IndividualSensorConfig, KOIoTSensorConfig } from "@/types/esp32-config"
import { UserSensor } from "@/hooks/use-sensor-management"

type ConfigFormData = {
  measurement_interval: number
  wifi_ssid: string
  wifi_password: string
  wifi_auto_connect: boolean
  temperature_offset: number
  temperature_scale: number
  deep_sleep_enabled: boolean
  deep_sleep_duration: number
  debug_mode: boolean
  log_level: "error" | "warn" | "info" | "debug"
}

interface KoiotDevicePanelProps {
  device: KOIoTSensorConfig
  isDeviceOpen: boolean
  isConfigOpen: boolean
  isSensorsOpen: boolean
  isEditingConfig: boolean
  editingSensor: UserSensor | null
  editingName: string
  configFormData: ConfigFormData
  savingConfig: boolean
  statusIcon: ReactNode
  statusBadge: ReactNode
  formatMeasurementInterval: (seconds: number) => string
  onToggleDevice: () => void
  onToggleConfig: () => void
  onToggleSensors: () => void
  onEditingNameChange: (value: string) => void
  onStartRename: () => void
  onSaveRename: () => void
  onCancelRename: () => void
  onRemoveDevice: () => void
  onEditConfig: () => void
  onCancelEditConfig: () => void
  onSaveConfig: () => void
  onConfigFormChange: (next: ConfigFormData) => void
  onRequestRestart: () => void
  onIndividualConfigUpdate: (
    sensorId: string,
    sensorType: string,
    config: IndividualSensorConfig
  ) => void
}

export function KoiotDevicePanel({
  device,
  isDeviceOpen,
  isConfigOpen,
  isSensorsOpen,
  isEditingConfig,
  editingSensor,
  editingName,
  configFormData,
  savingConfig,
  statusIcon,
  statusBadge,
  formatMeasurementInterval,
  onToggleDevice,
  onToggleConfig,
  onToggleSensors,
  onEditingNameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onRemoveDevice,
  onEditConfig,
  onCancelEditConfig,
  onSaveConfig,
  onConfigFormChange,
  onRequestRestart,
  onIndividualConfigUpdate,
}: KoiotDevicePanelProps) {
  const sensorCount = device.individual_sensors?.length || 0
  const id = device.sensor_id

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0.5 shrink-0"
              onClick={onToggleDevice}
            >
              {isDeviceOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {statusIcon}
                {editingSensor?.id === id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={editingName}
                      onChange={(e) => onEditingNameChange(e.target.value)}
                      className="h-8 w-48"
                    />
                    <Button size="sm" onClick={onSaveRename}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={onCancelRename}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <CardTitle className="text-lg truncate">
                      {device.sensor_name || id}
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={onStartRename}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <CardDescription className="mt-1">
                Device ID: <span className="font-mono">{id}</span>
                {sensorCount > 0 && (
                  <span>
                    {" "}
                    · {sensorCount} sensor{sensorCount === 1 ? "" : "en"}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
            {device.pending_changes && (
              <Badge
                variant="outline"
                className="text-orange-600 border-orange-200"
              >
                Wijzigingen pending
              </Badge>
            )}
            {statusBadge}
            <Button size="sm" variant="outline" onClick={onRemoveDevice}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isDeviceOpen && (
        <CardContent className="pt-4 space-y-4">
          <div className="rounded-lg border bg-background">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
              onClick={onToggleConfig}
            >
              <div className="flex items-center gap-2">
                {isConfigOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Settings className="h-4 w-4" />
                <span className="font-medium">Device-configuratie</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatMeasurementInterval(device.measurement_interval)} ·{" "}
                {device.wifi_ssid || "Geen WiFi"}
              </span>
            </button>

            {isConfigOpen && (
              <div className="border-t px-4 py-4 space-y-4">
                {isEditingConfig ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h5 className="font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Meetinstellingen
                      </h5>
                      <div>
                        <Label htmlFor={`measurement_interval_${id}`}>
                          Meetinterval (seconden)
                        </Label>
                        <Input
                          id={`measurement_interval_${id}`}
                          type="number"
                          min="60"
                          max="3600"
                          value={configFormData.measurement_interval}
                          onChange={(e) =>
                            onConfigFormChange({
                              ...configFormData,
                              measurement_interval: parseInt(e.target.value) || 300,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Huidig:{" "}
                          {formatMeasurementInterval(
                            configFormData.measurement_interval
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="font-medium flex items-center gap-2">
                        <Wifi className="h-4 w-4" />
                        WiFi Instellingen
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`wifi_ssid_${id}`}>WiFi SSID</Label>
                          <Input
                            id={`wifi_ssid_${id}`}
                            value={configFormData.wifi_ssid}
                            onChange={(e) =>
                              onConfigFormChange({
                                ...configFormData,
                                wifi_ssid: e.target.value,
                              })
                            }
                            placeholder="WiFi netwerk naam"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`wifi_password_${id}`}>
                            WiFi Wachtwoord
                          </Label>
                          <Input
                            id={`wifi_password_${id}`}
                            type="password"
                            value={configFormData.wifi_password}
                            onChange={(e) =>
                              onConfigFormChange({
                                ...configFormData,
                                wifi_password: e.target.value,
                              })
                            }
                            placeholder="WiFi wachtwoord"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`wifi_auto_connect_${id}`}
                          checked={configFormData.wifi_auto_connect}
                          onCheckedChange={(checked) =>
                            onConfigFormChange({
                              ...configFormData,
                              wifi_auto_connect: checked,
                            })
                          }
                        />
                        <Label htmlFor={`wifi_auto_connect_${id}`}>
                          Automatisch verbinden
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="font-medium flex items-center gap-2">
                        <Thermometer className="h-4 w-4" />
                        Sensor Instellingen
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`temperature_offset_${id}`}>
                            Temperatuur Offset (°C)
                          </Label>
                          <Input
                            id={`temperature_offset_${id}`}
                            type="number"
                            step="0.1"
                            value={configFormData.temperature_offset}
                            onChange={(e) =>
                              onConfigFormChange({
                                ...configFormData,
                                temperature_offset: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`temperature_scale_${id}`}>
                            Temperatuur Schaal
                          </Label>
                          <Input
                            id={`temperature_scale_${id}`}
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={configFormData.temperature_scale}
                            onChange={(e) =>
                              onConfigFormChange({
                                ...configFormData,
                                temperature_scale: parseFloat(e.target.value) || 1.0,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="font-medium flex items-center gap-2">
                        <Power className="h-4 w-4" />
                        Energiebeheer
                      </h5>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`deep_sleep_enabled_${id}`}
                          checked={configFormData.deep_sleep_enabled}
                          onCheckedChange={(checked) =>
                            onConfigFormChange({
                              ...configFormData,
                              deep_sleep_enabled: checked,
                            })
                          }
                        />
                        <Label htmlFor={`deep_sleep_enabled_${id}`}>
                          Deep Sleep inschakelen
                        </Label>
                      </div>
                      {configFormData.deep_sleep_enabled && (
                        <div>
                          <Label htmlFor={`deep_sleep_duration_${id}`}>
                            Deep Sleep Duur (seconden)
                          </Label>
                          <Input
                            id={`deep_sleep_duration_${id}`}
                            type="number"
                            min="60"
                            value={configFormData.deep_sleep_duration}
                            onChange={(e) =>
                              onConfigFormChange({
                                ...configFormData,
                                deep_sleep_duration:
                                  parseInt(e.target.value) || 3600,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h5 className="font-medium flex items-center gap-2">
                        <Bug className="h-4 w-4" />
                        Debug Instellingen
                      </h5>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`debug_mode_${id}`}
                          checked={configFormData.debug_mode}
                          onCheckedChange={(checked) =>
                            onConfigFormChange({
                              ...configFormData,
                              debug_mode: checked,
                            })
                          }
                        />
                        <Label htmlFor={`debug_mode_${id}`}>Debug Mode</Label>
                      </div>
                      <div>
                        <Label htmlFor={`log_level_${id}`}>Log Level</Label>
                        <Select
                          value={configFormData.log_level}
                          onValueChange={(
                            value: "error" | "warn" | "info" | "debug"
                          ) =>
                            onConfigFormChange({
                              ...configFormData,
                              log_level: value,
                            })
                          }
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

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                      <Button onClick={onSaveConfig} disabled={savingConfig}>
                        {savingConfig ? "Opslaan..." : "Opslaan"}
                      </Button>
                      <Button variant="outline" onClick={onCancelEditConfig}>
                        Annuleren
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={onRequestRestart}
                        className="sm:ml-auto"
                      >
                        <Power className="h-4 w-4 mr-2" />
                        Herstart ESP32
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Meetinterval</span>
                        <p className="text-muted-foreground">
                          {formatMeasurementInterval(device.measurement_interval)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">WiFi</span>
                        <p className="text-muted-foreground">
                          {device.wifi_ssid || "Niet ingesteld"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Offset</span>
                        <p className="text-muted-foreground">
                          {device.temperature_offset || 0}°C
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Deep Sleep</span>
                        <p className="text-muted-foreground">
                          {device.deep_sleep_enabled ? "Aan" : "Uit"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={onEditConfig}>
                        <Settings className="h-4 w-4 mr-2" />
                        Bewerken
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={onRequestRestart}
                      >
                        <Power className="h-4 w-4 mr-2" />
                        Herstart ESP32
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed bg-muted/20">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
              onClick={onToggleSensors}
            >
              <div className="flex items-center gap-2">
                {isSensorsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Thermometer className="h-4 w-4" />
                <span className="font-medium">Sensoren</span>
                <Badge variant="secondary">{sensorCount}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {isSensorsOpen ? "Inklappen" : "Uitklappen"}
              </span>
            </button>

            {isSensorsOpen && (
              <div className="border-t px-4 py-4">
                {sensorCount === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nog geen individuele sensoren gekoppeld aan dit device.
                  </p>
                ) : (
                  <div className="relative space-y-3 pl-4 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-border">
                    {device.individual_sensors!.map((individualSensor) => (
                      <div
                        key={individualSensor.sensor_id}
                        className="relative before:absolute before:-left-4 before:top-6 before:h-px before:w-3 before:bg-border"
                      >
                        <IndividualSensorConfigComponent
                          sensorId={individualSensor.sensor_id}
                          sensorType={individualSensor.sensor_type}
                          config={individualSensor}
                          onConfigUpdate={onIndividualConfigUpdate}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
