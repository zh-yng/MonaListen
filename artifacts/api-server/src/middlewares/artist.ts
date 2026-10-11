import { getAuth } from "@clerk/express";
import type { RequestHandler, Request } from "express";
import { HttpError } from "../lib/mona-db";

export const requireArtist: RequestHandler = (req,res,next) => {
  if (!getAuth(req).userId) { res.status(401).json({error:"Sign in to your artist account"}); return; }
  next();
};
export function artistId(req: Request): string {
  const id=getAuth(req).userId;
  if (!id) throw new HttpError(401,"Sign in to your artist account");
  return id;
}
