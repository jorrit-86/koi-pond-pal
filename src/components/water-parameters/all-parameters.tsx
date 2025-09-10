import { ParameterPageTemplate } from "./parameter-page-template"

interface ParameterPageProps {
  onNavigate: (tab: string) => void
}

// Mock historic data for different parameters
const khData = [
  { date: "2024-01-01", value: 6, time: "Jan 1" },
  { date: "2024-01-02", value: 7, time: "Jan 2" },
  { date: "2024-01-03", value: 5, time: "Jan 3" },
  { date: "2024-01-04", value: 6, time: "Jan 4" },
  { date: "2024-01-05", value: 8, time: "Jan 5" },
  { date: "2024-01-06", value: 6, time: "Jan 6" },
  { date: "2024-01-07", value: 7, time: "Jan 7" },
]

const ghData = [
  { date: "2024-01-01", value: 9, time: "Jan 1" },
  { date: "2024-01-02", value: 10, time: "Jan 2" },
  { date: "2024-01-03", value: 8, time: "Jan 3" },
  { date: "2024-01-04", value: 9, time: "Jan 4" },
  { date: "2024-01-05", value: 11, time: "Jan 5" },
  { date: "2024-01-06", value: 9, time: "Jan 6" },
  { date: "2024-01-07", value: 10, time: "Jan 7" },
]

const nitriteData = [
  { date: "2024-01-01", value: 0.1, time: "Jan 1" },
  { date: "2024-01-02", value: 0.05, time: "Jan 2" },
  { date: "2024-01-03", value: 0.08, time: "Jan 3" },
  { date: "2024-01-04", value: 0.02, time: "Jan 4" },
  { date: "2024-01-05", value: 0.15, time: "Jan 5" },
  { date: "2024-01-06", value: 0.03, time: "Jan 6" },
  { date: "2024-01-07", value: 0.05, time: "Jan 7" },
]

const nitrateData = [
  { date: "2024-01-01", value: 15, time: "Jan 1" },
  { date: "2024-01-02", value: 18, time: "Jan 2" },
  { date: "2024-01-03", value: 12, time: "Jan 3" },
  { date: "2024-01-04", value: 20, time: "Jan 4" },
  { date: "2024-01-05", value: 25, time: "Jan 5" },
  { date: "2024-01-06", value: 16, time: "Jan 6" },
  { date: "2024-01-07", value: 18, time: "Jan 7" },
]

const phosphateData = [
  { date: "2024-01-01", value: 0.02, time: "Jan 1" },
  { date: "2024-01-02", value: 0.03, time: "Jan 2" },
  { date: "2024-01-03", value: 0.01, time: "Jan 3" },
  { date: "2024-01-04", value: 0.04, time: "Jan 4" },
  { date: "2024-01-05", value: 0.05, time: "Jan 5" },
  { date: "2024-01-06", value: 0.02, time: "Jan 6" },
  { date: "2024-01-07", value: 0.03, time: "Jan 7" },
]

export const KhPage = ({ onNavigate }: ParameterPageProps) => (
  <ParameterPageTemplate
    onNavigate={onNavigate}
    parameterName="KH (Carbonate Hardness)"
    parameterKey="kh"
    currentValue={7}
    unit="°dKH"
    idealRange="6 - 10°dKH"
    status="optimal"
    historicData={khData}
    infoContent={{
      description: "Buffering capacity of pond water",
      importance: "KH measures the water's ability to resist pH changes",
      effects: [
        "Low KH: pH swings, unstable water chemistry",
        "High KH: Difficulty adjusting pH when needed",
        "Optimal KH: Stable pH, reduced stress on koi",
        "KH affects the nitrogen cycle efficiency"
      ],
      management: [
        "Add bicarbonate products to raise KH",
        "Use RO water mixing to lower KH gradually",
        "Test weekly during seasonal changes",
        "Maintain alongside proper pH levels"
      ]
    }}
  />
)

export const GhPage = ({ onNavigate }: ParameterPageProps) => (
  <ParameterPageTemplate
    onNavigate={onNavigate}
    parameterName="GH (General Hardness)"
    parameterKey="gh"
    currentValue={10}
    unit="°dGH"
    idealRange="6 - 12°dGH"
    status="optimal"
    historicData={ghData}
    infoContent={{
      description: "Total mineral content in pond water",
      importance: "GH measures dissolved minerals, particularly calcium and magnesium",
      effects: [
        "Low GH: Poor bone/scale development, osmotic stress",
        "High GH: Reduced medication effectiveness",
        "Optimal GH: Healthy bone development, proper osmoregulation",
        "Affects koi color development and vitality"
      ],
      management: [
        "Add calcium/magnesium supplements to raise GH",
        "Use reverse osmosis water to lower GH",
        "Test monthly as GH changes slowly",
        "Consider local water source characteristics"
      ]
    }}
  />
)

export const NitritePage = ({ onNavigate }: ParameterPageProps) => (
  <ParameterPageTemplate
    onNavigate={onNavigate}
    parameterName="Nitrite (NO₂)"
    parameterKey="nitrite"
    currentValue={0.05}
    unit=" mg/L"
    idealRange="0 - 0.1 mg/L"
    status="optimal"
    historicData={nitriteData}
    infoContent={{
      description: "Toxic intermediate in the nitrogen cycle",
      importance: "Nitrite is highly toxic to koi even at low concentrations",
      effects: [
        "Interferes with oxygen transport in blood",
        "Causes 'brown blood disease' at high levels",
        "Reduces koi immunity and appetite",
        "Can be lethal above 0.5 mg/L"
      ],
      management: [
        "Ensure biological filter is properly cycled",
        "Don't overstock pond or overfeed",
        "Add beneficial bacteria supplements",
        "Increase aeration and water flow"
      ]
    }}
  />
)

export const NitratePage = ({ onNavigate }: ParameterPageProps) => (
  <ParameterPageTemplate
    onNavigate={onNavigate}
    parameterName="Nitrate (NO₃)"
    parameterKey="nitrate"
    currentValue={18}
    unit=" mg/L"
    idealRange="< 25 mg/L"
    status="optimal"
    historicData={nitrateData}
    infoContent={{
      description: "End product of the nitrogen cycle",
      importance: "Nitrate accumulation indicates filter effectiveness and feeding levels",
      effects: [
        "High levels reduce koi immunity",
        "Promotes algae growth above 25 mg/L",
        "Causes long-term health issues",
        "Indicates overfeeding or inadequate filtration"
      ],
      management: [
        "Regular water changes to dilute nitrates",
        "Add aquatic plants to consume nitrates",
        "Reduce feeding if levels are high",
        "Upgrade biological filtration capacity"
      ]
    }}
  />
)

export const PhosphatePage = ({ onNavigate }: ParameterPageProps) => (
  <ParameterPageTemplate
    onNavigate={onNavigate}
    parameterName="Phosphate (PO₄)"
    parameterKey="phosphate"
    currentValue={0.03}
    unit=" mg/L"
    idealRange="< 0.05 mg/L"
    status="optimal"
    historicData={phosphateData}
    infoContent={{
      description: "Nutrient that promotes algae growth",
      importance: "Phosphate levels directly correlate with algae problems",
      effects: [
        "High levels cause excessive algae growth",
        "Reduces water clarity and oxygen levels",
        "Creates unsightly green water conditions",
        "Indicates overfeeding or decaying organic matter"
      ],
      management: [
        "Use phosphate-removing filter media",
        "Reduce feeding and remove uneaten food",
        "Regular gravel vacuuming and debris removal",
        "Add phosphate-absorbing plants"
      ]
    }}
  />
)