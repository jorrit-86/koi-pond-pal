import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { AIChatService, ChatMessage, ChatContext } from '@/lib/ai-chat-service'
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2,
  Sparkles,
  Droplets,
  Fish,
  Thermometer
} from 'lucide-react'
import { cn } from '@/lib/utils'


interface AIChatAssistantProps {
  currentPage?: string
}

export function AIChatAssistant({ currentPage = 'dashboard' }: AIChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pondContext, setPondContext] = useState<ChatContext | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()
  // Get all water parameters for AI context
  const [allParameters, setAllParameters] = useState<any[]>([])
  const [paramsLoading, setParamsLoading] = useState(true)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load all water parameters for AI context
  useEffect(() => {
    const loadAllParameters = async () => {
      if (!user) return

      try {
        setParamsLoading(true)
        const { data, error } = await supabase
          .from('water_parameters')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading parameters:', error)
          return
        }

        setAllParameters(data || [])
      } catch (error) {
        console.error('Error in loadAllParameters:', error)
      } finally {
        setParamsLoading(false)
      }
    }

    loadAllParameters()
  }, [user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load chat history and pond context when user is available
  useEffect(() => {
    if (user) {
      loadChatData()
    }
  }, [user])

  const loadChatData = async () => {
    if (!user) return

    try {
      // Load chat history
      const chatHistory = await AIChatService.getChatHistory(user.id, 20)
      
      // Load pond context
      const context = await AIChatService.getPondContext(user.id)
      setPondContext(context)

      if (chatHistory.length > 0) {
        setMessages(chatHistory)
      } else {
        // Show welcome message if no history
        setMessages([{
          id: '1',
          type: 'assistant',
          content: 'Hallo! Ik ben je Koi Sensei AI-assistant. Ik kan je helpen met vragen over je vijver, waterkwaliteit, koi-verzorging en meer. Wat wil je weten?',
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Error loading chat data:', error)
      // Show welcome message on error
      setMessages([{
        id: '1',
        type: 'assistant',
        content: 'Hallo! Ik ben je Koi Sensei AI-assistant. Ik kan je helpen met vragen over je vijver, waterkwaliteit, koi-verzorging en meer. Wat wil je weten?',
        timestamp: new Date()
      }])
    }
  }

  const generateAIResponse = async (userMessage: string): Promise<string> => {
    if (!pondContext) {
      return "Ik ben nog bezig met het laden van je vijvergegevens. Probeer het over een momentje opnieuw!"
    }

    // Update context with current page
    const updatedContext: ChatContext = {
      ...pondContext,
      currentPage
    }

    return await AIChatService.generateResponse(userMessage, updatedContext)
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !user) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      context: pondContext || undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Save user message to database
      await AIChatService.saveChatMessage(user.id, userMessage)

      const aiResponse = await generateAIResponse(userMessage.content)
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        context: pondContext || undefined
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Save assistant message to database
      await AIChatService.saveChatMessage(user.id, assistantMessage)
    } catch (error) {
      console.error('Error generating AI response:', error)
      toast({
        title: 'Fout',
        description: 'Er is een fout opgetreden bij het genereren van een antwoord.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getPageContext = () => {
    const pageNames: Record<string, string> = {
      dashboard: 'Dashboard',
      parameters: 'Waterparameters',
      koi: 'Koi Beheer',
      settings: 'Instellingen',
      analytics: 'Analytics'
    }
    return pageNames[currentPage] || 'Onbekende pagina'
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)]">
          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Koi Sensei AI</h3>
                    <p className="text-xs text-muted-foreground">
                      {getPageContext()} • Altijd beschikbaar
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Messages */}
              <ScrollArea className="h-80 px-4">
                <div className="space-y-4 pb-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-2",
                        message.type === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.type === 'assistant' && (
                        <div className="h-6 w-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      )}
                      
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                          message.type === 'user'
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-900"
                        )}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <div className={cn(
                          "text-xs mt-1",
                          message.type === 'user' ? "text-blue-100" : "text-gray-500"
                        )}>
                          {message.timestamp.toLocaleTimeString('nl-NL', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>

                      {message.type === 'user' && (
                        <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="h-3 w-3 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-2 justify-start">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                      <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-gray-500">Koi Sensei denkt na...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Stel je vraag over je vijver..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    size="sm"
                    className="px-3"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Quick suggestions */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {['Waterkwaliteit?', 'Koi voeding?', 'Filter onderhoud?', 'Seizoensadvies?'].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => setInputValue(suggestion)}
                      disabled={isLoading}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
