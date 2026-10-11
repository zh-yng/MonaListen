import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { Readable } from "node:stream";
import { pool } from "@workspace/db";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { requireArtist, artistId } from "../middlewares/artist";
import { storage, storageReady } from "../lib/assets";
import { HttpError } from "../lib/mona-db";

const router: IRouter = Router();
const allowed = ["image/jpeg","image/png","image/webp","audio/mpeg","audio/wav","audio/x-wav","audio/mp4","application/octet-stream"];
router.post("/storage/uploads/request-url",requireArtist,async(req,res):Promise<void>=>{
  const body=RequestUploadUrlBody.safeParse(req.body);
  if (!body.success) throw new HttpError(400,"Invalid upload metadata (limit 20 MB)");
  if (!allowed.includes(body.data.contentType)) throw new HttpError(400,"Upload a PNG, JPEG, WebP, audio file, or compiled .mind target");
  if (!storageReady()) throw new HttpError(503,"App Storage is not configured");
  const uploadURL=await storage.getObjectEntityUploadURL();
  const objectPath=storage.normalizeObjectEntityPath(uploadURL);
  await pool.query("INSERT INTO mona_assets(path,owner_id,mime,size) VALUES($1,$2,$3,$4)",[objectPath,artistId(req),body.data.contentType,body.data.size]);
  res.json(RequestUploadUrlResponse.parse({uploadURL,objectPath}));
});
router.get("/storage/objects/*path",async(req,res):Promise<void>=>{
  const raw=req.params.path;
  const suffix=Array.isArray(raw)?raw.join("/"):raw;
  if (!/^uploads\/[a-zA-Z0-9_-]+$/.test(suffix)) throw new HttpError(404,"File not found");
  const path="/objects/"+suffix;
  const {rows}=await pool.query("SELECT * FROM mona_assets WHERE path=$1",[path]);
  const asset=rows[0];
  if (!asset || (!asset.public && asset.owner_id!==getAuth(req).userId)) throw new HttpError(404,"File not found");
  const file=await storage.getObjectEntityFile(path);
  const response=await storage.downloadObject(file,asset.public?86400:0);
  res.setHeader("Content-Type",asset.mime);
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Cache-Control",asset.public?"public, max-age=86400, immutable":"private, no-store");
  if(response.headers.get("content-length")) res.setHeader("Content-Length",response.headers.get("content-length")!);
  Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).on("error",()=>res.destroy()).pipe(res);
});
router.get("/storage/public-objects/*path",async(req,res):Promise<void>=>{
  const raw=req.params.path;
  const path=Array.isArray(raw)?raw.join("/"):raw;
  if(path.includes("..")) throw new HttpError(404,"File not found");
  const file=await storage.searchPublicObject(path);
  if(!file) throw new HttpError(404,"File not found");
  const response=await storage.downloadObject(file);
  res.setHeader("Content-Type",response.headers.get("Content-Type")||"application/octet-stream");
  Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).on("error",()=>res.destroy()).pipe(res);
});
export default router;
