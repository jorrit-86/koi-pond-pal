import { ParameterPageTemplate } from "./parameter-page-template"

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

export const TemperaturePage = ({ onNavigate }: TemperaturePageProps) => (
  <ParameterPageTemplate
    onNavigate={onNavigate}
    parameterName="Water Temperature"
    parameterKey="temperature"
    currentValue={19}
    unit="°C"
    idealRange="15 - 25°C"
    status="optimal"
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