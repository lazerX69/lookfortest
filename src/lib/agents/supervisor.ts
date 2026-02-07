// Supervisor Agent - Reviews responses before sending
import { supabase } from '@/integrations/supabase/client';
import { SessionMessage, ToolCall, EscalationSummary, AgentResponse } from './types';

export interface SupervisorReview {
  approved: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  contradictions: string[];
  policyViolations: string[];
  suggestedModifications?: string;
  shouldEscalate: boolean;
  escalationReason?: string;
}

export interface SupervisorContext {
  customerName: string;
  sessionId: string;
  workflowCategory: string;
  previousMessages: SessionMessage[];
  previousToolCalls: ToolCall[];
  proposedResponse: string;
  proposedToolCalls: ToolCall[];
  promisesMade: string[];
}

const SUPERVISOR_PROMPT = `You are a Supervisor Agent for NATPAT customer support.
Your role is to REVIEW agent responses BEFORE they are sent to customers.

IMPORTANT: Your job is to ASSIST agents, not block them. You should HELP them improve, not reject them.

YOUR RESPONSIBILITIES:
1. CONTRADICTION CHECK: Ensure the response doesn't contradict previous messages or promises
2. POLICY COMPLIANCE: Verify the response follows workflow manual rules
3. RISK ASSESSMENT: Identify high-risk actions (refunds, cancellations, escalations)
4. TONE VALIDATION: Ensure professional, empathetic communication

WHAT MAKES A GOOD AGENT RESPONSE:
- Agent asks clarifying questions when info is missing - EXCELLENT
- Agent asks for order number before making promises - EXCELLENT
- Agent uses tools to verify before taking action - EXCELLENT
- Agent is friendly and helpful - EXCELLENT
- Agent gathers information step by step - EXCELLENT

APPROVE THESE RESPONSES (approved=true):
- Agent is asking for order number or more details - APPROVE
- Agent is asking clarifying questions - APPROVE
- Agent is following the workflow steps in order - APPROVE
- Agent is being helpful and professional - APPROVE
- Agent is gathering information before taking action - APPROVE
- Minor wording differences from templates - APPROVE
- Agent asks customer to verify or provide info - APPROVE

FLAG BUT DON'T ESCALATE (approved=false, shouldEscalate=false):
- Agent makes promises WITHOUT first verifying order details
- Agent offers refund/resend without looking up the order
- Response could be improved but is acceptable
- Minor policy deviations that don't harm customer

ESCALATE ONLY FOR CRITICAL ISSUES (shouldEscalate=true):
- Customer mentions legal action, lawyer, suing
- Customer mentions medical issues or adverse reactions
- Customer threatens social media exposure
- Agent made a promise that DIRECTLY contradicts a previous promise
- Potential fraud detected

RISK LEVELS:
- LOW: Asking questions, status updates, positive interactions, gathering info
- MEDIUM: Discussing options, minor complaints, general assistance
- HIGH: Refund discussions after verification, subscription changes, upset customer
- CRITICAL: Legal threats, medical issues, fraud (ONLY this level should escalate)

OUTPUT FORMAT (JSON):
{
  "approved": true,
  "riskLevel": "low",
  "contradictions": [],
  "policyViolations": [],
  "suggestedModifications": null,
  "shouldEscalate": false,
  "escalationReason": null
}

CRITICAL RULES:
- DEFAULT TO APPROVED=TRUE for interactive, question-asking responses
- shouldEscalate should ONLY be true for CRITICAL risk level
- Asking questions is GOOD behavior, always approve it
- Don't flag responses just for being cautious or asking for info
- If agent is gathering information, that's the RIGHT behavior`;

export class SupervisorAgent {
  
  async reviewResponse(context: SupervisorContext): Promise<SupervisorReview> {
    const prompt = this.buildReviewPrompt(context);
    
    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { 
          prompt, 
          agentName: 'Supervisor',
          temperature: 0.1 // Low temperature for consistent reviews
        },
      });

      if (error || data.error) {
        console.error('Supervisor review error:', error || data.error);
        // Default to cautious approval on error
        return this.getDefaultReview('medium');
      }

      return this.parseReview(data.content);
    } catch (e) {
      console.error('Supervisor exception:', e);
      return this.getDefaultReview('medium');
    }
  }

  private buildReviewPrompt(context: SupervisorContext): string {
    const conversationHistory = context.previousMessages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const toolCallHistory = context.previousToolCalls
      .map(t => `- ${t.toolName}: ${t.success ? 'SUCCESS' : 'FAILED'} - ${JSON.stringify(t.toolInput)}`)
      .join('\n');

    const proposedTools = context.proposedToolCalls
      .map(t => `- ${t.toolName}: ${JSON.stringify(t.toolInput)}`)
      .join('\n');

    return `${SUPERVISOR_PROMPT}

REVIEW REQUEST:
===============

CUSTOMER: ${context.customerName}
SESSION ID: ${context.sessionId}
WORKFLOW: ${context.workflowCategory}

PREVIOUS CONVERSATION:
${conversationHistory || 'No previous messages'}

PREVIOUS TOOL CALLS:
${toolCallHistory || 'No previous tool calls'}

PROMISES MADE TO CUSTOMER:
${context.promisesMade.length > 0 ? context.promisesMade.join('\n') : 'None recorded'}

PROPOSED RESPONSE TO REVIEW:
"""
${context.proposedResponse}
"""

PROPOSED TOOL CALLS:
${proposedTools || 'None'}

Review this response and provide your assessment:`;
  }

  private parseReview(content: string): SupervisorReview {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          approved: parsed.approved ?? true,
          riskLevel: parsed.riskLevel ?? 'medium',
          contradictions: parsed.contradictions ?? [],
          policyViolations: parsed.policyViolations ?? [],
          suggestedModifications: parsed.suggestedModifications,
          shouldEscalate: parsed.shouldEscalate ?? false,
          escalationReason: parsed.escalationReason,
        };
      }
    } catch (e) {
      console.error('Failed to parse supervisor review:', e);
    }
    
    return this.getDefaultReview('medium');
  }

  private getDefaultReview(riskLevel: SupervisorReview['riskLevel']): SupervisorReview {
    return {
      approved: true,
      riskLevel,
      contradictions: [],
      policyViolations: [],
      shouldEscalate: false,
    };
  }

  // Quick risk checks that don't need LLM
  quickRiskCheck(response: string, toolCalls: ToolCall[]): { 
    hasHighRiskActions: boolean; 
    reasons: string[] 
  } {
    const reasons: string[] = [];
    
    // Check for high-risk tool usage
    const highRiskTools = ['shopify_refund_order', 'shopify_cancel_order', 'skio_cancel_subscription'];
    for (const call of toolCalls) {
      if (highRiskTools.includes(call.toolName)) {
        reasons.push(`High-risk action: ${call.toolName}`);
      }
    }

    // Check for sensitive keywords in response
    const sensitivePatterns = [
      { pattern: /refund.*full/i, reason: 'Full refund mentioned' },
      { pattern: /cancel.*subscription/i, reason: 'Subscription cancellation' },
      { pattern: /legal|lawyer|attorney/i, reason: 'Legal terms detected' },
      { pattern: /compensat/i, reason: 'Compensation discussed' },
      { pattern: /free.*replacement/i, reason: 'Free replacement offered' },
    ];

    for (const { pattern, reason } of sensitivePatterns) {
      if (pattern.test(response)) {
        reasons.push(reason);
      }
    }

    return {
      hasHighRiskActions: reasons.length > 0,
      reasons,
    };
  }

  // Check for contradictions with promises
  checkPromiseContradictions(
    response: string, 
    promisesMade: string[]
  ): string[] {
    const contradictions: string[] = [];
    
    // Simple heuristic checks
    for (const promise of promisesMade) {
      // If promised to wait and now offering immediate action
      if (promise.includes('wait') && response.match(/immediately|right now|today/i)) {
        contradictions.push(`Previously promised to wait, but now offering immediate action`);
      }
      
      // If promised store credit but now offering cash
      if (promise.includes('store credit') && response.match(/cash refund|original payment/i)) {
        contradictions.push(`Previously offered store credit, now offering cash refund`);
      }
    }

    return contradictions;
  }
}

export const supervisorAgent = new SupervisorAgent();
