import { useEffect, useRef, useState } from 'react';
import type { Point, SoundRegion } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { sampleRegion } from '@/lib/region-geometry';
import { REGION_COLORS, clamp01 } from '@/lib/regions';

export type Tool = 'select' | 'polygon' | 'path';
interface Props {
  imageUrl: string; aspect: number; regions: SoundRegion[]; selectedId: string | null;
  tool: Tool; onTool: (t: Tool) => void; onSelect: (id: string | null) => void;
  onPoints: (id: string, pts: Point[]) => void; onSource: (id: string, x: number, y: number) => void;
  onCreate: (kind: 'polygon' | 'path', pts: Point[]) => void;
}
type Drag = { id: string; idx: number | 'source' } | null;

export function Stage(p: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [drawing, setDrawing] = useState<Point[]>([]);
  const [selPoint, setSelPoint] = useState<number | null>(null);
  const drag = useRef<Drag>(null);

  useEffect(() => {
    const el = svgRef.current?.parentElement; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { setDrawing([]); setSelPoint(null); }, [p.tool, p.selectedId]);

  const norm = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };
  const px = (pt: Point) => `${pt.x * size.w},${pt.y * size.h}`;
  const finish = () => {
    if (p.tool === 'select') return;
    const min = p.tool === 'polygon' ? 3 : 2;
    if (drawing.length >= min) { p.onCreate(p.tool, drawing); setDrawing([]); p.onTool('select'); }
  };
  const sel = p.regions.find((r) => r.id === p.selectedId);

  const outline = (r: SoundRegion) => {
    const pts = r.curved && r.points.length >= 2 ? sampleRegion(r) : r.points;
    if (!pts.length) return '';
    return 'M' + pts.map(px).join(' L') + (r.kind === 'polygon' ? 'Z' : '');
  };

  const onBg = (e: React.PointerEvent) => {
    svgRef.current?.focus();
    if (p.tool === 'select') { p.onSelect(null); return; }
    const pt = norm(e);
    if (p.tool === 'polygon' && drawing.length >= 3) {
      const f = drawing[0];
      if (Math.hypot((f.x - pt.x) * size.w, (f.y - pt.y) * size.h) < 12) { finish(); return; }
    }
    setDrawing((d) => [...d, pt]);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const pt = norm(e);
    if (d.idx === 'source') p.onSource(d.id, pt.x, pt.y);
    else { const r = p.regions.find((x) => x.id === d.id); if (r) p.onPoints(d.id, r.points.map((o, i) => (i === d.idx ? pt : o))); }
  };
  const startDrag = (e: React.PointerEvent, id: string, idx: number | 'source') => {
    e.stopPropagation(); (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { id, idx }; p.onSelect(id); setSelPoint(typeof idx === 'number' ? idx : null);
    svgRef.current?.focus();
  };
  const insert = (e: React.PointerEvent, r: SoundRegion, i: number) => {
    e.stopPropagation(); const pt = norm(e);
    const pts = [...r.points]; pts.splice(i + 1, 0, pt); p.onPoints(r.id, pts);
    (e.target as Element).setPointerCapture(e.pointerId); drag.current = { id: r.id, idx: i + 1 }; setSelPoint(i + 1);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { finish(); return; }
    if (e.key === 'Escape') { setDrawing([]); p.onTool('select'); return; }
    if (!sel || selPoint === null) return;
    const min = sel.kind === 'polygon' ? 3 : 2;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel.points.length > min) {
      e.preventDefault(); p.onPoints(sel.id, sel.points.filter((_, i) => i !== selPoint)); setSelPoint(null); return;
    }
    const step = e.shiftKey ? 0.02 : 0.004;
    const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
    const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
    if (dx || dy) {
      e.preventDefault();
      p.onPoints(sel.id, sel.points.map((o, i) => (i === selPoint ? { x: clamp01(o.x + dx), y: clamp01(o.y + dy) } : o)));
    }
  };

  const edges = sel && p.tool === 'select' ? sel.points.map((a, i) => {
    const last = i === sel.points.length - 1;
    if (last && sel.kind === 'path') return null;
    return { i, a, b: sel.points[(i + 1) % sel.points.length] };
  }).filter(Boolean) as { i: number; a: Point; b: Point }[] : [];

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-lg border bg-muted" style={{ aspectRatio: p.aspect }}>
        <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} data-testid="img-artwork" />
        <svg ref={svgRef} width={size.w} height={size.h} tabIndex={0} role="application"
          aria-label="Region drawing surface. Use arrow keys to move the selected point, Delete to remove it, Enter to finish drawing."
          className={`absolute inset-0 touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring ${p.tool === 'select' ? '' : 'cursor-crosshair'}`}
          onPointerDown={onBg} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onKeyDown={onKey} data-testid="canvas-regions">
          {p.regions.map((r, i) => {
            const c = REGION_COLORS[i % REGION_COLORS.length]; const active = r.id === p.selectedId;
            return (
              <g key={r.id}>
                {r.falloffMode === 'source' && active && <circle cx={r.sourceX * size.w} cy={r.sourceY * size.h} r={r.radius * size.w} fill={`hsl(${c} / .12)`} stroke={`hsl(${c} / .6)`} strokeDasharray="4 4" />}
                <path d={outline(r)} fill={r.kind === 'polygon' ? `hsl(${c} / ${active ? 0.3 : 0.16})` : 'none'} stroke={`hsl(${c})`} strokeWidth={active ? 3 : 2} strokeLinejoin="round" strokeLinecap="round"
                  className={p.tool === 'select' ? 'cursor-pointer' : ''}
                  onPointerDown={(e) => { if (p.tool === 'select') { e.stopPropagation(); p.onSelect(r.id); svgRef.current?.focus(); } }} />
                {r.kind === 'path' && <path d={outline(r)} fill="none" stroke="transparent" strokeWidth={14} onPointerDown={(e) => { if (p.tool === 'select') { e.stopPropagation(); p.onSelect(r.id); } }} />}
              </g>
            );
          })}
          {edges.map((ed) => (
            <line key={ed.i} x1={ed.a.x * size.w} y1={ed.a.y * size.h} x2={ed.b.x * size.w} y2={ed.b.y * size.h} stroke="transparent" strokeWidth={14} className="cursor-copy" onPointerDown={(e) => insert(e, sel!, ed.i)} />
          ))}
          {sel && p.tool === 'select' && sel.points.map((pt, i) => (
            <circle key={i} cx={pt.x * size.w} cy={pt.y * size.h} r={selPoint === i ? 8 : 6} fill={selPoint === i ? 'hsl(14 82% 50%)' : 'hsl(40 40% 97%)'} stroke="hsl(232 35% 14%)" strokeWidth={2} className="cursor-grab" onPointerDown={(e) => startDrag(e, sel.id, i)} />
          ))}
          {sel && p.tool === 'select' && sel.falloffMode === 'source' && (
            <rect x={sel.sourceX * size.w - 7} y={sel.sourceY * size.h - 7} width={14} height={14} transform={`rotate(45 ${sel.sourceX * size.w} ${sel.sourceY * size.h})`} fill="hsl(42 90% 52%)" stroke="hsl(232 35% 14%)" strokeWidth={2} className="cursor-grab" onPointerDown={(e) => startDrag(e, sel.id, 'source')}><title>Sound source</title></rect>
          )}
          {drawing.length > 0 && (
            <g>
              <path d={'M' + drawing.map(px).join(' L')} fill="none" stroke="hsl(232 35% 14%)" strokeWidth={3} strokeDasharray="6 4" />
              {drawing.map((pt, i) => <circle key={i} cx={pt.x * size.w} cy={pt.y * size.h} r={i === 0 ? 7 : 5} fill="hsl(14 82% 50%)" stroke="hsl(40 40% 97%)" strokeWidth={2} />)}
            </g>
          )}
        </svg>
      </div>
      <div className="flex min-h-9 flex-wrap items-center gap-2 text-sm" aria-live="polite">
        {p.tool === 'select' ? (
          <span className="text-muted-foreground">{sel ? 'Drag points to reshape. Click an edge to add a point. Select a point and press Delete to remove it.' : 'Choose a draw tool, or select a region to edit its shape.'}</span>
        ) : (
          <>
            <span className="text-muted-foreground">{p.tool === 'polygon' ? 'Click to place corners (3 minimum).' : 'Click to lay a path (2 points minimum).'} {drawing.length} placed.</span>
            <Button size="sm" onClick={finish} disabled={drawing.length < (p.tool === 'polygon' ? 3 : 2)} data-testid="button-finish-shape">Finish</Button>
            <Button size="sm" variant="outline" onClick={() => { setDrawing([]); p.onTool('select'); }} data-testid="button-cancel-shape">Cancel</Button>
            {drawing.length > 0 && <Button size="sm" variant="ghost" onClick={() => setDrawing((d) => d.slice(0, -1))} data-testid="button-undo-point">Undo point</Button>}
          </>
        )}
      </div>
    </div>
  );
}
