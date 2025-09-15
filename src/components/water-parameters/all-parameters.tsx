import { ParameterPageTemplate } from "./parameter-page-template"
import { useParameterData } from "@/hooks/use-parameter-data"
import { useTranslation } from "react-i18next"

interface ParameterPageProps {
  onNavigate: (tab: string) => void
}

export const KhPage = ({ onNavigate }: ParameterPageProps) => {
  const getKhStatus = (value: number): "optimal" | "warning" | "critical" => {
    if (value >= 6 && value <= 10) return "optimal"
    if (value >= 4 && value <= 12) return "warning"
    return "critical"
  }

  const { historicData, currentValue, status, loading } = useParameterData({
    parameterType: 'kh',
    getStatus: getKhStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading KH data...</p>
        </div>
      </div>
    )
  }

  return (
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="KH (Carbonate Hardness)"
      parameterKey="kh"
      currentValue={currentValue}
      unit="°dKH"
      idealRange="6 - 10°dKH"
      status={status}
      historicData={historicData}
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
}

export const GhPage = ({ onNavigate }: ParameterPageProps) => {
  const getGhStatus = (value: number): "optimal" | "warning" | "critical" => {
    if (value >= 6 && value <= 12) return "optimal"
    if (value >= 4 && value <= 15) return "warning"
    return "critical"
  }

  const { historicData, currentValue, status, loading } = useParameterData({
    parameterType: 'gh',
    getStatus: getGhStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading GH data...</p>
        </div>
      </div>
    )
  }

  return (
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="GH (General Hardness)"
      parameterKey="gh"
      currentValue={currentValue}
      unit="°dGH"
      idealRange="6 - 12°dGH"
      status={status}
      historicData={historicData}
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
}

export const NitritePage = ({ onNavigate }: ParameterPageProps) => {
  const { t } = useTranslation()
  
  const getNitriteStatus = (value: number): "optimal" | "warning" | "critical" => {
    // 0 mg/l is actually good for nitrite
    if (value <= 0.3) return "optimal"
    if (value <= 0.5) return "warning"
    return "critical"
  }

  const { historicData, currentValue, status, loading } = useParameterData({
    parameterType: 'nitrite',
    getStatus: getNitriteStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("loading")} Nitriet data...</p>
        </div>
      </div>
    )
  }

  return (
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="Nitriet (NO₂)"
      parameterKey="nitrite"
      currentValue={currentValue}
      unit=" mg/L"
      idealRange="0 - 0.3 mg/L"
      status={status}
      historicData={historicData}
      infoContent={{
        description: "Giftig tussenproduct in de stikstofcyclus",
        importance: "Nitriet is zeer giftig voor koi, zelfs bij lage concentraties",
        effects: [
          "Verstoort zuurstoftransport in het bloed",
          "Veroorzaakt 'bruine bloedziekte' bij hoge niveaus",
          "Vermindert koi-immuniteit en eetlust",
          "Kan dodelijk zijn boven 0.5 mg/L"
        ],
        management: [
          "Zorg voor een goed werkend biologisch filter",
          "Vermijd overbevolking of overvoeding",
          "Voeg nuttige bacteriën toe",
          "Verhoog beluchting en waterstroom"
        ]
      }}
    />
  )
}

export const NitratePage = ({ onNavigate }: ParameterPageProps) => {
  const { t } = useTranslation()
  
  const getNitrateStatus = (value: number): "optimal" | "warning" | "critical" => {
    if (value < 25) return "optimal"
    if (value < 50) return "warning"
    return "critical"
  }

  const { historicData, currentValue, status, loading } = useParameterData({
    parameterType: 'nitrate',
    getStatus: getNitrateStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("loading")} Nitraat data...</p>
        </div>
      </div>
    )
  }

  return (
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="Nitraat (NO₃)"
      parameterKey="nitrate"
      currentValue={currentValue}
      unit=" mg/L"
      idealRange="< 25 mg/L"
      status={status}
      historicData={historicData}
      infoContent={{
        description: "Eindproduct van de stikstofcyclus",
        importance: "Nitraatophoping geeft filtereffectiviteit en voedingsniveaus aan",
        effects: [
          "Hoge niveaus verminderen koi-immuniteit",
          "Bevordert algenbloei boven 25 mg/L",
          "Veroorzaakt langetermijn gezondheidsproblemen",
          "Geeft overvoeding of onvoldoende filtratie aan"
        ],
        management: [
          "Regelmatige waterverversing om nitraten te verdunnen",
          "Voeg waterplanten toe om nitraten te consumeren",
          "Verminder voeding als niveaus hoog zijn",
          "Upgrade biologische filtratiecapaciteit"
        ]
      }}
    />
  )
}

export const PhosphatePage = ({ onNavigate }: ParameterPageProps) => {
  const getPhosphateStatus = (value: number): "optimal" | "warning" | "critical" => {
    // 0 mg/l is actually good for phosphate
    if (value < 0.5) return "optimal"
    if (value < 1.0) return "warning"
    return "critical"
  }

  const { historicData, currentValue, status, loading } = useParameterData({
    parameterType: 'phosphate',
    getStatus: getPhosphateStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Phosphate data...</p>
        </div>
      </div>
    )
  }

  return (
    <ParameterPageTemplate
      onNavigate={onNavigate}
      parameterName="Phosphate (PO₄)"
      parameterKey="phosphate"
      currentValue={currentValue}
      unit=" mg/L"
      idealRange="< 0.5 mg/L"
      status={status}
      historicData={historicData}
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
}