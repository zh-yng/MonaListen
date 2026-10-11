import { useState } from 'react';
import { Check, Loader2, Sparkles, Trash2 } from 'lucide-react';
import type { SoundRegion } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGION_COLORS, audioReady, regionValid } from '@/lib/regions';

interface Props {
  r: SoundRegion; index: number; selected: boolean; previewing: boolean; previewError: string | null;
  onSelect: () => void; onChange: (patch: Partial<SoundRegion>) => void; onDelete: () => void;
  onPreview: (duration: number) => void;
}

function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><div className="flex justify-between"><Label>{label}</Label>{value && <span className="font-mono-ui text-xs text-muted-foreground">{value}</span>}</div>{children}</div>;
}

export function RegionCard({ r, index, selected, previewing, previewError, onSelect, onChange, onDelete, onPreview }: Props) {
  const [dur, setDur] = useState(10);
  const color = REGION_COLORS[index % REGION_COLORS.length];
  const ready = audioReady(r);
  const stale = !!r.audioUrl && r.audioPrompt !== r.prompt;
  const id = r.id;
  return (
    <div className={`rounded-lg border bg-card transition-shadow ${selected ? 'shadow-lg ring-2 ring-ring/60' : ''}`} data-testid={`region-${id}`}>
      <button type="button" onClick={onSelect} aria-expanded={selected} className="flex w-full items-center gap-3 p-3 text-left" data-testid={`button-select-${id}`}>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `hsl(${color})` }} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{r.name || 'Untitled region'}</span>
        {!regionValid(r) && <Badge variant="destructive">Shape incomplete</Badge>}
        <Badge variant={ready ? 'default' : 'secondary'}>{ready ? 'Approved' : r.audioUrl ? 'Needs approval' : 'No audio'}</Badge>
      </button>
      {selected && (
        <div className="space-y-5 border-t p-4">
          <div className="space-y-2"><Label htmlFor={`n-${id}`}>Name</Label><Input id={`n-${id}`} value={r.name} maxLength={100} onChange={(e) => onChange({ name: e.target.value })} data-testid={`input-region-name-${id}`} /></div>
          <div className="space-y-2"><Label htmlFor={`d-${id}`}>What is here (notes for you)</Label><Textarea id={`d-${id}`} rows={2} value={r.description} maxLength={2000} onChange={(e) => onChange({ description: e.target.value })} data-testid={`input-region-desc-${id}`} /></div>

          <div className="space-y-2">
            <Label htmlFor={`p-${id}`}>Sound prompt</Label>
            <Textarea id={`p-${id}`} rows={3} value={r.prompt} maxLength={2000} placeholder="A slow rolling tide of low cello, with distant gulls" onChange={(e) => onChange({ prompt: e.target.value, approved: false })} data-testid={`input-region-prompt-${id}`} />
            <p className="text-xs text-muted-foreground">Editing the prompt clears the approval for this region.</p>
          </div>

          <div className="space-y-3 rounded-md bg-muted/60 p-3">
            <Row label="Preview length" value={`${dur}s`}><Slider min={1} max={30} step={1} value={[dur]} onValueChange={([v]) => setDur(v)} data-testid={`slider-duration-${id}`} /></Row>
            <Button variant="secondary" onClick={() => onPreview(dur)} disabled={previewing || r.prompt.trim().length < 3} data-testid={`button-preview-${id}`}>
              {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{r.audioUrl ? 'Generate a new take' : 'Generate preview'}
            </Button>
            {previewError && <p role="alert" className="text-sm text-destructive" data-testid={`error-preview-${id}`}>{previewError}</p>}
            {r.audioUrl && (
              <div className="space-y-2">
                <audio src={r.audioUrl} controls loop className="w-full" aria-label={`Looping preview of ${r.name}`} data-testid={`audio-${id}`} />
                {stale && <p className="text-xs text-destructive">This take was made from an older prompt. Generate again before approving.</p>}
                <Button onClick={() => onChange({ approved: true })} disabled={ready || stale} variant={ready ? 'outline' : 'default'} data-testid={`button-approve-${id}`}>
                  <Check className="mr-2 h-4 w-4" />{ready ? 'Approved for publishing' : 'Approve this exact audio'}
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Row label="Volume" value={r.volume.toFixed(2)}><Slider min={0} max={1} step={0.01} value={[r.volume]} onValueChange={([v]) => onChange({ volume: v })} data-testid={`slider-volume-${id}`} /></Row>
            <Row label="Reach (radius)" value={r.radius.toFixed(2)}><Slider min={0.001} max={2} step={0.01} value={[r.radius]} onValueChange={([v]) => onChange({ radius: v })} data-testid={`slider-radius-${id}`} /></Row>
            <Row label="Stereo pan" value={r.pan.toFixed(2)}><Slider min={-1} max={1} step={0.05} value={[r.pan]} onValueChange={([v]) => onChange({ pan: v })} data-testid={`slider-pan-${id}`} /></Row>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <Label htmlFor={`c-${id}`}>Smooth spline</Label>
              <Switch id={`c-${id}`} checked={r.curved} onCheckedChange={(v) => onChange({ curved: v })} data-testid={`switch-curved-${id}`} />
            </div>
            <div className="space-y-2"><Label>Shape type</Label>
              <Select value={r.kind} onValueChange={(v) => onChange({ kind: v as SoundRegion['kind'] })}>
                <SelectTrigger data-testid={`select-kind-${id}`}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="polygon">Polygon (filled area)</SelectItem><SelectItem value="path">Path (line)</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-2"><Label>Falloff from</Label>
              <Select value={r.falloffMode} onValueChange={(v) => onChange({ falloffMode: v as SoundRegion['falloffMode'] })}>
                <SelectTrigger data-testid={`select-falloff-mode-${id}`}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="interior">Region shape</SelectItem><SelectItem value="source">A single source point</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-2"><Label>Falloff curve</Label>
              <Select value={r.falloffCurve} onValueChange={(v) => onChange({ falloffCurve: v as SoundRegion['falloffCurve'] })}>
                <SelectTrigger data-testid={`select-falloff-curve-${id}`}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="linear">Linear</SelectItem><SelectItem value="smooth">Smooth</SelectItem><SelectItem value="exponential">Exponential</SelectItem></SelectContent>
              </Select></div>
          </div>
          {r.falloffMode === 'source' && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Row label="Source X" value={r.sourceX.toFixed(2)}><Slider min={0} max={1} step={0.005} value={[r.sourceX]} onValueChange={([v]) => onChange({ sourceX: v })} data-testid={`slider-sx-${id}`} /></Row>
              <Row label="Source Y" value={r.sourceY.toFixed(2)}><Slider min={0} max={1} step={0.005} value={[r.sourceY]} onValueChange={([v]) => onChange({ sourceY: v })} data-testid={`slider-sy-${id}`} /></Row>
            </div>
          )}
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete} data-testid={`button-delete-region-${id}`}><Trash2 className="mr-2 h-4 w-4" />Delete region</Button>
        </div>
      )}
    </div>
  );
}
