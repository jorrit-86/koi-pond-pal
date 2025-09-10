import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Info } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts"

interface TemperaturePageProps {
  onNavigate: (tab: string) => void
}

// Mock historic data
const historicData = [
  { date: "2024-01-01", value: 18, time: "Jan 1" },
  { date: "2024-01-02", value: 19, time: "Jan 2" },
  { date: "2024-01-03", value: 20, time: "Jan 3" },
  { date: "2024-01-04", value: 21, time: "Jan 4" },
  { date: "2024-01-05", value: 20, time: "Jan 5" },
  { date: "2024-01-06", value: 18, time: "Jan 6" },
  { date: "2024-01-07", value: 19, time: "Jan 7" },
]

const chartConfig = {
  value: {
    label: "Temperature (°C)",
    color: "hsl(var(--primary))",
  },
}

export const TemperaturePage = ({ onNavigate }: TemperaturePageProps) => {
  const [showInfo, setShowInfo] = useState(false)
  const currentValue = 19
  const status = "optimal"
  const idealRange = "15 - 25°C"

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "bg-emerald-500/10 text-emerald-600 border-emerald-200"
      case "warning": return "bg-amber-500/10 text-amber-600 border-amber-200"
      case "critical": return "bg-red-500/10 text-red-600 border-red-200"
      default: return "bg-gray-500/10 text-gray-600 border-gray-200"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Water Temperature</h1>
            <p className="text-muted-foreground">Pond temperature monitoring</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowInfo(!showInfo)}>
          <Info className="h-4 w-4 mr-2" />
          Info
        </Button>
      </div>

      {/* Current Value Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Reading</CardTitle>
          <CardDescription>Latest temperature measurement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl font-bold text-primary">{currentValue}°C</div>
              <div className="text-sm text-muted-foreground">
                <div>Ideal: {idealRange}</div>
                <div className="text-xs">Last updated: 2 hours ago</div>
              </div>
            </div>
            <Badge className={getStatusColor(status)}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Historic Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Temperature History</CardTitle>
          <CardDescription>Last 7 days of temperature readings</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicData}>
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  domain={[10, 30]}
                  tick={{ fontSize: 12 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Information Panel */}
      {showInfo && (
        <Card>
          <CardHeader>
            <CardTitle>About Water Temperature</CardTitle>
            <CardDescription>Understanding temperature effects on koi health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Importance of Temperature</h4>
              <p className="text-sm text-muted-foreground">
                Water temperature directly affects koi metabolism, immune system, feeding patterns, 
                and overall health. It's one of the most critical parameters to monitor.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Seasonal Temperature Ranges</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Spring/Fall:</strong> 10-20°C - Moderate feeding, active but careful</li>
                <li>• <strong>Summer:</strong> 20-28°C - Peak activity, maximum feeding</li>
                <li>• <strong>Winter:</strong> 4-10°C - Minimal feeding, reduced activity</li>
                <li>• <strong>Critical:</strong> Below 4°C or above 30°C - Stress conditions</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Temperature Effects</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Metabolism:</strong> Warmer water increases koi activity and appetite</li>
                <li>• <strong>Oxygen levels:</strong> Warmer water holds less dissolved oxygen</li>
                <li>• <strong>Disease risk:</strong> Rapid temperature changes stress fish</li>
                <li>• <strong>Beneficial bacteria:</strong> Activity decreases in cold water</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Temperature Management</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Provide shade in summer to prevent overheating</li>
                <li>• Use pond heaters in extreme cold climates</li>
                <li>• Ensure proper aeration, especially in warm weather</li>
                <li>• Monitor daily during seasonal transitions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}