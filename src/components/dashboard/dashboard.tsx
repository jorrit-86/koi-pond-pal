import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Thermometer, Activity, Droplets, AlertTriangle, TrendingUp, Plus, History, Lightbulb } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { RecommendationsPanel } from "@/components/recommendations/recommendations-panel"
import { useRecommendations } from "@/hooks/use-recommendations"

interface WaterParameter {
  name: string
  value: number
  unit: string
  status: "good" | "warning" | "danger"
  range: string
}

interface DashboardProps {
  onNavigate: (tab: string) => void
  refreshTrigger?: number // Add this to trigger refresh from parent
}

export function Dashboard({ onNavigate, refreshTrigger }: DashboardProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [waterParameters, setWaterParameters] = useState<WaterParameter[]>([])
  const [loading, setLoading] = useState(true)
  const [koiCount, setKoiCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState("No data")
  
  // Smart recommendations
  const { 
    recommendations, 
    riskAssessment, 
    loading: recommendationsLoading,
    refreshRecommendations 
  } = useRecommendations()

  // Load water parameters from database
  useEffect(() => {
    if (user) {
      loadWaterParameters()
      loadKoiCount()
    }
  }, [user, refreshTrigger])

  const loadWaterParameters = async () => {
    try {
      setLoading(true)
      
      // Get the latest reading for each parameter type
      const { data, error } = await supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user?.id)
        .order('measured_at', { ascending: false })

      if (error) {
        console.error('Error loading water parameters:', error)
        return
      }

      // Group by parameter type and get the latest value for each
      const latestReadings: Record<string, any> = {}
      data?.forEach(reading => {
        if (!latestReadings[reading.parameter_type] || 
            new Date(reading.measured_at) > new Date(latestReadings[reading.parameter_type].measured_at)) {
          latestReadings[reading.parameter_type] = reading
        }
      })

      // Transform to WaterParameter format
      const parameters: WaterParameter[] = [
        { 
          name: t("waterParameters.ph"), 
          value: latestReadings.ph?.value || 0, 
          unit: latestReadings.ph?.unit || "", 
          status: getParameterStatus('ph', latestReadings.ph?.value), 
          range: "6.8-8.2" 
        },
        { 
          name: t("waterParameters.temperature"), 
          value: latestReadings.temperature?.value || 0, 
          unit: latestReadings.temperature?.unit || "°C", 
          status: getParameterStatus('temperature', latestReadings.temperature?.value), 
          range: "15-25°C" 
        },
        { 
          name: t("waterParameters.kh"), 
          value: latestReadings.kh?.value || 0, 
          unit: latestReadings.kh?.unit || "°dH", 
          status: getParameterStatus('kh', latestReadings.kh?.value), 
          range: "3-8°dH" 
        },
        { 
          name: t("waterParameters.gh"), 
          value: latestReadings.gh?.value || 0, 
          unit: latestReadings.gh?.unit || "°dH", 
          status: getParameterStatus('gh', latestReadings.gh?.value), 
          range: "4-12°dH" 
        },
        { 
          name: t("waterParameters.nitrite"), 
          value: latestReadings.nitrite?.value || 0, 
          unit: latestReadings.nitrite?.unit || "mg/l", 
          status: getParameterStatus('nitrite', latestReadings.nitrite?.value), 
          range: "0-0.3mg/l" 
        },
        { 
          name: t("waterParameters.nitrate"), 
          value: latestReadings.nitrate?.value || 0, 
          unit: latestReadings.nitrate?.unit || "mg/l", 
          status: getParameterStatus('nitrate', latestReadings.nitrate?.value), 
          range: "<25mg/l" 
        },
        { 
          name: t("waterParameters.phosphate"), 
          value: latestReadings.phosphate?.value || 0, 
          unit: latestReadings.phosphate?.unit || "mg/l", 
          status: getParameterStatus('phosphate', latestReadings.phosphate?.value), 
          range: "<0.5mg/l" 
        },
      ]

      setWaterParameters(parameters)
      
      // Set last update time
      const latestReading = data?.[0]
      if (latestReading) {
        const updateTime = new Date(latestReading.measured_at)
        const now = new Date()
        const diffHours = Math.floor((now.getTime() - updateTime.getTime()) / (1000 * 60 * 60))
        setLastUpdate(diffHours === 0 ? t("dashboard.justNow") : `${diffHours} ${t("dashboard.hoursAgo")}`)
      }

    } catch (error) {
      console.error('Error in loadWaterParameters:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadKoiCount = async () => {
    try {
      const { count, error } = await supabase
        .from('koi')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)

      if (!error) {
        setKoiCount(count || 0)
      }
    } catch (error) {
      console.error('Error loading koi count:', error)
    }
  }

  const getParameterStatus = (type: string, value: number): "good" | "warning" | "danger" => {
    // Handle cases where value is 0 or undefined
    if (value === undefined || value === null) return "warning"
    
    switch (type) {
      case 'ph':
        if (value >= 6.8 && value <= 8.2) return "good"
        if (value >= 6.5 && value <= 8.5) return "warning"
        return "danger"
      case 'temperature':
        if (value >= 15 && value <= 25) return "good"
        if (value >= 10 && value <= 30) return "warning"
        return "danger"
      case 'kh':
        if (value >= 3 && value <= 8) return "good"
        if (value >= 2 && value <= 10) return "warning"
        return "danger"
      case 'gh':
        if (value >= 4 && value <= 12) return "good"
        if (value >= 3 && value <= 15) return "warning"
        return "danger"
      case 'nitrite':
        // 0 mg/l is actually good for nitrite
        if (value <= 0.3) return "good"
        if (value <= 0.5) return "warning"
        return "danger"
      case 'nitrate':
        if (value < 25) return "good"
        if (value < 50) return "warning"
        return "danger"
      case 'phosphate':
        // 0 mg/l is actually good for phosphate
        if (value < 0.5) return "good"
        if (value < 1.0) return "warning"
        return "danger"
      default:
        return "warning"
    }
  }

  const currentTemp = waterParameters.find(p => p.name === t("waterParameters.temperature"))?.value || 0

  // Generate dynamic alerts based on actual water parameter values
  const generateAlerts = () => {
    const alerts: Array<{
      type: "warning" | "danger"
      title: string
      description: string
      parameter: string
    }> = []

    waterParameters.forEach(param => {
      if (param.status === "danger") {
        switch (param.name) {
          case t("waterParameters.ph"):
            alerts.push({
              type: "danger",
              title: t("dashboard.criticalPhLevel"),
              description: param.value < 6.5 
                ? t("dashboard.lowPhWarning")
                : t("dashboard.highPhWarning"),
              parameter: "ph"
            })
            break
          case t("waterParameters.temperature"):
            alerts.push({
              type: "danger",
              title: t("dashboard.criticalTemperature"),
              description: param.value < 10 
                ? t("dashboard.lowTempWarning")
                : t("dashboard.highTempWarning"),
              parameter: "temperature"
            })
            break
          case t("waterParameters.nitrite"):
            alerts.push({
              type: "danger",
              title: t("dashboard.dangerousNitriteLevel"),
              description: t("dashboard.nitriteDangerWarning"),
              parameter: "nitrite"
            })
            break
          case t("waterParameters.nitrate"):
            alerts.push({
              type: "danger",
              title: t("dashboard.dangerousNitrateLevel"),
              description: t("dashboard.nitrateDangerWarning"),
              parameter: "nitrate"
            })
            break
          case t("waterParameters.phosphate"):
            alerts.push({
              type: "danger",
              title: t("dashboard.dangerousPhosphateLevel"),
              description: t("dashboard.phosphateDangerWarning"),
              parameter: "phosphate"
            })
            break
        }
      } else if (param.status === "warning") {
        switch (param.name) {
          case t("waterParameters.ph"):
            alerts.push({
              type: "warning",
              title: t("dashboard.elevatedPhLevel"),
              description: t("dashboard.phWarning"),
              parameter: "ph"
            })
            break
          case t("waterParameters.temperature"):
            alerts.push({
              type: "warning",
              title: t("dashboard.elevatedTemperature"),
              description: t("dashboard.temperatureWarning"),
              parameter: "temperature"
            })
            break
          case t("waterParameters.nitrate"):
            alerts.push({
              type: "warning",
              title: t("dashboard.elevatedNitrates"),
              description: t("dashboard.nitrateWarning"),
              parameter: "nitrate"
            })
            break
          case t("waterParameters.phosphate"):
            alerts.push({
              type: "warning",
              title: t("dashboard.highPhosphateLevel"),
              description: t("dashboard.phosphateWarning"),
              parameter: "phosphate"
            })
            break
        }
      }
    })

    return alerts
  }

  const alerts = generateAlerts()

  const handleParameterClick = (parameterName: string) => {
    const parameterRoutes: Record<string, string> = {
      [t("waterParameters.ph")]: "ph",
      [t("waterParameters.temperature")]: "temperature",
      [t("waterParameters.kh")]: "kh", 
      [t("waterParameters.gh")]: "gh",
      [t("waterParameters.nitrite")]: "nitrite",
      [t("waterParameters.nitrate")]: "nitrate",
      [t("waterParameters.phosphate")]: "phosphate"
    }
    
    const route = parameterRoutes[parameterName]
    if (route) {
      onNavigate(route)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good": return "bg-success text-success-foreground"
      case "warning": return "bg-warning text-warning-foreground"
      case "danger": return "bg-destructive text-destructive-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "good": return t("waterParameters.optimal")
      case "warning": return t("waterParameters.warning")
      case "danger": return t("waterParameters.critical")
      default: return status
    }
  }

  if (loading) {
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">{t("dashboard.subtitle")}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className="bg-gradient-water cursor-pointer hover:shadow-water transition-shadow"
          onClick={() => onNavigate("temperature")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("waterParameters.temperature")}</p>
                <p className="text-2xl font-bold">{currentTemp}°C</p>
              </div>
              <Thermometer className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard.koiCount")}</p>
                <p className="text-2xl font-bold">{koiCount}</p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard.lastUpdated")}</p>
                <p className="text-2xl font-bold">{lastUpdate}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Alerts */}
      {alerts.length > 0 && (
        <Card className={alerts.some(a => a.type === "danger") ? "border-destructive" : "border-warning"}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${alerts.some(a => a.type === "danger") ? "text-destructive" : "text-warning"}`}>
              <AlertTriangle className="h-5 w-5" />
              {t("dashboard.alertsRecommendations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${alert.type === "danger" ? "bg-destructive" : "bg-warning"}`}></div>
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {alert.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Water Parameters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-primary" />
                {t("waterParameters.title")}
              </CardTitle>
              <CardDescription>{t("dashboard.currentWaterQuality")}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => onNavigate("parameters")} size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {t("waterParameters.addReading")}
              </Button>
              <Button onClick={() => onNavigate("water-history")} variant="outline" size="sm" className="w-full sm:w-auto">
                <History className="h-4 w-4 mr-2" />
                Bekijk eerdere metingen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waterParameters.map((param) => (
              <Card 
                key={param.name}
                className="cursor-pointer hover:shadow-water transition-shadow"
                onClick={() => handleParameterClick(param.name)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{param.name}</h3>
                    <Badge className={getStatusColor(param.status)}>
                      {getStatusText(param.status)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">
                      {param.value}{param.unit}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard.ideal")}: {param.range}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Smart Recommendations */}
      {!recommendationsLoading && (recommendations.length > 0 || (riskAssessment && riskAssessment.overall_risk !== 'low')) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Slimme Aanbevelingen
                </CardTitle>
                <CardDescription>
                  AI-gedreven advies gebaseerd op je waterkwaliteit
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshRecommendations}
                disabled={recommendationsLoading}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Vernieuwen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <RecommendationsPanel
              recommendations={recommendations}
              riskAssessment={riskAssessment!}
              onRecommendationAction={(recommendationId, action) => {
                // Refresh recommendations after action
                setTimeout(() => {
                  refreshRecommendations()
                }, 1000)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-water transition-shadow" onClick={() => onNavigate("parameters")}>
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboard.logWaterParameters")}</CardTitle>
            <CardDescription>{t("dashboard.recordNewMeasurements")}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-water transition-shadow" onClick={() => onNavigate("koi")}>
          <CardHeader>
            <CardTitle className="text-lg">{t("dashboard.manageKoi")}</CardTitle>
            <CardDescription>{t("dashboard.addUpdateKoiInfo")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}