import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmailSession } from '@/lib/agents/types';
import { Mail, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SessionListProps {
  sessions: EmailSession[];
  currentSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onClearSessions: () => void;
}

const categoryLabels: Record<string, string> = {
  shipping_delay: 'Shipping',
  wrong_missing_item: 'Wrong/Missing',
  product_issue_no_effect: 'Product Issue',
  refund_request: 'Refund',
  order_modification: 'Order Mod',
  positive_feedback: 'Feedback ✨',
  subscription_billing: 'Subscription',
  discount_code: 'Discount',
  unknown: 'Unclassified',
};

export function SessionList({ sessions, currentSessionId, onSelectSession, onClearSessions }: SessionListProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Sessions ({sessions.length})
          </div>
          {sessions.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all active sessions? Imported tickets will be preserved.')) {
                  onClearSessions();
                }
              }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              title="Clear all active sessions"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No sessions yet</p>
          ) : (
            <div className="space-y-1 p-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${currentSessionId === session.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">
                      {session.customerFirstName} {session.customerLastName}
                    </span>
                    {session.isEscalated ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mb-2">
                    {session.subject || session.customerEmail}
                  </div>
                  <div className="flex items-center justify-between">
                    {session.workflowCategory && (
                      <Badge variant="secondary" className="text-xs">
                        {categoryLabels[session.workflowCategory] || session.workflowCategory}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
