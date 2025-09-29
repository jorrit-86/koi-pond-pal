import { useState } from "react"
import { ParameterPageTemplate } from "./parameter-page-template"
import { useCombinedTemperatureData } from "@/hooks/use-combined-temperature-data"
import { Card, CardContent } from "@/components/ui/card"

interface TemperaturePageProps {
  onNavigate: (tab: string) => void
}

export const TemperaturePage = ({ onNavigate }: TemperaturePageProps) => {
  const [timeRange, setTimeRange] = useState("24h")
  const { 
    combinedData, 
    currentValue, 
    status, 
    loading, 
    error, 
    sensorTemp, 
    sensorLastUpdate 
  } = useCombinedTemperatureData(timeRange)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading temperature data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <span className="text-sm">⚠️ Error loading temperature data: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combined Data Chart */}
      <ParameterPageTemplate
        onNavigate={onNavigate}
        parameterName="Water Temperatuur"
        parameterKey="temperature"
        currentValue={currentValue || 0}
        unit="°C"
        idealRange="15 - 25°C"
        status={status}
        historicData={combinedData}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        sensorData={{
          value: sensorTemp,
          lastUpdate: sensorLastUpdate
        }}
        infoContent={{
          description: "Vijver temperatuur monitoring",
          importance: "Begrijp de effecten van temperatuur op koi gezondheid",
          effects: [
            "Metabolisme: Warmer water verhoogt koi activiteit en eetlust",
            "Zuurstofniveau: Warmer water bevat minder opgeloste zuurstof",
            "Ziekterisico: Snelle temperatuurveranderingen stressen vissen",
            "Gunstige bacteriën: Activiteit neemt af in koud water"
          ],
          management: [
            "Zorg voor schaduw in de zomer om oververhitting te voorkomen",
            "Gebruik vijververwarmers in extreme koude klimaten",
            "Zorg voor goede beluchting, vooral bij warm weer",
            "Monitor dagelijks tijdens seizoensovergangen"
          ]
        }}
      />
    </div>
  )
}