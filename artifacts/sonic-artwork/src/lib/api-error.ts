export function errorStatus(e: unknown): number | undefined {
  return (e as { status?: number })?.status;
}
export function errorMessage(e: unknown, fallback = 'Something went wrong.'): string {
  const x = e as { data?: unknown; message?: string };
  const d = x?.data as { error?: string; message?: string } | string | null | undefined;
  const m = typeof d === 'string' ? d : d?.error ?? d?.message;
  return m ? String(m) : x?.message || fallback;
}
export type Service = 'gemini' | 'elevenlabs' | 'storage';
const HINT: Record<Service, string> = {
  gemini: 'Gemini suggestions need a working Gemini API key. Check Settings for service status.',
  elevenlabs: 'ElevenLabs is not connected yet, so sound previews cannot be generated. Check Settings.',
  storage: 'File storage may need setup before uploads work. Check Settings.',
};
export function explain(e: unknown, service?: Service, fallback?: string) {
  const base = errorMessage(e, fallback);
  const s = errorStatus(e);
  return service && (s === undefined || s >= 500 || s === 501 || s === 503 || s === 424) ? `${base} ${HINT[service]}` : base;
}
