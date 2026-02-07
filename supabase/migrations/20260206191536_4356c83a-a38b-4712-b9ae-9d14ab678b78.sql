-- Email support sessions table
CREATE TABLE public.email_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  customer_first_name TEXT NOT NULL,
  customer_last_name TEXT NOT NULL,
  shopify_customer_id TEXT NOT NULL,
  subject TEXT,
  workflow_category TEXT,
  is_escalated BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  escalation_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Session messages table
CREATE TABLE public.session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.email_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'agent', 'system')),
  content TEXT NOT NULL,
  agent_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tool calls trace table
CREATE TABLE public.tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.email_sessions(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.session_messages(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Actions taken table for observability
CREATE TABLE public.session_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.email_sessions(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL,
  action_details JSONB NOT NULL,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Session context/memory for continuous conversation
CREATE TABLE public.session_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.email_sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  promises_made JSONB DEFAULT '[]'::jsonb,
  order_data JSONB,
  subscription_data JSONB,
  customer_sentiment TEXT,
  conversation_state JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.email_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_context ENABLE ROW LEVEL SECURITY;

-- For hackathon demo, allow all operations (public access)
CREATE POLICY "Allow all on email_sessions" ON public.email_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on session_messages" ON public.session_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tool_calls" ON public.tool_calls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on session_actions" ON public.session_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on session_context" ON public.session_context FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_session_messages_session_id ON public.session_messages(session_id);
CREATE INDEX idx_tool_calls_session_id ON public.tool_calls(session_id);
CREATE INDEX idx_session_actions_session_id ON public.session_actions(session_id);
CREATE INDEX idx_email_sessions_customer_email ON public.email_sessions(customer_email);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_email_sessions_updated_at
  BEFORE UPDATE ON public.email_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_session_context_updated_at
  BEFORE UPDATE ON public.session_context
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();