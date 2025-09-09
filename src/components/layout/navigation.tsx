import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { Moon, Sun, Waves, Droplets, Fish, Settings, BarChart3, Menu } from "lucide-react"
import koiSensaiLogo from "@/assets/koi-sensai-logo.png"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Waves },
    { id: "parameters", label: "Water Log", icon: Droplets },
    { id: "koi", label: "My Koi", icon: Fish },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  const NavContent = () => (
    <nav className="flex flex-col space-y-2 p-4">
      <div className="flex items-center space-x-3 mb-6">
        <img 
          src={koiSensaiLogo} 
          alt="Koi Sensai Logo" 
          className="h-10 w-10 object-contain"
        />
        <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Koi Sensai
        </h1>
      </div>

      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            className="justify-start w-full"
            onClick={() => {
              onTabChange(item.id)
              setIsOpen(false)
            }}
          >
            <Icon className="mr-3 h-4 w-4" />
            {item.label}
          </Button>
        )
      })}

      <div className="mt-6 pt-6 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="w-full justify-start"
        >
          {theme === "light" ? (
            <Moon className="mr-3 h-4 w-4" />
          ) : (
            <Sun className="mr-3 h-4 w-4" />
          )}
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </Button>
      </div>
    </nav>
  )

  return (
    <>
      {/* Mobile Navigation */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <img 
              src={koiSensaiLogo} 
              alt="Koi Sensai Logo" 
              className="h-7 w-7 object-contain"
            />
            <span className="font-semibold">Koi Sensai</span>
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:block fixed left-0 top-0 h-full w-72 bg-card border-r border-border">
        <NavContent />
      </div>
    </>
  )
}