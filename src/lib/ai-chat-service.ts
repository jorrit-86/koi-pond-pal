import { supabase } from './supabase'

export interface ChatContext {
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
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  context?: ChatContext
}

export class AIChatService {
  // Get user's pond context for personalized responses
  static async getPondContext(userId: string): Promise<ChatContext> {
    try {
      // Get user preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('experience_level, pond_size')
        .eq('user_id', userId)
        .single()

      // Get latest water parameters
      const { data: parameters } = await supabase
        .from('water_parameters')
        .select('parameter_type, value, unit, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)

      // Get koi count
      const { count: koiCount } = await supabase
        .from('koi')
        .select('*', { count: 'exact', head: true })
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
        pondSize: preferences?.pond_size || 0,
        userExperience: preferences?.experience_level || 'beginner',
        season
      }
    } catch (error) {
      console.error('Error getting pond context:', error)
      return {
        currentPage: 'dashboard',
        waterParameters: [],
        koiCount: 0,
        pondSize: 0,
        userExperience: 'beginner',
        season: 'spring'
      }
    }
  }

  // Generate AI response based on user message and context
  static async generateResponse(
    userMessage: string, 
    context: ChatContext
  ): Promise<string> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))

    const lowerMessage = userMessage.toLowerCase()
    
    // Water quality related questions
    if (lowerMessage.includes('water') || lowerMessage.includes('waterkwaliteit') || lowerMessage.includes('ph') || lowerMessage.includes('nitriet') || lowerMessage.includes('nitraat')) {
      return this.generateWaterQualityResponse(context)
    }

    // Koi care questions
    if (lowerMessage.includes('koi') || lowerMessage.includes('vis') || lowerMessage.includes('vissen')) {
      return this.generateKoiCareResponse(context)
    }

    // Feeding questions
    if (lowerMessage.includes('voeding') || lowerMessage.includes('eten') || lowerMessage.includes('voer')) {
      return this.generateFeedingResponse(context)
    }

    // Filter questions
    if (lowerMessage.includes('filter') || lowerMessage.includes('filtratie') || lowerMessage.includes('biologisch')) {
      return this.generateFilterResponse(context)
    }

    // Temperature questions
    if (lowerMessage.includes('temperatuur') || lowerMessage.includes('warm') || lowerMessage.includes('koud')) {
      return this.generateTemperatureResponse(context)
    }

    // Seasonal questions
    if (lowerMessage.includes('seizoen') || lowerMessage.includes('winter') || lowerMessage.includes('zomer') || lowerMessage.includes('lente') || lowerMessage.includes('herfst')) {
      return this.generateSeasonalResponse(context)
    }

    // Health/disease questions
    if (lowerMessage.includes('ziek') || lowerMessage.includes('gezondheid') || lowerMessage.includes('probleem') || lowerMessage.includes('symptoom')) {
      return this.generateHealthResponse(context)
    }

    // General help
    if (lowerMessage.includes('help') || lowerMessage.includes('hulp') || lowerMessage.includes('wat kan je')) {
      return this.generateHelpResponse(context)
    }

    // Default response
    return this.generateDefaultResponse(context)
  }

  private static generateWaterQualityResponse(context: ChatContext): string {
    const params = context.waterParameters || []
    
    if (params.length === 0) {
      return `Ik zie dat je nog geen waterparameters hebt ingevoerd. Om je beter te kunnen helpen, voeg eerst wat metingen toe via de 'Waterparameters' pagina. 

Ideale waarden voor koi:
• pH: 7.0-8.5
• Ammoniak: 0 mg/l
• Nitriet: 0 mg/l  
• Nitraat: <50 mg/l
• KH: 4-8 dH
• GH: 6-12 dH

Wat wil je specifiek weten over waterkwaliteit?`
    }

    const paramSummary = params.map(p => `${p.name}: ${p.value} ${p.unit}`).join(', ')
    return `Gebaseerd op je laatste metingen (${paramSummary}), kan ik je helpen met specifieke vragen over je waterkwaliteit. 

Wat wil je precies weten? Bijvoorbeeld:
• Zijn je waarden goed?
• Hoe verbeter je specifieke parameters?
• Wat betekenen afwijkende waarden?
• Onderhoudstips voor je filtersysteem?`
  }

  private static generateKoiCareResponse(context: ChatContext): string {
    const koiCount = context.koiCount || 0
    const experience = context.userExperience || 'beginner'
    
    if (koiCount === 0) {
      return `Ik kan je helpen met alle aspecten van koi-verzorging! Van het kiezen van de juiste koi tot dagelijkse verzorging.

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} koi-houder kan ik je adviseren over:
• Het kiezen van gezonde koi
• Quarantaine procedures
• Dagelijkse observatie
• Groei en ontwikkeling
• Gedrag en interactie

Wat wil je specifiek weten over koi-verzorging?`
    }

    return `Je hebt momenteel ${koiCount} koi in je vijver. Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} koi-houder kan ik je helpen met:

• Dagelijkse gezondheidscontrole
• Groei en ontwikkeling
• Gedrag en interactie
• Voeding en verzorging
• Probleemherkenning

Wat wil je specifiek weten over je koi?`
  }

  private static generateFeedingResponse(context: ChatContext): string {
    const season = context.season || 'spring'
    const experience = context.userExperience || 'beginner'
    
    const seasonalAdvice = {
      spring: 'In de lente beginnen koi weer actief te worden. Start met lichte voeding en bouw langzaam op.',
      summer: 'In de zomer zijn koi het meest actief. Voer 2-3x per dag met hoogwaardig voer.',
      autumn: 'In de herfst bereid je koi voor op de winter. Verminder voeding en gebruik wintervoer.',
      winter: 'In de winter eten koi weinig tot niets. Voer alleen bij temperaturen boven 10°C.'
    }

    return `Koi-voeding hangt sterk af van het seizoen en de temperatuur. ${seasonalAdvice[season as keyof typeof seasonalAdvice]}

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} koi-houder:
• Voer alleen wat ze in 5 minuten opeten
• Gebruik seizoensgebonden voer
• Voer niet bij temperaturen onder 10°C
• Varieer met verschillende soorten voer

Wat wil je specifiek weten over voeding?`
  }

  private static generateFilterResponse(context: ChatContext): string {
    const pondSize = context.pondSize || 0
    const experience = context.userExperience || 'beginner'
    
    return `Goede filtratie is essentieel voor een gezonde vijver! Voor een vijver van ${pondSize > 0 ? `${pondSize} liter` : 'jouw grootte'} is het belangrijk om:

• Mechanische filtratie (vuil verwijderen)
• Biologische filtratie (bacteriën voor afbraak)
• Voldoende doorstroming
• Regelmatig onderhoud

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder kan ik je helpen met:
• Filterkeuze en opstelling
• Onderhoudsschema
• Probleemoplossing
• Optimalisatie

Wat wil je weten over je filtersysteem?`
  }

  private static generateTemperatureResponse(context: ChatContext): string {
    const season = context.season || 'spring'
    
    return `Temperatuur is cruciaal voor koi! In de ${season} is het belangrijk om:

• Onder 10°C: Koi eten weinig tot niets
• 10-15°C: Lichte voeding, weinig activiteit
• 15-20°C: Normale voeding, matige activiteit
• 20-25°C: Optimale temperatuur, actieve koi
• Boven 25°C: Extra zuurstof en schaduw nodig

Wat wil je weten over temperatuurbeheer in je vijver?`
  }

  private static generateSeasonalResponse(context: ChatContext): string {
    const season = context.season || 'spring'
    const experience = context.userExperience || 'beginner'
    
    const seasonalTasks = {
      spring: 'Lente: Vijver opstarten, filter controleren, eerste voeding, waterkwaliteit testen',
      summer: 'Zomer: Regelmatig voeren, waterkwaliteit monitoren, schaduw voorzien, zuurstof controleren',
      autumn: 'Herfst: Bladeren verwijderen, wintervoer, vijver voorbereiden op winter',
      winter: 'Winter: Minimale voeding, ijsvrij houden, filter onderhoud, koi observeren'
    }

    return `In de ${season} zijn er specifieke taken voor je vijver:

${seasonalTasks[season as keyof typeof seasonalTasks]}

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder kan ik je helpen met seizoensgebonden adviezen. Wat wil je specifiek weten over ${season}onderhoud?`
  }

  private static generateHealthResponse(context: ChatContext): string {
    const experience = context.userExperience || 'beginner'
    
    return `Koi-gezondheid is belangrijk! Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} koi-houder kan ik je helpen met:

• Symptoomherkenning
• Preventieve maatregelen
• Eerste hulp bij problemen
• Wanneer een specialist raadplegen
• Quarantaine procedures

Belangrijke signalen om op te letten:
• Veranderd zwemgedrag
• Verlies van eetlust
• Vreemde plekken of wonden
• Ademhalingsproblemen

Wat specifiek wil je weten over koi-gezondheid?`
  }

  private static generateHelpResponse(context: ChatContext): string {
    const experience = context.userExperience || 'beginner'
    
    return `Ik ben je Koi Sensei AI-assistant! Ik kan je helpen met:

🌊 **Waterkwaliteit**
• Parameter interpretatie
• Probleemoplossing
• Onderhoudstips

🐟 **Koi-verzorging**
• Voeding en gezondheid
• Gedrag en groei
• Probleemherkenning

🔧 **Vijveronderhoud**
• Filterbeheer
• Seizoensadviezen
• Technische vragen

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder geef ik je gepersonaliseerd advies. Stel gerust je vraag!`
  }

  private static generateDefaultResponse(context: ChatContext): string {
    const experience = context.userExperience || 'beginner'
    
    return `Dat is een interessante vraag! Als Koi Sensei kan ik je helpen met:

• Waterkwaliteit en parameters
• Koi-verzorging en gezondheid  
• Vijveronderhoud en filtratie
• Seizoensadviezen
• Probleemoplossing

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder geef ik je gepersonaliseerd advies. Kun je je vraag wat specifieker stellen? Dan kan ik je het beste advies geven!`
  }

  // Save chat history to database
  static async saveChatMessage(
    userId: string, 
    message: ChatMessage
  ): Promise<void> {
    try {
      await supabase
        .from('ai_chat_history')
        .insert({
          user_id: userId,
          message_type: message.type,
          content: message.content,
          context: message.context,
          created_at: message.timestamp.toISOString()
        })
    } catch (error) {
      console.error('Error saving chat message:', error)
    }
  }

  // Get chat history from database
  static async getChatHistory(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data?.map(msg => ({
        id: msg.id,
        type: msg.message_type,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        context: msg.context
      })).reverse() || []
    } catch (error) {
      console.error('Error getting chat history:', error)
      return []
    }
  }
}
