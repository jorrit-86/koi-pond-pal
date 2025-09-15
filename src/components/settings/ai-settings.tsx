import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'
import { 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  Bell, 
  BookOpen,
  RotateCcw
} from 'lucide-react'

interface AIPreferences {
  ai_recommendations_enabled: boolean
  ai_risk_assessment_enabled: boolean
  ai_trend_analysis_enabled: boolean
  ai_notifications_enabled: boolean
  ai_learning_enabled: boolean
}

export function AISettings() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<AIPreferences>({
    ai_recommendations_enabled: true,
    ai_risk_assessment_enabled: true,
    ai_trend_analysis_enabled: true,
    ai_notifications_enabled: true,
    ai_learning_enabled: true
  })

  useEffect(() => {
    if (user) {
      loadAIPreferences()
    }
  }, [user])

  const loadAIPreferences = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('user_preferences')
        .select('ai_recommendations_enabled, ai_risk_assessment_enabled, ai_trend_analysis_enabled, ai_notifications_enabled, ai_learning_enabled')
        .eq('user_id', user?.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading AI preferences:', error)
        
        // More specific error message
        let errorMessage = 'Kon AI instellingen niet laden'
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          errorMessage = 'Database kolommen bestaan nog niet. Voer eerst het AI instellingen SQL script uit.'
        } else if (error.message.includes('permission')) {
          errorMessage = 'Geen toestemming om instellingen te laden'
        }
        
        toast({
          title: t('common.error'),
          description: errorMessage,
          variant: 'destructive'
        })
        return
      }

      if (data) {
        setPreferences({
          ai_recommendations_enabled: data.ai_recommendations_enabled ?? true,
          ai_risk_assessment_enabled: data.ai_risk_assessment_enabled ?? true,
          ai_trend_analysis_enabled: data.ai_trend_analysis_enabled ?? true,
          ai_notifications_enabled: data.ai_notifications_enabled ?? true,
          ai_learning_enabled: data.ai_learning_enabled ?? true
        })
      }
    } catch (error) {
      console.error('Error in loadAIPreferences:', error)
      toast({
        title: t('common.error'),
        description: 'Er is een fout opgetreden bij het laden van AI instellingen',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const resetToDefaults = async () => {
    const defaultPreferences = {
      ai_recommendations_enabled: true,
      ai_risk_assessment_enabled: true,
      ai_trend_analysis_enabled: true,
      ai_notifications_enabled: true,
      ai_learning_enabled: true
    }

    if (!user) return

    try {
      setSaving(true)

      // Update local state
      setPreferences(defaultPreferences)

      // Save all preferences to database
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...defaultPreferences
        })

      if (error) {
        console.error('Error resetting AI preferences:', error)
        toast({
          title: t('common.error'),
          description: 'Kon instellingen niet resetten',
          variant: 'destructive'
        })
        return
      }

      toast({
        title: t('common.success'),
        description: 'Instellingen gereset naar standaardwaarden'
      })
    } catch (error) {
      console.error('Error in resetToDefaults:', error)
      toast({
        title: t('common.error'),
        description: 'Er is een fout opgetreden bij het resetten',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }


  const handleToggle = async (key: keyof AIPreferences) => {
    const newValue = !preferences[key]
    
    // Update local state immediately for responsive UI
    setPreferences(prev => ({
      ...prev,
      [key]: newValue
    }))

    // Save to database immediately
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          [key]: newValue
        })

      if (error) {
        console.error('Error saving AI preference:', error)
        // Revert local state on error
        setPreferences(prev => ({
          ...prev,
          [key]: !newValue
        }))
        
        // More specific error message
        let errorMessage = 'Kon instelling niet opslaan'
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          errorMessage = 'Database kolommen bestaan nog niet. Voer eerst het AI instellingen SQL script uit.'
        } else if (error.message.includes('permission')) {
          errorMessage = 'Geen toestemming om instellingen op te slaan'
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = 'Netwerkfout. Controleer je internetverbinding'
        }
        
        toast({
          title: t('common.error'),
          description: errorMessage,
          variant: 'destructive'
        })
        return
      }

      // Show success feedback
      toast({
        title: t('common.success'),
        description: 'Instelling opgeslagen',
        duration: 2000
      })
    } catch (error) {
      console.error('Error in handleToggle:', error)
      // Revert local state on error
      setPreferences(prev => ({
        ...prev,
        [key]: !newValue
      }))
      toast({
        title: t('common.error'),
        description: 'Er is een fout opgetreden',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">AI instellingen laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI Instellingen</h2>
        <p className="text-muted-foreground">
          Beheer de AI-functionaliteiten van Koi Sensei. Schakel onderdelen in of uit naar wens.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Smart Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Slimme Aanbevelingen
            </CardTitle>
            <CardDescription>
              AI-gedreven advies gebaseerd op je waterkwaliteit en vijver omstandigheden
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="recommendations-toggle">Aanbevelingen inschakelen</Label>
                <p className="text-sm text-muted-foreground">
                  Ontvang gepersonaliseerde aanbevelingen voor wateronderhoud en vijverbeheer
                </p>
              </div>
              <Switch
                id="recommendations-toggle"
                checked={preferences.ai_recommendations_enabled}
                onCheckedChange={() => handleToggle('ai_recommendations_enabled')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Risk Assessment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Risico Assessment
            </CardTitle>
            <CardDescription>
              Automatische analyse van waterkwaliteit risico's en waarschuwingen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="risk-assessment-toggle">Risico analyse inschakelen</Label>
                <p className="text-sm text-muted-foreground">
                  Krijg real-time waarschuwingen bij gevaarlijke water parameters
                </p>
              </div>
              <Switch
                id="risk-assessment-toggle"
                checked={preferences.ai_risk_assessment_enabled}
                onCheckedChange={() => handleToggle('ai_risk_assessment_enabled')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Trend Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Trend Analyse
            </CardTitle>
            <CardDescription>
              Analyse van waterkwaliteit trends en voorspellingen voor de toekomst
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="trend-analysis-toggle">Trend analyse inschakelen</Label>
                <p className="text-sm text-muted-foreground">
                  Bekijk trends in je waterkwaliteit en krijg voorspellingen
                </p>
              </div>
              <Switch
                id="trend-analysis-toggle"
                checked={preferences.ai_trend_analysis_enabled}
                onCheckedChange={() => handleToggle('ai_trend_analysis_enabled')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-green-500" />
              AI Notificaties
            </CardTitle>
            <CardDescription>
              Intelligente meldingen en herinneringen voor vijveronderhoud
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="notifications-toggle">Notificaties inschakelen</Label>
                <p className="text-sm text-muted-foreground">
                  Ontvang slimme herinneringen en waarschuwingen
                </p>
              </div>
              <Switch
                id="notifications-toggle"
                checked={preferences.ai_notifications_enabled}
                onCheckedChange={() => handleToggle('ai_notifications_enabled')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Learning */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-500" />
              AI Leren
            </CardTitle>
            <CardDescription>
              Laat de AI leren van je feedback en voorkeuren voor betere aanbevelingen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="learning-toggle">AI leren inschakelen</Label>
                <p className="text-sm text-muted-foreground">
                  Verbeter AI aanbevelingen door feedback en gebruikspatronen
                </p>
              </div>
              <Switch
                id="learning-toggle"
                checked={preferences.ai_learning_enabled}
                onCheckedChange={() => handleToggle('ai_learning_enabled')}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Action Buttons */}
      <div className="flex items-center justify-center">
        <Button
          variant="outline"
          onClick={resetToDefaults}
          disabled={saving}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {saving ? 'Resetten...' : 'Reset naar Standaardwaarden'}
        </Button>
      </div>

      {/* Info Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900">Over AI Instellingen</h4>
              <p className="text-sm text-blue-700 mt-1">
                Deze instellingen bepalen welke AI-functionaliteiten actief zijn in je Koi Sensei account. 
                Wijzigingen worden automatisch opgeslagen wanneer je een toggle aanpast. Uitgeschakelde functies 
                worden niet uitgevoerd en verbruiken geen verwerkingskracht.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Setup Info */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-900">Database Setup Vereist</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Als je de foutmelding "Database kolommen bestaan nog niet" krijgt, moet je eerst het AI instellingen 
                SQL script uitvoeren in je Supabase SQL Editor. Kopieer en plak het script dat hieronder staat:
              </p>
              <div className="mt-3 p-3 bg-yellow-100 rounded border text-xs font-mono text-yellow-800 overflow-x-auto">
                <pre>{`-- AI Settings Database Update
-- Run this in your Supabase SQL Editor

ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS ai_recommendations_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_risk_assessment_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_trend_analysis_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_learning_enabled BOOLEAN DEFAULT TRUE;`}</pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
