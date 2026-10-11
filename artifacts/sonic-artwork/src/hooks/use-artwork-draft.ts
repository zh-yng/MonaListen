import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetArtworkQueryKey, getGetStudioSummaryQueryKey, getListArtworksQueryKey,
  useGetArtwork, useUpdateArtwork, type Artwork, type SoundRegion,
} from '@workspace/api-client-react';
import { errorStatus } from '@/lib/api-error';
import { setDirty } from '@/lib/nav-guard';

export interface Draft {
  title: string; description: string; altText: string;
  imageUrl: string | null; imageWidth: number; imageHeight: number;
  targetUrl: string | null; targetImageUrl: string | null;
  regions: SoundRegion[]; needsReview: boolean;
}
const toDraft = (a: Artwork): Draft => ({
  title: a.title, description: a.description, altText: a.altText, imageUrl: a.imageUrl,
  imageWidth: a.imageWidth, imageHeight: a.imageHeight, targetUrl: a.targetUrl,
  targetImageUrl: a.targetImageUrl, regions: a.regions, needsReview: a.needsReview,
});
const key = (d: Draft) => JSON.stringify(d);

export function useArtworkDraft(id: string) {
  const qc = useQueryClient();
  const q = useGetArtwork(id, { query: { queryKey: getGetArtworkQueryKey(id), refetchOnWindowFocus: false } });
  const update = useUpdateArtwork();
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [savedKey, setSavedKey] = useState('');
  const [conflict, setConflict] = useState(false);
  const draftRef = useRef<Draft | null>(null);
  const revision = useRef('');
  const initFor = useRef<string | null>(null);
  const updateRef = useRef(update.mutateAsync);
  updateRef.current = update.mutateAsync;

  const apply = useCallback((a: Artwork) => {
    const d = toDraft(a);
    draftRef.current = d; revision.current = a.updatedAt;
    setDraftState(d); setSavedKey(key(d)); setConflict(false);
  }, []);

  useEffect(() => {
    if (q.data && initFor.current !== id) { initFor.current = id; apply(q.data); }
  }, [q.data, id, apply]);

  const dirty = !!draft && key(draft) !== savedKey;
  useEffect(() => {
    setDirty(dirty);
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  useEffect(() => () => setDirty(false), []);

  const setDraft = useCallback((patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
    const cur = draftRef.current; if (!cur) return;
    const next = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) };
    draftRef.current = next; setDraftState(next);
  }, []);

  const save = useCallback(async (patch?: Partial<Draft>): Promise<Artwork> => {
    if (patch) setDraft(patch);
    const next = draftRef.current!;
    try {
      const res = await updateRef.current({ id, data: { ...next, revision: revision.current } });
      revision.current = res.updatedAt;
      setSavedKey(key(next)); setConflict(false);
      qc.setQueryData(getGetArtworkQueryKey(id), res);
      qc.invalidateQueries({ queryKey: getListArtworksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetStudioSummaryQueryKey() });
      return res;
    } catch (e) {
      if (errorStatus(e) === 409) setConflict(true);
      throw e;
    }
  }, [id, qc, setDraft]);

  /** Pull the latest server record, discarding local edits (conflict resolution). */
  const reloadLatest = useCallback(async () => {
    const r = await q.refetch();
    if (r.data) apply(r.data);
  }, [q, apply]);

  /** Refresh revision + publish info without touching local edits. */
  const syncRevision = useCallback(async (knownRevision?: string) => {
    if (knownRevision) revision.current = knownRevision;
    else {
      const r = await q.refetch();
      if (r.data) revision.current = r.data.updatedAt;
    }
    qc.invalidateQueries({ queryKey: getListArtworksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStudioSummaryQueryKey() });
  }, [q, qc]);

  return { artwork: q.data, isLoading: q.isLoading, error: q.error, refetch: q.refetch, draft, dirty, saving: update.isPending, conflict, setDraft, save, reloadLatest, syncRevision };
}
