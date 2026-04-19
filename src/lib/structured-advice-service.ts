/**
 * Structured Advice Service
 * Implements 3-part output structure: Summary, Advice, Action Points
 * Provides comprehensive, educational advice for koi pond management
 */

import { NitrogenBalanceService } from './nitrogen-balance-service'
import { FilterEfficiencyService } from './filter-efficiency-service'
import { SeasonalLogicService } from './seasonal-logic-service'
import { WaterSafetyService } from './water-safety-service'
import { EducationalAdviceService } from './educational-advice-service'

export interface StructuredAdvice {
  summary: AdviceSection
  advice: AdviceSection
  actionPoints: AdviceSection
  educationalContext: string
  systemThinking: string
}

export interface AdviceSection {
  title: string
  content: string
  status: 'good' | 'warning' | 'danger'
  icon: string
}

export interface PondData {
  volume: number
  koiCount: number
  averageLength: number
  averageAge: number
  temperature: number
  filterType: string
  filterEfficiency: number
  waterParameters: {
    ammonia: number
    nitrite: number
    nitrate: number
    pH: number
    oxygen: number
    KH: number
    GH: number
  }
}

export class StructuredAdviceService {
  /**
   * Generate comprehensive structured advice
   */
  static generateStructuredAdvice(pondData: PondData): StructuredAdvice {
    // Get all necessary data
    const seasonalAdvice = SeasonalLogicService.getSeasonalAdvice({
      temperature: pondData.temperature,
      month: new Date().getMonth() + 1,
      dayOfYear: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    })

    const waterSafety = WaterSafetyService.assessWaterSafety([
      { name: 'ammonia', value: pondData.waterParameters.ammonia, unit: 'mg/L', status: 'good' as any, range: { safe: { min: 0, max: 0.2 }, warning: { min: 0.2, max: 0.5 }, danger: { min: 0.5, max: 10 } } },
      { name: 'nitrite', value: pondData.waterParameters.nitrite, unit: 'mg/L', status: 'good' as any, range: { safe: { min: 0, max: 0.1 }, warning: { min: 0.1, max: 0.3 }, danger: { min: 0.3, max: 10 } } },
      { name: 'nitrate', value: pondData.waterParameters.nitrate, unit: 'mg/L', status: 'good' as any, range: { safe: { min: 0, max: 50 }, warning: { min: 50, max: 100 }, danger: { min: 100, max: 1000 } } },
      { name: 'ph', value: pondData.waterParameters.pH, unit: '', status: 'good' as any, range: { safe: { min: 7.0, max: 8.5 }, warning: { min: 6.5, max: 9.0 }, danger: { min: 0, max: 14 } } },
      { name: 'oxygen', value: pondData.waterParameters.oxygen, unit: 'mg/L', status: 'good' as any, range: { safe: { min: 6, max: 20 }, warning: { min: 4, max: 6 }, danger: { min: 0, max: 4 } } }
    ])

    // Generate summary
    const summary = this.generateSummary(pondData, seasonalAdvice, waterSafety)
    
    // Generate advice
    const advice = this.generateAdvice(pondData, seasonalAdvice, waterSafety)
    
    // Generate action points
    const actionPoints = this.generateActionPoints(pondData, seasonalAdvice, waterSafety)
    
    // Generate educational context
    const educationalContext = this.generateEducationalContext(pondData, seasonalAdvice, waterSafety)
    
    // Generate system thinking
    const systemThinking = this.generateSystemThinking(pondData, seasonalAdvice, waterSafety)
    
    return {
      summary,
      advice,
      actionPoints,
      educationalContext,
      systemThinking
    }
  }

  /**
   * Generate summary section
   */
  private static generateSummary(
    pondData: PondData,
    seasonalAdvice: any,
    waterSafety: any
  ): AdviceSection {
    const status = waterSafety.overallStatus === 'safe' ? 'good' : 
                  waterSafety.overallStatus === 'warning' ? 'warning' : 'danger'
    
    const icon = status === 'good' ? '✅' : status === 'warning' ? '⚠️' : '🚨'
    
    const content = `**Vijver**: ${pondData.volume}L | ${pondData.koiCount} koi (gem. ${pondData.averageLength}cm, ${pondData.averageAge}jr)
**Water**: ${pondData.temperature}°C | Ammoniak ${pondData.waterParameters.ammonia}mg/L | Nitriet ${pondData.waterParameters.nitrite}mg/L
**Filter**: ${pondData.filterType} | Efficiëntie: ${(pondData.filterEfficiency * 100).toFixed(0)}%
**Seizoen**: ${seasonalAdvice.season} (${seasonalAdvice.phase})`
    
    return {
      title: 'Vijver Overzicht',
      content,
      status,
      icon
    }
  }

  /**
   * Generate advice section
   */
  private static generateAdvice(
    pondData: PondData,
    seasonalAdvice: any,
    waterSafety: any
  ): AdviceSection {
    const status = waterSafety.overallStatus === 'safe' ? 'good' : 
                  waterSafety.overallStatus === 'warning' ? 'warning' : 'danger'
    
    const icon = status === 'good' ? '💡' : status === 'warning' ? '⚠️' : '🚨'
    
    let content = ''
    
    // Feeding advice
    if (pondData.temperature < 8) {
      content += `**Voeradvies**: Niet voeren - temperatuur <8°C\n`
    } else {
      const feedingAdvice = seasonalAdvice.feedingAdvice
      content += `**Voeradvies**: ${feedingAdvice.frequency}x per dag, ${feedingAdvice.amount} hoeveelheid\n`
      if (feedingAdvice.weeklyIncrease > 0) {
        content += `**Seizoensfase**: ${seasonalAdvice.season} → voer wekelijks +${feedingAdvice.weeklyIncrease}g verhogen\n`
      } else if (feedingAdvice.weeklyIncrease < 0) {
        content += `**Seizoensfase**: ${seasonalAdvice.season} → voer wekelijks ${feedingAdvice.weeklyIncrease}g verminderen\n`
      }
    }
    
    // Filter advice
    const filterEfficiency = pondData.filterEfficiency
    if (filterEfficiency > 0.9) {
      content += `**Filter**: Uitstekend (${(filterEfficiency * 100).toFixed(0)}% efficiëntie)\n`
    } else if (filterEfficiency > 0.7) {
      content += `**Filter**: Goed (${(filterEfficiency * 100).toFixed(0)}% efficiëntie)\n`
    } else {
      content += `**Filter**: Onderbelast (${(filterEfficiency * 100).toFixed(0)}% efficiëntie) - controleer onderhoud\n`
    }
    
    // Water quality advice
    if (waterSafety.overallStatus === 'safe') {
      content += `**Waterkwaliteit**: Stabiel - alle parameters veilig`
    } else if (waterSafety.overallStatus === 'warning') {
      content += `**Waterkwaliteit**: Let op - enkele parameters stijgen`
    } else {
      content += `**Waterkwaliteit**: Gevaarlijk - directe actie vereist`
    }
    
    return {
      title: 'Advies',
      content,
      status,
      icon
    }
  }

  /**
   * Generate action points section
   */
  private static generateActionPoints(
    pondData: PondData,
    seasonalAdvice: any,
    waterSafety: any
  ): AdviceSection {
    const actionPoints: string[] = []
    
    // Water quality action points
    if (pondData.waterParameters.ammonia > 0.2) {
      actionPoints.push('🚨 Ammoniak te hoog - controleer filter en overweeg waterverversing')
    } else {
      actionPoints.push('✅ Ammoniak niveau veilig')
    }
    
    if (pondData.waterParameters.nitrite > 0.1) {
      actionPoints.push('⚠️ Nitriet stijgt - controleer biologische filter')
    } else {
      actionPoints.push('✅ Nitriet niveau veilig')
    }
    
    if (pondData.waterParameters.nitrate > 50) {
      actionPoints.push('⚠️ Nitraat hoog - verhoog waterverversing of voeg planten toe')
    }
    
    // Seasonal action points
    const feedingAdvice = seasonalAdvice.feedingAdvice
    if (feedingAdvice.shouldFeed) {
      if (feedingAdvice.weeklyIncrease > 0) {
        actionPoints.push(`🌱 ${seasonalAdvice.season} - voer wekelijks +${feedingAdvice.weeklyIncrease}g verhogen`)
      } else if (feedingAdvice.weeklyIncrease < 0) {
        actionPoints.push(`🍂 ${seasonalAdvice.season} - voer wekelijks ${feedingAdvice.weeklyIncrease}g verminderen`)
      }
    } else {
      actionPoints.push('❄️ Winter - niet voeren, filter laten circuleren')
    }
    
    // Filter maintenance
    actionPoints.push('🧽 Reinig voorfilter 1× per week')
    
    // Critical issues
    if (waterSafety.criticalIssues.length > 0) {
      actionPoints.push(...waterSafety.criticalIssues)
    }
    
    const status = waterSafety.overallStatus === 'safe' ? 'good' : 
                  waterSafety.overallStatus === 'warning' ? 'warning' : 'danger'
    
    const icon = status === 'good' ? '📋' : status === 'warning' ? '⚠️' : '🚨'
    
    return {
      title: 'Actiepunten',
      content: actionPoints.join('\n'),
      status,
      icon
    }
  }

  /**
   * Generate educational context
   */
  private static generateEducationalContext(
    pondData: PondData,
    seasonalAdvice: any,
    waterSafety: any
  ): string {
    let context = `\n🧬 **Biologische Processen Uitleg**\n\n`
    
    // Temperature and bacterial activity
    context += `**Temperatuur en bacteriën:**\n`
    if (pondData.temperature < 8) {
      context += `• ${pondData.temperature}°C: Bacteriën inactief - filter werkt niet\n`
      context += `• Geen voeren - ammoniak zou ophopen\n`
    } else if (pondData.temperature < 13) {
      context += `• ${pondData.temperature}°C: Bacteriën worden wakker - filter opbouwen\n`
      context += `• Voorzichtig voeren - langzaam opbouwen\n`
    } else if (pondData.temperature < 20) {
      context += `• ${pondData.temperature}°C: Bacteriën actief - normale filterwerking\n`
      context += `• Normaal voeren mogelijk\n`
    } else {
      context += `• ${pondData.temperature}°C: Bacteriën optimaal - maximale capaciteit\n`
      context += `• Maximaal voeren mogelijk\n`
    }
    
    // Nitrogen cycle explanation
    context += `\n**Stikstofcyclus:**\n`
    context += `• Voer → Stikstof → Ammoniak → Nitriet → Nitraat\n`
    context += `• 85% van voer wordt afval (ammoniak)\n`
    context += `• 15% wordt gebruikt voor visgroei\n`
    context += `• Filter bacteriën breken ammoniak af\n`
    
    // Current status
    context += `\n**Huidige status:**\n`
    context += `• Ammoniak: ${pondData.waterParameters.ammonia}mg/L (veilig <0.2mg/L)\n`
    context += `• Nitriet: ${pondData.waterParameters.nitrite}mg/L (veilig <0.1mg/L)\n`
    context += `• Nitraat: ${pondData.waterParameters.nitrate}mg/L (veilig <50mg/L)\n`
    
    return context
  }

  /**
   * Generate system thinking explanation
   */
  private static generateSystemThinking(
    pondData: PondData,
    seasonalAdvice: any,
    waterSafety: any
  ): string {
    let thinking = `\n🌐 **Systeemdenken - Alles is Verbonden**\n\n`
    
    thinking += `**Input → Process → Output:**\n`
    thinking += `• Voer (input) → Stikstof → Ammoniak (process) → Filter → Schoon water (output)\n\n`
    
    thinking += `**Balans is cruciaal:**\n`
    thinking += `• Meer voer = meer ammoniak = meer filter nodig\n`
    thinking += `• Hogere temperatuur = actievere bacteriën = meer filter capaciteit\n`
    thinking += `• Filter onderbelast = ammoniak ophoping = vis stress\n\n`
    
    thinking += `**Prioriteit volgorde:**\n`
    thinking += `1. **Veiligheid** - Geen giftige stoffen\n`
    thinking += `2. **Stabiliteit** - Consistente waterkwaliteit\n`
    thinking += `3. **Groei** - Vis ontwikkeling\n\n`
    
    thinking += `**Waarom deze aanpak werkt:**\n`
    thinking += `• Filterveiligheid gaat voor visgroei\n`
    thinking += `• Temperatuur bepaalt wat mogelijk is\n`
    thinking += `• Seizoenen volgen natuurlijke cycli\n`
    thinking += `• Alles wat erin gaat, moet eruit via filter of verversing\n`
    
    return thinking
  }

  /**
   * Get formatted advice for display
   */
  static getFormattedAdvice(structuredAdvice: StructuredAdvice): string {
    let formatted = ''
    
    // Summary
    formatted += `## ${structuredAdvice.summary.icon} ${structuredAdvice.summary.title}\n`
    formatted += `${structuredAdvice.summary.content}\n\n`
    
    // Advice
    formatted += `## ${structuredAdvice.advice.icon} ${structuredAdvice.advice.title}\n`
    formatted += `${structuredAdvice.advice.content}\n\n`
    
    // Action Points
    formatted += `## ${structuredAdvice.actionPoints.icon} ${structuredAdvice.actionPoints.title}\n`
    formatted += `${structuredAdvice.actionPoints.content}\n\n`
    
    // Educational Context
    formatted += structuredAdvice.educationalContext + '\n\n'
    
    // System Thinking
    formatted += structuredAdvice.systemThinking
    
    return formatted
  }

  /**
   * Get quick status overview
   */
  static getQuickStatus(pondData: PondData): {
    overall: 'good' | 'warning' | 'danger'
    message: string
    icon: string
  } {
    const criticalIssues = []
    
    if (pondData.waterParameters.ammonia > 0.5) criticalIssues.push('Ammoniak gevaarlijk hoog')
    if (pondData.waterParameters.nitrite > 0.3) criticalIssues.push('Nitriet gevaarlijk hoog')
    if (pondData.waterParameters.nitrate > 100) criticalIssues.push('Nitraat gevaarlijk hoog')
    if (pondData.temperature < 5) criticalIssues.push('Temperatuur te laag')
    
    if (criticalIssues.length > 0) {
      return {
        overall: 'danger',
        message: criticalIssues.join(', '),
        icon: '🚨'
      }
    }
    
    const warnings = []
    if (pondData.waterParameters.ammonia > 0.2) warnings.push('Ammoniak stijgt')
    if (pondData.waterParameters.nitrite > 0.1) warnings.push('Nitriet stijgt')
    if (pondData.filterEfficiency < 0.5) warnings.push('Filter onderbelast')
    
    if (warnings.length > 0) {
      return {
        overall: 'warning',
        message: warnings.join(', '),
        icon: '⚠️'
      }
    }
    
    return {
      overall: 'good',
      message: 'Alle parameters veilig',
      icon: '✅'
    }
  }
}
