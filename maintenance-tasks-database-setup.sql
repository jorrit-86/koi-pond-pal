-- Maintenance Tasks Database Setup
-- This script creates tables for managing recurring maintenance tasks and to-do items

-- Create maintenance_task_templates table for user-defined recurring tasks
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

-- Create maintenance_tasks table for generated to-do items
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

-- Enable Row Level Security
ALTER TABLE public.maintenance_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for maintenance_task_templates
CREATE POLICY "Users can view their own task templates" ON public.maintenance_task_templates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task templates" ON public.maintenance_task_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task templates" ON public.maintenance_task_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task templates" ON public.maintenance_task_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for maintenance_tasks
CREATE POLICY "Users can view their own tasks" ON public.maintenance_tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks" ON public.maintenance_tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" ON public.maintenance_tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" ON public.maintenance_tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_maintenance_task_templates_user_id ON public.maintenance_task_templates(user_id);
CREATE INDEX idx_maintenance_task_templates_active ON public.maintenance_task_templates(is_active);
CREATE INDEX idx_maintenance_tasks_user_id ON public.maintenance_tasks(user_id);
CREATE INDEX idx_maintenance_tasks_due_date ON public.maintenance_tasks(due_date);
CREATE INDEX idx_maintenance_tasks_status ON public.maintenance_tasks(status);
CREATE INDEX idx_maintenance_tasks_template_id ON public.maintenance_tasks(template_id);

-- Create updated_at triggers
CREATE TRIGGER update_maintenance_task_templates_updated_at 
    BEFORE UPDATE ON public.maintenance_task_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_tasks_updated_at 
    BEFORE UPDATE ON public.maintenance_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.maintenance_task_templates IS 'User-defined templates for recurring maintenance tasks';
COMMENT ON TABLE public.maintenance_tasks IS 'Generated to-do items based on task templates';
COMMENT ON COLUMN public.maintenance_task_templates.frequency_type IS 'Type of frequency: daily, weekly, x_days, monthly, four_weeks';
COMMENT ON COLUMN public.maintenance_task_templates.frequency_value IS 'Value for frequency: day of week (0-6) for weekly, day of month (1-31) for monthly, number of days for x_days';
COMMENT ON COLUMN public.maintenance_task_templates.advance_notice_days IS 'How many days before due date the task should appear';
COMMENT ON COLUMN public.maintenance_tasks.due_date IS 'When the task should be completed';
COMMENT ON COLUMN public.maintenance_tasks.status IS 'Task status: pending, completed, overdue';
