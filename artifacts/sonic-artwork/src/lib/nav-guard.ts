import { useSyncExternalStore } from 'react';
import { useBrowserLocation } from 'wouter/use-browser-location';

type Pending = (() => void) | null;
let dirty = false;
let pending: Pending = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const setDirty = (v: boolean) => { dirty = v; };
export const resolvePending = (go: boolean) => {
  const p = pending; pending = null; emit();
  if (go && p) { dirty = false; p(); }
};
export const usePending = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => pending);

export const useGuardedLocation: typeof useBrowserLocation = (opts) => {
  const [loc, nav] = useBrowserLocation(opts);
  const guarded = (to: string, o?: { replace?: boolean; state?: unknown }) => {
    if (dirty) { pending = () => nav(to, o as never); emit(); return; }
    nav(to, o as never);
  };
  return [loc, guarded as typeof nav];
};
