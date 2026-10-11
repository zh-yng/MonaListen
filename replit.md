# MonaListen

Artists create spatial sound experiences for physical paintings. The artist studio is a laptop-friendly web app; visitors use the account-free iPhone camera experience.

## Development

- Frontend: `artifacts/sonic-artwork`, preview `/`, managed workflow `artifacts/sonic-artwork: web`.
- Backend: `artifacts/api-server`, preview `/api`, managed workflow `artifacts/api-server: API Server`.
- `pnpm run typecheck` checks all workspace packages.
- Frontend build: `PORT=24499 BASE_PATH=/ pnpm --filter @workspace/sonic-artwork run build`.
- API contract: `lib/api-spec/openapi.yaml`; regenerate with `pnpm --filter @workspace/api-spec run codegen`.
- Use generated clients from `@workspace/api-client-react` and generated server validators from `@workspace/api-zod`.

## Services and persistence

- Artist identity: Replit-managed Clerk; web API calls use session cookies, never manual bearer-token getters.
- Database: existing external Tiger Cloud via `TIGER_DATABASE_URL`. Dedicated `mona_*` tables and PostGIS are initialized additively by `artifacts/api-server/src/lib/mona-db.ts`.
- Do not run the template Drizzle `push` command against this database. It does not describe the PostGIS/application tables.
- App Storage: direct presigned PUT uploads, metadata/ownership in PostgreSQL, bytes never in PostgreSQL.
- Gemini: user's own `GEMINI_API_KEY`, standard Google GenAI SDK, artist-triggered Analyze only.
- ElevenLabs: Replit connector `elevenlabs`, called only server-side; unavailable connections return explicit errors.
- Service keys are managed through Secrets; do not print values.

## Playback and publishing

- Browser compiler and tracker use the pinned MindAR 1.2.5 browser distribution.
- Matching Three.js browser dependency is mapped in the HTML import map.
- Normalized region coordinates have a top-left origin. Cubic spline sampling must match across editor, backend spatial storage, and playback.
- Each published version snapshots geometry/settings and copies already approved audio unchanged. Stable links change only on explicit version activation.
- Visitor positions and camera images never leave the device; no anonymous session analytics or position logs.
- Physical iPhone/painting validation is required before making claims about close-up tracking reliability.
