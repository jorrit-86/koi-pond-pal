import { ParameterPageTemplate } from "./parameter-page-template"
import { useParameterData } from "@/hooks/use-parameter-data"

interface PhPageProps {
  onNavigate: (tab: string) => void
}

export const PhPage = ({ onNavigate }: PhPageProps) => {
  const getPhStatus = (value: number): "optimal" | "warning" | "critical" => {
    if (value >= 6.8 && value <= 8.2) return "optimal"
    if (value >= 6.5 && value <= 8.5) return "warning"
    return "critical"
  }

  const { historicData, currentValue, status, loading } = useParameterData({
    parameterType: 'ph',
    getStatus: getPhStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pH data...</p>
        </div>
      </div>
    )
  }

  return (
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="pH Level"
      parameterKey="ph"
      currentValue={currentValue}
      unit=""
      idealRange="6.8 - 8.2"
      status={status}
      historicData={historicData}
      infoContent={{
        description: "Water acidity/alkalinity measurement",
        importance: "Understanding water acidity and alkalinity",
        effects: [
          "Low pH (acidic): Can cause gill damage, stress, and reduced immunity",
          "High pH (alkaline): May lead to ammonia toxicity and eye/skin irritation",
          "pH swings: Rapid changes are more dangerous than being slightly outside range"
        ],
        management: [
          "Lower pH: Use pH down products or introduce organic matter",
          "Raise pH: Add baking soda or pH up products gradually",
          "Stabilize: Maintain proper KH (buffering capacity) levels"
        ]
      }}
    />
  )
}