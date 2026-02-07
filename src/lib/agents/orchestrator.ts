// Multi-agent orchestrator for email support
import { supabase } from '@/integrations/supabase/client';
import {
  CustomerInfo,
  EmailSession,
  SessionMessage,
  ToolCall,
  SessionAction,
  SessionContext,
  WorkflowCategory,
  EscalationSummary,
  AgentResponse,
  RoutingResult,
  SupervisorReviewResult,
} from './types';
import { toolRegistry } from './tools';
import { agentDefinitions, routerPrompt, getWaitPromise, AGENT_SIGNATURE } from './workflows';
import { supervisorAgent, SupervisorReview } from './supervisor';

export class EmailSupportOrchestrator {
  private apiUrl: string;

  constructor(config: { apiUrl: string }) {
    this.apiUrl = config.apiUrl;
  }

  // Create a new email session
  async createSession(customer: CustomerInfo, subject?: string): Promise<EmailSession> {
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

    if (error) throw new Error(`Failed to create session: ${error.message}`);

    // Initialize session context
    await supabase.from('session_context').insert({
      session_id: data.id,
      promises_made: [],
      conversation_state: {},
    });

    return this.mapSession(data);
  }

  // Get session by ID
  async getSession(sessionId: string): Promise<EmailSession | null> {
    const { data, error } = await supabase
      .from('email_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapSession(data);
  }

  // Get all sessions
  async getAllSessions(): Promise<EmailSession[]> {
    const { data, error } = await supabase
      .from('email_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return [];
    return data.map(this.mapSession);
  }

  // Clear all sessions and related data (keeps imported tickets)
  async clearAllSessions(): Promise<void> {
    // Delete in order of dependency (though cascade might handle it, explicit is safer)
    await supabase.from('session_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tool_calls').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('session_actions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('session_context').delete().neq('session_id', '00000000-0000-0000-0000-000000000000');

    // Finally delete sessions
    const { error } = await supabase.from('email_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw new Error(`Failed to clear sessions: ${error.message}`);
  }

  // Get all messages for a session
  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    const { data, error } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data.map(this.mapMessage);
  }

  // Get tool calls for a session
  async getToolCalls(sessionId: string): Promise<ToolCall[]> {
    const { data, error } = await supabase
      .from('tool_calls')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data.map(this.mapToolCall);
  }

  // Get actions for a session
  async getSessionActions(sessionId: string): Promise<SessionAction[]> {
    const { data, error } = await supabase
      .from('session_actions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data.map(this.mapAction);
  }

  // Get session context
  async getSessionContext(sessionId: string): Promise<SessionContext | null> {
    const { data, error } = await supabase
      .from('session_context')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapContext(data);
  }

  // Process incoming customer message
  async processMessage(sessionId: string, customerMessage: string): Promise<AgentResponse> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    // Check if session is escalated - no more automated responses
    if (session.isEscalated) {
      return {
        message: '',
        toolCalls: [],
        actions: [],
        shouldEscalate: true,
        escalationSummary: session.escalationSummary,
      };
    }

    // Save customer message
    await this.saveMessage(sessionId, 'customer', customerMessage);

    // Get conversation history and context
    const messages = await this.getSessionMessages(sessionId);
    const context = await this.getSessionContext(sessionId);

    // Route to appropriate agent if not already classified
    let category = session.workflowCategory as WorkflowCategory;
    if (!category || category === 'unknown') {
      const routing = await this.routeMessage(customerMessage, messages);
      category = routing.category;

      // Update session with category
      await supabase
        .from('email_sessions')
        .update({ workflow_category: category })
        .eq('id', sessionId);
    }

    // Get the appropriate agent
    const agent = agentDefinitions[category] || agentDefinitions.unknown;

    // Process with the agent
    let response = await this.runAgent(session, agent, messages, context, customerMessage);

    // === SUPERVISOR REVIEW ===
    // Only review if not already escalated and has a message
    if (!response.shouldEscalate && response.message) {
      const supervisorReview = await this.runSupervisorReview(
        session,
        messages,
        context,
        response
      );

      response.supervisorReview = {
        approved: supervisorReview.approved,
        riskLevel: supervisorReview.riskLevel,
        contradictions: supervisorReview.contradictions,
        policyViolations: supervisorReview.policyViolations,
        suggestedModifications: supervisorReview.suggestedModifications,
        reviewedAt: new Date().toISOString(),
      };

      // ONLY escalate if supervisor explicitly says shouldEscalate AND risk is critical
      // Don't escalate just because approved=false (that's just a flag for improvement)
      if (supervisorReview.shouldEscalate && supervisorReview.riskLevel === 'critical') {
        response.shouldEscalate = true;
        response.escalationSummary = {
          reason: supervisorReview.escalationReason || 'Critical issue detected by supervisor',
          customerIssue: customerMessage,
          attemptedResolutions: response.toolCalls.map(t => t.toolName),
          recommendedAction: supervisorReview.suggestedModifications || 'Manual review required',
          priority: 'high',
        };
        response.message = `Hey ${session.customerFirstName}, I want to make sure we handle this perfectly for you. I'm bringing in Monica, our Head of CS, to take a closer look. She'll be in touch shortly! 🙏\n\n${AGENT_SIGNATURE}`;
      }

      // Record supervisor review action
      await this.recordAction(
        sessionId,
        'supervisor_review',
        {
          approved: supervisorReview.approved,
          riskLevel: supervisorReview.riskLevel,
          contradictions: supervisorReview.contradictions,
          policyViolations: supervisorReview.policyViolations,
        },
        'Supervisor Agent'
      );
    }

    // Save agent response
    if (response.message) {
      await this.saveMessage(sessionId, 'agent', response.message, agent.name);
    }

    // Handle escalation
    if (response.shouldEscalate && response.escalationSummary) {
      await this.escalateSession(sessionId, response.escalationSummary);
    }

    // Update context with any new state
    if (response.nextState) {
      await this.updateContext(sessionId, response.nextState);
    }

    return response;
  }

  // Run supervisor review on proposed response
  private async runSupervisorReview(
    session: EmailSession,
    messages: SessionMessage[],
    context: SessionContext | null,
    response: AgentResponse
  ): Promise<SupervisorReview> {
    // First do quick risk checks (no LLM needed)
    const quickCheck = supervisorAgent.quickRiskCheck(response.message, response.toolCalls);

    // Check promise contradictions
    const promiseContradictions = supervisorAgent.checkPromiseContradictions(
      response.message,
      context?.promisesMade || []
    );

    // If quick checks find issues, do full LLM review
    if (quickCheck.hasHighRiskActions || promiseContradictions.length > 0) {
      console.log('[Supervisor] Quick check found issues, running full review...');
    }

    // Run full supervisor review
    const review = await supervisorAgent.reviewResponse({
      customerName: session.customerFirstName,
      sessionId: session.id,
      workflowCategory: session.workflowCategory || 'unknown',
      previousMessages: messages,
      previousToolCalls: await this.getToolCalls(session.id),
      proposedResponse: response.message,
      proposedToolCalls: response.toolCalls,
      promisesMade: context?.promisesMade || [],
    });

    // Merge quick check findings
    if (promiseContradictions.length > 0) {
      review.contradictions = [...review.contradictions, ...promiseContradictions];
      if (review.contradictions.length > 0) {
        review.approved = false;
      }
    }

    console.log('[Supervisor] Review result:', {
      approved: review.approved,
      riskLevel: review.riskLevel,
      contradictions: review.contradictions.length,
      policyViolations: review.policyViolations.length,
    });

    return review;
  }

  // Helper to extract JSON from LLM output (handles markdown code blocks + nested objects)
  private stripMarkdownCodeFence(text: string): string {
    const trimmed = text.trim();
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    return (codeBlockMatch ? codeBlockMatch[1] : trimmed).trim();
  }

  private extractBalancedJSONObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  private extractJSON(text: string): string {
    const cleaned = this.stripMarkdownCodeFence(text);
    return this.extractBalancedJSONObject(cleaned) ?? cleaned;
  }

  // Route message to appropriate category
  private async routeMessage(message: string, history: SessionMessage[]): Promise<RoutingResult> {
    const prompt = `${routerPrompt}

CONVERSATION HISTORY:
${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

NEW MESSAGE:
${message}

Classify this inquiry:`;

    let llmResponse = '';
    try {
      llmResponse = await this.callLLM(prompt, 'router');
      const jsonStr = this.extractJSON(llmResponse);
      const parsed = JSON.parse(jsonStr);
      return {
        category: parsed.category as WorkflowCategory,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
      };
    } catch (e) {
      console.error('Routing parse error:', e, 'Response was:', llmResponse);
      return { category: 'unknown', confidence: 0, reasoning: 'Failed to parse routing response' };
    }
  }

  // Run the specialized agent
  private async runAgent(
    session: EmailSession,
    agent: typeof agentDefinitions[WorkflowCategory],
    messages: SessionMessage[],
    context: SessionContext | null,
    currentMessage: string
  ): Promise<AgentResponse> {
    const customerName = session.customerFirstName;
    const { waitUntil, isEarlyWeek } = getWaitPromise();

    // Build the conversation context
    const conversationHistory = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const contextInfo = context
      ? `
SESSION CONTEXT:
- Promises made: ${JSON.stringify(context.promisesMade)}
- Order data: ${JSON.stringify(context.orderData)}
- Subscription data: ${JSON.stringify(context.subscriptionData)}
- Customer sentiment: ${context.customerSentiment}
- Conversation state: ${JSON.stringify(context.conversationState)}
`
      : '';

    const systemPrompt = `${agent.systemPrompt}

CUSTOMER INFO:
- Name: ${customerName} ${session.customerLastName}
- Email: ${session.customerEmail}
- Shopify Customer ID: ${session.shopifyCustomerId}

CURRENT DAY CONTEXT:
- Wait promise: Ask customer to wait until ${waitUntil}
- Is early week (Mon-Wed): ${isEarlyWeek}

${contextInfo}

AVAILABLE TOOLS:
${agent.tools.map(t => {
      const tool = toolRegistry[t];
      return `- ${t}: ${tool?.description || 'Tool'}\n  Parameters: ${JSON.stringify(tool?.parameters || {})}`;
    }).join('\n')}

ESCALATION TRIGGERS:
${agent.escalationTriggers.map(t => `- ${t}`).join('\n')}

OUTPUT FORMAT (follow exactly):
- To call a tool: TOOL_CALL: {"tool": "tool_name", "params": {...}}
- To escalate: ESCALATE: {"reason": "...", "summary": {...}}
- For customer message: RESPONSE: <your message here>

CRITICAL: You MUST output RESPONSE: followed by your message to the customer.
Even if asking a question, use: RESPONSE: <question>
Always replace {{first_name}} with "${customerName}".
End every message with your signature.`;

    const prompt = `${systemPrompt}

CONVERSATION HISTORY:
${conversationHistory}

LATEST CUSTOMER MESSAGE:
${currentMessage}

Respond to the customer. Output RESPONSE: followed by your message:`;

    try {
      let agentResponse = await this.callLLM(prompt, agent.name);
      const toolCalls: ToolCall[] = [];
      const actions: SessionAction[] = [];
      let shouldEscalate = false;
      let escalationSummary: EscalationSummary | undefined;
      let finalMessage = '';

      // Process tool calls - robust parsing for nested JSON
      const MAX_TOOL_ITERATIONS = 5;
      let toolIteration = 0;
      let lastToolParseError: string | null = null;

      const TRANSIENT_TOOL_ERROR_RE = /Network error|Failed to fetch|timeout|ECONN|ENOTFOUND|502|503|504/i;
      let transientFailureStreak = 0;
      let transientFailureTool: string | null = null;

      while (toolIteration < MAX_TOOL_ITERATIONS) {
        const markerIndex = agentResponse.indexOf('TOOL_CALL:');
        if (markerIndex === -1) break;

        const afterMarker = agentResponse.slice(markerIndex + 'TOOL_CALL:'.length);
        const jsonStr = this.extractJSON(afterMarker);

        let toolRequest: { tool?: string; params?: Record<string, unknown> };
        try {
          toolRequest = JSON.parse(jsonStr);
        } catch (e) {
          lastToolParseError = e instanceof Error ? e.message : String(e);
          const repairPrompt = `${prompt}\n\nYour previous output contained an invalid TOOL_CALL JSON (${lastToolParseError}).\nReturn ONLY one line in this exact format (no markdown, no extra text):\nTOOL_CALL: {\"tool\":\"<tool_name>\",\"params\":{...}}`;
          agentResponse = await this.callLLM(repairPrompt, agent.name);
          toolIteration++;
          continue;
        }

        const toolName = toolRequest.tool;
        const toolParams = (toolRequest.params ?? {}) as Record<string, unknown>;

        if (!toolName || !toolRegistry[toolName]) {
          const toolList = agent.tools.join(', ');
          const repairPrompt = `${prompt}\n\nYou requested an unknown/unavailable tool: ${String(toolName)}.\nAvailable tools: ${toolList}.\nRespond again. If you need a tool, output TOOL_CALL using an available tool; otherwise output RESPONSE.`;
          agentResponse = await this.callLLM(repairPrompt, agent.name);
          toolIteration++;
          continue;
        }

        const tool = toolRegistry[toolName];
        console.log(`[Tool] Executing ${toolName} with params:`, toolParams);
        const result = await tool.execute(toolParams, this.apiUrl);
        console.log(`[Tool] ${toolName} result:`, result);

        // Track transient tool outages (network/system issues). If it happens twice in a row,
        // escalate deterministically rather than getting stuck in repeated tool loops.
        const isTransientFailure =
          !result.success &&
          typeof result.error === 'string' &&
          TRANSIENT_TOOL_ERROR_RE.test(result.error);

        if (result.success) {
          transientFailureStreak = 0;
          transientFailureTool = null;
        } else if (isTransientFailure) {
          if (transientFailureTool === toolName) {
            transientFailureStreak++;
          } else {
            transientFailureTool = toolName;
            transientFailureStreak = 1;
          }

          if (transientFailureStreak >= 2) {
            shouldEscalate = true;
            escalationSummary = {
              reason: 'Tool system temporarily unavailable',
              customerIssue: currentMessage,
              attemptedResolutions: toolCalls.map((t) => t.toolName).concat(toolName),
              recommendedAction: 'Manual lookup and customer follow-up required',
              priority: 'high',
            };
            finalMessage = `Hey ${customerName}, thanks for your patience — I’m having trouble accessing our order system right now, so I can’t verify the details immediately. I’m looping in Monica (our Head of CS) to manually check this for you and get back to you ASAP. 🙏\n\n${AGENT_SIGNATURE}`;
            break;
          }
        }

        // Record tool call
        const toolCall = await this.recordToolCall(
          session.id,
          toolName,
          toolParams,
          result as unknown as Record<string, unknown>
        );
        toolCalls.push(toolCall);

        // Record action if tool was successful
        if (result.success) {
          const action = await this.recordAction(
            session.id,
            `tool_${toolName}`,
            { input: toolParams, output: result.data || {} },
            agent.name
          );
          actions.push(action);
        }

        // Ask agent to continue given tool result (truncate large payloads to avoid context overflow)
        const resultJson = JSON.stringify(result);
        const truncatedResult =
          resultJson.length > 8000
            ? resultJson.slice(0, 8000) + '... [truncated, data too large]'
            : resultJson;
        const followUpPrompt = `${prompt}\n\nTOOL_RESULT for ${toolName}: ${truncatedResult}\n\nBased on this result, respond to the customer. Output RESPONSE: followed by your message.`;
        agentResponse = await this.callLLM(followUpPrompt, agent.name);

        toolIteration++;
      }

      // If we already escalated due to tool outage, skip additional parsing/LLM nudges.
      if (!shouldEscalate) {
        // If the agent kept emitting tool calls but we couldn't complete, force a final RESPONSE
        if (!agentResponse.includes('RESPONSE:') && agentResponse.includes('TOOL_CALL:')) {
          const nudgePrompt = `${prompt}\n\nDo NOT call tools. Provide the final message to the customer now.\nYou MUST output: RESPONSE: <your message>`;
          agentResponse = await this.callLLM(nudgePrompt, agent.name);
        }

        console.log(`[${agent.name}] Final agent response:`, agentResponse.substring(0, 500));
      }

      // Check for escalation (robust JSON parsing)
      const escIndex = agentResponse.indexOf('ESCALATE:');
      if (escIndex !== -1) {
        try {
          const afterMarker = agentResponse.slice(escIndex + 'ESCALATE:'.length);
          const jsonStr = this.extractJSON(afterMarker);
          const escalateData = JSON.parse(jsonStr);
          shouldEscalate = true;
          escalationSummary = {
            reason: escalateData.reason,
            customerIssue: currentMessage,
            attemptedResolutions: toolCalls.map(t => t.toolName),
            recommendedAction: escalateData.summary?.recommendedAction || 'Manual review required',
            priority: escalateData.summary?.priority || 'medium',
          };

          // Generate escalation message for customer
          finalMessage = `Hey ${customerName}, I'm looping in Monica, who is our Head of CS. She'll take it from here. 🙏\n\n${AGENT_SIGNATURE}`;
        } catch (e) {
          console.error('Escalation parse error:', e);
        }
      }

      // Extract final response - try multiple patterns
      // Pattern 1: Explicit RESPONSE: prefix (greedy capture to end or next marker)
      let responseMatch = agentResponse.match(/RESPONSE:\s*([\s\S]+?)(?=TOOL_CALL:|ESCALATE:|$)/);
      if (responseMatch && !shouldEscalate) {
        finalMessage = responseMatch[1]
          .trim()
          .replace(/\{\{first_name\}\}/g, customerName);
      }

      // Pattern 2: If no RESPONSE: prefix but has text, extract intelligently
      if (!finalMessage && !shouldEscalate) {
        // Remove any tool call/result markers and extract clean text
        let cleaned = agentResponse
          .replace(/TOOL_CALL:\s*\{[\s\S]*?\}/g, '')
          .replace(/TOOL_RESULT[\s\S]*?(?=\n\n|$)/g, '')
          .replace(/```[\s\S]*?```/g, '') // Remove code blocks
          .trim();

        // If the response is just a normal message (no special markers), use it
        if (cleaned && !cleaned.includes('TOOL_CALL:') && !cleaned.includes('ESCALATE:')) {
          finalMessage = cleaned.replace(/\{\{first_name\}\}/g, customerName);
        }
      }

      // Pattern 3: If still no message, the agent might have output raw text - use the last paragraph
      if (!finalMessage && !shouldEscalate && agentResponse.trim()) {
        const paragraphs = agentResponse.split(/\n\n+/).filter(p =>
          p.trim() &&
          !p.includes('TOOL_CALL:') &&
          !p.includes('TOOL_RESULT') &&
          !p.startsWith('{')
        );
        if (paragraphs.length > 0) {
          finalMessage = paragraphs[paragraphs.length - 1]
            .trim()
            .replace(/\{\{first_name\}\}/g, customerName);
        }
      }

      // Final safety net: never return an empty customer message.
      if (!finalMessage && !shouldEscalate) {
        finalMessage = `Hi ${customerName}, thanks for reaching out — could you please confirm the order number and the email used at checkout so I can locate the order and help you from there?\n\n${AGENT_SIGNATURE}`;
      }

      return {
        message: finalMessage,
        toolCalls,
        actions,
        shouldEscalate,
        escalationSummary,
      };
    } catch (e) {
      console.error('Agent error:', e);
      return {
        message: `Hi ${customerName}, I apologize but I'm having some trouble processing your request. Let me get a team member to help you.${AGENT_SIGNATURE}`,
        toolCalls: [],
        actions: [],
        shouldEscalate: true,
        escalationSummary: {
          reason: 'Agent processing error',
          customerIssue: currentMessage,
          attemptedResolutions: [],
          recommendedAction: 'Manual review - agent error',
          priority: 'high',
        },
      };
    }
  }

  // Call LLM via edge function (uses OpenAI key from Supabase secrets)
  private async callLLM(prompt: string, agentName: string): Promise<string> {
    console.log(`[${agentName}] Calling LLM via edge function, prompt length: ${prompt.length}`);

    const { data, error } = await supabase.functions.invoke('chat', {
      body: { prompt, agentName },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(`LLM call failed: ${error.message}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data.content || '';
  }

  // Helper methods for database operations
  private async saveMessage(
    sessionId: string,
    role: 'customer' | 'agent' | 'system',
    content: string,
    agentName?: string
  ): Promise<SessionMessage> {
    const { data, error } = await supabase
      .from('session_messages')
      .insert({ session_id: sessionId, role, content, agent_name: agentName })
      .select()
      .single();

    if (error) throw error;
    return this.mapMessage(data);
  }

  private async recordToolCall(
    sessionId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    toolOutput: Record<string, unknown>
  ): Promise<ToolCall> {
    // Cast to any to satisfy Supabase's strict Json type requirements
    const insertData = {
      session_id: sessionId,
      tool_name: toolName,
      tool_input: JSON.parse(JSON.stringify(toolInput)),
      tool_output: JSON.parse(JSON.stringify(toolOutput)),
      success: (toolOutput as { success?: boolean }).success ?? false,
      error_message: (toolOutput as { error?: string }).error,
    };

    const { data, error } = await supabase
      .from('tool_calls')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return this.mapToolCall(data);
  }

  private async recordAction(
    sessionId: string,
    actionType: string,
    actionDetails: Record<string, unknown>,
    performedBy: string
  ): Promise<SessionAction> {
    const insertData = {
      session_id: sessionId,
      action_type: actionType,
      action_details: JSON.parse(JSON.stringify(actionDetails)),
      performed_by: performedBy,
    };

    const { data, error } = await supabase
      .from('session_actions')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return this.mapAction(data);
  }

  private async escalateSession(sessionId: string, summary: EscalationSummary): Promise<void> {
    await supabase
      .from('email_sessions')
      .update({
        is_escalated: true,
        escalation_reason: summary.reason,
        escalation_summary: JSON.parse(JSON.stringify(summary)),
      })
      .eq('id', sessionId);
  }

  private async updateContext(sessionId: string, state: Record<string, unknown>): Promise<void> {
    const existing = await this.getSessionContext(sessionId);
    const mergedState = { ...existing?.conversationState, ...state };
    await supabase
      .from('session_context')
      .update({
        conversation_state: JSON.parse(JSON.stringify(mergedState)),
      })
      .eq('session_id', sessionId);
  }

  // Mapping functions
  private mapSession(data: Record<string, unknown>): EmailSession {
    return {
      id: data.id as string,
      customerEmail: data.customer_email as string,
      customerFirstName: data.customer_first_name as string,
      customerLastName: data.customer_last_name as string,
      shopifyCustomerId: data.shopify_customer_id as string,
      subject: data.subject as string | undefined,
      workflowCategory: data.workflow_category as WorkflowCategory | undefined,
      isEscalated: data.is_escalated as boolean,
      escalationReason: data.escalation_reason as string | undefined,
      escalationSummary: data.escalation_summary as EscalationSummary | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      conversationId: data.conversation_id as string | undefined,
      conversationType: data.conversation_type as string | undefined,
      rawConversation: data.raw_conversation as string | undefined,
    };
  }

  private mapMessage(data: Record<string, unknown>): SessionMessage {
    return {
      id: data.id as string,
      sessionId: data.session_id as string,
      role: data.role as 'customer' | 'agent' | 'system',
      content: data.content as string,
      agentName: data.agent_name as string | undefined,
      createdAt: data.created_at as string,
    };
  }

  private mapToolCall(data: Record<string, unknown>): ToolCall {
    return {
      id: data.id as string,
      sessionId: data.session_id as string,
      messageId: data.message_id as string | undefined,
      toolName: data.tool_name as string,
      toolInput: data.tool_input as Record<string, unknown>,
      toolOutput: data.tool_output as Record<string, unknown> | undefined,
      success: data.success as boolean | undefined,
      errorMessage: data.error_message as string | undefined,
      createdAt: data.created_at as string,
    };
  }

  private mapAction(data: Record<string, unknown>): SessionAction {
    return {
      id: data.id as string,
      sessionId: data.session_id as string,
      actionType: data.action_type as string,
      actionDetails: data.action_details as Record<string, unknown>,
      performedBy: data.performed_by as string,
      createdAt: data.created_at as string,
    };
  }

  private mapContext(data: Record<string, unknown>): SessionContext {
    return {
      id: data.id as string,
      sessionId: data.session_id as string,
      promisesMade: (data.promises_made as string[]) || [],
      orderData: data.order_data as SessionContext['orderData'],
      subscriptionData: data.subscription_data as SessionContext['subscriptionData'],
      customerSentiment: data.customer_sentiment as string | undefined,
      conversationState: (data.conversation_state as Record<string, unknown>) || {},
      updatedAt: data.updated_at as string,
    };
  }
}
