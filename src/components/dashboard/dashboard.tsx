import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Thermometer, Activity, Droplets, AlertTriangle, TrendingUp, Plus } from "lucide-react"

interface WaterParameter {
  name: string
  value: number
  unit: string
  status: "good" | "warning" | "danger"
  range: string
}

interface DashboardProps {
  onNavigate: (tab: string) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  // Mock data - will be replaced with real data later
  const waterParameters: WaterParameter[] = [
    { name: "pH", value: 7.2, unit: "", status: "good", range: "6.8-8.2" },
    { name: "KH", value: 4.5, unit: "°dH", status: "good", range: "3-8°dH" },
    { name: "GH", value: 8.2, unit: "°dH", status: "warning", range: "4-12°dH" },
    { name: "Nitrite", value: 0.1, unit: "mg/l", status: "good", range: "0-0.3mg/l" },
    { name: "Nitrate", value: 15, unit: "mg/l", status: "warning", range: "<25mg/l" },
    { name: "Phosphate", value: 0.8, unit: "mg/l", status: "danger", range: "<0.5mg/l" },
  ]

  const currentTemp = 18.5
  const koiCount = 7
  const lastUpdate = "2 hours ago"

  const handleParameterClick = (parameterName: string) => {
    const parameterRoutes: Record<string, string> = {
      "pH": "ph",
      "KH": "kh", 
      "GH": "gh",
      "Nitrite": "nitrite",
      "Nitrate": "nitrate",
      "Phosphate": "phosphate"
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Monitor your koi pond's health at a glance</p>
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
                <p className="text-sm font-medium text-muted-foreground">Water Temperature</p>
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
                <p className="text-sm font-medium text-muted-foreground">Koi Count</p>
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
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-2xl font-bold">{lastUpdate}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Water Parameters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-primary" />
                Water Parameters
              </CardTitle>
              <CardDescription>Current water quality measurements</CardDescription>
            </div>
            <Button onClick={() => onNavigate("parameters")} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Reading
            </Button>
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
                      {param.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">
                      {param.value}{param.unit}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ideal: {param.range}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-water transition-shadow" onClick={() => onNavigate("parameters")}>
          <CardHeader>
            <CardTitle className="text-lg">Log Water Parameters</CardTitle>
            <CardDescription>Record new water quality measurements</CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-water transition-shadow" onClick={() => onNavigate("koi")}>
          <CardHeader>
            <CardTitle className="text-lg">Manage Koi</CardTitle>
            <CardDescription>Add or update information about your koi</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="border-warning">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Alerts & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-destructive rounded-full mt-2"></div>
              <div>
                <p className="font-medium">High Phosphate Level</p>
                <p className="text-sm text-muted-foreground">
                  Phosphate is at 0.8mg/l, above recommended levels. Consider water change or phosphate remover.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-warning rounded-full mt-2"></div>
              <div>
                <p className="font-medium">Elevated Nitrates</p>
                <p className="text-sm text-muted-foreground">
                  Nitrate levels are getting high. A partial water change is recommended.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}