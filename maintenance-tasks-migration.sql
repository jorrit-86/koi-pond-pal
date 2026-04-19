-- Migration: Add advance_notice_days column to maintenance_tasks table
-- Run this if you already have the maintenance_tasks table

-- Add the advance_notice_days column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_tasks' 
        AND column_name = 'advance_notice_days'
    ) THEN
        ALTER TABLE public.maintenance_tasks 
        ADD COLUMN advance_notice_days INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Update existing tasks to use the advance_notice_days from their templates
UPDATE public.maintenance_tasks 
SET advance_notice_days = (
    SELECT advance_notice_days 
    FROM public.maintenance_task_templates 
    WHERE maintenance_task_templates.id = maintenance_tasks.template_id
)
WHERE template_id IS NOT NULL;

-- For tasks without templates, keep the default value of 1
