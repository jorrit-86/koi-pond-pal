import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "@/components/theme-provider"
import { Settings, Home, Bell, Database, Wifi } from "lucide-react"
import { useState } from "react"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [homeAssistantUrl, setHomeAssistantUrl] = useState("")
  const [homeAssistantToken, setHomeAssistantToken] = useState("")
  const [notifications, setNotifications] = useState(true)
  const [autoLogging, setAutoLogging] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
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
                <Label className="text-sm">Nitrate Warning (mg/l)</Label>
                <Input placeholder="20" type="number" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Nitrate Danger (mg/l)</Label>
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