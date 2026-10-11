export interface ScreenPoint { x: number; y: number }
export interface ViewportBounds { left: number; top: number; width: number; height: number }

/** Convert the visible reticle's CSS-pixel center to the renderer's camera coordinates. */
export function screenPointToNdc(point: ScreenPoint, viewport: ViewportBounds): ScreenPoint | null {
  if (![point.x, point.y, viewport.left, viewport.top, viewport.width, viewport.height].every(Number.isFinite)
      || viewport.width <= 0 || viewport.height <= 0) return null;
  const x = (point.x - viewport.left) / viewport.width;
  const y = (point.y - viewport.top) / viewport.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: x * 2 - 1, y: 1 - y * 2 };
}
