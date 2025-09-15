import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { 
  Brain, 
  TrendingUp, 
  Users, 
  Target, 
  RefreshCw,
  Lightbulb,
  BarChart3,
  Star
} from 'lucide-react'
import { AILearningService, LearningPattern, RecommendationEffectiveness } from '@/lib/ai-learning-service'

interface LearningStats {
  totalFeedback: number
  averageEffectiveness: number
  learningPatterns: number
  userSatisfaction: number
}

export function AILearningDashboard() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<LearningStats>({
    totalFeedback: 0,
    averageEffectiveness: 0,
    learningPatterns: 0,
    userSatisfaction: 0
  })
  const [patterns, setPatterns] = useState<LearningPattern[]>([])
  const [effectiveness, setEffectiveness] = useState<RecommendationEffectiveness[]>([])

  useEffect(() => {
    loadLearningData()
  }, [])

  const loadLearningData = async () => {
    try {
      setLoading(true)
      
      const [statsData, patternsData, effectivenessData] = await Promise.all([
        AILearningService.getLearningStats(),
        AILearningService.getLearningPatterns(),
        AILearningService.getRecommendationEffectiveness()
      ])

      setStats(statsData)
      setPatterns(patternsData)
      setEffectiveness(effectivenessData)
    } catch (error) {
      console.error('Error loading learning data:', error)
    } finally {
      setLoading(false)
    }
  }

  const triggerLearning = async () => {
    try {
      await AILearningService.triggerLearning()
      await loadLearningData() // Refresh data
    } catch (error) {
      console.error('Error triggering learning:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">AI learning data laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Learning Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor en beheer de AI learning processen
          </p>
        </div>
        <Button onClick={triggerLearning} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Trigger Learning
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totaal Feedback</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFeedback}</div>
            <p className="text-xs text-muted-foreground">
              Gebruiker feedback entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gemiddelde Effectiviteit</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.averageEffectiveness * 100)}%
            </div>
            <Progress 
              value={stats.averageEffectiveness * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Patterns</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.learningPatterns}</div>
            <p className="text-xs text-muted-foreground">
              Gedetecteerde patronen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gebruiker Tevredenheid</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.userSatisfaction * 100)}%
            </div>
            <Progress 
              value={stats.userSatisfaction * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Learning Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Learning Patterns
          </CardTitle>
          <CardDescription>
            Patronen die de AI heeft geleerd van gebruikersdata
          </CardDescription>
        </CardHeader>
        <CardContent>
          {patterns.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nog geen learning patterns beschikbaar
            </p>
          ) : (
            <div className="space-y-3">
              {patterns.slice(0, 5).map((pattern) => (
                <div key={pattern.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{pattern.pattern_type}</Badge>
                      <span className="text-sm font-medium">
                        {pattern.pattern_type === 'seasonal' && 'Seizoenspatroon'}
                        {pattern.pattern_type === 'pond_size' && 'Vijver grootte patroon'}
                        {pattern.pattern_type === 'koi_count' && 'Koi aantal patroon'}
                        {pattern.pattern_type === 'user_behavior' && 'Gebruikersgedrag patroon'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gebruikt {pattern.usage_count} keer • {Math.round(pattern.success_rate * 100)}% succes
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {Math.round(pattern.confidence_score * 100)}%
                    </div>
                    <Progress value={pattern.confidence_score * 100} className="w-16 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendation Effectiveness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Aanbeveling Effectiviteit
          </CardTitle>
          <CardDescription>
            Hoe effectief verschillende types aanbevelingen zijn
          </CardDescription>
        </CardHeader>
        <CardContent>
          {effectiveness.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nog geen effectiviteit data beschikbaar
            </p>
          ) : (
            <div className="space-y-3">
              {effectiveness.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium capitalize">
                      {item.recommendation_type.replace('_', ' ')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.success_count} van {item.total_count} succesvol
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {Math.round(item.average_effectiveness * 100)}%
                    </div>
                    <Progress value={item.average_effectiveness * 100} className="w-16 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Learning Insights */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900">AI Learning Status</h4>
              <p className="text-sm text-blue-700 mt-1">
                De AI leert continu van gebruikersfeedback en waterkwaliteit data. 
                Hoe meer feedback je geeft, hoe beter de aanbevelingen worden. 
                Learning patterns worden automatisch bijgewerkt wanneer nieuwe data beschikbaar komt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
