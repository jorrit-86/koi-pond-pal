import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Info } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts"

interface ParameterPageProps {
  onNavigate: (tab: string) => void
  parameterName: string
  currentValue: number | string
  unit: string
  idealRange: string
  status: "optimal" | "warning" | "critical"
  historicData: Array<{ date: string; value: number; time: string }>
  infoContent: {
    description: string
    importance: string
    effects: string[]
    management: string[]
  }
}

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--primary))",
  },
}

export const ParameterPageTemplate = ({
  onNavigate,
  parameterName,
  currentValue,
  unit,
  idealRange,
  status,
  historicData,
  infoContent
}: ParameterPageProps) => {
  const [showInfo, setShowInfo] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "bg-emerald-500/10 text-emerald-600 border-emerald-200"
      case "warning": return "bg-amber-500/10 text-amber-600 border-amber-200"
      case "critical": return "bg-red-500/10 text-red-600 border-red-200"
      default: return "bg-gray-500/10 text-gray-600 border-gray-200"
    }
  }

  const getYAxisDomain = () => {
    const values = historicData.map(d => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const padding = (max - min) * 0.2
    return [Math.max(0, min - padding), max + padding]
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
            <h1 className="text-3xl font-bold">{parameterName}</h1>
            <p className="text-muted-foreground">{infoContent.description}</p>
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
          <CardDescription>Latest {parameterName.toLowerCase()} measurement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl font-bold text-primary">
                {currentValue}{unit}
              </div>
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
          <CardTitle>{parameterName} History</CardTitle>
          <CardDescription>Last 7 days of {parameterName.toLowerCase()} measurements</CardDescription>
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
                  domain={getYAxisDomain()}
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
            <CardTitle>About {parameterName}</CardTitle>
            <CardDescription>{infoContent.importance}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Effects</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {infoContent.effects.map((effect, index) => (
                  <li key={index}>• {effect}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Management Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {infoContent.management.map((tip, index) => (
                  <li key={index}>• {tip}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}