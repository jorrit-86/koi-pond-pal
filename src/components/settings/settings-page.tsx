import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "@/components/theme-provider"
import { useParameterTimers } from "@/hooks/use-parameter-timers"
import { useAuth } from "@/contexts/AuthContext"
import { AdminPanel } from "@/components/admin/admin-panel"
import { Settings, Home, Bell, Database, Wifi, Timer, Globe, Shield, Cpu, Menu, X } from "lucide-react"
import { PondProperties } from '@/components/settings/pond-properties'
import { KOIoTSettings } from '@/components/settings/koiot-settings'
import { MaintenanceSettings } from '@/components/maintenance/maintenance-settings'
import { useState } from "react"
import { useTranslation } from "react-i18next"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { timerConfigs, updateTimerConfig } = useParameterTimers()
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const [homeAssistantUrl, setHomeAssistantUrl] = useState("")
  const [homeAssistantToken, setHomeAssistantToken] = useState("")
  const [notifications, setNotifications] = useState(true)
  const [autoLogging, setAutoLogging] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string>("general")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)


  const parameterNames = {
    ph: t("waterParameters.ph"),
    temperature: t("waterParameters.temperature"),
    kh: t("waterParameters.kh"),
    gh: t("waterParameters.gh"),
    nitrite: t("waterParameters.nitrite"),
    nitrate: t("waterParameters.nitrate"),
    phosphate: t("waterParameters.phosphate"),
    ammonia: t("waterParameters.ammonia")
  }

  const changeLanguage = (newLang: string) => {
    i18n.changeLanguage(newLang)
    document.documentElement.lang = newLang
  }

  const getLanguageName = (langCode: string) => {
    switch (langCode) {
      case 'en': return 'English'
      case 'nl': return 'Nederlands'
      default: return langCode
    }
  }

  const renderContent = () => {
    if (activeSubmenu === "pond-properties") {
      return <PondProperties />
    }
    
    if (activeSubmenu === "koiot") {
      return <KOIoTSettings />
    }
    
    
    
    
    if (activeSubmenu === "maintenance") {
      return <MaintenanceSettings />
    }
    
    if (activeSubmenu === "admin") {
      return <AdminPanel />
    }
    
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">{t("settings.general.title")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t("settings.general.subtitle")}</p>
        </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {t("settings.general.appearance")}
          </CardTitle>
          <CardDescription className="text-sm">{t("settings.general.appearanceDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1 pr-3">
              <Label className="text-sm sm:text-base">{t("settings.general.darkMode")}</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("settings.general.darkModeDescription")}
              </p>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm sm:text-base">
              <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
              {t("settings.language")}
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("settings.general.chooseLanguage")}
            </p>
            <Select value={i18n.language} onValueChange={changeLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("settings.general.selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🇬🇧</span>
                    <span>English</span>
                  </div>
                </SelectItem>
                <SelectItem value="nl">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🇳🇱</span>
                    <span>Nederlands</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Home Assistant Integration */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Home className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {t("settings.general.homeAssistantIntegration")}
          </CardTitle>
          <CardDescription className="text-sm">
            {t("settings.general.homeAssistantDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 pt-0">
          <div className="space-y-2">
            <Label htmlFor="ha-url" className="text-sm sm:text-base">{t("settings.general.homeAssistantUrl")}</Label>
            <Input
              id="ha-url"
              placeholder={t("settings.general.homeAssistantUrlPlaceholder")}
              value={homeAssistantUrl}
              onChange={(e) => setHomeAssistantUrl(e.target.value)}
              className="h-9 sm:h-10"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ha-token" className="text-sm sm:text-base">{t("settings.general.longLivedAccessToken")}</Label>
            <Input
              id="ha-token"
              type="password"
              placeholder={t("settings.general.accessTokenPlaceholder")}
              value={homeAssistantToken}
              onChange={(e) => setHomeAssistantToken(e.target.value)}
              className="h-9 sm:h-10"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5 flex-1 pr-3">
              <Label className="text-sm sm:text-base">{t("settings.general.autoLoggingFromHA")}</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("settings.general.autoLoggingDescription")}
              </p>
            </div>
            <Switch
              checked={autoLogging}
              onCheckedChange={setAutoLogging}
            />
          </div>

          <div className="pt-2">
            <Button variant="outline" className="w-full h-9 sm:h-10">
              <Wifi className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="text-sm">{t("settings.general.testConnection")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Parameter Timers */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Timer className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {t("settings.general.parameterTestingTimers")}
          </CardTitle>
          <CardDescription className="text-sm">{t("settings.general.parameterTimersDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 pt-0">
          {Object.entries(parameterNames).map(([key, name]) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1 pr-3">
                  <Label className="text-sm sm:text-base">{name} Timer</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t("settings.general.enableTimerReminders", { parameter: name.toLowerCase() })}
                  </p>
                </div>
                <Switch
                  checked={timerConfigs[key]?.enabled || false}
                  onCheckedChange={(checked) => 
                    updateTimerConfig(key, { 
                      ...timerConfigs[key], 
                      enabled: checked 
                    })
                  }
                />
              </div>
              
              {timerConfigs[key]?.enabled && (
                <div className="ml-4 space-y-2">
                  <Label htmlFor={`${key}-duration`} className="text-xs sm:text-sm">
                    {t("settings.general.timerDuration")}
                  </Label>
                  <Input
                    id={`${key}-duration`}
                    type="number"
                    min={1}
                    max={1440}
                    value={timerConfigs[key]?.duration === 0 ? '' : timerConfigs[key]?.duration || 30}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === '') {
                        // Allow empty value temporarily
                        updateTimerConfig(key, {
                          ...timerConfigs[key],
                          duration: 0
                        })
                      } else {
                        const numValue = parseInt(value)
                        if (!isNaN(numValue) && numValue > 0) {
                          updateTimerConfig(key, {
                            ...timerConfigs[key],
                            duration: numValue
                          })
                        }
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.target.select()}
                    onBlur={(e) => {
                      if (e.target.value === '' || parseInt(e.target.value) <= 0) {
                        updateTimerConfig(key, {
                          ...timerConfigs[key],
                          duration: 30
                        })
                      }
                    }}
                    className="w-24 sm:w-32 h-8 sm:h-9"
                  />
                </div>
              )}
              
              {key !== "phosphate" && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {t("settings.general.notificationsAlerts")}
          </CardTitle>
          <CardDescription className="text-sm">{t("settings.general.notificationsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1 pr-3">
              <Label className="text-sm sm:text-base">{t("settings.general.parameterAlerts")}</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("settings.general.parameterAlertsDescription")}
              </p>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>

          <Separator />

          <div className="space-y-3 sm:space-y-4">
            <h4 className="font-semibold text-sm">{t("settings.general.alertThresholds")}</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("settings.general.phWarningLevel")}</Label>
                <Input placeholder="6.5" type="number" step="0.1" className="h-8 sm:h-9" />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("settings.general.phDangerLevel")}</Label>
                <Input placeholder="6.0" type="number" step="0.1" className="h-8 sm:h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("settings.general.nitrateWarning")}</Label>
                <Input placeholder="20" type="number" className="h-8 sm:h-9" />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("settings.general.nitrateDanger")}</Label>
                <Input placeholder="30" type="number" className="h-8 sm:h-9" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Database className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {t("settings.general.dataManagement")}
          </CardTitle>
          <CardDescription className="text-sm">{t("settings.general.dataManagementDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Button variant="outline" className="h-9 sm:h-10 text-sm">
              {t("settings.general.exportData")}
            </Button>
            <Button variant="outline" className="h-9 sm:h-10 text-sm">
              {t("settings.general.importData")}
            </Button>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-destructive">{t("settings.general.dangerZone")}</h4>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("settings.general.dangerZoneDescription")}
            </p>
            <Button variant="destructive" className="w-full h-9 sm:h-10 text-sm">
              {t("settings.general.clearAllHistoricalData")}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    )
  }

  const navigationItems = [
    { id: "general", label: t("settings.general.title"), icon: Settings },
    { id: "pond-properties", label: "Vijver Eigenschappen", icon: Database },
    { id: "koiot", label: "KOIoT", icon: Cpu },
    { id: "maintenance", label: "Onderhoud Taken", icon: Timer },
    ...(user?.role === 'admin' ? [{ id: "admin", label: "Admin Panel", icon: Shield }] : [])
  ]

  const handleSubmenuChange = (submenu: string) => {
    setActiveSubmenu(submenu)
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Responsive Submenu Navigation */}
      <div className="relative">
        {/* Mobile Navigation (alles onder 1024px) */}
        <div className="xl:hidden">
          {/* Mobile Menu Button */}
          <Button
            variant="outline"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-full justify-between h-10 sm:h-9"
          >
            <span className="flex items-center gap-2">
              {navigationItems.find(item => item.id === activeSubmenu)?.icon && (
                <>
                  {(() => {
                    const Icon = navigationItems.find(item => item.id === activeSubmenu)?.icon
                    return Icon ? <Icon className="h-4 w-4" /> : null
                  })()}
                  {navigationItems.find(item => item.id === activeSubmenu)?.label}
                </>
              )}
            </span>
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 sm:mt-2 bg-background border border-border rounded-lg shadow-lg">
              <div className="p-1 sm:p-2 space-y-0.5 sm:space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Button
                      key={item.id}
                      variant={activeSubmenu === item.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleSubmenuChange(item.id)}
                      className="w-full justify-start h-8 sm:h-9 text-sm"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Navigation (alleen op zeer grote schermen) */}
        <div className="hidden xl:flex space-x-1 bg-muted p-1 rounded-lg w-fit">
          {navigationItems.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.id}
                variant={activeSubmenu === item.id ? "default" : "ghost"}
                size="sm"
                onClick={() => handleSubmenuChange(item.id)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}