import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface WaterChangePopupProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  taskName: string
}

export function WaterChangePopup({ isOpen, onClose, onComplete, taskName }: WaterChangePopupProps) {
  const { t } = useTranslation()
  const { user, session } = useAuth()
  const [liters, setLiters] = useState<string>('')
  const [waterType, setWaterType] = useState<string>('tap_water')
  const [reason, setReason] = useState<string>('maintenance')
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user || !user.id) return

    const litersValue = parseFloat(liters)
    if (isNaN(litersValue) || litersValue <= 0) {
      toast.error('Voer een geldig aantal liters in')
      return
    }

    setIsSubmitting(true)

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      const waterChangeData = {
        user_id: user.id,
        liters_added: litersValue,
        water_type: waterType,
        reason: reason,
        notes: notes || `Waterwissel taak: ${taskName}`,
        changed_at: new Date().toISOString()
      }
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Saving water change using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_changes`,
            {
              method: 'POST',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(waterChangeData)
            }
          )
          
          if (response.ok) {
            toast.success('Waterwissel opgeslagen in geschiedenis')
            onComplete()
            onClose()
            
            // Reset form
            setLiters('')
            setWaterType('tap_water')
            setReason('maintenance')
            setNotes('')
            return
          } else {
            const errorData = await response.json()
            console.error('Error saving water change with direct fetch:', errorData)
            toast.error('Fout bij opslaan waterwissel')
            return
          }
        } catch (error: any) {
          console.error('Error saving water change with direct fetch:', error)
          toast.error('Fout bij opslaan waterwissel')
          return
        }
      } else {
        // Normal Supabase query
        const { error } = await supabase
          .from('water_changes')
          .insert(waterChangeData)

        if (error) {
          console.error('Error saving water change:', error)
          toast.error('Fout bij opslaan waterwissel')
          return
        }

        toast.success('Waterwissel opgeslagen in geschiedenis')
        onComplete()
        onClose()
        
        // Reset form
        setLiters('')
        setWaterType('tap_water')
        setReason('maintenance')
        setNotes('')
      }
    } catch (err) {
      console.error('Error:', err)
      toast.error('Fout bij opslaan waterwissel')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Waterwissel Voltooid</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="liters">Aantal liters gewisseld</Label>
            <Input
              id="liters"
              type="number"
              step="0.1"
              min="0"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              placeholder="Bijv. 50"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label htmlFor="water-type">Type water</Label>
            <Select value={waterType} onValueChange={setWaterType} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tap_water">Kraanwater</SelectItem>
                <SelectItem value="well_water">Putwater</SelectItem>
                <SelectItem value="rain_water">Regenwater</SelectItem>
                <SelectItem value="ro_water">RO water</SelectItem>
                <SelectItem value="mixed">Gemengd</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="reason">Reden</Label>
            <Select value={reason} onValueChange={setReason} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="maintenance">Onderhoud</SelectItem>
                <SelectItem value="problem">Probleem</SelectItem>
                <SelectItem value="emergency">Noodgeval</SelectItem>
                <SelectItem value="seasonal">Seizoensgebonden</SelectItem>
                <SelectItem value="other">Anders</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Opmerkingen (optioneel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra informatie over de waterwissel..."
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !liters}>
            {isSubmitting ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
