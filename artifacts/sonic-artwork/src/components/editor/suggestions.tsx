import { Check, Pencil, X } from 'lucide-react';
import type { SoundRegion } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';

export function Suggestions({ altText, regions, onUseAlt, onDismissAlt, onAccept, onEdit, onDiscard, full }: {
  altText: string | null; regions: SoundRegion[]; full: boolean;
  onUseAlt: () => void; onDismissAlt: () => void;
  onAccept: (r: SoundRegion) => void; onEdit: (r: SoundRegion) => void; onDiscard: (id: string) => void;
}) {
  if (!altText && regions.length === 0) return null;
  return (
    <section aria-label="Gemini suggestions" className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4" data-testid="panel-suggestions">
      <h3 className="font-display text-lg font-semibold">Suggestions from Gemini</h3>
      <p className="text-xs text-muted-foreground">Nothing is applied until you accept it.{full && ' The region limit has been reached.'}</p>
      {altText && (
        <div className="rounded border bg-card p-3" data-testid="suggestion-alt">
          <p className="font-mono-ui text-[11px] uppercase tracking-wider text-muted-foreground">Alt text</p>
          <p className="mt-1 text-sm">{altText}</p>
          <div className="mt-2 flex gap-2"><Button size="sm" onClick={onUseAlt} data-testid="button-use-alt">Use this</Button><Button size="sm" variant="ghost" onClick={onDismissAlt} data-testid="button-dismiss-alt">Discard</Button></div>
        </div>
      )}
      {regions.map((r) => (
        <div key={r.id} className="rounded border bg-card p-3" data-testid={`suggestion-region-${r.id}`}>
          <p className="font-medium">{r.name} <span className="font-mono-ui text-xs text-muted-foreground">{r.kind}, {r.points.length} points</span></p>
          {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
          {r.prompt && <p className="mt-1 text-sm italic">"{r.prompt}"</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={full} onClick={() => onAccept(r)} data-testid={`button-accept-${r.id}`}><Check className="mr-1 h-3.5 w-3.5" />Accept</Button>
            <Button size="sm" variant="outline" disabled={full} onClick={() => onEdit(r)} data-testid={`button-edit-suggestion-${r.id}`}><Pencil className="mr-1 h-3.5 w-3.5" />Accept and edit</Button>
            <Button size="sm" variant="ghost" onClick={() => onDiscard(r.id)} data-testid={`button-discard-${r.id}`}><X className="mr-1 h-3.5 w-3.5" />Discard</Button>
          </div>
        </div>
      ))}
    </section>
  );
}
