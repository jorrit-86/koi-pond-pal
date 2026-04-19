import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Plus, Calendar, FileText, Activity, Pill, Heart, Stethoscope, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface KoiLogEntry {
  id: string;
  koi_id: string;
  entry_date: string;
  entry_type: 'measurement' | 'medication' | 'note' | 'behavior' | 'treatment';
  description: string;
  length_cm?: number;
  created_at: string;
  updated_at: string;
}

interface KoiLogbookProps {
  koiId: string;
  onMeasurementAdded?: () => void; // Callback voor wanneer een meting wordt toegevoegd
  showAll?: boolean; // Of alle entries moeten worden getoond (default: false, toont max 3)
  onViewAll?: () => void; // Callback voor "bekijk alle meldingen" knop
}

const entryTypeLabels = {
  measurement: 'Meting',
  medication: 'Medicijngebruik',
  note: 'Opmerking',
  behavior: 'Gedrag',
  treatment: 'Ziekte/Behandeling'
};

const entryTypeIcons = {
  measurement: Activity,
  medication: Pill,
  note: FileText,
  behavior: Heart,
  treatment: Stethoscope
};

const entryTypeColors = {
  measurement: 'bg-blue-100 text-blue-800',
  medication: 'bg-red-100 text-red-800',
  note: 'bg-gray-100 text-gray-800',
  behavior: 'bg-purple-100 text-purple-800',
  treatment: 'bg-orange-100 text-orange-800'
};

export function KoiLogbook({ koiId, onMeasurementAdded, showAll = false, onViewAll }: KoiLogbookProps) {
  const { user, session } = useAuth();
  const [logEntries, setLogEntries] = useState<KoiLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KoiLogEntry | null>(null);
  const [newEntry, setNewEntry] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'note' as KoiLogEntry['entry_type'],
    description: '',
    length_cm: ''
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user && koiId) {
      loadLogEntries();
    }
  }, [koiId, user]);

  const loadLogEntries = async () => {
    if (!user || !koiId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading log entries for koi:', koiId);
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading log entries using direct fetch with access token...');
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_log_entries?koi_id=eq.${koiId}&select=*&order=entry_date.desc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('Loaded log entries (direct fetch):', data?.length || 0, 'records');
          setLogEntries(data || []);
          return;
        } catch (error: any) {
          console.error('Error loading log entries with direct fetch:', error);
          // Fall through to try normal Supabase query
        }
      }
      
      // Normal Supabase query
      const { data, error } = await supabase
        .from('koi_log_entries')
        .select('*')
        .eq('koi_id', koiId)
        .order('entry_date', { ascending: false });

      if (error) {
        console.error('Error loading log entries:', error);
        throw error;
      }
      
      console.log('Loaded log entries (normal query):', data?.length || 0, 'records');
      setLogEntries(data || []);
    } catch (error: any) {
      console.error('Error loading log entries:', error);
      
      if (error?.code === '42P01') {
        toast.error('Logboek tabel bestaat nog niet. Voer eerst het SQL script uit.');
      } else {
        toast.error(`Fout bij laden van logboek: ${error?.message || 'Onbekende fout'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (newEntry.entry_type === 'measurement' && !newEntry.length_cm) {
      toast.error('Lengte is verplicht bij metingen');
      return;
    }

    if (newEntry.entry_type !== 'measurement' && !newEntry.description.trim()) {
      toast.error('Beschrijving is verplicht');
      return;
    }

    try {
      setSaving(true);
      
      // Prepare insert data
      const insertData: any = {
        koi_id: koiId,
        entry_date: newEntry.entry_date,
        entry_type: newEntry.entry_type,
        description: newEntry.description.trim() || 'Geen beschrijving'
      };

      // Only add length_cm for measurements
      if (newEntry.entry_type === 'measurement' && newEntry.length_cm) {
        insertData.length_cm = parseInt(newEntry.length_cm);
      }

      console.log('Inserting log entry:', insertData);

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Inserting log entry using direct fetch with access token...');
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_log_entries`,
            {
              method: 'POST',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(insertData)
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
          }
          
          const data = await response.json();
          const insertedData = Array.isArray(data) ? data[0] : data;
          
          console.log('Inserted log entry (direct fetch):', insertedData);
          setLogEntries(prev => [insertedData, ...prev]);
          setNewEntry({
            entry_date: new Date().toISOString().split('T')[0],
            entry_type: 'note',
            description: '',
            length_cm: ''
          });
          setIsDialogOpen(false);
          toast.success('Logboek entry toegevoegd');
          
          // Call callback if a measurement was added
          if (newEntry.entry_type === 'measurement' && onMeasurementAdded) {
            onMeasurementAdded();
          }
          return;
        } catch (error: any) {
          console.error('Error inserting log entry with direct fetch:', error);
          throw error;
        }
      }

      // Normal Supabase query
      const { data, error } = await supabase
        .from('koi_log_entries')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setLogEntries(prev => [data, ...prev]);
      setNewEntry({
        entry_date: new Date().toISOString().split('T')[0],
        entry_type: 'note',
        description: '',
        length_cm: ''
      });
      setIsDialogOpen(false);
      toast.success('Logboek entry toegevoegd');
      
      // Call callback if a measurement was added
      if (newEntry.entry_type === 'measurement' && onMeasurementAdded) {
        onMeasurementAdded();
      }
    } catch (error: any) {
      console.error('Error adding log entry:', error);
      
      // More specific error messages
      if (error?.code === '23503') {
        toast.error('Koi niet gevonden. Probeer de pagina te verversen.');
      } else if (error?.code === '23514') {
        toast.error('Ongeldig gebeurtenistype. Probeer opnieuw.');
      } else if (error?.message?.includes('permission') || error?.message?.includes('401')) {
        toast.error('Geen toestemming. Controleer je inloggegevens.');
      } else {
        toast.error(`Fout bij toevoegen: ${error?.message || 'Onbekende fout'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL');
  };

  const handleEditEntry = (entry: KoiLogEntry) => {
    setEditingEntry(entry);
    setNewEntry({
      entry_date: entry.entry_date,
      entry_type: entry.entry_type,
      description: entry.description || '',
      length_cm: entry.length_cm?.toString() || ''
    });
    setIsDialogOpen(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Weet je zeker dat je deze logboek entry wilt verwijderen?')) {
      return;
    }

    try {
      setDeleting(entryId);
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Deleting log entry using direct fetch with access token...');
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_log_entries?id=eq.${entryId}`,
            {
              method: 'DELETE',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
          }
          
          setLogEntries(prev => prev.filter(entry => entry.id !== entryId));
          toast.success('Logboek entry verwijderd');
          
          // Call callback if a measurement was deleted
          if (onMeasurementAdded) {
            onMeasurementAdded();
          }
          return;
        } catch (error: any) {
          console.error('Error deleting log entry with direct fetch:', error);
          throw error;
        }
      }

      // Normal Supabase query
      const { error } = await supabase
        .from('koi_log_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      setLogEntries(prev => prev.filter(entry => entry.id !== entryId));
      toast.success('Logboek entry verwijderd');
      
      // Call callback if a measurement was deleted
      if (onMeasurementAdded) {
        onMeasurementAdded();
      }
    } catch (error: any) {
      console.error('Error deleting log entry:', error);
      toast.error(`Fout bij verwijderen: ${error?.message || 'Onbekende fout'}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;

    if (newEntry.entry_type === 'measurement' && !newEntry.length_cm) {
      toast.error('Lengte is verplicht bij metingen');
      return;
    }

    if (newEntry.entry_type !== 'measurement' && !newEntry.description.trim()) {
      toast.error('Beschrijving is verplicht');
      return;
    }

    try {
      setSaving(true);
      
      // Prepare update data
      const updateData: any = {
        entry_date: newEntry.entry_date,
        entry_type: newEntry.entry_type,
        description: newEntry.description.trim() || 'Geen beschrijving'
      };

      // Only add length_cm for measurements
      if (newEntry.entry_type === 'measurement' && newEntry.length_cm) {
        updateData.length_cm = parseInt(newEntry.length_cm);
      } else {
        updateData.length_cm = null;
      }

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Updating log entry using direct fetch with access token...');
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_log_entries?id=eq.${editingEntry.id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(updateData)
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
          }
          
          const data = await response.json();
          const updatedData = Array.isArray(data) ? data[0] : data;
          
          console.log('Updated log entry (direct fetch):', updatedData);
          setLogEntries(prev => prev.map(entry => 
            entry.id === editingEntry.id ? updatedData : entry
          ));
          
          setEditingEntry(null);
          setNewEntry({
            entry_date: new Date().toISOString().split('T')[0],
            entry_type: 'note',
            description: '',
            length_cm: ''
          });
          setIsDialogOpen(false);
          toast.success('Logboek entry bijgewerkt');
          
          // Call callback if a measurement was updated
          if (newEntry.entry_type === 'measurement' && onMeasurementAdded) {
            onMeasurementAdded();
          }
          return;
        } catch (error: any) {
          console.error('Error updating log entry with direct fetch:', error);
          throw error;
        }
      }

      // Normal Supabase query
      const { data, error } = await supabase
        .from('koi_log_entries')
        .update(updateData)
        .eq('id', editingEntry.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setLogEntries(prev => prev.map(entry => 
        entry.id === editingEntry.id ? data : entry
      ));
      
      setEditingEntry(null);
      setNewEntry({
        entry_date: new Date().toISOString().split('T')[0],
        entry_type: 'note',
        description: '',
        length_cm: ''
      });
      setIsDialogOpen(false);
      toast.success('Logboek entry bijgewerkt');
      
      // Call callback if a measurement was updated
      if (newEntry.entry_type === 'measurement' && onMeasurementAdded) {
        onMeasurementAdded();
      }
    } catch (error: any) {
      console.error('Error updating log entry:', error);
      toast.error(`Fout bij bijwerken: ${error?.message || 'Onbekende fout'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Koi Logboek
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Koi Logboek
          </CardTitle>
          <div className="flex gap-2">
            {!showAll && onViewAll && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onViewAll}
              >
                Bekijk logboek
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Toevoegen
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logEntries.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">Nog geen logboek entries</p>
            <p className="text-sm text-gray-400">Voeg je eerste gebeurtenis toe om te beginnen</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(showAll ? logEntries : logEntries.slice(0, 3)).map((entry) => {
              const IconComponent = entryTypeIcons[entry.entry_type];
              return (
                <div key={entry.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4 text-gray-600" />
                      <Badge className={entryTypeColors[entry.entry_type]}>
                        {entryTypeLabels[entry.entry_type]}
                      </Badge>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(entry.entry_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditEntry(entry)}
                        className="h-6 w-6 p-0"
                        title="Bewerken"
                      >
                        <Edit className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={deleting === entry.id}
                        className="h-6 w-6 p-0"
                        title="Verwijderen"
                      >
                        <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-600" />
                      </Button>
                    </div>
                  </div>
                  
                  {entry.entry_type === 'measurement' && entry.length_cm && (
                    <div className="mb-2">
                      <span className="text-sm font-medium text-blue-600">
                        Lengte: {entry.length_cm} cm
                      </span>
                    </div>
                  )}
                  
                  <p className="text-gray-900">{entry.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      
      {/* Dialog for adding/editing entries */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'Logboek Entry Bewerken' : 'Nieuwe Logboek Entry'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry_date">Datum</Label>
              <Input
                id="entry_date"
                type="date"
                value={newEntry.entry_date}
                onChange={(e) => setNewEntry(prev => ({ ...prev, entry_date: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="entry_type">Type Gebeurtenis</Label>
              <Select value={newEntry.entry_type} onValueChange={(value: KoiLogEntry['entry_type']) => 
                setNewEntry(prev => ({ ...prev, entry_type: value, length_cm: '' }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="measurement">Meting</SelectItem>
                  <SelectItem value="medication">Medicijngebruik</SelectItem>
                  <SelectItem value="note">Opmerking</SelectItem>
                  <SelectItem value="behavior">Gedrag</SelectItem>
                  <SelectItem value="treatment">Ziekte/Behandeling</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newEntry.entry_type === 'measurement' && (
              <div className="space-y-2">
                <Label htmlFor="length_cm">Lengte (cm)</Label>
                <Input
                  id="length_cm"
                  type="number"
                  min="1"
                  value={newEntry.length_cm}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, length_cm: e.target.value }))}
                  placeholder="Bijv. 25"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">
                Beschrijving {newEntry.entry_type === 'measurement' ? '(optioneel)' : ''}
              </Label>
              <Textarea
                id="description"
                value={newEntry.description}
                onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                placeholder={newEntry.entry_type === 'measurement' ? 'Optionele opmerking bij de meting...' : 'Beschrijf de gebeurtenis...'}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                setEditingEntry(null);
                setNewEntry({
                  entry_date: new Date().toISOString().split('T')[0],
                  entry_type: 'note',
                  description: '',
                  length_cm: ''
                });
              }}>
                Annuleren
              </Button>
              <Button onClick={editingEntry ? handleUpdateEntry : handleAddEntry} disabled={saving}>
                {saving ? 'Opslaan...' : (editingEntry ? 'Bijwerken' : 'Opslaan')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
