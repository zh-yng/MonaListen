import { CheckCircle2, XCircle } from 'lucide-react';
import { useGetServiceStatus } from '@workspace/api-client-react';
import { StudioShell } from '@/components/studio-shell';
import { QueryError } from '@/components/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { data, isLoading, error, refetch, isFetching } = useGetServiceStatus();
  const rows = data ? [
    { k: 'database', t: 'Database', ok: data.database, good: 'Artworks and regions are being stored.', bad: 'The database is unreachable. Nothing you create can be saved.' },
    { k: 'storage', t: 'File storage', ok: data.storage, good: 'Images, audio and tracking targets can be uploaded.', bad: 'Storage needs setup. Image uploads, cropping, and target compiling will fail until a bucket is provisioned.' },
    { k: 'gemini', t: 'Gemini suggestions', ok: data.gemini, good: 'Your own Gemini API key is configured. Suggestions stay opt-in.', bad: 'No working Gemini API key. Manual drawing still works; AI suggestions are unavailable.' },
    { k: 'elevenlabs', t: 'ElevenLabs sound', ok: data.elevenlabs, good: 'Sound previews can be generated.', bad: 'ElevenLabs is not connected yet. You cannot generate or approve region audio, so nothing can be published.' },
  ] : [];
  return (
    <StudioShell>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-semibold">Services</h1>
        <p className="mt-2 text-muted-foreground">What the studio is connected to right now.</p>
        <div className="mt-10 space-y-3">
          {isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
          {error && <QueryError error={error} onRetry={() => refetch()} title="Could not read service status" />}
          {rows.map((r) => (
            <div key={r.k} data-testid={`status-${r.k}`} className="flex items-start gap-4 rounded-lg border bg-card p-5">
              {r.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-[hsl(168_50%_32%)]" aria-label="Connected" /> : <XCircle className="mt-0.5 h-5 w-5 text-destructive" aria-label="Not connected" />}
              <div><h2 className="font-display text-lg font-semibold">{r.t}</h2><p className="text-sm text-muted-foreground">{r.ok ? r.good : r.bad}</p></div>
            </div>
          ))}
          {data && (
            <div className="flex items-start gap-4 rounded-lg border bg-card p-5" data-testid="status-analytics">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[hsl(168_50%_32%)]" aria-hidden />
              <div><h2 className="font-display text-lg font-semibold">Analytics</h2>
                <p className="text-sm text-muted-foreground">{data.analyticsEnabled ? 'Analytics reports as enabled by the server.' : 'Off. Visitors are never tracked.'}</p></div>
            </div>
          )}
        </div>
        <Button variant="outline" className="mt-6" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-status">Check again</Button>
      </div>
    </StudioShell>
  );
}
