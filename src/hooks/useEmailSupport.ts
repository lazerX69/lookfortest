import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { EmailSupportOrchestrator, CustomerInfo, EmailSession, SessionMessage, ToolCall, SessionAction, AgentResponse, SupervisorReviewResult } from '@/lib/agents';

interface OrchestratorConfig {
  apiUrl: string;
}

export function useEmailSupport(config: OrchestratorConfig) {
  const [orchestrator] = useState(() => new EmailSupportOrchestrator(config));
  const [sessions, setSessions] = useState<EmailSession[]>([]);
  const [currentSession, setCurrentSession] = useState<EmailSession | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [supervisorReview, setSupervisorReview] = useState<SupervisorReviewResult | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadSessions = async () => {
    try {
      const allSessions = await orchestrator.getAllSessions();
      setSessions(allSessions);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive',
      });
    }
  };

  const createSession = async (customer: CustomerInfo, subject?: string) => {
    setIsLoading(true);
    try {
      const session = await orchestrator.createSession(customer, subject);
      setSessions(prev => [session, ...prev]);
      setCurrentSession(session);
      setMessages([]);
      setToolCalls([]);
      setActions([]);
      toast({
        title: 'Session Created',
        description: `New session for ${customer.firstName} ${customer.lastName}`,
      });
      return session;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create session',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const selectSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const session = await orchestrator.getSession(sessionId);
      if (session) {
        setCurrentSession(session);
        const [msgs, tools, acts] = await Promise.all([
          orchestrator.getSessionMessages(sessionId),
          orchestrator.getToolCalls(sessionId),
          orchestrator.getSessionActions(sessionId),
        ]);
        setMessages(msgs);
        setToolCalls(tools);
        setActions(acts);
      }
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

  const sendMessage = async (content: string): Promise<AgentResponse | null> => {
    if (!currentSession) {
      toast({
        title: 'Error',
        description: 'No active session',
        variant: 'destructive',
      });
      return null;
    }

    if (currentSession.isEscalated) {
      toast({
        title: 'Session Escalated',
        description: 'This session has been escalated. No automated responses.',
        variant: 'destructive',
      });
      return null;
    }

    setIsLoading(true);
    try {
      const response = await orchestrator.processMessage(currentSession.id, content);

      // Refresh session data
      const [updatedSession, msgs, tools, acts] = await Promise.all([
        orchestrator.getSession(currentSession.id),
        orchestrator.getSessionMessages(currentSession.id),
        orchestrator.getToolCalls(currentSession.id),
        orchestrator.getSessionActions(currentSession.id),
      ]);

      if (updatedSession) {
        setCurrentSession(updatedSession);
        setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      }
      setMessages(msgs);
      setToolCalls(tools);
      setActions(acts);

      // Store supervisor review from response
      if (response.supervisorReview) {
        setSupervisorReview(response.supervisorReview);
      }

      if (response.shouldEscalate) {
        toast({
          title: 'Session Escalated',
          description: response.escalationSummary?.reason || 'Escalated to human agent',
        });
      }

      // Show supervisor review toast if there were issues
      if (response.supervisorReview && !response.supervisorReview.approved) {
        toast({
          title: 'Supervisor Flagged Response',
          description: `Risk: ${response.supervisorReview.riskLevel.toUpperCase()} - Response was modified before sending`,
          variant: 'destructive',
        });
      }

      return response;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process message',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sessions,
    currentSession,
    messages,
    toolCalls,
    actions,
    supervisorReview,
    isLoading,
    loadSessions,
    createSession,
    selectSession,
    sendMessage,
    clearAllSessions: async () => {
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
    },
  };
}
