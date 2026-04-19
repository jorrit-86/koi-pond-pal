import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle } from 'lucide-react'

interface WaterParametersPopupProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  onNavigateToParameters: () => void
  taskName: string
}

export function WaterParametersPopup({ 
  isOpen, 
  onClose, 
  onComplete, 
  onNavigateToParameters, 
  taskName 
}: WaterParametersPopupProps) {
  const { t } = useTranslation()

  const handleYes = () => {
    onComplete()
    onClose()
  }

  const handleNo = () => {
    onNavigateToParameters()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Waterparameters Meten</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-lg font-medium mb-2">{taskName}</p>
            <p className="text-muted-foreground">
              Zijn de waterparameters al gemeten en ingevoerd in het systeem?
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleNo}
            className="flex items-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            Nee, nog niet gemeten
          </Button>
          <Button 
            onClick={handleYes}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Ja, al ingevoerd
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
