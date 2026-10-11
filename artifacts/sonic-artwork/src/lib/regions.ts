import type { Point, SoundRegion } from '@workspace/api-client-react';

export const REGION_COLORS = ['14 82% 50%', '232 58% 45%', '168 55% 34%', '42 90% 46%', '320 50% 44%', '200 70% 38%'];
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function centroid(pts: Point[]): Point {
  if (!pts.length) return { x: 0.5, y: 0.5 };
  return { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
}
export function newRegion(kind: 'polygon' | 'path', points: Point[], n: number): SoundRegion {
  const c = centroid(points);
  return {
    id: crypto.randomUUID(), name: `Region ${n}`, description: '', prompt: '', kind, points, curved: false,
    volume: 0.8, radius: 0.25, falloffMode: 'interior', falloffCurve: 'smooth',
    sourceX: c.x, sourceY: c.y, pan: 0, audioUrl: null, audioPrompt: null, approved: false,
  };
}
export const minPoints = (r: SoundRegion) => (r.kind === 'polygon' ? 3 : 2);
export const regionValid = (r: SoundRegion) => r.points.length >= minPoints(r) && r.points.length <= 500;
export const audioReady = (r: SoundRegion) => !!r.audioUrl && r.approved && r.audioPrompt === r.prompt && r.prompt.length >= 3;
