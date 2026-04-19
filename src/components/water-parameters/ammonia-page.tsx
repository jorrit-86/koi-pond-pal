import { useState } from "react"
import { ParameterPageTemplate } from "./parameter-page-template"
import { useParameterDataWithTimeRange } from "@/hooks/use-parameter-data-with-time-range"

interface AmmoniaPageProps {
  onNavigate: (tab: string) => void
}

export const AmmoniaPage = ({ onNavigate }: AmmoniaPageProps) => {
  const [timeRange, setTimeRange] = useState("30d")

  const getAmmoniaStatus = (value: number): "optimal" | "warning" | "critical" => {
    if (value <= 0.05) return "optimal"
    if (value <= 0.1) return "warning"
    return "critical"
  }

  const { historicData, currentValue, status, loading, hasDataInTimeRange, hasAnyDataInDatabase, timeRangeInfo } = useParameterDataWithTimeRange({
    parameterType: 'ammonia',
    getStatus: getAmmoniaStatus
  }, timeRange)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading ammonia data...</p>
        </div>
      </div>
    )
  }

  return (
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="NH₃/NH₄ (Ammonia)"
      parameterKey="ammonia"
      currentValue={currentValue}
      unit="mg/l"
      idealRange="0 - 0.05 mg/l"
      status={status}
      historicData={historicData}
      hasDataInTimeRange={hasDataInTimeRange}
      hasAnyDataInDatabase={hasAnyDataInDatabase}
      timeRangeInfo={timeRangeInfo}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      infoContent={{
        description: "Ammonia (NH₃/NH₄) is a toxic compound produced by fish waste and decomposing organic matter",
        importance: "Critical water quality parameter that can be lethal to fish",
        effects: [
          "Low levels (0-0.05 mg/l): Safe for fish, normal biological processes",
          "Moderate levels (0.05-0.1 mg/l): Stress, reduced immunity, gill damage",
          "High levels (>0.1 mg/l): Lethal toxicity, fish death, severe gill damage"
        ],
        management: [
          "Immediate water change: 25-50% water change to dilute ammonia",
          "Biological filtration: Ensure adequate beneficial bacteria",
          "Reduce feeding: Less food = less waste = less ammonia",
          "Add beneficial bacteria: Use commercial bacterial supplements",
          "Check pH: Higher pH increases ammonia toxicity"
        ]
      }}
    />
  )
}
