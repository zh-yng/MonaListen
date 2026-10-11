import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface CropResult { blob: Blob; left: number; top: number; width: number; height: number; imageWidth: number; imageHeight: number }

export function CropDialog({ open, onOpenChange, imageUrl, busy, onApply }: {
  open: boolean; onOpenChange: (o: boolean) => void; imageUrl: string; busy: boolean; onApply: (r: CropResult) => void;
}) {
  const [c, setC] = useState({ l: 0, t: 0, r: 0, b: 0 });
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setC({ l: 0, t: 0, r: 0, b: 0 }); setErr(''); } }, [open]);
  const fields: [keyof typeof c, string][] = [['l', 'Trim left'], ['t', 'Trim top'], ['r', 'Trim right'], ['b', 'Trim bottom']];

  const apply = async () => {
    setErr('');
    try {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.src = imageUrl; await img.decode();
      const left = c.l / 100, top = c.t / 100, width = 1 - (c.l + c.r) / 100, height = 1 - (c.t + c.b) / 100;
      const sw = Math.max(1, Math.round(width * img.naturalWidth)), sh = Math.max(1, Math.round(height * img.naturalHeight));
      const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
      cv.getContext('2d')!.drawImage(img, left * img.naturalWidth, top * img.naturalHeight, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error('The browser could not encode the cropped image.');
      onApply({ blob, left, top, width, height, imageWidth: sw, imageHeight: sh });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Cropping failed.'); }
  };
  const valid = c.l + c.r < 90 && c.t + c.b < 90;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="font-display">Crop to the canvas</DialogTitle>
          <DialogDescription>Trim away frame, wall and table. Your regions move with the painting, and the crop must be reviewed afterwards. The tracking target will need recompiling.</DialogDescription></DialogHeader>
        <div className="relative mx-auto max-h-[40vh] w-fit overflow-hidden rounded border bg-muted">
          <img src={imageUrl} alt="Artwork being cropped" className="max-h-[40vh] w-auto" />
          <div className="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_999px_hsl(232_35%_14%/.55)]" style={{ left: `${c.l}%`, top: `${c.t}%`, right: `${c.r}%`, bottom: `${c.b}%` }} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([k, label]) => (
            <div key={k} className="space-y-2"><Label htmlFor={`crop-${k}`}>{label}: {c[k]}%</Label>
              <Slider id={`crop-${k}`} min={0} max={45} step={1} value={[c[k]]} onValueChange={([v]) => setC((s) => ({ ...s, [k]: v }))} data-testid={`slider-crop-${k}`} /></div>
          ))}
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={busy || !valid} data-testid="button-apply-crop">{busy ? 'Uploading crop' : 'Apply crop'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
