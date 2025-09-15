import { ParameterPageTemplate } from "./parameter-page-template"
import { useParameterData } from "@/hooks/use-parameter-data"

interface TemperaturePageProps {
  onNavigate: (tab: string) => void
}

export const TemperaturePage = ({ onNavigate }: TemperaturePageProps) => {
  const getTemperatureStatus = (value: number): "optimal" | "warning" | "critical" => {
    if (value >= 15 && value <= 25) return "optimal"
    if (value >= 10 && value <= 30) return "warning"
    return "critical"
  }

  const { historicData, currentValue, status, loading } = useParameterData({
    parameterType: 'temperature',
    getStatus: getTemperatureStatus
  })

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
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="Water Temperature"
      parameterKey="temperature"
      currentValue={currentValue}
      unit="°C"
      idealRange="15 - 25°C"
      status={status}
      historicData={historicData}
      infoContent={{
        description: "Pond temperature monitoring",
        importance: "Understanding temperature effects on koi health",
        effects: [
          "Metabolism: Warmer water increases koi activity and appetite",
          "Oxygen levels: Warmer water holds less dissolved oxygen",
          "Disease risk: Rapid temperature changes stress fish",
          "Beneficial bacteria: Activity decreases in cold water"
        ],
        management: [
          "Provide shade in summer to prevent overheating",
          "Use pond heaters in extreme cold climates",
          "Ensure proper aeration, especially in warm weather",
          "Monitor daily during seasonal transitions"
        ]
      }}
    />
  )
}