import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FileText } from 'lucide-react'

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerateReport: (timeRange: string) => void
  loading?: boolean
}

export function ReportDialog({ open, onOpenChange, onGenerateReport, loading = false }: ReportDialogProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30')

  const handleGenerate = () => {
    onGenerateReport(selectedPeriod)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            PDF Rapport Genereren
          </DialogTitle>
          <DialogDescription>
            Selecteer de periode waarvoor u een rapport wilt genereren. Het rapport bevat alle waterparameter metingen voor de geselecteerde periode.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="period">Tijdsperiode</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger id="period">
                <SelectValue placeholder="Selecteer periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Laatste 7 dagen</SelectItem>
                <SelectItem value="30">Laatste 30 dagen</SelectItem>
                <SelectItem value="90">Laatste 90 dagen</SelectItem>
                <SelectItem value="365">Laatste jaar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuleren
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? 'Genereren...' : 'Rapport Genereren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}




