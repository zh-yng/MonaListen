import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Crop, ImagePlus, MousePointer2, Pentagon, Save, Sparkles, Spline } from 'lucide-react';
import {
  getListArtworkVersionsQueryKey, useActivateArtworkVersion, useAnalyzeArtwork, useGetServiceStatus,
  useListArtworkVersions, usePreviewRegionSound, usePublishArtwork, useRequestUploadUrl,
  type Point, type SoundRegion,
} from '@workspace/api-client-react';
import { StudioShell } from '@/components/studio-shell';
import { QueryError } from '@/components/query-error';
import { Stage, type Tool } from '@/components/editor/stage';
import { RegionCard } from '@/components/editor/region-card';
import { Suggestions } from '@/components/editor/suggestions';
import { CropDialog, type CropResult } from '@/components/editor/crop-dialog';
import { PublishPanel, type Check } from '@/components/editor/publish-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';
import { useArtworkDraft } from '@/hooks/use-artwork-draft';
import { explain, errorMessage } from '@/lib/api-error';
import { audioReady, clamp01, newRegion, regionValid } from '@/lib/regions';
import { uploadBlob } from '@/lib/upload';
import { compileTarget } from '@/lib/target-compiler';

const MAX_REGIONS = 32;

export default function Editor() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const d = useArtworkDraft(id);
  const status = useGetServiceStatus();
  const versions = useListArtworkVersions(id);
  const requestUpload = useRequestUploadUrl();
  const analyze = useAnalyzeArtwork();
  const preview = usePreviewRegionSound();
  const publish = usePublishArtwork();
  const activate = useActivateArtworkVersion();

  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [busyImage, setBusyImage] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [compiling, setCompiling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [sugAlt, setSugAlt] = useState<string | null>(null);
  const [sugRegions, setSugRegions] = useState<SoundRegion[]>([]);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = d.draft;

  const fail = (title: string, e: unknown, svc?: Parameters<typeof explain>[1]) =>
    toast({ variant: 'destructive', title, description: explain(e, svc) });

  const doSave = async (patch?: Parameters<typeof d.save>[0]) => {
    if (draft && !(patch?.title ?? draft.title).trim()) { toast({ variant: 'destructive', title: 'Title is required' }); return null; }
    try { const r = await d.save(patch); return r; }
    catch (e) {
      if ((e as { status?: number }).status === 409) toast({ variant: 'destructive', title: 'Changed elsewhere', description: 'Another tab or device saved newer changes. Your edits were not saved.' });
      else fail('Could not save', e);
      return null;
    }
  };

  const updateRegion = (rid: string, patch: Partial<SoundRegion>) =>
    d.setDraft((s) => ({ regions: s.regions.map((r) => (r.id === rid ? { ...r, ...patch } : r)) }));
  const addRegion = (r: SoundRegion) => {
    d.setDraft((s) => ({ regions: [...s.regions, r] })); setSelected(r.id);
  };

  const pickImage = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast({ variant: 'destructive', title: 'Choose an image file' }); return; }
    setBusyImage('Uploading image'); setUploadPct(0);
    try {
      const url = await uploadBlob(requestUpload.mutateAsync, file, file.name, file.type, setUploadPct);
      const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
        const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => rej(new Error('Could not read the uploaded image.')); img.src = url;
      });
      const hadRegions = (draft?.regions.length ?? 0) > 0;
      const saved = await doSave({ imageUrl: url, imageWidth: dims.w, imageHeight: dims.h, targetUrl: null, targetImageUrl: null, needsReview: hadRegions || !!draft?.imageUrl });
      if (!saved) return;
      toast({ title: 'Image saved', description: 'Compile the tracking target before publishing.' });
    } catch (e) { fail('Image upload failed', e, 'storage'); }
    finally { setBusyImage(null); }
  };

  const applyCrop = async (c: CropResult) => {
    setBusyImage('Uploading crop');
    try {
      const url = await uploadBlob(requestUpload.mutateAsync, c.blob, 'cropped.jpg', 'image/jpeg', setUploadPct);
      const remap = (p: Point): Point => ({ x: clamp01((p.x - c.left) / c.width), y: clamp01((p.y - c.top) / c.height) });
      const regions = draft!.regions.map((r) => {
        const s = remap({ x: r.sourceX, y: r.sourceY });
        return { ...r, points: r.points.map(remap), sourceX: s.x, sourceY: s.y };
      });
      const saved = await doSave({ imageUrl: url, imageWidth: c.imageWidth, imageHeight: c.imageHeight, regions, targetUrl: null, targetImageUrl: null, needsReview: true });
      if (!saved) return;
      setCropOpen(false);
      toast({ title: 'Crop applied', description: 'Review that every region still sits on the right part of the painting.' });
    } catch (e) { fail('Crop failed', e, 'storage'); }
    finally { setBusyImage(null); }
  };

  const runAnalyze = () => {
    setAnalyzeError(null);
    analyze.mutate({ id }, {
      onSuccess: (a) => { setSugAlt(a.altText || null); setSugRegions(a.suggestions); if (!a.altText && !a.suggestions.length) toast({ title: 'Gemini had no suggestions' }); },
      onError: (e) => setAnalyzeError(explain(e, 'gemini')),
    });
  };
  const acceptSuggestion = (r: SoundRegion, edit: boolean) => {
    if ((draft?.regions.length ?? 0) >= MAX_REGIONS) return;
    const exists = draft?.regions.some((x) => x.id === r.id);
    addRegion({ ...r, id: exists ? crypto.randomUUID() : r.id, approved: false });
    setSugRegions((s) => s.filter((x) => x.id !== r.id));
    if (edit) setTool('select');
  };

  const runPreview = async (r: SoundRegion, duration: number) => {
    setPreviewErrors((s) => ({ ...s, [r.id]: '' }));
    setPreviewing(r.id);
    try {
      const saved = await d.save(); // region must exist server-side
      void saved;
      const res = await preview.mutateAsync({ id, regionId: r.id, data: { prompt: r.prompt, duration } });
      await d.syncRevision(res.revision);
      updateRegion(r.id, { audioUrl: res.audioUrl, audioPrompt: res.prompt, prompt: res.prompt, approved: false });
    } catch (e) {
      setPreviewErrors((s) => ({ ...s, [r.id]: (e as { status?: number }).status === 409 ? 'Saved changes elsewhere conflict with this draft. Reload before previewing.' : explain(e, 'elevenlabs') }));
    } finally { setPreviewing(null); }
  };

  const runCompile = async () => {
    if (!draft?.imageUrl) return;
    setCompiling(true); setProgress(0); setCompileError(null);
    try {
      const blob = await compileTarget(draft.imageUrl, setProgress);
      const url = await uploadBlob(requestUpload.mutateAsync, blob, 'target.mind', 'application/octet-stream');
      await d.save({ targetUrl: url, targetImageUrl: draft.imageUrl });
      toast({ title: 'Tracking target ready' });
    } catch (e) { setCompileError(explain(e, 'storage', 'Target compilation failed.')); }
    finally { setCompiling(false); }
  };

  const runPublish = async () => {
    try {
      const v = await publish.mutateAsync({ id });
      await d.syncRevision();
      qc.invalidateQueries({ queryKey: getListArtworkVersionsQueryKey(id) });
      toast({ title: `Version ${v.version} published`, description: 'It is live for visitors.' });
    } catch (e) { fail('Could not publish', e); }
  };
  const runActivate = (version: number) => activate.mutate({ id, data: { version } }, {
    onSuccess: async () => { await d.syncRevision(); qc.invalidateQueries({ queryKey: getListArtworkVersionsQueryKey(id) }); toast({ title: `Version ${version} is live` }); },
    onError: (e) => fail('Could not switch version', e),
  });

  const checks: Check[] = useMemo(() => {
    if (!draft) return [];
    const n = draft.regions.length;
    return [
      { ok: !!draft.imageUrl, label: 'Artwork image uploaded', hint: 'Upload a photograph of the painting.' },
      { ok: n > 0 && draft.regions.every(regionValid), label: 'Valid region shapes', hint: n ? 'Polygons need 3 points, paths need 2.' : 'Draw at least one region.' },
      { ok: n > 0 && draft.regions.every(audioReady), label: 'Every region has approved audio', hint: 'Generate, listen, then approve each region.' },
      { ok: !!draft.targetUrl && draft.targetImageUrl === draft.imageUrl && !!draft.imageUrl, label: 'Tracking target matches image', hint: 'Compile the target for the current image.' },
      { ok: !draft.needsReview, label: 'Crop reviewed', hint: 'Check the regions after cropping, then mark reviewed.' },
    ];
  }, [draft]);

  if (d.isLoading) return <StudioShell><div className="space-y-4 p-8"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-[60vh]" /></div></StudioShell>;
  if (d.error || !draft) return <StudioShell><div className="p-8"><QueryError error={d.error ?? new Error('Artwork not found.')} onRetry={() => d.refetch()} title="Could not open this artwork" /><Button asChild variant="ghost" className="mt-4"><Link href="/studio">Back to library</Link></Button></div></StudioShell>;

  const aspect = draft.imageWidth && draft.imageHeight ? draft.imageWidth / draft.imageHeight : 4 / 3;
  const full = draft.regions.length >= MAX_REGIONS;

  return (
    <StudioShell>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Upload artwork image" data-testid="input-image-file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }} />
      <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to library"><Link href="/studio" data-testid="link-back"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <Input value={draft.title} maxLength={200} aria-label="Artwork title" onChange={(e) => d.setDraft({ title: e.target.value })} className="font-display h-11 min-w-0 flex-1 border-transparent bg-transparent text-2xl font-semibold shadow-none focus-visible:border-input" data-testid="input-artwork-title" />
          <span className="font-mono-ui text-xs text-muted-foreground" role="status" data-testid="status-save">{d.saving ? 'Saving' : d.dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <Button onClick={() => doSave()} disabled={!d.dirty || d.saving} data-testid="button-save"><Save className="mr-2 h-4 w-4" />Save</Button>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        {d.conflict && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive bg-destructive/10 p-4" data-testid="alert-conflict">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="min-w-0 flex-1 text-sm"><strong>This artwork changed elsewhere.</strong> Saving would overwrite newer work, so it was blocked. Your edits are still here.</p>
            <Button variant="outline" onClick={() => d.reloadLatest()} data-testid="button-reload-latest">Discard mine and load latest</Button>
          </div>
        )}
        {status.data && !status.data.storage && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="banner-storage">File storage needs setup, so image, audio, and target uploads will fail. See Services.</p>}
        {status.data && !status.data.elevenlabs && <p role="alert" className="rounded-md border border-border bg-muted p-3 text-sm" data-testid="banner-elevenlabs">ElevenLabs is not connected yet. You can draw regions, but sound previews and publishing are unavailable.</p>}
        {draft.needsReview && draft.imageUrl && <p role="status" className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm" data-testid="banner-review">The image was changed or cropped. Review every region, then mark the crop reviewed in the Publish panel.</p>}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {draft.imageUrl ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleGroup type="single" value={tool} onValueChange={(v) => v && setTool(v as Tool)} variant="outline" aria-label="Drawing tool">
                    <ToggleGroupItem value="select" data-testid="tool-select"><MousePointer2 className="mr-1.5 h-4 w-4" />Edit</ToggleGroupItem>
                    <ToggleGroupItem value="polygon" disabled={full} data-testid="tool-polygon"><Pentagon className="mr-1.5 h-4 w-4" />Polygon</ToggleGroupItem>
                    <ToggleGroupItem value="path" disabled={full} data-testid="tool-path"><Spline className="mr-1.5 h-4 w-4" />Path</ToggleGroupItem>
                  </ToggleGroup>
                  <span className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setCropOpen(true)} data-testid="button-crop"><Crop className="mr-1.5 h-4 w-4" />Crop</Button>
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!!busyImage} data-testid="button-replace-image"><ImagePlus className="mr-1.5 h-4 w-4" />Replace</Button>
                </div>
                <Stage imageUrl={draft.imageUrl} aspect={aspect} regions={draft.regions} selectedId={selected} tool={tool} onTool={setTool} onSelect={setSelected}
                  onPoints={(rid, pts) => updateRegion(rid, { points: pts })}
                  onSource={(rid, x, y) => updateRegion(rid, { sourceX: clamp01(x), sourceY: clamp01(y) })}
                  onCreate={(kind, pts) => addRegion(newRegion(kind, pts, draft.regions.length + 1))} />
              </>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busyImage} className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card p-8 text-center transition-colors hover:border-primary" data-testid="button-upload-image">
                <ImagePlus className="h-10 w-10 text-primary" aria-hidden />
                <span className="font-display mt-4 text-2xl font-semibold">Add the painting</span>
                <span className="mt-1 max-w-sm text-sm text-muted-foreground">Photograph it straight-on in even light. JPEG or PNG up to 20 MB.</span>
              </button>
            )}
            {busyImage && <div role="status" className="text-sm"><span>{busyImage}</span> <span className="font-mono-ui">{uploadPct}%</span></div>}

            <div className="space-y-2">
              <Label htmlFor="alt-text">Alt text</Label>
              <Textarea id="alt-text" rows={4} maxLength={5000} value={draft.altText} onChange={(e) => d.setDraft({ altText: e.target.value })} placeholder="Describe the painting for someone who cannot see it. Visitors can hear this on request." data-testid="input-alt-text" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" rows={2} maxLength={2000} value={draft.description} onChange={(e) => d.setDraft({ description: e.target.value })} data-testid="input-artwork-description" />
            </div>
          </div>

          <div className="space-y-6">
            <section aria-label="Regions" className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Sound regions <span className="font-mono-ui text-sm text-muted-foreground">{draft.regions.length}/{MAX_REGIONS}</span></h2></div>
              {draft.regions.length === 0 && (
                <div className="rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground" data-testid="empty-regions">
                  {draft.imageUrl ? 'No regions yet. Pick Polygon or Path and trace something on the painting, or ask Gemini for suggestions below.' : 'Upload the painting first, then trace regions over it.'}
                </div>
              )}
              {draft.regions.map((r, i) => (
                <RegionCard key={r.id} r={r} index={i} selected={selected === r.id} previewing={previewing === r.id} previewError={previewErrors[r.id] || null}
                  onSelect={() => setSelected(selected === r.id ? null : r.id)} onChange={(p) => updateRegion(r.id, p)}
                  onDelete={() => { d.setDraft((s) => ({ regions: s.regions.filter((x) => x.id !== r.id) })); setSelected(null); }}
                  onPreview={(dur) => runPreview(r, dur)} />
              ))}
              {draft.regions.length > 0 && <p className="text-xs text-muted-foreground">Regions are written in layers that all play at once. Previewing saves your draft first.</p>}
            </section>

            <section aria-label="AI assistance" className="space-y-3">
              <Button variant="outline" onClick={runAnalyze} disabled={!draft.imageUrl || analyze.isPending || d.dirty} data-testid="button-analyze">
                <Sparkles className="mr-2 h-4 w-4" />{analyze.isPending ? 'Gemini is looking' : 'Ask Gemini for suggestions'}
              </Button>
              {d.dirty && draft.imageUrl && <p className="text-xs text-muted-foreground">Save first so Gemini sees the current image.</p>}
              {analyzeError && <p role="alert" className="text-sm text-destructive" data-testid="error-analyze">{analyzeError}</p>}
              <Suggestions altText={sugAlt} regions={sugRegions} full={full}
                onUseAlt={() => { d.setDraft({ altText: sugAlt ?? '' }); setSugAlt(null); }} onDismissAlt={() => setSugAlt(null)}
                onAccept={(r) => acceptSuggestion(r, false)} onEdit={(r) => acceptSuggestion(r, true)} onDiscard={(rid) => setSugRegions((s) => s.filter((x) => x.id !== rid))} />
            </section>

            <PublishPanel checks={checks} dirty={d.dirty} compiling={compiling} progress={progress} compileError={compileError} hasTarget={!!draft.targetUrl}
              onCompile={() => { if (d.dirty) { toast({ title: 'Save first', description: 'Save your changes, then compile the target.' }); return; } runCompile(); }}
              onReview={() => d.setDraft({ needsReview: false })} needsReview={draft.needsReview}
              publishing={publish.isPending} onPublish={runPublish}
              versions={versions.data ?? []} onActivate={runActivate} activating={activate.isPending} />
            {versions.error && <p className="text-xs text-destructive">Versions unavailable: {errorMessage(versions.error)}</p>}
          </div>
        </div>
      </div>
      {draft.imageUrl && <CropDialog open={cropOpen} onOpenChange={setCropOpen} imageUrl={draft.imageUrl} busy={!!busyImage} onApply={applyCrop} />}
    </StudioShell>
  );
}
