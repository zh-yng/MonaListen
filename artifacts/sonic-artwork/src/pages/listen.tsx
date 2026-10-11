import { useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { Ear, Loader2, Pause, Play, Share2, Square, Volume2 } from 'lucide-react';
import { useGetExperience } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api-error';
import { startExperience, type ViewerSession } from '@/lib/viewer-engine';

type Status = 'idle' | 'starting' | 'searching' | 'tracking' | 'lost' | 'paused';

const SPOKEN: Record<Status, string> = {
  idle: '', starting: 'Starting the camera.',
  searching: 'Looking for the painting. Hold the phone upright, about an arm length away, and face the whole canvas.',
  tracking: 'Painting found. Sound is following your phone. Move slowly to explore.',
  lost: 'Lost the painting. Sound is fading. Step back a little, hold steady, and bring the whole canvas into view.',
  paused: 'Paused. Sound is silent.',
};

export default function Listen() {
  const { id = '', version = 'active' } = useParams<{ id: string; version?: string }>();
  const { data: m, isLoading, error, refetch } = useGetExperience(id, version);
  const stage = useRef<HTMLDivElement>(null);
  const session = useRef<ViewerSession | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [fault, setFault] = useState<string | null>(null);
  const [vol, setVol] = useState(0.8);
  const [helper, setHelper] = useState(false);
  const [describing, setDescribing] = useState(false);

  useEffect(() => () => { session.current?.stop(); session.current = null; }, []);

  const begin = async () => {
    if (!m || !stage.current) return;
    setFault(null); setStatus('starting');
    try {
      session.current?.stop();
      const s = await startExperience(stage.current, m, {
        onStatus: (st) => setStatus(st),
        onError: (msg) => { setFault(msg); },
      });
      session.current = s; s.setVolume(vol);
      setStatus((cur) => (cur === 'starting' ? 'searching' : cur));
    } catch (e) {
      setFault(errorMessage(e, 'The camera could not be started. Allow camera access in Safari settings and try again.'));
      setStatus('idle');
    }
  };
  const stop = () => { session.current?.stop(); session.current = null; setStatus('idle'); };
  const toggle = async () => {
    const s = session.current; if (!s) return;
    if (status === 'paused') { try { await s.resume(); } catch (e) { setFault(errorMessage(e)); } } else { s.pause(); setStatus('paused'); }
  };
  const describe = async () => {
    setDescribing(true);
    try { await session.current?.describe(); } catch (e) { setFault(errorMessage(e, 'Could not play the description.')); }
    finally { setDescribing(false); }
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: m?.title, url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard?.writeText(url);
  };

  const active = status !== 'idle' && status !== 'starting';
  return (
    <div className="relative min-h-[100dvh] bg-[hsl(232_38%_10%)] text-[hsl(38_30%_92%)]">
      <div ref={stage} className="pointer-events-none absolute inset-0 overflow-hidden opacity-60 [&>video]:h-full [&>video]:w-full [&>video]:object-cover" aria-hidden data-testid="camera-stage" />
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(232_38%_10%/.85)] via-transparent to-[hsl(232_38%_10%/.95)]" aria-hidden />
      <main className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-8">
        {isLoading && <div className="space-y-4 pt-10"><Skeleton className="h-10 w-2/3 bg-white/10" /><Skeleton className="h-40 bg-white/10" /></div>}
        {error && (
          <div role="alert" className="mt-16 rounded-lg border border-[hsl(355_70%_55%)] p-5" data-testid="error-experience">
            <h1 className="font-display text-2xl font-semibold">This artwork is not available</h1>
            <p className="mt-2 text-sm opacity-80">{errorMessage(error, 'The experience could not be loaded.')} Check the link, or ask the gallery for a new one.</p>
            <Button className="mt-4 h-12" onClick={() => refetch()} data-testid="button-retry">Try again</Button>
          </div>
        )}
        {m && (
          <>
            <header className="pt-6">
              <p className="font-mono-ui text-[11px] uppercase tracking-[0.25em] text-[hsl(14_82%_62%)]">MonaListen</p>
              <h1 className="font-display mt-2 text-4xl font-semibold leading-tight" data-testid="text-title">{m.title}</h1>
            </header>

            <p role="status" aria-live="polite" className="mt-8 min-h-[4.5rem] text-lg leading-snug" data-testid="status-tracking">
              {status === 'idle' ? 'Use headphones. Stand in front of the painting with the phone upright, then begin.' : SPOKEN[status]}
            </p>
            {fault && <p role="alert" className="mt-3 rounded border border-[hsl(355_70%_55%)] p-3 text-sm" data-testid="error-viewer">{fault}</p>}

            {status === 'tracking' || status === 'searching' || status === 'lost' ? (
              <div className="my-8 flex justify-center" aria-hidden>
                <div className={`h-24 w-24 rounded-full border-2 ${status === 'tracking' ? 'pulse-ring border-[hsl(14_82%_60%)] bg-[hsl(14_82%_50%/.3)]' : 'border-white/30'}`} />
              </div>
            ) : <div className="flex-1" />}

            <div className="space-y-3">
              {!active && (
                <Button className="h-16 w-full text-lg" onClick={begin} disabled={status === 'starting'} data-testid="button-begin">
                  {status === 'starting' ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Starting</> : <><Play className="mr-2 h-5 w-5" />Begin listening</>}
                </Button>
              )}
              {active && (
                <>
                  <Button className="h-14 w-full text-base" variant="secondary" onClick={toggle} data-testid="button-pause">
                    {status === 'paused' ? <><Play className="mr-2 h-5 w-5" />Resume sound</> : <><Pause className="mr-2 h-5 w-5" />Pause sound</>}
                  </Button>
                  <Button className="h-14 w-full text-base" variant="outline" onClick={describe} disabled={describing} data-testid="button-describe"><Ear className="mr-2 h-5 w-5" />{describing ? 'Describing' : 'Describe the artwork'}</Button>
                  <div className="rounded-lg border border-white/20 p-4">
                    <label htmlFor="vol" className="mb-3 flex items-center gap-2 text-sm"><Volume2 className="h-4 w-4" />Volume {Math.round(vol * 100)} percent</label>
                    <Slider id="vol" min={0} max={1} step={0.05} value={[vol]} onValueChange={([v]) => { setVol(v); session.current?.setVolume(v); }} data-testid="slider-volume" />
                  </div>
                  <Button className="h-12 w-full" variant="ghost" onClick={stop} data-testid="button-stop"><Square className="mr-2 h-4 w-4" />Stop and close camera</Button>
                </>
              )}
            </div>

            <section className="mt-10 border-t border-white/15 pt-6" aria-labelledby="about">
              <h2 id="about" className="font-display text-xl font-semibold">About this artwork</h2>
              <p className="mt-2 text-sm leading-relaxed opacity-85" data-testid="text-alt">{m.altText || 'The artist has not written a description yet.'}</p>
            </section>

            <section className="mt-6 pb-8">
              <button type="button" onClick={() => setHelper((h) => !h)} aria-expanded={helper} className="min-h-12 text-sm underline underline-offset-4" data-testid="button-helper">Helper setup</button>
              {helper && (
                <div className="mt-3 space-y-3 rounded-lg bg-white/5 p-4 text-sm" data-testid="panel-helper">
                  <ol className="list-decimal space-y-2 pl-5">
                    <li>Open this page in Safari on the visitor's iPhone and allow camera access.</li>
                    <li>Stand the visitor about an arm's length from the painting, facing it squarely.</li>
                    <li>Point the back camera at the whole canvas, phone upright, and press Begin listening.</li>
                    <li>If sound fades, tilt the phone until the full painting is in view again.</li>
                  </ol>
                  <Button variant="outline" className="h-12" onClick={share} data-testid="button-share"><Share2 className="mr-2 h-4 w-4" />Share this link</Button>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
