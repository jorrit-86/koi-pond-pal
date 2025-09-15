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
    if (!newKoi.name || !newKoi.variety || !newKoi.age || !newKoi.length) {
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
          name: newKoi.name,
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
          length_at_purchase: newKoi.length_at_purchase ? parseInt(newKoi.length_at_purchase) : null
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Nieuwe Koi Toevoegen</h1>
          <p className="text-muted-foreground">Voeg een nieuwe koi toe aan je collectie</p>
        </div>
        <Button variant="outline" onClick={() => onNavigate("koi")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar Collectie
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Koi Informatie</CardTitle>
          <CardDescription>
            Vul de details in voor je nieuwe koi vis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Naam *</Label>
            <Input
              id="name"
              value={newKoi.name}
              onChange={(e) => setNewKoi(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Voer koi naam in"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="variety">Variëteit *</Label>
            <Select value={newKoi.variety} onValueChange={(value) => setNewKoi(prev => ({ ...prev, variety: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer variëteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asagi">Asagi</SelectItem>
                <SelectItem value="Bekko">Bekko</SelectItem>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Leeftijd (jaren) *</Label>
              <Input
                id="age"
                type="number"
                value={newKoi.age}
                onChange={(e) => setNewKoi(prev => ({ ...prev, age: e.target.value }))}
                placeholder="0"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="length">Lengte (cm) *</Label>
              <Input
                id="length"
                type="number"
                value={newKoi.length}
                onChange={(e) => setNewKoi(prev => ({ ...prev, length: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Gewicht (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={newKoi.weight}
              onChange={(e) => setNewKoi(prev => ({ ...prev, weight: e.target.value }))}
              placeholder="0.0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Kleur</Label>
            <Input
              id="color"
              value={newKoi.color}
              onChange={(e) => setNewKoi(prev => ({ ...prev, color: e.target.value }))}
              placeholder="Beschrijf het kleurpatroon"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="health">Gezondheidsstatus</Label>
            <Select value={newKoi.healthStatus} onValueChange={(value: any) => setNewKoi(prev => ({ ...prev, healthStatus: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Uitstekend</SelectItem>
                <SelectItem value="good">Goed</SelectItem>
                <SelectItem value="needs-attention">Aandacht Nodig</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breeder">Kweker</Label>
              <Input
                id="breeder"
                value={newKoi.breeder}
                onChange={(e) => setNewKoi(prev => ({ ...prev, breeder: e.target.value }))}
                placeholder="Naam van de kweker"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dealer">Dealer</Label>
              <Input
                id="dealer"
                value={newKoi.dealer}
                onChange={(e) => setNewKoi(prev => ({ ...prev, dealer: e.target.value }))}
                placeholder="Naam van de dealer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_price">Aankoopbedrag (€)</Label>
            <Input
              id="purchase_price"
              type="number"
              step="0.01"
              min="0"
              value={newKoi.purchase_price}
              onChange={(e) => setNewKoi(prev => ({ ...prev, purchase_price: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_date">Datum Aanschaf</Label>
            <Input
              id="purchase_date"
              type="date"
              value={newKoi.purchase_date}
              onChange={(e) => setNewKoi(prev => ({ ...prev, purchase_date: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="age_at_purchase">Leeftijd bij Aanschaf (jaar)</Label>
            <Input
              id="age_at_purchase"
              type="number"
              min="0"
              value={newKoi.age_at_purchase}
              onChange={(e) => setNewKoi(prev => ({ ...prev, age_at_purchase: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="length_at_purchase">Lengte bij Aanschaf (cm)</Label>
            <Input
              id="length_at_purchase"
              type="number"
              min="0"
              value={newKoi.length_at_purchase}
              onChange={(e) => setNewKoi(prev => ({ ...prev, length_at_purchase: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notities</Label>
            <Textarea
              id="notes"
              value={newKoi.notes}
              onChange={(e) => setNewKoi(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Aanvullende notities over deze koi"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Foto</Label>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowPhotoUpload(true)}
                className="flex-1"
              >
                <Image className="h-4 w-4 mr-2" />
                Foto Toevoegen
              </Button>
              {newKoi.photo_url && (
                <div className="flex-1">
                  <img 
                    src={newKoi.photo_url} 
                    alt="Koi preview" 
                    className="w-full h-20 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleAddKoi} 
              className="flex-1"
              disabled={saving || uploading}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Opslaan...' : uploading ? 'Uploaden...' : 'Koi Toevoegen'}
            </Button>
            <Button variant="outline" onClick={() => onNavigate("koi")}>
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
