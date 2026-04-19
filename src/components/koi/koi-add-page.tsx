import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhotoUpload } from "@/components/ui/photo-upload"
import { ArrowLeft, Image, Save } from "lucide-react"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { usePhotoUpload } from "@/hooks/use-photo-upload"
import { useToast } from "@/hooks/use-toast"

interface KoiAddPageProps {
  onNavigate: (tab: string) => void
}

export function KoiAddPage({ onNavigate }: KoiAddPageProps) {
  const { user } = useAuth()
  const { uploadPhoto, uploading } = usePhotoUpload()
  const { toast } = useToast()
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newKoi, setNewKoi] = useState({
    name: '',
    variety: '',
    age: '',
    length: '',
    weight: '',
    color: '',
    healthStatus: 'excellent' as const,
    notes: '',
    photo_url: '',
    breeder: '',
    dealer: '',
    purchase_price: '',
    purchase_date: '',
    age_at_purchase: '',
    location: 'pond',
    length_at_purchase: ''
  })

  const handlePhotoSelected = async (photoUrl: string, photoFile: File) => {
    try {
      const result = await uploadPhoto(photoFile, 'koi-photos')
      if (result) {
        setNewKoi(prev => ({ ...prev, photo_url: result.url }))
        setShowPhotoUpload(false)
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
    }
  }

  const handleAddKoi = async () => {
    if (!newKoi.variety || !newKoi.age || !newKoi.length) {
      toast({
        title: "Ontbrekende informatie",
        description: "Vul alle verplichte velden in.",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "Authenticatie vereist",
        description: "Je moet ingelogd zijn om koi toe te voegen.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      // Save to database
      const { data, error } = await supabase
        .from('koi')
        .insert({
          user_id: user.id,
          name: newKoi.name || newKoi.variety, // Use variety as name if no name provided
          species: newKoi.variety,
          age_years: parseInt(newKoi.age),
          size_cm: parseInt(newKoi.length),
          weight: newKoi.weight ? parseFloat(newKoi.weight) : null,
          color: newKoi.color,
          purchase_date: newKoi.purchase_date || new Date().toISOString().split('T')[0],
          notes: newKoi.notes || null,
          photo_url: newKoi.photo_url || null,
          breeder: newKoi.breeder || null,
          dealer: newKoi.dealer || null,
          purchase_price: newKoi.purchase_price ? parseFloat(newKoi.purchase_price) : null,
          age_at_purchase: newKoi.age_at_purchase ? parseInt(newKoi.age_at_purchase) : null,
          length_at_purchase: newKoi.length_at_purchase ? parseInt(newKoi.length_at_purchase) : null,
          location: newKoi.location || 'pond'
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding koi:', error)
        toast({
          title: "Opslag fout",
          description: "Fout bij toevoegen koi: " + error.message,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Koi toegevoegd",
        description: "Je koi is succesvol toegevoegd aan je collectie.",
      })

      // Navigate back to koi management
      onNavigate("koi")

    } catch (error) {
      console.error('Error in handleAddKoi:', error)
      toast({
        title: "Opslag fout",
        description: "Er is een onverwachte fout opgetreden.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("koi")} className="h-8 w-8 sm:h-10 sm:w-10">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Nieuwe Koi Toevoegen</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Voeg een nieuwe koi toe aan je collectie</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Koi Informatie</CardTitle>
          <CardDescription className="text-sm">
            Vul de details in voor je nieuwe koi vis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 pt-0">
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="name" className="text-xs sm:text-sm">Naam *</Label>
            <Input
              id="name"
              value={newKoi.name}
              onChange={(e) => setNewKoi(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Voer koi naam in"
              className="h-8 sm:h-9 text-sm"
            />
          </div>
          
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="variety" className="text-xs sm:text-sm">Variëteit *</Label>
            <Select value={newKoi.variety} onValueChange={(value) => setNewKoi(prev => ({ ...prev, variety: value }))}>
              <SelectTrigger className="h-8 sm:h-9 text-sm">
                <SelectValue placeholder="Selecteer variëteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asagi">Asagi</SelectItem>
                <SelectItem value="Bekko">Bekko</SelectItem>
                <SelectItem value="Benigoi">Benigoi</SelectItem>
                <SelectItem value="Goshiki">Goshiki</SelectItem>
                <SelectItem value="Kohaku">Kohaku</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
                <SelectItem value="Sanke">Sanke</SelectItem>
                <SelectItem value="Showa">Showa</SelectItem>
                <SelectItem value="Shusui">Shusui</SelectItem>
                <SelectItem value="Tancho Kohaku">Tancho Kohaku</SelectItem>
                <SelectItem value="Tancho Showa">Tancho Showa</SelectItem>
                <SelectItem value="Utsuri">Utsuri</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="age" className="text-xs sm:text-sm">Leeftijd (jaren) *</Label>
              <Input
                id="age"
                type="number"
                value={newKoi.age}
                onChange={(e) => setNewKoi(prev => ({ ...prev, age: e.target.value }))}
                placeholder="0"
                className="h-8 sm:h-9 text-sm"
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
            
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="length" className="text-xs sm:text-sm">Lengte (cm) *</Label>
              <Input
                id="length"
                type="number"
                value={newKoi.length}
                onChange={(e) => setNewKoi(prev => ({ ...prev, length: e.target.value }))}
                placeholder="0"
                className="h-8 sm:h-9 text-sm"
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="weight" className="text-xs sm:text-sm">Gewicht (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={newKoi.weight}
              onChange={(e) => setNewKoi(prev => ({ ...prev, weight: e.target.value }))}
              placeholder="0.0"
              className="h-8 sm:h-9 text-sm"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
            />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="location" className="text-xs sm:text-sm">Locatie</Label>
            <Select value={newKoi.location} onValueChange={(value) => setNewKoi(prev => ({ ...prev, location: value }))}>
              <SelectTrigger className="h-8 sm:h-9 text-sm">
                <SelectValue placeholder="Selecteer locatie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pond">Vijver</SelectItem>
                <SelectItem value="quarantine">Quarantaine</SelectItem>
                <SelectItem value="hospital">Ziekenboeg</SelectItem>
                <SelectItem value="breeding_tank">Kweekbak</SelectItem>
                <SelectItem value="breeder">Kweker</SelectItem>
                <SelectItem value="dealer">Dealer</SelectItem>
                <SelectItem value="other">Anders</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="color" className="text-xs sm:text-sm">Kleur</Label>
            <Input
              id="color"
              value={newKoi.color}
              onChange={(e) => setNewKoi(prev => ({ ...prev, color: e.target.value }))}
              placeholder="Beschrijf het kleurpatroon"
              className="h-8 sm:h-9 text-sm"
            />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="health" className="text-xs sm:text-sm">Gezondheidsstatus</Label>
            <Select value={newKoi.healthStatus} onValueChange={(value: any) => setNewKoi(prev => ({ ...prev, healthStatus: value }))}>
              <SelectTrigger className="h-8 sm:h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Uitstekend</SelectItem>
                <SelectItem value="good">Goed</SelectItem>
                <SelectItem value="needs-attention">Aandacht Nodig</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="breeder" className="text-xs sm:text-sm">Kweker</Label>
              <Input
                id="breeder"
                value={newKoi.breeder}
                onChange={(e) => setNewKoi(prev => ({ ...prev, breeder: e.target.value }))}
                placeholder="Naam van de kweker"
                className="h-8 sm:h-9 text-sm"
              />
            </div>
            
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="dealer" className="text-xs sm:text-sm">Dealer</Label>
              <Input
                id="dealer"
                value={newKoi.dealer}
                onChange={(e) => setNewKoi(prev => ({ ...prev, dealer: e.target.value }))}
                placeholder="Naam van de dealer"
                className="h-8 sm:h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="purchase_price" className="text-xs sm:text-sm">Aankoopbedrag (€)</Label>
            <Input
              id="purchase_price"
              type="number"
              step="0.01"
              min="0"
              value={newKoi.purchase_price}
              onChange={(e) => setNewKoi(prev => ({ ...prev, purchase_price: e.target.value }))}
              placeholder="0.00"
              className="h-8 sm:h-9 text-sm"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
            />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="purchase_date" className="text-xs sm:text-sm">Datum Aanschaf</Label>
            <Input
              id="purchase_date"
              type="date"
              value={newKoi.purchase_date}
              onChange={(e) => setNewKoi(prev => ({ ...prev, purchase_date: e.target.value }))}
              className="h-8 sm:h-9 text-sm"
            />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="age_at_purchase" className="text-xs sm:text-sm">Leeftijd bij Aanschaf (jaar)</Label>
            <Input
              id="age_at_purchase"
              type="number"
              min="0"
              value={newKoi.age_at_purchase}
              onChange={(e) => setNewKoi(prev => ({ ...prev, age_at_purchase: e.target.value }))}
              placeholder="0"
              className="h-8 sm:h-9 text-sm"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="length_at_purchase" className="text-xs sm:text-sm">Lengte bij Aanschaf (cm)</Label>
            <Input
              id="length_at_purchase"
              type="number"
              min="0"
              value={newKoi.length_at_purchase}
              onChange={(e) => setNewKoi(prev => ({ ...prev, length_at_purchase: e.target.value }))}
              placeholder="0"
              className="h-8 sm:h-9 text-sm"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="notes" className="text-xs sm:text-sm">Notities</Label>
            <Textarea
              id="notes"
              value={newKoi.notes}
              onChange={(e) => setNewKoi(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Aanvullende notities over deze koi"
              rows={3}
              className="text-sm"
            />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm">Foto</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowPhotoUpload(true)}
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
              >
                <Image className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <span className="hidden sm:inline">Foto Toevoegen</span>
                <span className="sm:hidden">Foto</span>
              </Button>
              {newKoi.photo_url && (
                <div className="flex-1">
                  <img 
                    src={newKoi.photo_url} 
                    alt="Koi preview" 
                    className="w-full h-16 sm:h-20 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
            <Button 
              onClick={handleAddKoi} 
              className="flex-1 h-9 sm:h-10 text-sm"
              disabled={saving || uploading}
            >
              <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              {saving ? 'Opslaan...' : uploading ? 'Uploaden...' : 'Koi Toevoegen'}
            </Button>
            <Button variant="outline" onClick={() => onNavigate("koi")} className="h-9 sm:h-10 text-sm">
              Annuleren
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <PhotoUpload
          onPhotoSelected={handlePhotoSelected}
          onClose={() => setShowPhotoUpload(false)}
          title="Koi Foto Toevoegen"
          description="Selecteer een foto van je koi van je apparaat"
        />
      )}
    </div>
  )
}
