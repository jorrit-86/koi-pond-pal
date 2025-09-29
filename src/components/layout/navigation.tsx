import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Waves, Droplets, Fish, Settings, BarChart3, Menu, LogOut, User } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import koiSenseiLogo from "@/assets/koi-sensei-logo.svg"

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (user?.full_name) {
      return user.full_name
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return user?.email?.[0]?.toUpperCase() || 'U'
  }

  const navItems = [
    { id: "dashboard", label: t("navigation.dashboard"), icon: Waves },
    { id: "parameters", label: t("navigation.waterParameters"), icon: Droplets },
    { id: "koi", label: t("navigation.koiManagement"), icon: Fish },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: t("navigation.settings"), icon: Settings },
  ]

  const NavContent = () => (
    <nav className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <img 
          src={koiSenseiLogo} 
          alt="Koi Sensei Logo" 
          className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onTabChange("dashboard")}
          onTouchEnd={(e) => {
            e.preventDefault();
            onTabChange("dashboard");
          }}
        />
        <h1 
          className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onTabChange("dashboard")}
          onTouchEnd={(e) => {
            e.preventDefault();
            onTabChange("dashboard");
          }}
        >
          Koi Sensei
        </h1>
      </div>

      {/* Main Navigation Items */}
      <div className="flex-1 space-y-2">
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
      </div>

      {/* Account and Sign Out - Bottom of Menu */}
      <div className="mt-auto pt-6 border-t border-border space-y-2">
        {/* User Account */}
        <Button
          variant={activeTab === "user-profile" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            onTabChange("user-profile")
            setIsOpen(false)
          }}
          className="w-full justify-start px-3 py-2 h-auto"
        >
          <div className="flex items-center gap-3 w-full">
            <Avatar className="h-11 w-11">
              <AvatarImage 
                src={user?.profile_photo_url || undefined} 
                alt="Profile photo" 
              />
              <AvatarFallback className="text-sm">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="truncate text-sm">{user?.full_name || user?.email}</span>
              {user?.role === 'admin' && (
                <div className="text-xs text-primary font-medium">Admin</div>
              )}
            </div>
          </div>
        </Button>
        
        {/* Sign Out */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            signOut()
            setIsOpen(false)
          }}
          className="w-full justify-start text-destructive hover:text-destructive"
        >
          <LogOut className="mr-3 h-4 w-4" />
          {t("navigation.signOut")}
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
              src={koiSenseiLogo} 
              alt="Koi Sensei Logo" 
              className="h-8 w-8"
            />
            <span className="font-semibold text-xl">Koi Sensei</span>
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
      <div className="hidden lg:block fixed left-0 top-0 h-full w-72 bg-card border-r border-border max-w-[1920px]">
        <NavContent />
      </div>
    </>
  )
}