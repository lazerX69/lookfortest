import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { fetchTicketsFromFile, importTickets, getImportedTickets, createSessionFromTicket } from '@/lib/agents';
import { Upload, Database, Play } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ImportTicketsDialogProps {
  onSessionCreated: (sessionId: string) => void;
}

export function ImportTicketsDialog({ onSessionCreated }: ImportTicketsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [tickets, setTickets] = useState<Array<{ id: string; conversationId: string; subject: string; customerId: string }>>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const rawTickets = await fetchTicketsFromFile();
      if (rawTickets.length === 0) {
        toast({
          title: 'No Tickets Found',
          description: 'Could not load tickets from the data file',
          variant: 'destructive',
        });
        return;
      }

      const result = await importTickets(rawTickets);
      setImportedCount(result.imported);
      
      toast({
        title: 'Import Complete',
        description: `Imported ${result.imported} tickets, skipped ${result.skipped} duplicates`,
      });

      // Reload imported tickets list
      await loadImportedTickets();
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const loadImportedTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const imported = await getImportedTickets();
      setTickets(imported.map(t => ({
        id: t.id,
        conversationId: t.conversationId,
        subject: t.subject,
        customerId: t.customerId,
      })));
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleStartSession = async (ticketId: string) => {
    try {
      const imported = await getImportedTickets();
      const ticket = imported.find(t => t.id === ticketId);
      if (!ticket) return;

      const sessionId = await createSessionFromTicket(ticket);
      if (sessionId) {
        toast({
          title: 'Session Created',
          description: 'Created session from imported ticket',
        });
        onSessionCreated(sessionId);
        setOpen(false);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create session from ticket',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) loadImportedTickets();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Database className="h-4 w-4 mr-2" />
          Import Tickets
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Dataset Tickets</DialogTitle>
          <DialogDescription>
            Import tickets from the hackathon dataset and create test sessions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={handleImport} disabled={isImporting}>
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? 'Importing...' : 'Import from Dataset'}
            </Button>
            {importedCount !== null && (
              <Badge variant="secondary">{importedCount} imported</Badge>
            )}
          </div>

          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted">
              <h4 className="font-medium text-sm">Imported Tickets ({tickets.length})</h4>
            </div>
            <ScrollArea className="h-[300px]">
              {isLoadingTickets ? (
                <p className="p-4 text-sm text-muted-foreground">Loading...</p>
              ) : tickets.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No tickets imported yet. Click "Import from Dataset" to load them.
                </p>
              ) : (
                <div className="divide-y">
                  {tickets.slice(0, 50).map((ticket) => (
                    <div key={ticket.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ticket.subject || '(no subject)'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {ticket.customerId} • {ticket.conversationId.slice(0, 20)}...
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartSession(ticket.id)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Test
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
