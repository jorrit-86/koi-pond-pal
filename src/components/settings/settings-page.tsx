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
import { Settings, Home, Bell, Database, Wifi, Timer, Globe, Shield } from "lucide-react"
import { RecommendationsTest } from "@/components/debug/RecommendationsTest"
import { AISettings } from '@/components/settings/ai-settings'
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


  const parameterNames = {
    ph: t("waterParameters.ph"),
    temperature: t("waterParameters.temperature"),
    kh: t("waterParameters.kh"),
    gh: t("waterParameters.gh"),
    nitrite: t("waterParameters.nitrite"),
    nitrate: t("waterParameters.nitrate"),
    phosphate: t("waterParameters.phosphate")
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
    if (activeSubmenu === "ai-settings") {
      return <AISettings />
    }
    
    if (activeSubmenu === "recommendations-test") {
      return <RecommendationsTest />
    }
    
    if (activeSubmenu === "admin") {
      return <AdminPanel />
    }
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("settings.title")}</h1>
          <p className="text-muted-foreground">Configure your koi pond management preferences</p>
        </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>Customize the look and feel of your dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark theme
              </p>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("settings.language")}
            </Label>
            <p className="text-sm text-muted-foreground">
              Choose your preferred language
            </p>
            <Select value={i18n.language} onValueChange={changeLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Home Assistant Integration
          </CardTitle>
          <CardDescription>
            Connect to your Home Assistant instance for automated data logging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ha-url">Home Assistant URL</Label>
            <Input
              id="ha-url"
              placeholder="https://your-homeassistant.local:8123"
              value={homeAssistantUrl}
              onChange={(e) => setHomeAssistantUrl(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ha-token">Long-Lived Access Token</Label>
            <Input
              id="ha-token"
              type="password"
              placeholder="Your Home Assistant access token"
              value={homeAssistantToken}
              onChange={(e) => setHomeAssistantToken(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label>Auto-logging from HA</Label>
              <p className="text-sm text-muted-foreground">
                Automatically log water parameters from Home Assistant sensors
              </p>
            </div>
            <Switch
              checked={autoLogging}
              onCheckedChange={setAutoLogging}
            />
          </div>

          <div className="pt-2">
            <Button variant="outline" className="w-full">
              <Wifi className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Parameter Timers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Parameter Testing Timers
          </CardTitle>
          <CardDescription>Set countdown timers for regular water parameter testing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(parameterNames).map(([key, name]) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{name} Timer</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable timer reminders for {name.toLowerCase()} testing
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
                  <Label htmlFor={`${key}-duration`} className="text-sm">
                    Timer Duration (minutes)
                  </Label>
                  <Input
                    id={`${key}-duration`}
                    type="number"
                    min={1}
                    max={1440}
                    value={timerConfigs[key]?.duration || 30}
                    onChange={(e) => 
                      updateTimerConfig(key, {
                        ...timerConfigs[key],
                        duration: parseInt(e.target.value) || 30
                      })
                    }
                    className="w-32"
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications & Alerts
          </CardTitle>
          <CardDescription>Configure when and how you receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Parameter Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when water parameters are outside ideal ranges
              </p>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Alert Thresholds</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">pH Warning Level</Label>
                <Input placeholder="6.5" type="number" step="0.1" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">pH Danger Level</Label>
                <Input placeholder="6.0" type="number" step="0.1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Nitraat Waarschuwing (mg/l)</Label>
                <Input placeholder="20" type="number" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Nitraat Gevaar (mg/l)</Label>
                <Input placeholder="30" type="number" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Management
          </CardTitle>
          <CardDescription>Manage your pond data and history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline">
              Export Data
            </Button>
            <Button variant="outline">
              Import Data
            </Button>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-destructive">Danger Zone</h4>
            <p className="text-sm text-muted-foreground">
              These actions cannot be undone. Please be careful.
            </p>
            <Button variant="destructive" className="w-full">
              Clear All Historical Data
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Submenu Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeSubmenu === "general" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSubmenu("general")}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          General
        </Button>
        <Button
          variant={activeSubmenu === "ai-settings" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSubmenu("ai-settings")}
          className="flex items-center gap-2"
        >
          <Database className="h-4 w-4" />
          AI Instellingen
        </Button>
        <Button
          variant={activeSubmenu === "recommendations-test" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSubmenu("recommendations-test")}
          className="flex items-center gap-2"
        >
          <Database className="h-4 w-4" />
          AI Test
        </Button>
        {user?.role === 'admin' && (
          <Button
            variant={activeSubmenu === "admin" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSubmenu("admin")}
            className="flex items-center gap-2"
          >
            <Shield className="h-4 w-4" />
            Admin Panel
          </Button>
        )}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}