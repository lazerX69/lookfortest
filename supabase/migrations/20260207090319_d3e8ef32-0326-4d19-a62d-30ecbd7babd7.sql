-- Add new columns to email_sessions table to match the dataset structure
ALTER TABLE public.email_sessions 
ADD COLUMN IF NOT EXISTS conversation_id text,
ADD COLUMN IF NOT EXISTS conversation_type text DEFAULT 'email',
ADD COLUMN IF NOT EXISTS raw_conversation text;

-- Create index on conversation_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_sessions_conversation_id ON public.email_sessions(conversation_id);

-- Create index on customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_sessions_shopify_customer_id ON public.email_sessions(shopify_customer_id);

-- Create a table to store the imported tickets for reference
CREATE TABLE IF NOT EXISTS public.imported_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id text NOT NULL UNIQUE,
    customer_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    original_created_at text,
    conversation_type text DEFAULT 'email',
    subject text,
    raw_conversation text NOT NULL,
    imported_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on imported_tickets
ALTER TABLE public.imported_tickets ENABLE ROW LEVEL SECURITY;

-- Create policy for imported_tickets (allow all for now since no auth)
CREATE POLICY "Allow all on imported_tickets" 
ON public.imported_tickets 
FOR ALL 
USING (true) 
WITH CHECK (true);