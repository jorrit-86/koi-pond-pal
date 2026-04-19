/**
 * Enhanced AI Chat Service
 * Integrates all new services for comprehensive koi pond advice
 * Provides educational, system-thinking based responses
 */

import { supabase } from './supabase'
import { NitrogenBalanceService } from './nitrogen-balance-service'
import { FilterEfficiencyService } from './filter-efficiency-service'
import { SeasonalLogicService } from './seasonal-logic-service'
import { WaterSafetyService } from './water-safety-service'
import { EducationalAdviceService } from './educational-advice-service'
import { StructuredAdviceService } from './structured-advice-service'
import { ConservativeSafetyService } from './conservative-safety-service'

export interface EnhancedChatContext {
  currentPage: string
  waterParameters?: Array<{
    name: string
    value: number
    unit: string
    status: string
  }>
  koiCount?: number
  pondSize?: number
  userExperience?: string
  season?: string
  filterData?: {
    filtration_type?: string
    filter_media?: string[]
    filter_segments?: Array<{
      name: string
      type: string
      media: string[]
      description: string
    }>
    uv_sterilizer?: boolean
    protein_skimmer?: boolean
    waterfall?: boolean
    fountain?: boolean
    aeration_system?: boolean
    heater?: boolean
    chiller?: boolean
    auto_feeder?: boolean
    water_source?: string
    water_changes_manual?: boolean
    plants_present?: boolean
    plant_types?: string[]
  }
}

export interface EnhancedChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  context?: EnhancedChatContext
  structuredAdvice?: any
  educationalContent?: string
}

export class EnhancedAIChatService {
  /**
   * Get enhanced pond context with all necessary data
   */
  static async getEnhancedPondContext(userId: string): Promise<EnhancedChatContext> {
    try {
      // Get user preferences including filter data
      const { data: preferences, error: preferencesError } = await supabase
        .from('user_preferences')
        .select(`
          experience_level, 
          pond_size_liters,
          filtration_type,
          filter_media,
          filter_segments,
          uv_sterilizer,
          protein_skimmer,
          waterfall,
          fountain,
          aeration_system,
          heater,
          chiller,
          auto_feeder,
          water_source,
          water_changes_manual,
          plants_present,
          plant_types
        `)
        .eq('user_id', userId)
        .maybeSingle()

      // Get latest water parameters
      const { data: parameters } = await supabase
        .from('water_parameters')
        .select('parameter_type, value, unit, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      // Get koi count and data
      const { count: koiCount } = await supabase
        .from('koi')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      // Get koi data for calculations
      const { data: koiData } = await supabase
        .from('koi')
        .select('*')
        .eq('user_id', userId)

      // Determine current season
      const currentMonth = new Date().getMonth()
      const season = currentMonth >= 2 && currentMonth <= 4 ? 'spring' :
                    currentMonth >= 5 && currentMonth <= 7 ? 'summer' :
                    currentMonth >= 8 && currentMonth <= 10 ? 'autumn' : 'winter'

      return {
        currentPage: 'dashboard',
        waterParameters: parameters?.map(p => ({
          name: p.parameter_type,
          value: p.value,
          unit: p.unit || '',
          status: p.status || 'normal'
        })),
        koiCount: koiCount || 0,
        pondSize: preferences?.pond_size_liters || 0,
        userExperience: preferences?.experience_level || 'beginner',
        season,
        filterData: {
          filtration_type: preferences?.filtration_type || 'mechanical_biological',
          filter_media: preferences?.filter_media || [],
          filter_segments: preferences?.filter_segments || [],
          uv_sterilizer: preferences?.uv_sterilizer ?? false,
          protein_skimmer: preferences?.protein_skimmer ?? false,
          waterfall: preferences?.waterfall ?? false,
          fountain: preferences?.fountain ?? false,
          aeration_system: preferences?.aeration_system ?? false,
          heater: preferences?.heater ?? false,
          chiller: preferences?.chiller ?? false,
          auto_feeder: preferences?.auto_feeder ?? false,
          water_source: preferences?.water_source || 'tap_water',
          water_changes_manual: preferences?.water_changes_manual ?? true,
          plants_present: preferences?.plants_present ?? false,
          plant_types: preferences?.plant_types || []
        }
      }
    } catch (error) {
      console.error('Error getting enhanced pond context:', error)
      return {
        currentPage: 'dashboard',
        waterParameters: [],
        koiCount: 0,
        pondSize: 0,
        userExperience: 'beginner',
        season: 'spring',
        filterData: {
          filtration_type: 'mechanical_biological',
          filter_media: [],
          filter_segments: [],
          uv_sterilizer: false,
          protein_skimmer: false,
          waterfall: false,
          fountain: false,
          aeration_system: false,
          heater: false,
          chiller: false,
          auto_feeder: false,
          water_source: 'tap_water',
          water_changes_manual: true,
          plants_present: false,
          plant_types: []
        }
      }
    }
  }

  /**
   * Generate enhanced AI response with all new services
   */
  static async generateEnhancedResponse(
    userMessage: string,
    context: EnhancedChatContext
  ): Promise<EnhancedChatMessage> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))

    const lowerMessage = userMessage.toLowerCase()
    
    // Check for missing parameters first
    const missingParams = this.checkMissingParameters(context)
    if (missingParams.length > 0) {
      return this.generateMissingParametersResponse(missingParams)
    }

    // Generate comprehensive advice
    const structuredAdvice = await this.generateComprehensiveAdvice(context)
    
    // Determine response type and generate appropriate response
    let response = ''
    let educationalContent = ''
    
    if (lowerMessage.includes('water') || lowerMessage.includes('waterkwaliteit')) {
      response = this.generateWaterQualityResponse(context, structuredAdvice)
      educationalContent = this.generateWaterQualityEducationalContent(context, structuredAdvice)
    } else if (lowerMessage.includes('filter') || lowerMessage.includes('filtratie')) {
      response = this.generateFilterResponse(context, structuredAdvice)
      educationalContent = this.generateFilterEducationalContent(context, structuredAdvice)
    } else if (lowerMessage.includes('seizoen') || lowerMessage.includes('temperatuur')) {
      response = this.generateSeasonalResponse(context, structuredAdvice)
      educationalContent = this.generateSeasonalEducationalContent(context, structuredAdvice)
    } else if (lowerMessage.includes('advies') || lowerMessage.includes('help') || lowerMessage.includes('hulp')) {
      response = this.generateGeneralAdviceResponse(context, structuredAdvice)
      educationalContent = this.generateGeneralEducationalContent(context, structuredAdvice)
    } else {
      response = this.generateDefaultResponse(context, structuredAdvice)
      educationalContent = this.generateDefaultEducationalContent(context, structuredAdvice)
    }

    return {
      id: Date.now().toString(),
      type: 'assistant',
      content: response,
      timestamp: new Date(),
      context,
      structuredAdvice,
      educationalContent
    }
  }

  /**
   * Generate comprehensive advice using all services
   */
  private static async generateComprehensiveAdvice(context: EnhancedChatContext): Promise<any> {
    // Extract water parameters
    const waterParams = this.extractWaterParameters(context)
    
    // Extract pond data
    const pondData = {
      volume: context.pondSize || 0,
      koiCount: context.koiCount || 0,
      averageLength: 45, // Default, should be calculated from actual data
      averageAge: 3, // Default, should be calculated from actual data
      temperature: waterParams.temperature || 20,
      filterType: context.filterData?.filtration_type || 'mechanical_biological',
      filterEfficiency: 0.8, // Default, should be calculated
      waterParameters: waterParams
    }

    // Generate structured advice
    return StructuredAdviceService.generateStructuredAdvice(pondData)
  }

  /**
   * Extract water parameters from context
   */
  private static extractWaterParameters(context: EnhancedChatContext): any {
    const params: any = {}
    
    if (context.waterParameters) {
      for (const param of context.waterParameters) {
        params[param.name.toLowerCase()] = param.value
      }
    }
    
    // Set defaults for missing parameters
    if (!params.temperature) params.temperature = 20
    if (!params.ammonia) params.ammonia = 0
    if (!params.nitrite) params.nitrite = 0
    if (!params.nitrate) params.nitrate = 10
    if (!params.ph) params.ph = 7.5
    if (!params.oxygen) params.oxygen = 7
    if (!params.kh) params.kh = 6
    if (!params.gh) params.gh = 8
    
    return params
  }

  /**
   * Check for missing parameters
   */
  private static checkMissingParameters(context: EnhancedChatContext): string[] {
    const missing: string[] = []
    const required = ['temperature', 'ammonia', 'nitrite', 'nitrate', 'ph', 'oxygen']
    
    if (context.waterParameters) {
      const paramNames = context.waterParameters.map(p => p.name.toLowerCase())
      for (const requiredParam of required) {
        if (!paramNames.includes(requiredParam)) {
          missing.push(requiredParam)
        }
      }
    } else {
      missing.push(...required)
    }
    
    return missing
  }

  /**
   * Generate response for missing parameters
   */
  private static generateMissingParametersResponse(missingParams: string[]): EnhancedChatMessage {
    const paramNames: Record<string, string> = {
      temperature: 'temperatuur',
      ammonia: 'ammoniak',
      nitrite: 'nitriet',
      nitrate: 'nitraat',
      ph: 'pH',
      oxygen: 'zuurstof'
    }
    
    const missingNames = missingParams.map(p => paramNames[p] || p)
    
    return {
      id: Date.now().toString(),
      type: 'assistant',
      content: `Ik heb de volgende waterparameters nodig voor een veilig advies: ${missingNames.join(', ')}. 
      
Voer deze waarden in via het waterparameters scherm om een volledig advies te krijgen.`,
      timestamp: new Date(),
      context: undefined,
      structuredAdvice: null,
      educationalContent: 'Zonder complete waterkwaliteit data kan ik geen volledig advies geven. Temperatuur en ammoniak/nitriet waarden zijn essentieel.'
    }
  }


  /**
   * Generate water quality response
   */
  private static generateWaterQualityResponse(context: EnhancedChatContext, structuredAdvice: any): string {
    const waterParams = this.extractWaterParameters(context)
    
    let response = `🧪 **Waterkwaliteit Analyse**\n\n`
    
    // Check each parameter
    const parameters = ['ammonia', 'nitrite', 'nitrate', 'ph', 'oxygen']
    const paramNames: Record<string, string> = {
      ammonia: 'Ammoniak',
      nitrite: 'Nitriet', 
      nitrate: 'Nitraat',
      ph: 'pH',
      oxygen: 'Zuurstof'
    }
    
    for (const param of parameters) {
      const value = waterParams[param] || 0
      const status = WaterSafetyService.getParameterStatus(param, value)
      
      response += `${status.icon} **${paramNames[param]}**: ${value}${param === 'ph' ? '' : 'mg/L'} - ${status.message}\n`
    }
    
    response += `\n**Algemene status**: ${structuredAdvice.summary.status === 'good' ? '✅ Veilig' : 
                  structuredAdvice.summary.status === 'warning' ? '⚠️ Let op' : '🚨 Gevaarlijk'}`
    
    return response
  }

  /**
   * Generate filter response
   */
  private static generateFilterResponse(context: EnhancedChatContext, structuredAdvice: any): string {
    const filterType = context.filterData?.filtration_type || 'mechanical_biological'
    const filterMedia = context.filterData?.filter_media || []
    const aeration = context.filterData?.aeration_system || false
    
    let response = `🔧 **Filter Analyse**\n\n`
    
    response += `**Filter type**: ${filterType}\n`
    response += `**Media**: ${filterMedia.join(', ') || 'Geen media gespecificeerd'}\n`
    response += `**Beluchting**: ${aeration ? '✅ Aanwezig' : '❌ Afwezig'}\n\n`
    
    response += `**Filter efficiëntie**: ${structuredAdvice.advice.content.includes('Uitstekend') ? '✅ Uitstekend' : 
                  structuredAdvice.advice.content.includes('Goed') ? '⚠️ Goed' : '🚨 Onderbelast'}\n\n`
    
    response += `**Onderhoud advies**:\n`
    response += `• Reinig voorfilter wekelijks\n`
    response += `• Controleer beluchting regelmatig\n`
    response += `• Vervang media volgens schema\n`
    
    return response
  }

  /**
   * Generate seasonal response
   */
  private static generateSeasonalResponse(context: EnhancedChatContext, structuredAdvice: any): string {
    const temperature = this.extractWaterParameters(context).temperature
    const season = context.season || 'spring'
    
    let response = `📅 **Seizoensadvies**\n\n`
    
    response += `**Huidige seizoen**: ${season}\n`
    response += `**Temperatuur**: ${temperature}°C\n\n`
    
    if (temperature < 8) {
      response += `❄️ **Winter fase**\n`
      response += `• Koi in winterslaap\n`
      response += `• Filter inactief\n`
      response += `• Minimale activiteit\n`
      response += `• Alleen circulatie\n`
    } else if (temperature < 12) {
      response += `🌱 **Voorjaar fase**\n`
      response += `• Koi worden wakker\n`
      response += `• Filter opbouwen\n`
      response += `• Voorzichtig opbouwen\n`
      response += `• Langzaam verhogen\n`
    } else if (temperature < 20) {
      response += `🌿 **Lente fase**\n`
      response += `• Koi actief\n`
      response += `• Filter actief\n`
      response += `• Normale activiteit\n`
      response += `• Groei periode\n`
    } else {
      response += `☀️ **Zomer fase**\n`
      response += `• Koi zeer actief\n`
      response += `• Filter optimaal\n`
      response += `• Maximale activiteit\n`
      response += `• Verdeel over porties\n`
    }
    
    return response
  }

  /**
   * Generate general advice response
   */
  private static generateGeneralAdviceResponse(context: EnhancedChatContext, structuredAdvice: any): string {
    return `🎯 **Volledig Advies**\n\n${structuredAdvice.summary.content}\n\n${structuredAdvice.advice.content}\n\n${structuredAdvice.actionPoints.content}`
  }

  /**
   * Generate default response
   */
  private static generateDefaultResponse(context: EnhancedChatContext, structuredAdvice: any): string {
    return `Hallo! Ik ben je koi vijver assistent. Ik kan je helpen met:\n\n• 🍽️ Voeradvies\n• 🧪 Waterkwaliteit\n• 🔧 Filter onderhoud\n• 📅 Seizoensadvies\n• 🧬 Biologische processen\n\nWat wil je weten?`
  }

  /**
   * Generate educational content for different topics
   */

  private static generateWaterQualityEducationalContent(context: EnhancedChatContext, structuredAdvice: any): string {
    return `\n🧪 **Waterkwaliteit Uitleg**\n\n${structuredAdvice.educationalContext}\n\n${structuredAdvice.systemThinking}`
  }

  private static generateFilterEducationalContent(context: EnhancedChatContext, structuredAdvice: any): string {
    return `\n🔧 **Filter Uitleg**\n\n${structuredAdvice.educationalContext}\n\n${structuredAdvice.systemThinking}`
  }

  private static generateSeasonalEducationalContent(context: EnhancedChatContext, structuredAdvice: any): string {
    return `\n📅 **Seizoensgedrag Uitleg**\n\n${structuredAdvice.educationalContext}\n\n${structuredAdvice.systemThinking}`
  }

  private static generateGeneralEducationalContent(context: EnhancedChatContext, structuredAdvice: any): string {
    return `\n🧬 **Volledige Uitleg**\n\n${structuredAdvice.educationalContext}\n\n${structuredAdvice.systemThinking}`
  }

  private static generateDefaultEducationalContent(context: EnhancedChatContext, structuredAdvice: any): string {
    return `\n🎯 **Koi Vijver Management**\n\nIk help je met wetenschappelijk onderbouwde adviezen voor je koi vijver. Alles draait om balans tussen filter en waterkwaliteit.`
  }
}
