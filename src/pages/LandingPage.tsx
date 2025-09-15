import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Waves, 
  Droplets, 
  Fish, 
  BarChart3, 
  Shield, 
  Smartphone, 
  Globe, 
  Users,
  CheckCircle,
  LogIn
} from 'lucide-react'
import koiSenseiLogo from '@/assets/koi-sensei-logo.svg'

export function LandingPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  const features = [
    {
      icon: Droplets,
      title: t("landing.features.waterQuality.title"),
      description: t("landing.features.waterQuality.description")
    },
    {
      icon: Fish,
      title: t("landing.features.koiManagement.title"),
      description: t("landing.features.koiManagement.description")
    },
    {
      icon: BarChart3,
      title: t("landing.features.analytics.title"),
      description: t("landing.features.analytics.description")
    },
    {
      icon: Shield,
      title: t("landing.features.security.title"),
      description: t("landing.features.security.description")
    },
    {
      icon: Smartphone,
      title: t("landing.features.mobile.title"),
      description: t("landing.features.mobile.description")
    },
    {
      icon: Globe,
      title: t("landing.features.multilingual.title"),
      description: t("landing.features.multilingual.description")
    }
  ]

  const benefits = [
    t("landing.benefits.professional"),
    t("landing.benefits.easy"),
    t("landing.benefits.secure"),
    t("landing.benefits.multilingual"),
    t("landing.benefits.mobile"),
    t("landing.benefits.analytics")
  ]

  const handleAuthClick = () => {
    setShowAuthModal(true)
  }


  if (user) {
    // Redirect to dashboard if user is logged in
    window.location.href = '/dashboard'
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <img 
                src={koiSenseiLogo} 
                alt="Koi Sensei Logo" 
                className="h-10 w-10"
              />
              <h1 className="text-2xl font-bold text-gray-900">Koi Sensei</h1>
            </div>
            <div className="flex items-center space-x-3">
              <LanguageSwitcher />
              <Button 
                variant="outline" 
                onClick={handleAuthClick}
                className="flex items-center space-x-2"
              >
                <LogIn className="h-4 w-4" />
                <span>{t("landing.login")}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6">
            {t("landing.badge")}
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            {t("landing.hero.title")}
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            {t("landing.hero.subtitle")}
          </p>
        </div>
      </section>


      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t("landing.features.title")}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t("landing.features.subtitle")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                {t("landing.benefits.title")}
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                {t("landing.benefits.subtitle")}
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="text-center">
                <Users className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {t("landing.cta.title")}
                </h3>
                <p className="text-gray-600 mb-6">
                  {t("landing.cta.description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src={koiSenseiLogo} 
                  alt="Koi Sensei Logo" 
                  className="h-8 w-8"
                />
                <h3 className="text-xl font-bold">Koi Sensei</h3>
              </div>
              <p className="text-gray-400">
                {t("landing.footer.description")}
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">{t("landing.footer.features")}</h4>
              <ul className="space-y-2 text-gray-400">
                <li>{t("landing.footer.waterQuality")}</li>
                <li>{t("landing.footer.koiManagement")}</li>
                <li>{t("landing.footer.analytics")}</li>
                <li>{t("landing.footer.security")}</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">{t("landing.footer.contact")}</h4>
              <p className="text-gray-400 mb-2">
                {t("landing.footer.email")}: admin@koisensei.nl
              </p>
              <p className="text-gray-400">
                {t("landing.footer.support")}
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Koi Sensei. {t("landing.footer.rights")}</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        initialTab="login"
      />
    </div>
  )
}
