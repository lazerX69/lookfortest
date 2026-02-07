// Core types for the multi-agent email support system

export type WorkflowCategory = 
  | 'shipping_delay'
  | 'wrong_missing_item'
  | 'product_issue_no_effect'
  | 'refund_request'
  | 'order_modification'
  | 'positive_feedback'
  | 'subscription_billing'
  | 'discount_code'
  | 'unknown';

export interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  shopifyCustomerId: string;
}

export interface EmailSession {
  id: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  shopifyCustomerId: string;
  subject?: string;
  workflowCategory?: WorkflowCategory;
  isEscalated: boolean;
  escalationReason?: string;
  escalationSummary?: EscalationSummary;
  createdAt: string;
  updatedAt: string;
  conversationId?: string;
  conversationType?: string;
  rawConversation?: string;
}

// Imported ticket from dataset
export interface ImportedTicket {
  id: string;
  conversationId: string;
  customerId: string;
  createdAt: string;
  originalCreatedAt: string;
  conversationType: string;
  subject: string;
  rawConversation: string;
  importedAt: string;
}

// Raw ticket from dataset JSON
export interface RawTicket {
  conversationId: string;
  customerId: string;
  createdAt: string;
  conversationType: string;
  subject: string;
  conversation: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'customer' | 'agent' | 'system';
  content: string;
  agentName?: string;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  sessionId: string;
  messageId?: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
  createdAt: string;
}

export interface SessionAction {
  id: string;
  sessionId: string;
  actionType: string;
  actionDetails: Record<string, unknown>;
  performedBy: string;
  createdAt: string;
}

export interface SessionContext {
  id: string;
  sessionId: string;
  promisesMade: string[];
  orderData?: OrderData;
  subscriptionData?: SubscriptionData;
  customerSentiment?: string;
  conversationState: Record<string, unknown>;
  updatedAt: string;
}

export interface OrderData {
  id: string;
  name: string;
  status: 'FULFILLED' | 'UNFULFILLED' | 'CANCELLED' | 'DELIVERED';
  createdAt: string;
  trackingUrl?: string;
}

export interface SubscriptionData {
  status: string;
  subscriptionId: string;
  nextBillingDate?: string;
}

export interface EscalationSummary {
  reason: string;
  customerIssue: string;
  attemptedResolutions: string[];
  recommendedAction: string;
  priority: 'low' | 'medium' | 'high';
}

export interface AgentResponse {
  message: string;
  toolCalls: ToolCall[];
  actions: SessionAction[];
  shouldEscalate: boolean;
  escalationSummary?: EscalationSummary;
  nextState?: Record<string, unknown>;
  supervisorReview?: SupervisorReviewResult;
}

export interface SupervisorReviewResult {
  approved: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  contradictions: string[];
  policyViolations: string[];
  suggestedModifications?: string;
  reviewedAt: string;
}

export interface RoutingResult {
  category: WorkflowCategory;
  confidence: number;
  reasoning: string;
}

// Tool definitions
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, apiUrl: string) => Promise<ToolResponse>;
}

export interface ToolResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// Agent definition
export interface AgentDefinition {
  name: string;
  category: WorkflowCategory;
  systemPrompt: string;
  tools: string[];
  escalationTriggers: string[];
}

// Day of week helper
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
