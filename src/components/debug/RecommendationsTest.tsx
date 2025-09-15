import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RecommendationsPanel } from '@/components/recommendations/recommendations-panel'
import { RecommendationEngine, WaterParameter, UserPreferences } from '@/lib/recommendation-engine'
import { TestTube, Droplets, Thermometer } from 'lucide-react'

export function RecommendationsTest() {
  const [testParameters, setTestParameters] = useState<WaterParameter[]>([
    { name: 'ph', value: 6.2, unit: '', status: 'danger', range: '6.8-8.2' },
    { name: 'temperature', value: 28, unit: '°C', status: 'warning', range: '15-25°C' },
    { name: 'nitrite', value: 0.8, unit: 'mg/l', status: 'danger', range: '0-0.3mg/l' },
    { name: 'nitrate', value: 35, unit: 'mg/l', status: 'warning', range: '<25mg/l' },
    { name: 'phosphate', value: 0.3, unit: 'mg/l', status: 'good', range: '<0.5mg/l' }
  ])

  const [userPreferences] = useState<UserPreferences>({
    experience_level: 'intermediate',
    maintenance_frequency: 'weekly',
    seasonal_awareness: true,
    auto_recommendations: true,
    pond_size_liters: 5000,
    koi_count: 8
  })

  const [analysis, setAnalysis] = useState<{
    recommendations: any[]
    riskAssessment: any
    trends: any[]
  } | null>(null)

  const [loading, setLoading] = useState(false)

  const runAnalysis = () => {
    setLoading(true)
    
    // Simulate analysis delay
    setTimeout(() => {
      const engine = new RecommendationEngine(userPreferences)
      const result = engine.analyzeWaterParameters(testParameters)
      setAnalysis(result)
      setLoading(false)
    }, 1000)
  }

  const updateParameter = (index: number, field: string, value: any) => {
    const newParameters = [...testParameters]
    newParameters[index] = { ...newParameters[index], [field]: value }
    setTestParameters(newParameters)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'danger': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'ph': return <TestTube className="h-4 w-4" />
      case 'temperature': return <Thermometer className="h-4 w-4" />
      default: return <Droplets className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>🧪 Recommendations Engine Test</CardTitle>
          <CardDescription>
            Test de nieuwe AI recommendation engine met verschillende water parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Parameters */}
          <div className="space-y-4">
            <h3 className="font-semibold">Test Water Parameters</h3>
            {testParameters.map((param, index) => (
              <div key={param.name} className="flex items-center space-x-4 p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(param.name)}
                  <Label className="font-medium min-w-[100px]">{param.name}</Label>
                </div>
                <Input
                  type="number"
                  value={param.value}
                  onChange={(e) => updateParameter(index, 'value', parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">{param.unit}</span>
                <select
                  value={param.status}
                  onChange={(e) => updateParameter(index, 'status', e.target.value)}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="good">Good</option>
                  <option value="warning">Warning</option>
                  <option value="danger">Danger</option>
                </select>
                <span className={`text-sm font-medium ${getStatusColor(param.status)}`}>
                  {param.status}
                </span>
                <span className="text-xs text-muted-foreground">Range: {param.range}</span>
              </div>
            ))}
          </div>

          <Button onClick={runAnalysis} disabled={loading} className="w-full">
            {loading ? 'Analyseren...' : 'Run AI Analysis'}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Analysis Results</CardTitle>
            <CardDescription>
              AI-gedreven aanbevelingen gebaseerd op de test parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecommendationsPanel
              recommendations={analysis.recommendations}
              riskAssessment={analysis.riskAssessment}
              trends={analysis.trends}
              onRecommendationAction={(recommendationId, action) => {
                console.log('Recommendation action:', recommendationId, action)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* User Preferences Display */}
      <Card>
        <CardHeader>
          <CardTitle>👤 User Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Experience Level:</strong> {userPreferences.experience_level}
            </div>
            <div>
              <strong>Maintenance Frequency:</strong> {userPreferences.maintenance_frequency}
            </div>
            <div>
              <strong>Pond Size:</strong> {userPreferences.pond_size_liters}L
            </div>
            <div>
              <strong>Koi Count:</strong> {userPreferences.koi_count}
            </div>
            <div>
              <strong>Seasonal Awareness:</strong> {userPreferences.seasonal_awareness ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Auto Recommendations:</strong> {userPreferences.auto_recommendations ? 'Yes' : 'No'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
