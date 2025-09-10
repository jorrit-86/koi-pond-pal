import { ParameterPageTemplate } from "./parameter-page-template"

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

export const PhPage = ({ onNavigate }: PhPageProps) => (
  <ParameterPageTemplate
    onNavigate={onNavigate}
    parameterName="pH Level"
    parameterKey="ph"
    currentValue={7.4}
    unit=""
    idealRange="6.8 - 7.8"
    status="optimal"
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