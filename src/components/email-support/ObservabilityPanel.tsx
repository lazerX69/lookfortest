import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToolCall, SessionAction, SupervisorReviewResult } from '@/lib/agents/types';
import { CheckCircle, XCircle, Wrench, Zap, Shield, AlertTriangle } from 'lucide-react';

interface ObservabilityPanelProps {
  toolCalls: ToolCall[];
  actions: SessionAction[];
  supervisorReview?: SupervisorReviewResult;
}

export function ObservabilityPanel({ toolCalls, actions, supervisorReview }: ObservabilityPanelProps) {
  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      {/* Supervisor Review Card */}
      <Card className={supervisorReview && !supervisorReview.approved ? 'border-destructive' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Supervisor Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!supervisorReview ? (
            <p className="text-sm text-muted-foreground">No review yet</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
              {supervisorReview.approved ? (
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approved
                </Badge>
              ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Rejected
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">Risk Level:</span>
                <Badge variant={getRiskBadgeVariant(supervisorReview.riskLevel)}>
                  {supervisorReview.riskLevel.toUpperCase()}
                </Badge>
              </div>

              {supervisorReview.contradictions.length > 0 && (
                <div className="space-y-1">
                  <span className="text-sm font-medium flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    Contradictions:
                  </span>
                  <ul className="text-xs text-destructive list-disc list-inside">
                    {supervisorReview.contradictions.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {supervisorReview.policyViolations.length > 0 && (
                <div className="space-y-1">
                  <span className="text-sm font-medium flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    Policy Violations:
                  </span>
                  <ul className="text-xs text-destructive list-disc list-inside">
                    {supervisorReview.policyViolations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}

              {supervisorReview.suggestedModifications && (
                <div className="space-y-1">
                  <span className="text-sm font-medium">Suggestions:</span>
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    {supervisorReview.suggestedModifications}
                  </p>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Reviewed at: {new Date(supervisorReview.reviewedAt).toLocaleTimeString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tool Calls Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Tool Calls ({toolCalls.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {toolCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tool calls yet</p>
            ) : (
              <div className="space-y-3">
                {toolCalls.map((call) => (
                  <div
                    key={call.id}
                    className="border rounded-lg p-3 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium">{call.toolName}</span>
                    {call.success ? (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Success
                      </Badge>
                    ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Input:</span>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(call.toolInput, null, 2)}
                      </pre>
                    </div>
                    {call.toolOutput && (
                      <div>
                        <span className="text-muted-foreground">Output:</span>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto max-h-24">
                          {JSON.stringify(call.toolOutput, null, 2)}
                        </pre>
                      </div>
                    )}
                    {call.errorMessage && (
                      <div className="text-destructive">
                        Error: {call.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Actions Taken ({actions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions taken yet</p>
            ) : (
              <div className="space-y-2">
                {actions.map((action) => (
                  <div
                    key={action.id}
                    className="border rounded-lg p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant={action.actionType === 'supervisor_review' ? 'secondary' : 'outline'}
                      >
                        {action.actionType}
                      </Badge>
                      <span className="text-muted-foreground">
                        {action.performedBy}
                      </span>
                    </div>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(action.actionDetails, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
