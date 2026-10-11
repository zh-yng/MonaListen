import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api-error';

export function QueryError({ error, onRetry, title = 'Could not load this' }: { error: unknown; onRetry: () => void; title?: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-6" data-testid="status-error">
      <AlertTriangle className="mb-3 h-5 w-5 text-destructive" />
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{errorMessage(error)}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry} data-testid="button-retry">Try again</Button>
    </div>
  );
}
