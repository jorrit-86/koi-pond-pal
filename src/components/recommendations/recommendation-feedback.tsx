import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'
import { 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Star
} from 'lucide-react'
import { Recommendation } from '@/lib/recommendation-engine'

interface RecommendationFeedbackProps {
  recommendation: Recommendation
  onFeedbackSubmitted?: () => void
}

export function RecommendationFeedback({ 
  recommendation, 
  onFeedbackSubmitted 
}: RecommendationFeedbackProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackType, setFeedbackType] = useState<string>('')
  const [effectivenessRating, setEffectivenessRating] = useState<number>(0)
  const [actualOutcome, setActualOutcome] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submitFeedback = async () => {
    if (!user || !feedbackType) {
      toast({
        title: t('common.error'),
        description: 'Selecteer eerst een feedback type',
        variant: 'destructive'
      })
      return
    }

    try {
      setSubmitting(true)

      const { error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user.id,
          recommendation_id: recommendation.id,
          feedback_type: feedbackType,
          effectiveness_rating: effectivenessRating > 0 ? effectivenessRating : null,
          actual_outcome: actualOutcome || null,
          notes: notes || null
        })

      if (error) {
        console.error('Error submitting feedback:', error)
        toast({
          title: t('common.error'),
          description: 'Kon feedback niet opslaan',
          variant: 'destructive'
        })
        return
      }

      toast({
        title: t('common.success'),
        description: 'Bedankt voor je feedback! Dit helpt de AI te verbeteren.'
      })

      setShowFeedback(false)
      setFeedbackType('')
      setEffectivenessRating(0)
      setActualOutcome('')
      setNotes('')
      
      onFeedbackSubmitted?.()
    } catch (error) {
      console.error('Error in submitFeedback:', error)
      toast({
        title: t('common.error'),
        description: 'Er is een fout opgetreden',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!showFeedback) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowFeedback(true)}
        className="text-xs"
      >
        <MessageSquare className="h-3 w-3 mr-1" />
        Feedback
      </Button>
    )
  }

  return (
    <Card className="mt-4 border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Help de AI verbeteren
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feedback Type */}
        <div>
          <Label className="text-sm font-medium">Was deze aanbeveling nuttig?</Label>
          <RadioGroup value={feedbackType} onValueChange={setFeedbackType} className="mt-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="helpful" id="helpful" />
              <Label htmlFor="helpful" className="flex items-center gap-2 text-sm">
                <ThumbsUp className="h-4 w-4 text-green-600" />
                Nuttig
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="not_helpful" id="not_helpful" />
              <Label htmlFor="not_helpful" className="flex items-center gap-2 text-sm">
                <ThumbsDown className="h-4 w-4 text-red-600" />
                Niet nuttig
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="completed" id="completed" />
              <Label htmlFor="completed" className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Uitgevoerd
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dismissed" id="dismissed" />
              <Label htmlFor="dismissed" className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-gray-600" />
                Genegeerd
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Effectiveness Rating */}
        {(feedbackType === 'helpful' || feedbackType === 'completed') && (
          <div>
            <Label className="text-sm font-medium">Effectiviteit (1-5 sterren)</Label>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setEffectivenessRating(rating)}
                  className={`p-1 ${
                    rating <= effectivenessRating 
                      ? 'text-yellow-500' 
                      : 'text-gray-300 hover:text-yellow-400'
                  }`}
                >
                  <Star className="h-5 w-5 fill-current" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actual Outcome */}
        <div>
          <Label htmlFor="outcome" className="text-sm font-medium">
            Wat was het resultaat?
          </Label>
          <Textarea
            id="outcome"
            placeholder="Bijv. 'Waterkwaliteit verbeterd', 'Geen verandering', 'Probleem opgelost'..."
            value={actualOutcome}
            onChange={(e) => setActualOutcome(e.target.value)}
            className="mt-1 text-sm"
            rows={2}
          />
        </div>

        {/* Additional Notes */}
        <div>
          <Label htmlFor="notes" className="text-sm font-medium">
            Extra opmerkingen (optioneel)
          </Label>
          <Textarea
            id="notes"
            placeholder="Deel je ervaring of suggesties voor verbetering..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 text-sm"
            rows={2}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFeedback(false)}
            disabled={submitting}
          >
            Annuleren
          </Button>
          <Button
            size="sm"
            onClick={submitFeedback}
            disabled={submitting || !feedbackType}
          >
            {submitting ? 'Opslaan...' : 'Feedback Versturen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
