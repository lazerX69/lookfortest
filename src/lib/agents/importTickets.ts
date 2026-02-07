// Import tickets from dataset into the database
import { supabase } from '@/integrations/supabase/client';
import { RawTicket, ImportedTicket } from './types';

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

// Parse the conversation string into individual messages
export function parseConversation(conversation: string): Array<{ role: 'customer' | 'agent'; content: string }> {
  const messages: Array<{ role: 'customer' | 'agent'; content: string }> = [];
  
  // Split by message markers
  const customerPattern = /Customer's message: "([\s\S]*?)"/g;
  const agentPattern = /Agent's message: "([\s\S]*?)"/g;
  
  // Extract all matches with positions
  const allMatches: Array<{ role: 'customer' | 'agent'; content: string; index: number }> = [];
  
  let match;
  while ((match = customerPattern.exec(conversation)) !== null) {
    allMatches.push({
      role: 'customer',
      content: match[1].trim(),
      index: match.index,
    });
  }
  
  while ((match = agentPattern.exec(conversation)) !== null) {
    allMatches.push({
      role: 'agent',
      content: match[1].trim(),
      index: match.index,
    });
  }
  
  // Sort by position in conversation
  allMatches.sort((a, b) => a.index - b.index);
  
  return allMatches.map(({ role, content }) => ({ role, content }));
}

// Parse date from dataset format "19-Jul-2025 13:07:09" to ISO
export function parseDateFromDataset(dateStr: string): string {
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, monthStr, year] = datePart.split('-');
    const months: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const month = months[monthStr] || '01';
    return `${year}-${month}-${day.padStart(2, '0')}T${timePart}Z`;
  } catch {
    return new Date().toISOString();
  }
}

// Extract customer name from conversation or use default
export function extractCustomerName(conversation: string, customerId: string): { firstName: string; lastName: string } {
  // Try to find names in the conversation
  const namePatterns = [
    /(?:Thanks|Hi|Hello|Dear)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/,
    /Kind regards[,\s]*([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i,
    /([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?\s+(?:Sent from|--)/,
  ];
  
  for (const pattern of namePatterns) {
    const match = conversation.match(pattern);
    if (match && match[1]) {
      return {
        firstName: match[1],
        lastName: match[2] || '',
      };
    }
  }
  
  // Use customer ID as fallback
  return {
    firstName: 'Customer',
    lastName: customerId.replace('cust_', '').slice(0, 8),
  };
}

// Import raw tickets from JSON data
export async function importTickets(tickets: RawTicket[]): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (const ticket of tickets) {
    try {
      // Check if already imported
      const { data: existing } = await supabase
        .from('imported_tickets')
        .select('id')
        .eq('conversation_id', ticket.conversationId)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }

      // Insert into imported_tickets table
      const { error } = await supabase
        .from('imported_tickets')
        .insert({
          conversation_id: ticket.conversationId,
          customer_id: ticket.customerId,
          original_created_at: ticket.createdAt,
          conversation_type: ticket.conversationType,
          subject: ticket.subject,
          raw_conversation: ticket.conversation,
        });

      if (error) {
        result.errors.push(`Failed to import ${ticket.conversationId}: ${error.message}`);
        continue;
      }

      result.imported++;
    } catch (e) {
      result.errors.push(`Error processing ${ticket.conversationId}: ${e}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

// Get all imported tickets
export async function getImportedTickets(): Promise<ImportedTicket[]> {
  const { data, error } = await supabase
    .from('imported_tickets')
    .select('*')
    .order('imported_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch imported tickets:', error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    customerId: row.customer_id,
    createdAt: row.created_at || '',
    originalCreatedAt: row.original_created_at || '',
    conversationType: row.conversation_type || 'email',
    subject: row.subject || '',
    rawConversation: row.raw_conversation,
    importedAt: row.imported_at || '',
  }));
}

// Create a session from an imported ticket for testing
export async function createSessionFromTicket(ticket: ImportedTicket): Promise<string | null> {
  const { firstName, lastName } = extractCustomerName(ticket.rawConversation, ticket.customerId);
  
  const { data, error } = await supabase
    .from('email_sessions')
    .insert({
      customer_email: `${ticket.customerId}@example.com`,
      customer_first_name: firstName,
      customer_last_name: lastName,
      shopify_customer_id: ticket.customerId,
      subject: ticket.subject,
      conversation_id: ticket.conversationId,
      conversation_type: ticket.conversationType,
      raw_conversation: ticket.rawConversation,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create session from ticket:', error);
    return null;
  }

  // Initialize session context
  await supabase.from('session_context').insert({
    session_id: data.id,
    promises_made: [],
    conversation_state: {},
  });

  // Parse and import messages
  const messages = parseConversation(ticket.rawConversation);
  for (const msg of messages) {
    await supabase.from('session_messages').insert({
      session_id: data.id,
      role: msg.role,
      content: msg.content,
    });
  }

  return data.id;
}

// Fetch tickets from the public data file
export async function fetchTicketsFromFile(): Promise<RawTicket[]> {
  try {
    const response = await fetch('/data/anonymized_tickets.json');
    if (!response.ok) throw new Error('Failed to fetch tickets file');
    return await response.json();
  } catch (e) {
    console.error('Error fetching tickets:', e);
    return [];
  }
}
