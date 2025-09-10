import { useState } from "react"
import { Navigation } from "@/components/layout/navigation"
import { Dashboard } from "@/components/dashboard/dashboard"
import { ParameterForm } from "@/components/water-parameters/parameter-form"
import { KoiManagement } from "@/components/koi/koi-management"
import { SettingsPage } from "@/components/settings/settings-page"
import { PhPage } from "@/components/water-parameters/ph-page"
import { TemperaturePage } from "@/components/water-parameters/temperature-page"
import { KhPage, GhPage, NitritePage, NitratePage, PhosphatePage } from "@/components/water-parameters/all-parameters"

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard")

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onNavigate={setActiveTab} />
      case "parameters":
        return <ParameterForm onNavigate={setActiveTab} />
      case "koi":
        return <KoiManagement onNavigate={setActiveTab} />
      case "analytics":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Analytics</h1>
              <p className="text-muted-foreground">Historical data and trends coming soon with Supabase integration</p>
            </div>
            <div className="p-8 text-center bg-gradient-water rounded-lg border border-border">
              <h3 className="text-lg font-semibold mb-2">Charts & Historical Data</h3>
              <p className="text-muted-foreground">This section will show water parameter trends over time once you connect Supabase for data storage.</p>
            </div>
          </div>
        )
      case "settings":
        return <SettingsPage />
      case "ph":
        return <PhPage onNavigate={setActiveTab} />
      case "temperature":
        return <TemperaturePage onNavigate={setActiveTab} />
      case "kh":
        return <KhPage onNavigate={setActiveTab} />
      case "gh":
        return <GhPage onNavigate={setActiveTab} />
      case "nitrite":
        return <NitritePage onNavigate={setActiveTab} />
      case "nitrate":
        return <NitratePage onNavigate={setActiveTab} />
      case "phosphate":
        return <PhosphatePage onNavigate={setActiveTab} />
      default:
        return <Dashboard onNavigate={setActiveTab} />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Main Content */}
      <div className="lg:pl-72 pt-16 lg:pt-0">
        <main className="p-4 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default Index