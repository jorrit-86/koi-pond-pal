import { useState } from "react"
import { Navigation } from "@/components/layout/navigation"
import { Dashboard } from "@/components/dashboard/dashboard"
import { ParameterForm } from "@/components/water-parameters/parameter-form"
import { WaterHistory } from "@/components/water-parameters/water-history"
import { KoiManagement } from "@/components/koi/koi-management"
import { KoiAddPage } from "@/components/koi/koi-add-page"
import { KoiEditPage } from "@/components/koi/koi-edit-page"
import { KoiLogbookOverview } from "@/components/koi/koi-logbook-overview"
import { SettingsPage } from "@/components/settings/settings-page"
import { UserProfilePage } from "@/components/user/user-profile-page"
import { AnalyticsPage } from "@/components/analytics/analytics-page"
import { PhPage } from "@/components/water-parameters/ph-page"
import { TemperaturePage } from "@/components/water-parameters/temperature-page"
import { KhPage, GhPage, NitritePage, NitratePage, PhosphatePage } from "@/components/water-parameters/all-parameters"
import { AuthModal } from "@/components/auth/AuthModal"
import { LandingPage } from "@/pages/LandingPage"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/hooks/use-language"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0)
  const [editingKoiId, setEditingKoiId] = useState<string | null>(null)
  const [editingKoiName, setEditingKoiName] = useState<string>('')
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  useLanguage() // Initialize language hook

  const handleDataSaved = () => {
    setDashboardRefreshTrigger(prev => prev + 1)
  }

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center max-w-[1920px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show landing page if user is not authenticated
  if (!user) {
    return <LandingPage />
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onNavigate={setActiveTab} refreshTrigger={dashboardRefreshTrigger} />
      case "parameters":
        return <ParameterForm onNavigate={setActiveTab} onDataSaved={handleDataSaved} />
      case "water-history":
        return <WaterHistory onNavigate={setActiveTab} />
      case "koi":
        return <KoiManagement onNavigate={setActiveTab} onEditKoi={(koiId, koiName) => {
          setEditingKoiId(koiId);
          setEditingKoiName(koiName);
        }} refreshTrigger={dashboardRefreshTrigger} />
      case "koi-add":
        return <KoiAddPage onNavigate={setActiveTab} />
      case "koi-edit":
        return <KoiEditPage 
          onNavigate={setActiveTab} 
          koiId={editingKoiId || ""} 
          onKoiUpdated={() => {
            // Refresh koi data when a measurement is added
            setDashboardRefreshTrigger(prev => prev + 1)
          }}
        />
      case "koi-logbook-overview":
        return <KoiLogbookOverview 
          koiId={editingKoiId || ""} 
          koiName={editingKoiName}
          onNavigate={setActiveTab}
          onMeasurementAdded={() => {
            // Refresh koi data when a measurement is added
            setDashboardRefreshTrigger(prev => prev + 1)
          }}
        />
      case "analytics":
        return <AnalyticsPage onNavigate={setActiveTab} />
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
      case "user-profile":
        return <UserProfilePage onNavigate={setActiveTab} />
      default:
        return <Dashboard onNavigate={setActiveTab} />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Main Content */}
      <div className="lg:pl-72 pt-16 lg:pt-0">
        <main className="p-4 lg:p-8 max-w-[1920px] mx-auto">
          {renderContent()}
        </main>
      </div>
      
    </div>
  )
}

export default Index