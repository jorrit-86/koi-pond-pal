-- Add can_skip column to maintenance_task_templates table
-- This allows tasks to be configured with a skip option

ALTER TABLE public.maintenance_task_templates 
ADD COLUMN IF NOT EXISTS can_skip BOOLEAN DEFAULT FALSE;

-- Update existing templates to have can_skip = false by default
UPDATE public.maintenance_task_templates 
SET can_skip = FALSE 
WHERE can_skip IS NULL;

-- Add comment to column
COMMENT ON COLUMN public.maintenance_task_templates.can_skip IS 'Whether this task can be skipped (skip button will appear in UI)';


