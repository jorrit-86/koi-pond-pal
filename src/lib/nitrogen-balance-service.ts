/**
 * Nitrogen Balance Service
 * Implements nitrogen balance calculations for koi pond management
 * Based on RAS (Recirculating Aquaculture Systems) principles
 */

export interface NitrogenInput {
  feedAmountGrams: number
  proteinPercentage: number
  temperature: number
  pondVolume: number
}

export interface NitrogenOutput {
  nitrogenInput: number
  ammoniaLoad: number
  growthNitrogen: number
  wasteNitrogen: number
  ammoniaConcentration: number
  safetyStatus: 'safe' | 'warning' | 'danger'
  recommendations: string[]
}

export interface FilterCapacity {
  type: 'weak' | 'medium' | 'strong'
  efficiency: number
  maxAmmoniaLoad: number
}

export class NitrogenBalanceService {
  // Fixed assumptions from the briefing
  private static readonly NITROGEN_PER_100G_FEED = 7 // grams
  private static readonly WASTE_PERCENTAGE = 0.85 // 85% becomes waste
  private static readonly GROWTH_PERCENTAGE = 0.15 // 15% used for growth
  private static readonly SAFE_AMMONIA_LIMIT = 0.2 // mg/L
  private static readonly WARNING_AMMONIA_LIMIT = 0.5 // mg/L

  /**
   * Calculate nitrogen balance for given feed input
   */
  static calculateNitrogenBalance(
    input: NitrogenInput,
    filterCapacity: FilterCapacity
  ): NitrogenOutput {
    // Calculate nitrogen input from feed
    const nitrogenInput = (input.feedAmountGrams / 100) * this.NITROGEN_PER_100G_FEED
    
    // Calculate waste and growth nitrogen
    const wasteNitrogen = nitrogenInput * this.WASTE_PERCENTAGE
    const growthNitrogen = nitrogenInput * this.GROWTH_PERCENTAGE
    
    // Calculate ammonia load (waste nitrogen becomes ammonia)
    const ammoniaLoad = wasteNitrogen
    
    // Calculate ammonia concentration in pond (mg/L)
    const ammoniaConcentration = (ammoniaLoad * 1000) / input.pondVolume // Convert to mg/L
    
    // Determine safety status
    const safetyStatus = this.determineSafetyStatus(ammoniaConcentration)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      ammoniaConcentration,
      ammoniaLoad,
      filterCapacity,
      input.temperature
    )
    
    return {
      nitrogenInput,
      ammoniaLoad,
      growthNitrogen,
      wasteNitrogen,
      ammoniaConcentration,
      safetyStatus,
      recommendations
    }
  }

  /**
   * Determine safety status based on ammonia concentration
   */
  private static determineSafetyStatus(ammoniaConcentration: number): 'safe' | 'warning' | 'danger' {
    if (ammoniaConcentration <= this.SAFE_AMMONIA_LIMIT) {
      return 'safe'
    } else if (ammoniaConcentration <= this.WARNING_AMMONIA_LIMIT) {
      return 'warning'
    } else {
      return 'danger'
    }
  }

  /**
   * Generate recommendations based on nitrogen balance
   */
  private static generateRecommendations(
    ammoniaConcentration: number,
    ammoniaLoad: number,
    filterCapacity: FilterCapacity,
    temperature: number
  ): string[] {
    const recommendations: string[] = []
    
    // Ammonia concentration recommendations
    if (ammoniaConcentration > this.WARNING_AMMONIA_LIMIT) {
      recommendations.push('🚨 Hoge ammoniakconcentratie! Direct 20-30% waterverversing uitvoeren')
      recommendations.push('Stop met voeren tot ammoniak <0.2 mg/L')
    } else if (ammoniaConcentration > this.SAFE_AMMONIA_LIMIT) {
      recommendations.push('⚠️ Ammoniak stijgt - controleer filter en overweeg waterverversing')
    } else {
      recommendations.push('✅ Ammoniakniveau veilig')
    }
    
    // Filter capacity recommendations
    if (ammoniaLoad > filterCapacity.maxAmmoniaLoad) {
      recommendations.push('🔧 Filter overbelast - overweeg filter uitbreiding of minder voeren')
    }
    
    // Temperature-based recommendations
    if (temperature < 8) {
      recommendations.push('❄️ Temperatuur <8°C - bacteriën inactief, niet voeren')
    } else if (temperature < 13) {
      recommendations.push('🌱 Voorjaar - filter opbouwen, langzaam verhogen voer')
    } else if (temperature > 20) {
      recommendations.push('☀️ Zomer - maximale filtercapaciteit beschikbaar')
    }
    
    return recommendations
  }

  /**
   * Calculate maximum safe feed amount based on filter capacity
   */
  static calculateMaxSafeFeed(
    filterCapacity: FilterCapacity,
    pondVolume: number,
    temperature: number
  ): number {
    // Temperature factor for bacterial activity
    const tempFactor = this.getTemperatureFactor(temperature)
    
    // Effective filter capacity
    const effectiveCapacity = filterCapacity.efficiency * tempFactor
    
    // Maximum ammonia load the filter can handle
    const maxAmmoniaLoad = filterCapacity.maxAmmoniaLoad * effectiveCapacity
    
    // Calculate maximum nitrogen input
    const maxNitrogenInput = maxAmmoniaLoad / this.WASTE_PERCENTAGE
    
    // Convert to maximum feed amount
    const maxFeedAmount = (maxNitrogenInput * 100) / this.NITROGEN_PER_100G_FEED
    
    return Math.max(0, maxFeedAmount)
  }

  /**
   * Get temperature factor for bacterial activity
   */
  private static getTemperatureFactor(temperature: number): number {
    if (temperature < 8) return 0.1 // Bacteria nearly inactive
    if (temperature < 13) return 0.3 // Slow activity
    if (temperature < 20) return 0.7 // Active
    if (temperature < 25) return 1.0 // Optimal
    return 0.8 // Slightly reduced at very high temps
  }

  /**
   * Calculate filter efficiency based on type and conditions
   */
  static calculateFilterEfficiency(
    filterType: string,
    temperature: number,
    oxygenLevel: number = 7.0,
    maintenanceFactor: number = 1.0
  ): number {
    // Base efficiency by filter type
    const baseEfficiency = this.getBaseFilterEfficiency(filterType)
    
    // Temperature factor
    const tempFactor = this.getTemperatureFactor(temperature)
    
    // Oxygen factor (optimal at 7+ mg/L)
    const oxygenFactor = Math.min(1, oxygenLevel / 7)
    
    // Calculate final efficiency
    return baseEfficiency * tempFactor * oxygenFactor * maintenanceFactor
  }

  /**
   * Get base filter efficiency by type
   */
  private static getBaseFilterEfficiency(filterType: string): number {
    const efficiencies: Record<string, number> = {
      'mattenbak': 0.9,
      'trickle': 0.95,
      'moving_bed': 0.9,
      'bead_filter': 0.7,
      'biological_only': 0.6,
      'mechanical_only': 0.3,
      'natural': 0.2
    }
    
    return efficiencies[filterType] || 0.5
  }

  /**
   * Get educational explanation for nitrogen cycle
   */
  static getEducationalExplanation(): string {
    return `
🧬 **Stikstofcyclus in de Vijver**

Alles wat je voert komt uiteindelijk in het water terecht:
• 100g voer bevat ±7g stikstof
• 85% wordt afval (ammoniak) - moet door filter worden afgebroken
• 15% wordt gebruikt voor visgroei

**Het systeem moet in balans zijn:**
Voer → Stikstof → Ammoniak → Nitriet → Nitraat → Waterverversing

**Waarom temperatuur belangrijk is:**
• <8°C: Bacteriën slapen, geen voer
• 8-15°C: Bacteriën worden wakker, voorzichtig opbouwen
• 15-25°C: Bacteriën actief, normaal voeren
• >25°C: Bacteriën optimaal, maximaal voeren mogelijk
    `.trim()
  }
}
