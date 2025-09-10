import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Info } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts"

interface PhPageProps {
  onNavigate: (tab: string) => void
}

// Mock historic data
const historicData = [
  { date: "2024-01-01", value: 7.2, time: "Jan 1" },
  { date: "2024-01-02", value: 7.4, time: "Jan 2" },
  { date: "2024-01-03", value: 7.1, time: "Jan 3" },
  { date: "2024-01-04", value: 7.3, time: "Jan 4" },
  { date: "2024-01-05", value: 7.5, time: "Jan 5" },
  { date: "2024-01-06", value: 7.2, time: "Jan 6" },
  { date: "2024-01-07", value: 7.4, time: "Jan 7" },
]

const chartConfig = {
  value: {
    label: "pH Level",
    color: "hsl(var(--primary))",
  },
}

export const PhPage = ({ onNavigate }: PhPageProps) => {
  const [showInfo, setShowInfo] = useState(false)
  const currentValue = 7.4
  const status = "optimal"
  const idealRange = "6.8 - 7.8"

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
            <h1 className="text-3xl font-bold">pH Level</h1>
            <p className="text-muted-foreground">Water acidity/alkalinity measurement</p>
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
          <CardDescription>Latest pH measurement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl font-bold text-primary">{currentValue}</div>
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
          <CardTitle>pH History</CardTitle>
          <CardDescription>Last 7 days of pH measurements</CardDescription>
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
                  domain={[6.5, 8.0]}
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
            <CardTitle>About pH Level</CardTitle>
            <CardDescription>Understanding water acidity and alkalinity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">What is pH?</h4>
              <p className="text-sm text-muted-foreground">
                pH measures the acidity or alkalinity of pond water on a scale of 0-14. A pH of 7 is neutral, 
                below 7 is acidic, and above 7 is alkaline (basic).
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Ideal Range for Koi</h4>
              <p className="text-sm text-muted-foreground">
                Koi thrive in slightly alkaline water with a pH between 6.8 and 7.8. This range supports 
                optimal gill function and overall fish health.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Effects of Incorrect pH</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Low pH (acidic):</strong> Can cause gill damage, stress, and reduced immunity</li>
                <li>• <strong>High pH (alkaline):</strong> May lead to ammonia toxicity and eye/skin irritation</li>
                <li>• <strong>pH swings:</strong> Rapid changes are more dangerous than being slightly outside range</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">How to Adjust pH</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Lower pH:</strong> Use pH down products or introduce organic matter</li>
                <li>• <strong>Raise pH:</strong> Add baking soda or pH up products gradually</li>
                <li>• <strong>Stabilize:</strong> Maintain proper KH (buffering capacity) levels</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}