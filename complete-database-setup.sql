-- Complete Database Setup for Maintenance Tasks
-- Execute this step by step in your Supabase SQL Editor

-- Step 1: Create the maintenance_task_templates table
CREATE TABLE IF NOT EXISTS public.maintenance_task_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK (task_type IN ('water_change', 'clean_brushes', 'filter_check', 'water_parameters', 'custom')),
    frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'x_days', 'monthly', 'four_weeks')),
    frequency_value INTEGER, -- For 'x_days' and 'weekly' (day of week 0-6), 'monthly' (day of month 1-31)
    advance_notice_days INTEGER NOT NULL DEFAULT 1, -- How many days before task appears
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create the maintenance_tasks table
CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.maintenance_task_templates(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    advance_notice_days INTEGER NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Enable Row Level Security
ALTER TABLE public.maintenance_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for maintenance_task_templates
DROP POLICY IF EXISTS "Users can view their own task templates" ON public.maintenance_task_templates;
CREATE POLICY "Users can view their own task templates" ON public.maintenance_task_templates
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own task templates" ON public.maintenance_task_templates;
CREATE POLICY "Users can insert their own task templates" ON public.maintenance_task_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own task templates" ON public.maintenance_task_templates;
CREATE POLICY "Users can update their own task templates" ON public.maintenance_task_templates
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own task templates" ON public.maintenance_task_templates;
CREATE POLICY "Users can delete their own task templates" ON public.maintenance_task_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Create RLS policies for maintenance_tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.maintenance_tasks;
CREATE POLICY "Users can view their own tasks" ON public.maintenance_tasks
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.maintenance_tasks;
CREATE POLICY "Users can insert their own tasks" ON public.maintenance_tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tasks" ON public.maintenance_tasks;
CREATE POLICY "Users can update their own tasks" ON public.maintenance_tasks
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.maintenance_tasks;
CREATE POLICY "Users can delete their own tasks" ON public.maintenance_tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_maintenance_task_templates_user_id ON public.maintenance_task_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_task_templates_active ON public.maintenance_task_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_user_id ON public.maintenance_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_due_date ON public.maintenance_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON public.maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_template_id ON public.maintenance_tasks(template_id);

-- Step 7: Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 8: Create updated_at triggers
DROP TRIGGER IF EXISTS update_maintenance_task_templates_updated_at ON public.maintenance_task_templates;
CREATE TRIGGER update_maintenance_task_templates_updated_at 
    BEFORE UPDATE ON public.maintenance_task_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_maintenance_tasks_updated_at ON public.maintenance_tasks;
CREATE TRIGGER update_maintenance_tasks_updated_at 
    BEFORE UPDATE ON public.maintenance_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Test the setup
SELECT 'Database setup completed successfully!' as status;
