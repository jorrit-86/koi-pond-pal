import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Thermometer, Activity, Droplets, AlertTriangle, TrendingUp, Plus, History, Waves, Calculator } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import { MaintenanceTodos } from "@/components/maintenance/maintenance-todos"
import { useDashboardData, formatTimeDifference, WaterParameter } from "@/hooks/use-dashboard-data"

interface DashboardProps {
  onNavigate: (tab: string) => void
  refreshTrigger?: number
  onNavigateToTemperatureSensor?: (sensorId: string) => void
}

export function Dashboard({ onNavigate, refreshTrigger, onNavigateToTemperatureSensor }: DashboardProps) {
  const { t } = useTranslation()
  const { loading: authLoading } = useAuth()
  const {
    waterParameters,
    loading,
    koiCount,
    lastUpdate,
    pondTemperature,
    pondSensorId,
    pondSensorDisplayName,
    pondSensorLastUpdate,
    ambientTemperature,
    ambientSensorId: _ambientSensorId,
    ambientSensorDisplayName: _ambientSensorDisplayName,
    lastWaterChange,
    pondSize,
  } = useDashboardData(refreshTrigger)

  // ── pure UI helpers ───────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-success text-success-foreground'
      case 'warning': return 'bg-warning text-warning-foreground'
      case 'danger': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'good': return t('waterParameters.optimal')
      case 'warning': return t('waterParameters.warning')
      case 'danger': return t('waterParameters.critical')
      default: return status
    }
  }

  const handleParameterClick = (param: WaterParameter) => {
    if (param.type === 'temperature') {
      if (pondSensorId && onNavigateToTemperatureSensor) {
        onNavigateToTemperatureSensor(pondSensorId)
      } else {
        onNavigate('temperature')
      }
      return
    }
    const parameterRoutes: Record<string, string> = {
      ph: 'ph', kh: 'kh', gh: 'gh', nitrite: 'nitrite',
      nitrate: 'nitrate', phosphate: 'phosphate', ammonia: 'ammonia',
    }
    const route = parameterRoutes[param.type]
    if (route) onNavigate(route)
  }

  const generateAlerts = () => {
    const alerts: Array<{
      type: 'warning' | 'danger'
      title: string
      description: string
    }> = []

    waterParameters.forEach(param => {
      if (param.status === 'danger') {
        switch (param.type) {
          case 'ph':
            alerts.push({ type: 'danger', title: t('dashboard.criticalPhLevel'), description: (param.value ?? 0) < 6.5 ? t('dashboard.lowPhWarning') : t('dashboard.highPhWarning') })
            break
          case 'temperature':
            alerts.push({ type: 'danger', title: t('dashboard.criticalTemperature'), description: (param.value ?? 0) < 10 ? t('dashboard.lowTempWarning') : (param.value ?? 0) > 30 ? t('dashboard.highTempWarning') : t('dashboard.temperatureWarning') })
            break
          case 'nitrite':
            alerts.push({ type: 'danger', title: t('dashboard.dangerousNitriteLevel'), description: t('dashboard.nitriteDangerWarning') })
            break
          case 'nitrate':
            alerts.push({ type: 'danger', title: t('dashboard.dangerousNitrateLevel'), description: t('dashboard.nitrateDangerWarning') })
            break
          case 'phosphate':
            alerts.push({ type: 'danger', title: t('dashboard.dangerousPhosphateLevel'), description: t('dashboard.phosphateDangerWarning') })
            break
        }
      } else if (param.status === 'warning') {
        switch (param.type) {
          case 'ph':
            alerts.push({ type: 'warning', title: t('dashboard.elevatedPhLevel'), description: t('dashboard.phWarning') })
            break
          case 'temperature':
            alerts.push({ type: 'warning', title: (param.value ?? 0) < 15 ? t('dashboard.lowTemperature') : t('dashboard.elevatedTemperature'), description: t('dashboard.temperatureWarning') })
            break
          case 'nitrate':
            alerts.push({ type: 'warning', title: t('dashboard.elevatedNitrates'), description: t('dashboard.nitrateWarning') })
            break
          case 'phosphate':
            alerts.push({ type: 'warning', title: t('dashboard.highPhosphateLevel'), description: t('dashboard.phosphateWarning') })
            break
        }
      }
    })

    return alerts
  }

  // ── derived values ────────────────────────────────────────────────────────

  const currentTemp = pondTemperature !== null ? pondTemperature : 0
  const alerts = generateAlerts()

  // ── render ────────────────────────────────────────────────────────────────

  if (authLoading || (loading && waterParameters.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">{t("dashboard.subtitle")}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card
          className="bg-gradient-water cursor-pointer hover:shadow-water transition-shadow"
          onClick={() => pondSensorId ? onNavigateToTemperatureSensor?.(pondSensorId) : onNavigate("temperature")}
        >
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-2">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{pondSensorDisplayName}</p>
                <p className="text-lg sm:text-2xl font-bold">{currentTemp}°C</p>
                {ambientTemperature !== null && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Buiten: {ambientTemperature}°C
                  </p>
                )}
                {pondTemperature !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📡 <span className="font-mono">{pondSensorLastUpdate}</span>
                  </p>
                )}
              </div>
              <Thermometer className="h-5 w-5 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("koi")}>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-2">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("dashboard.koiCount")}</p>
                <p className="text-lg sm:text-2xl font-bold">{koiCount}</p>
              </div>
              <Activity className="h-5 w-5 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water col-span-2 lg:col-span-1 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("water-history")}>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-2">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("dashboard.lastUpdated")}</p>
                <p className="text-lg sm:text-2xl font-bold">{lastUpdate}</p>
              </div>
              <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Alerts */}
      {alerts.length > 0 && (
        <Card className={alerts.some(a => a.type === "danger") ? "border-destructive" : "border-warning"}>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className={`flex items-center gap-2 text-lg sm:text-xl ${alerts.some(a => a.type === "danger") ? "text-destructive" : "text-warning"}`}>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              {t("dashboard.alertsRecommendations")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-start space-x-2 sm:space-x-3">
                  <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mt-2 ${alert.type === "danger" ? "bg-destructive" : "bg-warning"}`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm sm:text-base">{alert.title}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Todos */}
      <MaintenanceTodos onNavigate={onNavigate} />

      {/* Water Parameters */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                {t("waterParameters.title")}
              </CardTitle>
              <CardDescription className="text-sm">{t("dashboard.currentWaterQuality")}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => onNavigate("parameters")} size="sm" className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {t("waterParameters.addReading")}
              </Button>
              <Button onClick={() => onNavigate("water-change")} size="sm" className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm">
                <Waves className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Waterwissel
              </Button>
              <Button onClick={() => onNavigate("water-history")} variant="outline" size="sm" className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm">
                <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Bekijk eerdere metingen</span>
                <span className="sm:hidden">Geschiedenis</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 sm:space-y-4">
            {waterParameters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Geen waterparameters beschikbaar</p>
                {loading && <p className="text-sm mt-2">Laden...</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {waterParameters.map((param) => (
                  <Card
                    key={param.type}
                    className="cursor-pointer hover:shadow-water transition-shadow"
                    onClick={() => handleParameterClick(param)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm sm:text-base">
                          {param.name === "kH (Carbonaathardheid)" ? (
                            <>
                              <span className="sm:hidden">kH (carbo-<br />naatheid)</span>
                              <span className="hidden sm:inline">kH (Carbonaathardheid)</span>
                            </>
                          ) : (
                            param.name
                          )}
                        </h3>
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full sm:hidden mt-1 ${
                            param.status === 'good' ? 'bg-green-500' :
                            param.status === 'warning' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}></div>
                          <Badge className={`${getStatusColor(param.status)} text-xs hidden sm:inline-flex`}>
                            {getStatusText(param.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xl sm:text-2xl font-bold">
                          {param.value !== null && param.value !== undefined
                            ? `${param.value}${param.unit}`
                            : <span className="text-muted-foreground italic">Geen data</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("dashboard.ideal")}: {param.range}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Water Change Tile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              <Card
                className="cursor-pointer hover:shadow-water transition-shadow"
                onClick={() => onNavigate("water-change")}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="mb-2">
                    <h3 className="font-semibold flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base">
                      <Waves className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                      <span>Laatste Waterwissel</span>
                    </h3>
                  </div>
                  <div className="space-y-1">
                    {lastWaterChange ? (
                      <>
                        <p className="text-xl sm:text-2xl font-bold text-blue-600">
                          {(() => {
                            const litersAdded = typeof lastWaterChange.liters_added === 'string'
                              ? parseFloat(lastWaterChange.liters_added)
                              : Number(lastWaterChange.liters_added)
                            return litersAdded.toLocaleString('nl-NL')
                          })()}L
                          {pondSize && pondSize > 0 && lastWaterChange?.liters_added && (() => {
                            const litersAdded = typeof lastWaterChange.liters_added === 'string'
                              ? parseFloat(lastWaterChange.liters_added)
                              : Number(lastWaterChange.liters_added)
                            const pondSizeNum = Number(pondSize)
                            if (isNaN(litersAdded) || isNaN(pondSizeNum) || pondSizeNum <= 0) return null
                            const percentage = (litersAdded / pondSizeNum) * 100
                            return (
                              <span className="text-xs sm:text-sm font-semibold text-purple-600 ml-1 sm:ml-2">
                                ({percentage.toFixed(1)}%)
                              </span>
                            )
                          })()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeDifference(lastWaterChange.changed_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lastWaterChange.water_type === 'tap_water' ? 'Kraanwater' :
                           lastWaterChange.water_type === 'well_water' ? 'Putwater' :
                           lastWaterChange.water_type === 'rain_water' ? 'Regenwater' :
                           lastWaterChange.water_type === 'ro_water' ? 'RO water' :
                           lastWaterChange.water_type === 'mixed' ? 'Gemengd' : lastWaterChange.water_type}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-base sm:text-lg font-semibold text-gray-500">Geen waterwissel</p>
                        <p className="text-xs text-muted-foreground">Klik om een waterwissel te registreren</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="cursor-pointer hover:shadow-water transition-shadow" onClick={() => onNavigate("parameters")}>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.logWaterParameters")}</CardTitle>
            <CardDescription className="text-sm">{t("dashboard.recordNewMeasurements")}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-water transition-shadow" onClick={() => onNavigate("koi")}>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.manageKoi")}</CardTitle>
            <CardDescription className="text-sm">{t("dashboard.addUpdateKoiInfo")}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-water transition-shadow sm:col-span-2 lg:col-span-1" onClick={() => onNavigate("koi-weight-calculator")}>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Koi Voerstrategie Calculator</span>
              <span className="sm:hidden">Voerstrategie</span>
            </CardTitle>
            <CardDescription className="text-sm">Bereken de optimale voerstrategie voor je koi groep</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
