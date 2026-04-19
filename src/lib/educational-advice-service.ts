/**
 * Educational Advice Service
 * Provides educational explanations and system thinking for koi pond management
 * Focuses on teaching users about biological processes and system balance
 */

export interface EducationalAdvice {
  summary: string
  advice: string
  actionPoints: string[]
  educationalExplanation: string
  systemThinking: string
  seasonalContext: string
}

export interface PondSummary {
  volume: number
  koiCount: number
  averageLength: number
  averageAge: number
  temperature: number
  filterType: string
  filterEfficiency: number
}

export interface WaterSummary {
  ammonia: number
  nitrite: number
  nitrate: number
  pH: number
  oxygen: number
  temperature: number
}

export interface FeedingSummary {
  dailyAmount: number
  frequency: number
  feedPerMeal: number
  feedType: string
  safetyStatus: string
}

export class EducationalAdviceService {
  /**
   * Generate comprehensive educational advice
   */
  static generateEducationalAdvice(
    pondSummary: PondSummary,
    waterSummary: WaterSummary,
    feedingSummary: FeedingSummary,
    seasonalPhase: string
  ): EducationalAdvice {
    // Generate summary
    const summary = this.generateSummary(pondSummary, waterSummary, feedingSummary)
    
    // Generate advice
    const advice = this.generateAdvice(pondSummary, waterSummary, feedingSummary, seasonalPhase)
    
    // Generate action points
    const actionPoints = this.generateActionPoints(waterSummary, feedingSummary, seasonalPhase)
    
    // Generate educational explanation
    const educationalExplanation = this.generateEducationalExplanation(
      waterSummary, 
      feedingSummary, 
      seasonalPhase
    )
    
    // Generate system thinking explanation
    const systemThinking = this.generateSystemThinking(pondSummary, waterSummary, feedingSummary)
    
    // Generate seasonal context
    const seasonalContext = this.generateSeasonalContext(seasonalPhase, waterSummary.temperature)
    
    return {
      summary,
      advice,
      actionPoints,
      educationalExplanation,
      systemThinking,
      seasonalContext
    }
  }

  /**
   * Generate pond summary
   */
  private static generateSummary(
    pondSummary: PondSummary,
    waterSummary: WaterSummary,
    feedingSummary: FeedingSummary
  ): string {
    return `**Vijver**: ${pondSummary.volume}L | ${pondSummary.koiCount} koi (gem. ${pondSummary.averageLength}cm, ${pondSummary.averageAge}jr)
**Water**: ${waterSummary.temperature}°C | Ammoniak ${waterSummary.ammonia}mg/L | Nitriet ${waterSummary.nitrite}mg/L
**Filter**: ${pondSummary.filterType} | Efficiëntie: ${(pondSummary.filterEfficiency * 100).toFixed(0)}%`
  }

  /**
   * Generate feeding and filter advice
   */
  private static generateAdvice(
    pondSummary: PondSummary,
    waterSummary: WaterSummary,
    feedingSummary: FeedingSummary,
    seasonalPhase: string
  ): string {
    let advice = `**Voeradvies**: ${feedingSummary.dailyAmount.toFixed(0)}g/dag, verdeeld over ${feedingSummary.frequency} porties\n`
    
    // Filter efficiency advice
    const filterEfficiency = pondSummary.filterEfficiency
    if (filterEfficiency > 0.9) {
      advice += `**Filter**: Uitstekend (${(filterEfficiency * 100).toFixed(0)}% efficiëntie)\n`
    } else if (filterEfficiency > 0.7) {
      advice += `**Filter**: Goed (${(filterEfficiency * 100).toFixed(0)}% efficiëntie)\n`
    } else {
      advice += `**Filter**: Onderbelast (${(filterEfficiency * 100).toFixed(0)}% efficiëntie) - controleer onderhoud\n`
    }
    
    // Seasonal advice
    advice += `**Seizoen**: ${seasonalPhase} → ${this.getSeasonalFeedingAdvice(seasonalPhase, waterSummary.temperature)}`
    
    return advice
  }

  /**
   * Generate action points
   */
  private static generateActionPoints(
    waterSummary: WaterSummary,
    feedingSummary: FeedingSummary,
    seasonalPhase: string
  ): string[] {
    const actionPoints: string[] = []
    
    // Water quality action points
    if (waterSummary.ammonia > 0.2) {
      actionPoints.push('🚨 Ammoniak te hoog - controleer filter en overweeg waterverversing')
    } else {
      actionPoints.push('✅ Ammoniak niveau veilig')
    }
    
    if (waterSummary.nitrite > 0.1) {
      actionPoints.push('⚠️ Nitriet stijgt - controleer biologische filter')
    } else {
      actionPoints.push('✅ Nitriet niveau veilig')
    }
    
    if (waterSummary.nitrate > 50) {
      actionPoints.push('⚠️ Nitraat hoog - verhoog waterverversing of voeg planten toe')
    }
    
    // Seasonal action points
    if (seasonalPhase.includes('voorjaar')) {
      actionPoints.push('🌱 Voorjaar - voer wekelijks +25g verhogen')
    } else if (seasonalPhase.includes('zomer')) {
      actionPoints.push('☀️ Zomer - verdeel voer over meerdere porties')
    } else if (seasonalPhase.includes('herfst')) {
      actionPoints.push('🍂 Herfst - voer wekelijks -25g verminderen')
    } else if (seasonalPhase.includes('winter')) {
      actionPoints.push('❄️ Winter - niet voeren, filter laten circuleren')
    }
    
    // Filter maintenance
    actionPoints.push('🧽 Reinig voorfilter 1× per week')
    
    return actionPoints
  }

  /**
   * Generate educational explanation
   */
  private static generateEducationalExplanation(
    waterSummary: WaterSummary,
    feedingSummary: FeedingSummary,
    seasonalPhase: string
  ): string {
    let explanation = `\n🧬 **Biologische Processen Uitleg**\n\n`
    
    // Temperature and bacterial activity
    explanation += `**Temperatuur en bacteriën:**\n`
    if (waterSummary.temperature < 8) {
      explanation += `• ${waterSummary.temperature}°C: Bacteriën inactief - filter werkt niet\n`
      explanation += `• Geen voeren - ammoniak zou ophopen\n`
    } else if (waterSummary.temperature < 13) {
      explanation += `• ${waterSummary.temperature}°C: Bacteriën worden wakker - filter opbouwen\n`
      explanation += `• Voorzichtig voeren - langzaam opbouwen\n`
    } else if (waterSummary.temperature < 20) {
      explanation += `• ${waterSummary.temperature}°C: Bacteriën actief - normale filterwerking\n`
      explanation += `• Normaal voeren mogelijk\n`
    } else {
      explanation += `• ${waterSummary.temperature}°C: Bacteriën optimaal - maximale capaciteit\n`
      explanation += `• Maximaal voeren mogelijk\n`
    }
    
    // Nitrogen cycle explanation
    explanation += `\n**Stikstofcyclus:**\n`
    explanation += `• Voer → Stikstof → Ammoniak → Nitriet → Nitraat\n`
    explanation += `• 85% van voer wordt afval (ammoniak)\n`
    explanation += `• 15% wordt gebruikt voor visgroei\n`
    explanation += `• Filter bacteriën breken ammoniak af\n`
    
    // Current status
    explanation += `\n**Huidige status:**\n`
    explanation += `• Ammoniak: ${waterSummary.ammonia}mg/L (veilig <0.2mg/L)\n`
    explanation += `• Nitriet: ${waterSummary.nitrite}mg/L (veilig <0.1mg/L)\n`
    explanation += `• Nitraat: ${waterSummary.nitrate}mg/L (veilig <50mg/L)\n`
    
    return explanation
  }

  /**
   * Generate system thinking explanation
   */
  private static generateSystemThinking(
    pondSummary: PondSummary,
    waterSummary: WaterSummary,
    feedingSummary: FeedingSummary
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
   * Generate seasonal context
   */
  private static generateSeasonalContext(seasonalPhase: string, temperature: number): string {
    let context = `\n📅 **Seizoenscontext**\n\n`
    
    context += `**Huidige fase: ${seasonalPhase}**\n`
    
    if (seasonalPhase.includes('winter')) {
      context += `• Koi in winterslaap - metabolisme op minimum\n`
      context += `• Filter bacteriën inactief - alleen circulatie\n`
      context += `• Geen voeren - voorkom ammoniak ophoping\n`
    } else if (seasonalPhase.includes('voorjaar')) {
      context += `• Koi worden wakker - metabolisme stijgt\n`
      context += `• Filter bacteriën worden actief - opbouwen\n`
      context += `• Voorzichtig voeren - langzaam opbouwen\n`
    } else if (seasonalPhase.includes('zomer')) {
      context += `• Koi zeer actief - maximale groei\n`
      context += `• Filter bacteriën optimaal - maximale capaciteit\n`
      context += `• Maximaal voeren - verdeel over porties\n`
    } else if (seasonalPhase.includes('herfst')) {
      context += `• Koi bereiden zich voor op winter\n`
      context += `• Filter bacteriën worden minder actief\n`
      context += `• Afbouwen voeren - licht verteerbaar\n`
    }
    
    context += `\n**Temperatuur impact:**\n`
    context += `• ${temperature}°C bepaalt wat mogelijk is\n`
    context += `• Bacteriën volgen temperatuur cycli\n`
    context += `• Koi gedrag volgt natuurlijke patronen\n`
    
    return context
  }

  /**
   * Get seasonal feeding advice
   */
  private static getSeasonalFeedingAdvice(seasonalPhase: string, temperature: number): string {
    if (seasonalPhase.includes('winter')) {
      return 'niet voeren - filter inactief'
    } else if (seasonalPhase.includes('voorjaar')) {
      return 'voorzichtig opbouwen - +25g/week'
    } else if (seasonalPhase.includes('zomer')) {
      return 'maximaal voeren - verdeel over porties'
    } else if (seasonalPhase.includes('herfst')) {
      return 'afbouwen - licht verteerbaar voer'
    }
    return 'normaal voeren'
  }

  /**
   * Get educational tips for specific situations
   */
  static getEducationalTips(situation: string): string[] {
    const tips: Record<string, string[]> = {
      'high_ammonia': [
        '🧪 Ammoniak is direct giftig - stop met voeren',
        '💧 Waterverversing verdunt ammoniak',
        '🔧 Filter controle - bacteriën werken niet goed',
        '🌡️ Temperatuur controle - bacteriën hebben warmte nodig'
      ],
      'high_nitrite': [
        '🧪 Nitriet blokkeert zuurstoftransport',
        '💨 Extra beluchting helpt bacteriën',
        '🔧 Biologische filter controle - nitrificerende bacteriën',
        '⏰ Tijd - filter heeft tijd nodig om op te bouwen'
      ],
      'high_nitrate': [
        '🌿 Planten gebruiken nitraat als voeding',
        '💧 Waterverversing verwijdert nitraat',
        '🔄 Regelmatige verversing voorkomt ophoping',
        '⚖️ Balans tussen voer en filter capaciteit'
      ],
      'low_temperature': [
        '❄️ Koude temperaturen maken bacteriën inactief',
        '🚫 Niet voeren bij <8°C',
        '🔧 Filter laten draaien voor circulatie',
        '⏰ Wachten tot temperatuur stijgt'
      ],
      'filter_problems': [
        '🔧 Filter onderhoud - reinig en controleer',
        '💨 Beluchting controle - bacteriën hebben zuurstof nodig',
        '🌡️ Temperatuur controle - bacteriën hebben warmte nodig',
        '⏰ Tijd - filter heeft tijd nodig om te werken'
      ]
    }
    
    return tips[situation] || ['Controleer alle parameters regelmatig']
  }

  /**
   * Get system balance explanation
   */
  static getSystemBalanceExplanation(): string {
    return `
🌐 **Systeembalans Begrijpen**

**Het vijver systeem:**
• **Input**: Voer, water, zuurstof
• **Process**: Spijsvertering, filter bacteriën, stikstofcyclus
• **Output**: Groei, afval, waterverversing

**Waarom balans belangrijk is:**
• Te veel voer = ammoniak ophoping = vis stress
• Te weinig filter = afval ophoping = waterkwaliteit problemen
• Temperatuur bepaalt bacteriën activiteit = filter capaciteit

**Systeemdenken principes:**
1. Alles is verbonden - verandering in één deel beïnvloedt alles
2. Feedback loops - output beïnvloedt input
3. Tijd vertraging - effecten zijn niet altijd direct zichtbaar
4. Non-lineariteit - kleine veranderingen kunnen grote effecten hebben

**Praktische toepassing:**
• Voer alleen wat het filter aankan
• Temperatuur bepaalt wat mogelijk is
• Seizoenen volgen natuurlijke cycli
• Veiligheid gaat voor groei
    `.trim()
  }
}
