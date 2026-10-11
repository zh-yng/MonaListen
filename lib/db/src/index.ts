import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.TIGER_DATABASE_URL) {
  throw new Error("TIGER_DATABASE_URL must be set for MonaListen.");
}
const connectionUrl = new URL(process.env.TIGER_DATABASE_URL);
// Honor the explicitly supplied libpq SSL mode; do not silently retry with
// weaker verification. Tiger's require mode encrypts, but does not verify CA.
if (connectionUrl.searchParams.get("sslmode") === "require") {
  connectionUrl.searchParams.set("uselibpqcompat", "true");
}
export const pool = new Pool({
  connectionString: connectionUrl.toString(),
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
