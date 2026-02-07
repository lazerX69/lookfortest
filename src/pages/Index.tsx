import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  SessionList,
  MessageThread,
  MessageInput,
  NewSessionDialog,
  ObservabilityPanel,
  ConfigPanel,
} from '@/components/email-support';
import { ImportTicketsDialog } from '@/components/email-support/ImportTicketsDialog';
import { EmailSupportOrchestrator } from '@/lib/agents';
import { EmailSession, SessionMessage, ToolCall, SessionAction, CustomerInfo, SupervisorReviewResult } from '@/lib/agents/types';

const Index = () => {
  const { toast } = useToast();

  // Configuration state
  const [config, setConfig] = useState({
    apiUrl: 'https://www.lookfor.ai',
  });

  // Orchestrator instance
  const [orchestrator, setOrchestrator] = useState<EmailSupportOrchestrator | null>(null);

  // Session state
  const [sessions, setSessions] = useState<EmailSession[]>([]);
  const [currentSession, setCurrentSession] = useState<EmailSession | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [supervisorReview, setSupervisorReview] = useState<SupervisorReviewResult | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize orchestrator when config changes
  useEffect(() => {
    setOrchestrator(new EmailSupportOrchestrator(config));
  }, [config]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('email_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data.map(mapSession));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const mapSession = (data: Record<string, unknown>): EmailSession => ({
    id: data.id as string,
    customerEmail: data.customer_email as string,
    customerFirstName: data.customer_first_name as string,
    customerLastName: data.customer_last_name as string,
    shopifyCustomerId: data.shopify_customer_id as string,
    subject: data.subject as string | undefined,
    workflowCategory: data.workflow_category as EmailSession['workflowCategory'],
    isEscalated: data.is_escalated as boolean,
    escalationReason: data.escalation_reason as string | undefined,
    escalationSummary: data.escalation_summary as EmailSession['escalationSummary'],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    conversationId: data.conversation_id as string | undefined,
    conversationType: data.conversation_type as string | undefined,
    rawConversation: data.raw_conversation as string | undefined,
  });

  const mapMessage = (data: Record<string, unknown>): SessionMessage => ({
    id: data.id as string,
    sessionId: data.session_id as string,
    role: data.role as 'customer' | 'agent' | 'system',
    content: data.content as string,
    agentName: data.agent_name as string | undefined,
    createdAt: data.created_at as string,
  });

  const mapToolCall = (data: Record<string, unknown>): ToolCall => ({
    id: data.id as string,
    sessionId: data.session_id as string,
    messageId: data.message_id as string | undefined,
    toolName: data.tool_name as string,
    toolInput: data.tool_input as Record<string, unknown>,
    toolOutput: data.tool_output as Record<string, unknown> | undefined,
    success: data.success as boolean | undefined,
    errorMessage: data.error_message as string | undefined,
    createdAt: data.created_at as string,
  });

  const mapAction = (data: Record<string, unknown>): SessionAction => ({
    id: data.id as string,
    sessionId: data.session_id as string,
    actionType: data.action_type as string,
    actionDetails: data.action_details as Record<string, unknown>,
    performedBy: data.performed_by as string,
    createdAt: data.created_at as string,
  });

  const createSession = async (customer: CustomerInfo, subject?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_sessions')
        .insert({
          customer_email: customer.email,
          customer_first_name: customer.firstName,
          customer_last_name: customer.lastName,
          shopify_customer_id: customer.shopifyCustomerId,
          subject,
        })
        .select()
        .single();

      if (error) throw error;

      // Initialize session context
      await supabase.from('session_context').insert({
        session_id: data.id,
        promises_made: [],
        conversation_state: {},
      });

      const session = mapSession(data);
      setSessions((prev) => [session, ...prev]);
      setCurrentSession(session);
      setMessages([]);
      setToolCalls([]);
      setActions([]);

      toast({
        title: 'Session Created',
        description: `New session for ${customer.firstName} ${customer.lastName}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create session',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const [sessionRes, messagesRes, toolsRes, actionsRes] = await Promise.all([
        supabase.from('email_sessions').select('*').eq('id', sessionId).single(),
        supabase.from('session_messages').select('*').eq('session_id', sessionId).order('created_at'),
        supabase.from('tool_calls').select('*').eq('session_id', sessionId).order('created_at'),
        supabase.from('session_actions').select('*').eq('session_id', sessionId).order('created_at'),
      ]);

      if (sessionRes.data) {
        setCurrentSession(mapSession(sessionRes.data));
      }
      setMessages((messagesRes.data || []).map(mapMessage));
      setToolCalls((toolsRes.data || []).map(mapToolCall));
      setActions((actionsRes.data || []).map(mapAction));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load session',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllSessions = async () => {
    if (!orchestrator) return;

    try {
      setIsLoading(true);
      await orchestrator.clearAllSessions();
      setSessions([]);
      setCurrentSession(null);
      setMessages([]);
      setToolCalls([]);
      setActions([]);
      toast({
        title: 'Sessions Cleared',
        description: 'All active sessions have been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear sessions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!currentSession || !orchestrator) {
      return;
    }

    if (currentSession.isEscalated) {
      toast({
        title: 'Session Escalated',
        description: 'This session has been escalated. No automated responses.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await orchestrator.processMessage(currentSession.id, content);

      // Store supervisor review
      if (response.supervisorReview) {
        setSupervisorReview(response.supervisorReview);
      }

      // Refresh session data
      await selectSession(currentSession.id);

      if (response.shouldEscalate) {
        toast({
          title: 'Session Escalated',
          description: response.escalationSummary?.reason || 'Escalated to human agent',
        });
      }

      // Show supervisor toast if issues found
      if (response.supervisorReview && !response.supervisorReview.approved) {
        toast({
          title: 'Supervisor Flagged Response',
          description: `Risk: ${response.supervisorReview.riskLevel.toUpperCase()}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process message',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Email Support Agent System</h1>
        <p className="text-sm text-muted-foreground">
          Multi-agent workflow automation for e-commerce support
        </p>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left sidebar - Sessions */}
        <div className="w-80 border-r p-4 space-y-4">
          <NewSessionDialog onCreateSession={createSession} isLoading={isLoading} />
          <ImportTicketsDialog onSessionCreated={(sessionId) => {
            loadSessions();
            selectSession(sessionId);
          }} />
          <SessionList
            sessions={sessions}
            currentSessionId={currentSession?.id}
            onSelectSession={selectSession}
            onClearSessions={clearAllSessions}
          />
        </div>

        {/* Main content - Messages */}
        <div className="flex-1 flex flex-col p-4 space-y-4">
          <MessageThread session={currentSession} messages={messages} />
          <MessageInput
            onSendMessage={sendMessage}
            isLoading={isLoading}
            disabled={!currentSession || currentSession.isEscalated}
          />
        </div>

        {/* Right sidebar - Observability & Config */}
        <div className="w-96 border-l p-4 space-y-4 overflow-y-auto">
          <ConfigPanel config={config} onConfigChange={setConfig} />
          <ObservabilityPanel toolCalls={toolCalls} actions={actions} supervisorReview={supervisorReview} />
        </div>
      </div>
    </div>
  );
};

export default Index;
