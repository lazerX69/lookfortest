import { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SessionMessage, EmailSession } from '@/lib/agents/types';
import { MessageSquare, User, Bot, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MessageThreadProps {
  session: EmailSession | null;
  messages: SessionMessage[];
}

export function MessageThread({ session, messages }: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!session) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <div className="text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a session or create a new one</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {session.customerFirstName} {session.customerLastName}
          </CardTitle>
          {session.isEscalated && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Escalated
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {session.customerEmail} • {session.subject || 'No subject'}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-380px)]" ref={scrollRef}>
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet. Send a customer message to start.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'customer' ? '' : 'flex-row-reverse'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'customer'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-green-100 text-green-600'
                    }`}
                  >
                    {message.role === 'customer' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`flex-1 max-w-[80%] ${
                      message.role === 'customer' ? '' : 'text-right'
                    }`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg text-sm ${
                        message.role === 'customer'
                          ? 'bg-blue-50 text-blue-900'
                          : 'bg-green-50 text-green-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                      {message.agentName && (
                        <Badge variant="outline" className="text-xs">
                          {message.agentName}
                        </Badge>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(message.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}

            {session.isEscalated && session.escalationSummary && (
              <div className="border-t pt-4 mt-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Escalation Summary
                  </h4>
                  <div className="text-sm text-amber-700 space-y-1">
                    <p><strong>Reason:</strong> {session.escalationSummary.reason}</p>
                    <p><strong>Issue:</strong> {session.escalationSummary.customerIssue}</p>
                    <p><strong>Recommended:</strong> {session.escalationSummary.recommendedAction}</p>
                    <p><strong>Priority:</strong> 
                      <Badge 
                        variant={session.escalationSummary.priority === 'high' ? 'destructive' : 'secondary'}
                        className="ml-2"
                      >
                        {session.escalationSummary.priority}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
