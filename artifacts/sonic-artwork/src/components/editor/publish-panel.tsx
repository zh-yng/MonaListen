import { useState } from 'react';
import { CheckCircle2, Circle, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import type { PublishedVersion } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface Check { ok: boolean; label: string; hint?: string }
export function PublishPanel({ checks, dirty, compiling, progress, compileError, onCompile, onReview, needsReview, publishing, onPublish, versions, onActivate, activating, hasTarget }: {
  checks: Check[]; dirty: boolean; compiling: boolean; progress: number; compileError: string | null; hasTarget: boolean;
  onCompile: () => void; onReview: () => void; needsReview: boolean; publishing: boolean; onPublish: () => void;
  versions: PublishedVersion[]; onActivate: (v: number) => void; activating: boolean;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const ready = checks.every((c) => c.ok) && !dirty;
  return (
    <section aria-label="Publish" className="space-y-5 rounded-lg border bg-card p-5" data-testid="panel-publish">
      <h2 className="font-display text-2xl font-semibold">Publish</h2>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-sm" data-testid={`check-${c.label.toLowerCase().replace(/\W+/g, '-')}`}>
            {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(168_50%_32%)]" aria-label="Done" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Not done" />}
            <span><span className={c.ok ? '' : 'font-medium'}>{c.label}</span>{!c.ok && c.hint && <span className="block text-xs text-muted-foreground">{c.hint}</span>}</span>
          </li>
        ))}
        {dirty && <li className="text-sm font-medium text-destructive">Save your changes before publishing.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        {needsReview && <Button variant="outline" onClick={onReview} data-testid="button-mark-reviewed">Mark crop as reviewed</Button>}
        <Button variant="secondary" onClick={onCompile} disabled={compiling} data-testid="button-compile-target">
          {compiling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{hasTarget ? 'Recompile tracking target' : 'Compile tracking target'}
        </Button>
      </div>
      {compiling && <div><Progress value={progress} aria-label="Target compilation progress" /><p className="mt-1 font-mono-ui text-xs">{Math.round(progress)}%</p></div>}
      {compileError && <p role="alert" className="text-sm text-destructive" data-testid="error-compile">{compileError}</p>}
      <Button size="lg" className="w-full" onClick={onPublish} disabled={!ready || publishing} data-testid="button-publish">
        {publishing ? 'Publishing' : 'Publish new version'}
      </Button>
      {versions.length > 0 && (
        <div>
          <h3 className="font-mono-ui mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Versions</h3>
          <ul className="divide-y rounded border">
            {versions.map((v) => (
              <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" data-testid={`version-${v.version}`}>
                <span>v{v.version} <span className="text-xs text-muted-foreground">{v.regionCount} regions, {new Date(v.createdAt).toLocaleDateString()}</span> {v.active && <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">Live</span>}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" asChild><Link href={v.viewerPath} data-testid={`link-listen-${v.version}`}><ExternalLink className="mr-1 h-3.5 w-3.5" />Open</Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(new URL(v.viewerPath, window.location.origin).toString()); setCopied(v.version); }} data-testid={`button-copy-${v.version}`}>{copied === v.version ? 'Copied' : 'Copy link'}</Button>
                  {!v.active && <Button size="sm" variant="outline" disabled={activating} onClick={() => onActivate(v.version)} data-testid={`button-activate-${v.version}`}>Make live</Button>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
