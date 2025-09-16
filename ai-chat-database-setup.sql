-- AI Chat Database Setup
-- Run this in your Supabase SQL Editor

-- Create AI chat history table
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
    content TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user_id ON public.ai_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_created_at ON public.ai_chat_history(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own chat history" ON public.ai_chat_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages" ON public.ai_chat_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat messages" ON public.ai_chat_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat messages" ON public.ai_chat_history
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.ai_chat_history IS 'Stores AI chat conversation history for each user';
COMMENT ON COLUMN public.ai_chat_history.message_type IS 'Type of message: user or assistant';
COMMENT ON COLUMN public.ai_chat_history.content IS 'The actual message content';
COMMENT ON COLUMN public.ai_chat_history.context IS 'Contextual information about the conversation (page, parameters, etc.)';

-- Create a function to clean up old chat history (optional)
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_history()
RETURNS void AS $$
BEGIN
    -- Delete chat history older than 90 days
    DELETE FROM public.ai_chat_history 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get chat statistics
CREATE OR REPLACE FUNCTION public.get_chat_stats(user_id_param UUID)
RETURNS TABLE (
    total_messages BIGINT,
    user_messages BIGINT,
    assistant_messages BIGINT,
    first_message_date TIMESTAMP WITH TIME ZONE,
    last_message_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE message_type = 'user') as user_messages,
        COUNT(*) FILTER (WHERE message_type = 'assistant') as assistant_messages,
        MIN(created_at) as first_message_date,
        MAX(created_at) as last_message_date
    FROM public.ai_chat_history
    WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.ai_chat_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_chat_history() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_stats(UUID) TO authenticated;
