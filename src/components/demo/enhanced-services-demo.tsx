/**
 * Enhanced Services Demo Component
 * Demonstrates the new enhanced services for koi pond management
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Fish, 
  Droplets, 
  Thermometer, 
  Filter, 
  Leaf, 
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'
import { NitrogenBalanceService } from '@/lib/nitrogen-balance-service'
import { FilterEfficiencyService } from '@/lib/filter-efficiency-service'
import { SeasonalLogicService } from '@/lib/seasonal-logic-service'
import { WaterSafetyService } from '@/lib/water-safety-service'
import { EducationalAdviceService } from '@/lib/educational-advice-service'
import { StructuredAdviceService } from '@/lib/structured-advice-service'
import { ConservativeSafetyService } from '@/lib/conservative-safety-service'

interface EnhancedServicesDemoProps {
  onNavigate: (tab: string) => void
}

export function EnhancedServicesDemo({ onNavigate }: EnhancedServicesDemoProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [demoData, setDemoData] = useState({
    temperature: 18,
    ammonia: 0.1,
    nitrite: 0.05,
    nitrate: 25,
    pH: 7.5,
    oxygen: 7.5,
    feedAmount: 150,
    koiCount: 8,
    pondVolume: 12000
  })

  // Demo calculations
  const nitrogenBalance = NitrogenBalanceService.calculateNitrogenBalance(
    {
      feedAmountGrams: demoData.feedAmount,
      proteinPercentage: 0.4,
      temperature: demoData.temperature,
      pondVolume: demoData.pondVolume
    },
    {
      type: 'strong',
      efficiency: 0.9,
      maxAmmoniaLoad: 2.0
    }
  )

  const seasonalAdvice = SeasonalLogicService.getSeasonalAdvice({
    temperature: demoData.temperature,
    month: new Date().getMonth() + 1,
    dayOfYear: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  })

  const waterSafety = WaterSafetyService.assessWaterSafety([
    { name: 'ammonia', value: demoData.ammonia, unit: 'mg/L', status: 'good' as any, range: { safe: { min: 0, max: 0.2 }, warning: { min: 0.2, max: 0.5 }, danger: { min: 0.5, max: 10 } } },
    { name: 'nitrite', value: demoData.nitrite, unit: 'mg/L', status: 'good' as any, range: { safe: { min: 0, max: 0.1 }, warning: { min: 0.1, max: 0.3 }, danger: { min: 0.3, max: 10 } } },
    { name: 'nitrate', value: demoData.nitrate, unit: 'mg/L', status: 'good' as any, range: { safe: { min: 0, max: 50 }, warning: { min: 50, max: 100 }, danger: { min: 100, max: 1000 } } },
    { name: 'ph', value: demoData.pH, unit: '', status: 'good' as any, range: { safe: { min: 7.0, max: 8.5 }, warning: { min: 6.5, max: 9.0 }, danger: { min: 0, max: 14 } } },
    { name: 'oxygen', value: demoData.oxygen, unit: 'mg/L', status: 'good' as any, range: { safe: { min: 6, max: 20 }, warning: { min: 4, max: 6 }, danger: { min: 0, max: 4 } } }
  ])

  const structuredAdvice = StructuredAdviceService.generateStructuredAdvice({
    volume: demoData.pondVolume,
    koiCount: demoData.koiCount,
    averageLength: 45,
    averageAge: 3,
    temperature: demoData.temperature,
    filterType: 'mattenbak',
    filterEfficiency: 0.85,
    waterParameters: {
      ammonia: demoData.ammonia,
      nitrite: demoData.nitrite,
      nitrate: demoData.nitrate,
      pH: demoData.pH,
      oxygen: demoData.oxygen,
      KH: 6,
      GH: 8
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Enhanced Koi Pond Services</h1>
        <p className="text-lg text-muted-foreground">
          Nieuwe wetenschappelijk onderbouwde services voor optimale koi vijver management
        </p>
        <Badge variant="outline" className="text-sm">
          🧬 Koi Sensei Logic Implemented
        </Badge>
      </div>

      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Thermometer className="h-5 w-5" />
            <span>Demo Parameters</span>
          </CardTitle>
          <CardDescription>
            Pas de parameters aan om de nieuwe services te testen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Temperatuur (°C)</label>
              <input
                type="number"
                value={demoData.temperature}
                onChange={(e) => setDemoData({...demoData, temperature: Number(e.target.value)})}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Ammoniak (mg/L)</label>
              <input
                type="number"
                step="0.1"
                value={demoData.ammonia}
                onChange={(e) => setDemoData({...demoData, ammonia: Number(e.target.value)})}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nitriet (mg/L)</label>
              <input
                type="number"
                step="0.01"
                value={demoData.nitrite}
                onChange={(e) => setDemoData({...demoData, nitrite: Number(e.target.value)})}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Voer (g/dag)</label>
              <input
                type="number"
                value={demoData.feedAmount}
                onChange={(e) => setDemoData({...demoData, feedAmount: Number(e.target.value)})}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="nitrogen">Stikstof</TabsTrigger>
          <TabsTrigger value="seasonal">Seizoen</TabsTrigger>
          <TabsTrigger value="safety">Veiligheid</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Fish className="h-5 w-5" />
                <span>Gestructureerd Advies</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">📊 Samenvatting</h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-line">
                    {structuredAdvice.summary.content}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">💡 Advies</h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-line">
                    {structuredAdvice.advice.content}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">📋 Actiepunten</h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-line">
                    {structuredAdvice.actionPoints.content}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nitrogen" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Droplets className="h-5 w-5" />
                <span>Stikstofbalans</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Berekeningen</h4>
                  <div className="text-sm space-y-1">
                    <div>Stikstof invoer: {nitrogenBalance.nitrogenInput.toFixed(2)}g</div>
                    <div>Ammoniak belasting: {nitrogenBalance.ammoniaLoad.toFixed(2)}g</div>
                    <div>Groei stikstof: {nitrogenBalance.growthNitrogen.toFixed(2)}g</div>
                    <div>Ammoniak concentratie: {nitrogenBalance.ammoniaConcentration.toFixed(3)}mg/L</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Status</h4>
                  <Badge variant={nitrogenBalance.safetyStatus === 'safe' ? 'default' : nitrogenBalance.safetyStatus === 'warning' ? 'secondary' : 'destructive'}>
                    {nitrogenBalance.safetyStatus === 'safe' ? '✅ Veilig' : nitrogenBalance.safetyStatus === 'warning' ? '⚠️ Let op' : '🚨 Gevaarlijk'}
                  </Badge>
                  <div className="text-sm">
                    {nitrogenBalance.recommendations.map((rec, i) => (
                      <div key={i} className="text-xs">{rec}</div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasonal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Leaf className="h-5 w-5" />
                <span>Seizoenslogica</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Seizoensfase</h4>
                  <div className="text-sm">
                    <div><strong>Seizoen:</strong> {seasonalAdvice.season}</div>
                    <div><strong>Fase:</strong> {seasonalAdvice.phase}</div>
                    <div><strong>Voeren:</strong> {seasonalAdvice.feedingAdvice.shouldFeed ? 'Ja' : 'Nee'}</div>
                    <div><strong>Frequentie:</strong> {seasonalAdvice.feedingAdvice.frequency}x per dag</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Filter Advies</h4>
                  <div className="text-sm">
                    <div><strong>Activiteit:</strong> {seasonalAdvice.filterAdvice.activity}</div>
                    <div><strong>Onderhoud:</strong> {seasonalAdvice.filterAdvice.maintenance}</div>
                    <div><strong>Beluchting:</strong> {seasonalAdvice.filterAdvice.aeration}</div>
                  </div>
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {seasonalAdvice.educationalExplanation}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Waterveiligheid</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Algemene Status</h4>
                  <Badge variant={waterSafety.overallStatus === 'safe' ? 'default' : waterSafety.overallStatus === 'warning' ? 'secondary' : 'destructive'}>
                    {waterSafety.overallStatus === 'safe' ? '✅ Veilig' : waterSafety.overallStatus === 'warning' ? '⚠️ Let op' : '🚨 Gevaarlijk'}
                  </Badge>
                </div>
                
                {waterSafety.criticalIssues.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Kritieke problemen:</strong>
                      <ul className="mt-2 space-y-1">
                        {waterSafety.criticalIssues.map((issue, i) => (
                          <li key={i} className="text-sm">• {issue}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {waterSafety.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Waarschuwingen:</strong>
                      <ul className="mt-2 space-y-1">
                        {waterSafety.warnings.map((warning, i) => (
                          <li key={i} className="text-sm">• {warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <h4 className="font-semibold mb-2">Aanbevelingen</h4>
                  <ul className="space-y-1">
                    {waterSafety.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm">• {rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Educational Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Educatieve Uitleg</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-line text-sm">
              {structuredAdvice.educationalContext}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-center space-x-4">
        <Button onClick={() => onNavigate('dashboard')} variant="outline">
          Terug naar Dashboard
        </Button>
        <Button onClick={() => onNavigate('parameters')} variant="outline">
          Waterparameters
        </Button>
      </div>
    </div>
  )
}
