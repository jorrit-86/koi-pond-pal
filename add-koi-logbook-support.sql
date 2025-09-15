-- Koi Logboek Database Setup
-- Voer dit script uit in je Supabase SQL editor

-- Maak de koi_log_entries tabel
CREATE TABLE IF NOT EXISTS public.koi_log_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    koi_id UUID NOT NULL REFERENCES public.koi(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_type TEXT NOT NULL CHECK (entry_type IN (
        'measurement', 
        'medication', 
        'note', 
        'feeding', 
        'behavior', 
        'treatment'
    )),
    description TEXT NOT NULL,
    length_cm INTEGER, -- Alleen voor metingen
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) policies
ALTER TABLE public.koi_log_entries ENABLE ROW LEVEL SECURITY;

-- Policy voor SELECT - gebruikers kunnen alleen hun eigen koi log entries zien
CREATE POLICY "Users can view their own koi log entries" ON public.koi_log_entries
    FOR SELECT USING (
        koi_id IN (
            SELECT id FROM public.koi WHERE user_id = auth.uid()
        )
    );

-- Policy voor INSERT - gebruikers kunnen alleen log entries toevoegen voor hun eigen koi
CREATE POLICY "Users can insert their own koi log entries" ON public.koi_log_entries
    FOR INSERT WITH CHECK (
        koi_id IN (
            SELECT id FROM public.koi WHERE user_id = auth.uid()
        )
    );

-- Policy voor UPDATE - gebruikers kunnen alleen hun eigen koi log entries updaten
CREATE POLICY "Users can update their own koi log entries" ON public.koi_log_entries
    FOR UPDATE USING (
        koi_id IN (
            SELECT id FROM public.koi WHERE user_id = auth.uid()
        )
    );

-- Policy voor DELETE - gebruikers kunnen alleen hun eigen koi log entries verwijderen
CREATE POLICY "Users can delete their own koi log entries" ON public.koi_log_entries
    FOR DELETE USING (
        koi_id IN (
            SELECT id FROM public.koi WHERE user_id = auth.uid()
        )
    );

-- Indexes voor betere performance
CREATE INDEX IF NOT EXISTS idx_koi_log_entries_koi_id ON public.koi_log_entries(koi_id);
CREATE INDEX IF NOT EXISTS idx_koi_log_entries_entry_date ON public.koi_log_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_koi_log_entries_entry_type ON public.koi_log_entries(entry_type);

-- Trigger voor updated_at
CREATE OR REPLACE FUNCTION update_koi_log_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_koi_log_entries_updated_at
    BEFORE UPDATE ON public.koi_log_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_koi_log_entries_updated_at();

-- Test data (optioneel - verwijder na testen)
-- INSERT INTO public.koi_log_entries (koi_id, entry_date, entry_type, description, length_cm)
-- VALUES 
--     ('koi-uuid-here', '2024-01-15', 'measurement', 'Maandelijkse meting', 25),
--     ('koi-uuid-here', '2024-01-10', 'medication', 'Antibiotica kuur gestart', NULL),
--     ('koi-uuid-here', '2024-01-05', 'note', 'Actief gedrag, eet goed', NULL);
