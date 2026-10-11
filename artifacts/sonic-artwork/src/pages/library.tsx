import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ImageOff, Plus, Search, Trash2 } from 'lucide-react';
import {
  getGetStudioSummaryQueryKey, getListArtworksQueryKey, useCreateArtwork, useDeleteArtwork,
  useGetStudioSummary, useListArtworks, type Artwork,
} from '@workspace/api-client-react';
import { StudioShell } from '@/components/studio-shell';
import { QueryError } from '@/components/query-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/api-error';

function Stat({ label, value, id }: { label: string; value?: number; id: string }) {
  return (
    <div className="border-l-2 border-primary pl-4" data-testid={`stat-${id}`}>
      <div className="font-display text-4xl font-semibold tabular-nums">{value ?? <Skeleton className="h-9 w-10" />}</div>
      <div className="font-mono-ui mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Card({ a, onDelete }: { a: Artwork; onDelete: () => void }) {
  const status = a.publishedVersion ? `Published v${a.publishedVersion}` : 'Draft';
  return (
    <li className="group relative overflow-hidden rounded-lg border bg-card transition-transform hover:-translate-y-0.5" data-testid={`card-artwork-${a.id}`}>
      <Link href={`/studio/artworks/${a.id}`} className="block" data-testid={`link-artwork-${a.id}`}>
        <div className="aspect-[4/3] bg-muted">
          {a.imageUrl ? <img src={a.imageUrl} alt={a.altText || a.title} className="h-full w-full object-cover" loading="lazy" />
            : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageOff className="h-6 w-6" aria-hidden /><span className="ml-2 text-sm">No image yet</span></div>}
        </div>
        <div className="p-4">
          <h3 className="font-display text-xl font-semibold leading-tight">{a.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={a.publishedVersion ? 'default' : 'secondary'}>{status}</Badge>
            <span className="font-mono-ui text-xs text-muted-foreground">{a.regions.length} region{a.regions.length === 1 ? '' : 's'}</span>
            {a.needsReview && <Badge variant="outline">Review crop</Badge>}
          </div>
        </div>
      </Link>
      <Button size="icon" variant="secondary" className="absolute right-2 top-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100" aria-label={`Delete ${a.title}`} onClick={onDelete} data-testid={`button-delete-${a.id}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

export default function Library() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const summary = useGetStudioSummary();
  const list = useListArtworks();
  const create = useCreateArtwork();
  const del = useDeleteArtwork();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [toDelete, setToDelete] = useState<Artwork | null>(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list.data ?? []).filter((a) => !s || a.title.toLowerCase().includes(s) || a.description.toLowerCase().includes(s));
  }, [list.data, q]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListArtworksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStudioSummaryQueryKey() });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({ data: { title: title.trim(), description: desc.trim() } }, {
      onSuccess: (a) => { refresh(); setOpen(false); setTitle(''); setDesc(''); nav(`/studio/artworks/${a.id}`); },
      onError: (err) => toast({ variant: 'destructive', title: 'Could not create artwork', description: errorMessage(err) }),
    });
  };

  return (
    <StudioShell>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono-ui text-xs uppercase tracking-[0.25em] text-accent">Your studio</p>
            <h1 className="font-display mt-2 text-5xl font-semibold">Library</h1>
          </div>
          <Button size="lg" onClick={() => setOpen(true)} data-testid="button-new-artwork"><Plus className="mr-2 h-4 w-4" />New artwork</Button>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat id="total" label="Artworks" value={summary.data?.totalArtworks} />
          <Stat id="published" label="Published" value={summary.data?.publishedArtworks} />
          <Stat id="drafts" label="Drafts" value={summary.data?.draftArtworks} />
          <Stat id="regions" label="Sound regions" value={summary.data?.totalRegions} />
        </div>
        {summary.error && <p className="mt-3 text-sm text-destructive" role="alert">Summary unavailable: {errorMessage(summary.error)}</p>}

        <div className="relative mt-12 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or description" aria-label="Search artworks" className="pl-9" data-testid="input-search" />
        </div>

        <div className="mt-8">
          {list.isLoading && <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>}
          {list.error && <QueryError error={list.error} onRetry={() => list.refetch()} title="Could not load your library" />}
          {list.data && list.data.length === 0 && (
            <div className="rounded-xl border-2 border-dashed p-12 text-center" data-testid="empty-library">
              <h2 className="font-display text-2xl font-semibold">The walls are bare.</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">Create your first artwork, upload a photograph of the painting, and start tracing the places where it should sound.</p>
              <Button className="mt-6" onClick={() => setOpen(true)} data-testid="button-empty-create">Create an artwork</Button>
            </div>
          )}
          {list.data && list.data.length > 0 && shown.length === 0 && <p className="text-muted-foreground" data-testid="empty-search">Nothing matches "{q}".</p>}
          {shown.length > 0 && <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{shown.map((a) => <Card key={a.id} a={a} onDelete={() => setToDelete(a)} />)}</ul>}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader><DialogTitle className="font-display">New artwork</DialogTitle><DialogDescription>You will add the image and sound regions next.</DialogDescription></DialogHeader>
            <div className="my-5 space-y-4">
              <div className="space-y-2"><Label htmlFor="new-title">Title</Label><Input id="new-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required autoFocus data-testid="input-title" /></div>
              <div className="space-y-2"><Label htmlFor="new-desc">Description (optional)</Label><Textarea id="new-desc" value={desc} maxLength={2000} onChange={(e) => setDesc(e.target.value)} data-testid="input-description" /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={create.isPending || !title.trim()} data-testid="button-create-submit">{create.isPending ? 'Creating' : 'Create'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="font-display">Delete "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This removes the artwork, its regions and published versions. Visitors will no longer be able to open it.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete" onClick={() => toDelete && del.mutate({ id: toDelete.id }, {
              onSuccess: () => { refresh(); setToDelete(null); toast({ title: 'Artwork deleted' }); },
              onError: (err) => toast({ variant: 'destructive', title: 'Could not delete', description: errorMessage(err) }),
            })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StudioShell>
  );
}
