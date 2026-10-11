import { pool } from "@workspace/db";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { GetArtworkResponse } from "@workspace/api-zod";

export type Artwork = ReturnType<typeof GetArtworkResponse.parse>;
export type Region = Artwork["regions"][number];
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}
export async function ownedArtwork(client: Pick<PoolClient, "query">, id: string, owner: string, lock = false): Promise<Artwork> {
  const result = await client.query(
    `SELECT data FROM mona_artworks WHERE id=$1 AND owner_id=$2 ${lock ? "FOR UPDATE" : ""}`, [id, owner],
  );
  if (!result.rows[0]) throw new HttpError(404, "Artwork not found");
  return GetArtworkResponse.parse(result.rows[0].data);
}
export function blankArtwork(title: string, description = ""): Artwork {
  const now = new Date().toISOString();
  return { id: randomUUID(), title, description, altText: "", imageUrl: null, imageWidth: 0, imageHeight: 0, targetUrl: null, targetImageUrl: null, regions: [], needsReview: false, publishedVersion: null, createdAt: now, updatedAt: now };
}
export function revision(): string { return new Date().toISOString(); }

export async function migrate() {
  // Additive, isolated MonaListen tables; no existing application tables touched.
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE TABLE IF NOT EXISTS mona_artworks (
      id text PRIMARY KEY, owner_id text NOT NULL, data jsonb NOT NULL
    );
    CREATE INDEX IF NOT EXISTS mona_artworks_owner ON mona_artworks(owner_id);
    CREATE TABLE IF NOT EXISTS mona_regions (
      artwork_id text NOT NULL REFERENCES mona_artworks(id) ON DELETE CASCADE,
      id text NOT NULL, kind text NOT NULL, shape geometry(Geometry,0) NOT NULL,
      settings jsonb NOT NULL, PRIMARY KEY(artwork_id,id)
    );
    CREATE INDEX IF NOT EXISTS mona_regions_shape ON mona_regions USING gist(shape);
    CREATE TABLE IF NOT EXISTS mona_versions (
      artwork_id text NOT NULL REFERENCES mona_artworks(id) ON DELETE CASCADE,
      version integer NOT NULL, manifest jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(artwork_id,version)
    );
    CREATE TABLE IF NOT EXISTS mona_assets (
      path text PRIMARY KEY, owner_id text NOT NULL, mime text NOT NULL,
      size bigint NOT NULL, public boolean NOT NULL DEFAULT false,
      artwork_id text REFERENCES mona_artworks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS mona_cues (
      owner_id text NOT NULL, text_hash text NOT NULL, url text NOT NULL,
      PRIMARY KEY(owner_id,text_hash)
    );
  `);
}
