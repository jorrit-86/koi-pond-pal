import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Thermometer, Settings, Save, RotateCcw, Clock, Droplets, Waves } from "lucide-react"
import { IndividualSensorConfig } from "@/types/esp32-config"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

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
  onConfigUpdate,
}: IndividualSensorConfigProps) {
  const { user } = useAuth()
  const [localConfig, setLocalConfig] = useState<IndividualSensorConfig>(config)
  const [draftConfig, setDraftConfig] = useState<IndividualSensorConfig>(config)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [latestReading, setLatestReading] = useState<{
    temperature?: number | null
    humidity?: number | null
    ph?: number | null
    flow_rate?: number | null
    flow_total?: number | null
    created_at?: string
  } | null>(null)

  useEffect(() => {
    void loadConfigFromDatabase()
    void loadLatestReading()
  }, [sensorId, sensorType])

  useEffect(() => {
    const interval = setInterval(() => void loadLatestReading(), 120000)
    return () => clearInterval(interval)
  }, [sensorId, sensorType])

  const loadConfigFromDatabase = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("individual_sensor_configs")
        .select("*")
        .eq("sensor_id", sensorId)
        .eq("sensor_type", sensorType)
        .maybeSingle()

      if (error) {
        console.error("Error loading config from database:", error)
        return
      }

      const nextConfig: IndividualSensorConfig = data
        ? {
            sensor_id: data.sensor_id,
            sensor_type: data.sensor_type,
            device_id: data.device_id,
            display_name: data.display_name,
            temperature_offset: data.temperature_offset,
            temperature_scale: data.temperature_scale,
            enabled: data.enabled,
          }
        : config

      setLocalConfig(nextConfig)
      setDraftConfig(nextConfig)
    } catch (error) {
      console.error("Error loading config:", error)
      setLocalConfig(config)
      setDraftConfig(config)
    } finally {
      setLoading(false)
    }
  }

  const loadLatestReading = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("sensor_data")
        .select("temperature, humidity, ph, created_at, sensor_type, flow_rate, flow_total")
        .eq("sensor_id", sensorId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error("Error loading latest reading:", error)
        return
      }

      setLatestReading(data)
    } catch (error) {
      console.error("Error loading latest reading:", error)
    }
  }

  const formatLatestReading = (reading: { created_at?: string } | null) => {
    if (!reading?.created_at) return "Geen data"

    const now = new Date()
    const readingTime = new Date(reading.created_at)
    const diffMs = now.getTime() - readingTime.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) return "Zojuist"
    if (diffMinutes < 60) return `${diffMinutes} min geleden`
    if (diffHours < 24) return `${diffHours} uur geleden`
    return `${diffDays} dag${diffDays > 1 ? "en" : ""} geleden`
  }

  const getSensorIcon = (type: string) => {
    switch (type) {
      case "vijver_water":
      case "watertemperatuur":
        return <Thermometer className="h-4 w-4 text-blue-500" />
      case "filter_inlaat":
      case "omgevingstemperatuur":
      case "ambient":
        return <Thermometer className="h-4 w-4 text-orange-500" />
      case "ph_meter":
        return <Droplets className="h-4 w-4 text-teal-500" />
      case "waterflowmeter":
        return <Waves className="h-4 w-4 text-sky-500" />
      default:
        return <Thermometer className="h-4 w-4 text-gray-500" />
    }
  }

  const getSensorTitle = (cfg: IndividualSensorConfig) => {
    if (cfg.display_name?.trim()) return cfg.display_name
    if (sensorId.endsWith("-01")) return "Watertemperatuur"
    if (sensorId.endsWith("-02")) return "Omgevingstemperatuur"
    if (sensorId.endsWith("-03")) return "pH"
    if (sensorId.endsWith("-04")) return "Waterdebiet"
    return sensorId
  }

  const formatPrimaryValue = () => {
    if (sensorType === "ph_meter" || sensorId.endsWith("-03")) {
      return latestReading?.ph != null ? Number(latestReading.ph).toFixed(2) : "--"
    }
    if (sensorType === "waterflowmeter" || sensorId.endsWith("-04")) {
      return latestReading?.flow_rate != null
        ? `${Number(latestReading.flow_rate).toFixed(1)} L/min`
        : "-- L/min"
    }
    return latestReading?.temperature != null
      ? `${Number(latestReading.temperature).toFixed(1)}°C`
      : "--°C"
  }

  const formatSecondaryValue = () => {
    if (sensorType === "waterflowmeter" || sensorId.endsWith("-04")) {
      return latestReading?.flow_total != null
        ? `${Number(latestReading.flow_total).toFixed(1)} L totaal`
        : null
    }
    if (sensorType === "omgevingstemperatuur" || sensorId.endsWith("-02")) {
      return latestReading?.humidity != null
        ? `${Number(latestReading.humidity).toFixed(0)}% RV`
        : null
    }
    return null
  }

  const openDialog = () => {
    setDraftConfig(localConfig)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDraftConfig(localConfig)
    setDialogOpen(false)
  }

  const handleDraftChange = <K extends keyof IndividualSensorConfig>(
    field: K,
    value: IndividualSensorConfig[K]
  ) => {
    setDraftConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const upsertData = {
        sensor_id: sensorId,
        sensor_type: sensorType,
        device_id: config.device_id || localConfig.device_id,
        display_name: draftConfig.display_name,
        temperature_offset: draftConfig.temperature_offset,
        temperature_scale: draftConfig.temperature_scale,
        enabled: draftConfig.enabled,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("individual_sensor_configs")
        .upsert(upsertData, { onConflict: "sensor_id,sensor_type" })
        .select()

      if (error) {
        throw new Error(error.message)
      }

      setLocalConfig(draftConfig)
      onConfigUpdate(sensorId, sensorType, draftConfig)
      setDialogOpen(false)
      toast.success("Sensorconfiguratie opgeslagen")
    } catch (error) {
      console.error("Error saving sensor configuration:", error)
      toast.error(
        `Fout bij opslaan: ${error instanceof Error ? error.message : "onbekend"}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleResetDraft = () => {
    setDraftConfig(localConfig)
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
        Sensor laden…
      </div>
    )
  }

  return (
    <>
      <Card className="w-full shadow-none">
        <CardContent className="flex items-center gap-3 p-3 sm:p-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                latestReading ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {getSensorIcon(sensorType)}
                <p className="truncate font-medium">{getSensorTitle(localConfig)}</p>
                {!localConfig.enabled && (
                  <Badge variant="secondary" className="shrink-0">
                    Uit
                  </Badge>
                )}
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {sensorId}
              </p>
            </div>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-lg font-semibold tabular-nums text-primary">
              {formatPrimaryValue()}
            </p>
            {formatSecondaryValue() && (
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatSecondaryValue()}
              </p>
            )}
            <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatLatestReading(latestReading)}
            </p>
          </div>

          <div className="text-right sm:hidden">
            <p className="text-base font-semibold tabular-nums text-primary">
              {formatPrimaryValue()}
            </p>
            {formatSecondaryValue() && (
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {formatSecondaryValue()}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={openDialog}
            aria-label={`Configureer ${getSensorTitle(localConfig)}`}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
          else setDialogOpen(true)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getSensorIcon(sensorType)}
              {getSensorTitle(draftConfig)}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {sensorId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    latestReading ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm font-medium">
                  {latestReading ? "Actief" : "Geen data"}
                </span>
              </div>
              <div className="text-right text-sm tabular-nums text-muted-foreground">
                <div>{formatPrimaryValue()}</div>
                {formatSecondaryValue() && (
                  <div className="text-xs">{formatSecondaryValue()}</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`display-name-${sensorId}`}>Weergavenaam</Label>
              <Input
                id={`display-name-${sensorId}`}
                value={draftConfig.display_name}
                onChange={(e) => handleDraftChange("display_name", e.target.value)}
                placeholder="Bijv. Watertemperatuur"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`offset-${sensorId}`}>Offset (°C)</Label>
                <Input
                  id={`offset-${sensorId}`}
                  type="number"
                  step="0.1"
                  value={draftConfig.temperature_offset}
                  onChange={(e) =>
                    handleDraftChange(
                      "temperature_offset",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  + warmer, − kouder
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`scale-${sensorId}`}>Schaal</Label>
                <Input
                  id={`scale-${sensorId}`}
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="2.0"
                  value={draftConfig.temperature_scale}
                  onChange={(e) =>
                    handleDraftChange(
                      "temperature_scale",
                      parseFloat(e.target.value) || 1.0
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">1.0 = geen schaal</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label htmlFor={`enabled-${sensorId}`}>Sensor ingeschakeld</Label>
                <p className="text-xs text-muted-foreground">
                  Uitgeschakelde sensoren meten niet mee
                </p>
              </div>
              <Switch
                id={`enabled-${sensorId}`}
                checked={draftConfig.enabled}
                onCheckedChange={(checked) => handleDraftChange("enabled", checked)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleResetDraft}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="button" variant="ghost" onClick={closeDialog}>
              Annuleren
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Opslaan…" : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
