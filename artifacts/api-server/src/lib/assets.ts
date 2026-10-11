import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import { HttpError } from "./mona-db";
import type { PoolClient } from "pg";

export const storage = new ObjectStorageService();
const prefix = "/api/storage";
export const storageReady = () => Boolean(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID && process.env.PRIVATE_OBJECT_DIR);
export function assetPath(url: string): string {
  if (!/^\/api\/storage\/objects\/uploads\/[a-zA-Z0-9_-]+$/.test(url)) throw new HttpError(400,"Only MonaListen uploaded assets are allowed");
  return url.slice(prefix.length);
}
export async function ownedAsset(url: string, owner: string, types?: string[], client: Pick<PoolClient,"query">=pool) {
  const path=assetPath(url);
  const {rows}=await client.query("SELECT * FROM mona_assets WHERE path=$1 AND owner_id=$2",[path,owner]);
  if (!rows[0]) throw new HttpError(400,"The uploaded asset does not belong to your account");
  if (types && !types.includes(rows[0].mime)) throw new HttpError(400,"Wrong file type for this asset");
  const file=await storage.getObjectEntityFile(path);
  const [metadata]=await file.getMetadata();
  if (Number(metadata.size)>20000000 || Number(metadata.size)!==Number(rows[0].size)) throw new HttpError(400,"Upload is incomplete or exceeds its declared size");
  return file;
}
export async function saveBytes(bytes: Buffer, owner: string, mime: string): Promise<string> {
  if (!storageReady()) throw new HttpError(503,"App Storage is not configured");
  const signed=await storage.getObjectEntityUploadURL();
  const path=storage.normalizeObjectEntityPath(signed);
  // File does not yet exist; resolve its canonical bucket from PRIVATE_OBJECT_DIR.
  const dir=process.env.PRIVATE_OBJECT_DIR!;
  const slash=dir.indexOf("/",1), bucket=dir.slice(1,slash), root=dir.slice(slash+1);
  const { objectStorageClient } = await import("./objectStorage");
  await objectStorageClient.bucket(bucket).file(`${root}/${path.slice("/objects/".length)}`).save(bytes,{contentType:mime,resumable:false});
  await pool.query("INSERT INTO mona_assets(path,owner_id,mime,size) VALUES($1,$2,$3,$4)",[path,owner,mime,bytes.length]);
  return prefix+path;
}
export async function freezeAsset(url:string,owner:string,artworkId:string,client:PoolClient):Promise<string> {
  const source=await ownedAsset(url,owner,undefined,client);
  const [meta]=await source.getMetadata();
  const suffix=randomUUID();
  const path=`/objects/uploads/${suffix}`;
  const dir=process.env.PRIVATE_OBJECT_DIR!;
  const slash=dir.indexOf("/",1), bucket=dir.slice(1,slash), root=dir.slice(slash+1);
  const { objectStorageClient }=await import("./objectStorage");
  const dest=objectStorageClient.bucket(bucket).file(`${root}/uploads/${suffix}`);
  await source.copy(dest);
  await client.query("INSERT INTO mona_assets(path,owner_id,mime,size,public,artwork_id) VALUES($1,$2,$3,$4,true,$5)",[path,owner,meta.contentType||"application/octet-stream",Number(meta.size),artworkId]);
  return prefix+path;
}
