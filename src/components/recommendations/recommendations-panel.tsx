import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Lightbulb, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  ChevronDown, 
  ChevronRight,
  Droplets,
  Wrench,
  Thermometer,
  TestTube,
  Zap
} from 'lucide-react'
import { Recommendation, RiskAssessment, TrendAnalysis } from '@/lib/recommendation-engine'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

interface RecommendationsPanelProps {
  recommendations: Recommendation[]
  riskAssessment: RiskAssessment
  trends: TrendAnalysis[]
  onRecommendationAction: (recommendationId: string, action: 'completed' | 'dismissed') => void
}

export function RecommendationsPanel({ 
  recommendations, 
  riskAssessment, 
  trends, 
  onRecommendationAction 
}: RecommendationsPanelProps) {
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const { user } = useAuth()
  const { toast } = useToast()

  const toggleExpanded = (recommendationId: string) => {
    const newExpanded = new Set(expandedRecommendations)
    if (newExpanded.has(recommendationId)) {
      newExpanded.delete(recommendationId)
    } else {
      newExpanded.add(recommendationId)
    }
    setExpandedRecommendations(newExpanded)
  }

  const handleRecommendationAction = async (recommendationId: string, action: 'completed' | 'dismissed') => {
    if (!user) return

    setLoading(prev => ({ ...prev, [recommendationId]: true }))

    try {
      // Update recommendation status in database
      const { error } = await supabase
        .from('recommendations')
        .update({ 
          status: action,
          completed_at: action === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', recommendationId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating recommendation:', error)
        toast({
          title: "Fout",
          description: "Kon aanbeveling niet bijwerken.",
          variant: "destructive",
        })
        return
      }

      // Call parent callback
      onRecommendationAction(recommendationId, action)

      toast({
        title: action === 'completed' ? "Aanbeveling voltooid" : "Aanbeveling genegeerd",
        description: action === 'completed' 
          ? "Goed gedaan! Je hebt de aanbeveling uitgevoerd."
          : "Aanbeveling is genegeerd.",
      })

    } catch (error) {
      console.error('Error handling recommendation action:', error)
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden.",
        variant: "destructive",
      })
    } finally {
      setLoading(prev => ({ ...prev, [recommendationId]: false }))
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "bg-red-500 text-white"
      case 2: return "bg-orange-500 text-white"
      case 3: return "bg-yellow-500 text-black"
      case 4: return "bg-blue-500 text-white"
      case 5: return "bg-gray-500 text-white"
      default: return "bg-gray-500 text-white"
    }
  }

  const getPriorityText = (priority: number) => {
    switch (priority) {
      case 1: return "Kritiek"
      case 2: return "Hoog"
      case 3: return "Gemiddeld"
      case 4: return "Laag"
      case 5: return "Info"
      default: return "Onbekend"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'water_change': return <Droplets className="h-4 w-4" />
      case 'filter_maintenance': return <Wrench className="h-4 w-4" />
      case 'ph_adjustment': return <TestTube className="h-4 w-4" />
      case 'temperature_control': return <Thermometer className="h-4 w-4" />
      case 'chemical_treatment': return <Zap className="h-4 w-4" />
      default: return <Lightbulb className="h-4 w-4" />
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return "text-red-600"
      case 'high': return "text-orange-600"
      case 'medium': return "text-yellow-600"
      case 'low': return "text-green-600"
      default: return "text-gray-600"
    }
  }

  const getRiskText = (risk: string) => {
    switch (risk) {
      case 'critical': return "Kritiek"
      case 'high': return "Hoog"
      case 'medium': return "Gemiddeld"
      case 'low': return "Laag"
      default: return "Onbekend"
    }
  }

  if (recommendations.length === 0 && riskAssessment.overall_risk === 'low') {
    return (
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-800">Uitstekende waterkwaliteit!</h3>
              <p className="text-sm text-green-600">
                Alle parameters zijn binnen de ideale waarden. Geen actie vereist.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Risk Assessment */}
      <Card className={riskAssessment.overall_risk === 'critical' ? 'border-red-500' : 
                      riskAssessment.overall_risk === 'high' ? 'border-orange-500' : 
                      riskAssessment.overall_risk === 'medium' ? 'border-yellow-500' : 'border-green-500'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${getRiskColor(riskAssessment.overall_risk)}`} />
            Risico Assessment
          </CardTitle>
          <CardDescription>
            Huidige risico score: <span className={`font-semibold ${getRiskColor(riskAssessment.overall_risk)}`}>
              {getRiskText(riskAssessment.overall_risk)} ({riskAssessment.risk_score}/100)
            </span>
          </CardDescription>
        </CardHeader>
        {riskAssessment.risk_factors.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {riskAssessment.risk_factors.map((factor, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className={`w-2 h-2 rounded-full mt-2 ${getRiskColor(factor.risk_level).replace('text-', 'bg-')}`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{factor.parameter}: {factor.description}</p>
                    <p className="text-xs text-muted-foreground">{factor.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Slimme Aanbevelingen
            </CardTitle>
            <CardDescription>
              {recommendations.length} aanbeveling{recommendations.length !== 1 ? 'en' : ''} gebaseerd op je waterkwaliteit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendations.map((recommendation) => (
              <div key={recommendation.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-1">
                      {getTypeIcon(recommendation.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold">{recommendation.title}</h4>
                        <Badge className={getPriorityColor(recommendation.priority)}>
                          {getPriorityText(recommendation.priority)}
                        </Badge>
                        {recommendation.action_required && (
                          <Badge variant="destructive">Actie vereist</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {recommendation.description}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{recommendation.estimated_duration}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>Moeilijkheid:</span>
                          <span className="capitalize">{recommendation.estimated_effort}</span>
                        </div>
                        {recommendation.related_parameters.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <span>Parameters:</span>
                            <span>{recommendation.related_parameters.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpanded(recommendation.id)}
                    >
                      {expandedRecommendations.has(recommendation.id) ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecommendationAction(recommendation.id, 'completed')}
                      disabled={loading[recommendation.id]}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecommendationAction(recommendation.id, 'dismissed')}
                      disabled={loading[recommendation.id]}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedRecommendations.has(recommendation.id) && (
                  <div className="pl-7 space-y-2">
                    <Alert>
                      <AlertDescription>
                        <strong>Gedetailleerde informatie:</strong>
                        <ul className="mt-2 space-y-1">
                          <li>• Type: {recommendation.type}</li>
                          <li>• Prioriteit: {getPriorityText(recommendation.priority)}</li>
                          <li>• Geschatte tijd: {recommendation.estimated_duration}</li>
                          <li>• Moeilijkheid: {recommendation.estimated_effort}</li>
                          {recommendation.conditions && Object.keys(recommendation.conditions).length > 0 && (
                            <li>• Condities: {JSON.stringify(recommendation.conditions, null, 2)}</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Trends */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trend Analyse</CardTitle>
            <CardDescription>Ontwikkeling van water parameters over tijd</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trends.map((trend, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{trend.parameter}</p>
                    <p className="text-sm text-muted-foreground">
                      Trend: {trend.trend} ({trend.rate > 0 ? '+' : ''}{trend.rate.toFixed(2)} per dag)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      Voorspelling: {trend.prediction.value.toFixed(1)} in {trend.prediction.timeframe}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vertrouwen: {Math.round(trend.confidence * 100)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
