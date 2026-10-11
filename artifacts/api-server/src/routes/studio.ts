import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  GetServiceStatusResponse, GetStudioSummaryResponse, ListArtworksResponse,
  CreateArtworkBody, CreateArtworkResponse, GetArtworkParams, GetArtworkResponse,
  UpdateArtworkBody, UpdateArtworkResponse, DeleteArtworkParams,
  AnalyzeArtworkParams, PreviewRegionSoundParams, PreviewRegionSoundBody, PreviewRegionSoundResponse,
  PublishArtworkParams, PublishArtworkResponse, ListArtworkVersionsParams, ListArtworkVersionsResponse,
  ActivateArtworkVersionParams, ActivateArtworkVersionBody, ActivateArtworkVersionResponse,
  GetExperienceParams, GetExperienceResponse,
} from "@workspace/api-zod";
import { requireArtist, artistId } from "../middlewares/artist";
import { blankArtwork, ownedArtwork, transaction, HttpError, revision, type Artwork } from "../lib/mona-db";
import { ownedAsset, freezeAsset, storageReady } from "../lib/assets";
import { regionGeoJSON } from "../lib/geometry";
import { analyze } from "../lib/gemini-analysis";
import { elevenReady, generateLoop, spokenCue } from "../lib/elevenlabs";

const router: IRouter = Router();
const parameter = <T>(schema:{parse:(v:unknown)=>T},v:unknown):T => {
  try {return schema.parse(v);} catch {throw new HttpError(400,"Invalid request parameters");}
};
router.get("/integrations/status",async(_req,res):Promise<void>=>{
  let database=false;
  try{await pool.query("SELECT 1 FROM mona_artworks LIMIT 1");database=true;}catch{ /* Actual connectivity status, not configured-only status */ }
  res.json(GetServiceStatusResponse.parse({database,storage:storageReady(),gemini:Boolean(process.env.GEMINI_API_KEY),elevenlabs:await elevenReady(),analyticsEnabled:false}));
});
router.get("/experience/:id/versions/:version",async(req,res):Promise<void>=>{
  const {id,version}=parameter(GetExperienceParams,req.params);
  let num:number;
  if(version==="current" || version==="active"){
    const result=await pool.query("SELECT (data->>'publishedVersion')::integer AS version FROM mona_artworks WHERE id=$1",[id]);
    num=result.rows[0]?.version;
  }else num=Number(version);
  if(!Number.isSafeInteger(num)||num<1)throw new HttpError(404,"This listening experience has not been published");
  const {rows}=await pool.query("SELECT manifest FROM mona_versions WHERE artwork_id=$1 AND version=$2",[id,num]);
  if(!rows[0])throw new HttpError(404,"Listening experience not found");
  res.setHeader("Cache-Control","private, max-age=0");
  res.json(GetExperienceResponse.parse(rows[0].manifest));
});
router.use("/studio",requireArtist);
router.get("/studio/summary",async(req,res):Promise<void>=>{
  const {rows}=await pool.query(`SELECT count(*)::int AS total, count(*) FILTER(WHERE data->>'publishedVersion' IS NOT NULL)::int AS published, coalesce(sum(jsonb_array_length(data->'regions')),0)::int AS regions FROM mona_artworks WHERE owner_id=$1`,[artistId(req)]);
  const {total,published,regions}=rows[0];
  res.json(GetStudioSummaryResponse.parse({totalArtworks:total,publishedArtworks:published,totalRegions:regions,draftArtworks:total-published}));
});
router.get("/studio/artworks",async(req,res):Promise<void>=>{
  const {rows}=await pool.query("SELECT data FROM mona_artworks WHERE owner_id=$1 ORDER BY data->>'updatedAt' DESC",[artistId(req)]);
  res.json(ListArtworksResponse.parse(rows.map(row=>row.data)));
});
router.post("/studio/artworks",async(req,res):Promise<void>=>{
  const input=parameter(CreateArtworkBody,req.body);
  const data=blankArtwork(input.title,input.description);
  await pool.query("INSERT INTO mona_artworks(id,owner_id,data) VALUES($1,$2,$3)",[data.id,artistId(req),data]);
  res.status(201).json(CreateArtworkResponse.parse(data));
});
router.get("/studio/artworks/:id",async(req,res):Promise<void>=>{
  const {id}=parameter(GetArtworkParams,req.params);
  res.json(GetArtworkResponse.parse(await ownedArtwork(pool,id,artistId(req))));
});
router.patch("/studio/artworks/:id",async(req,res):Promise<void>=>{
  const {id}=parameter(GetArtworkParams,req.params), input=parameter(UpdateArtworkBody,req.body),owner=artistId(req);
  const data=await transaction(async client=>{
    const previous=await ownedArtwork(client,id,owner,true);
    if(input.revision && input.revision!==previous.updatedAt)throw new HttpError(409,"This artwork changed in another tab. Reload before saving.");
    const {revision:expected,...changes}=input;
    const next:Artwork={...previous,...changes,updatedAt:revision()};
    const imageChanged=next.imageUrl!==previous.imageUrl;
    if(next.imageUrl) {
      const file=await ownedAsset(next.imageUrl,owner,["image/jpeg","image/png","image/webp"],client);
      if(imageChanged){
        const [bytes]=await file.download();
        const sharp=(await import("sharp")).default;
        const meta=await sharp(bytes,{limitInputPixels:50000000}).metadata();
        if(!meta.width||!meta.height)throw new HttpError(400,"Invalid artwork image");
        next.imageWidth=meta.width;next.imageHeight=meta.height;
      }
    }
    if(imageChanged){
      next.needsReview=previous.regions.length>0 || next.regions.length>0;
      next.targetUrl=null;next.targetImageUrl=null;
    } else if(next.targetUrl){
      await ownedAsset(next.targetUrl,owner,["application/octet-stream"],client);
      if(next.targetImageUrl!==next.imageUrl)throw new HttpError(400,"Tracking target must be compiled from the current cropped image");
    }
    if(next.regions.length>32)throw new HttpError(400,"An artwork supports at most 32 sound regions");
    if(new Set(next.regions.map(r=>r.id)).size!==next.regions.length)throw new HttpError(400,"Each sound region needs a unique ID");
    await client.query("DELETE FROM mona_regions WHERE artwork_id=$1",[id]);
    for(const region of next.regions){
      if(region.audioUrl)await ownedAsset(region.audioUrl,owner,["audio/mpeg","audio/wav","audio/x-wav","audio/mp4"],client);
      if(!region.audioUrl||region.audioPrompt!==region.prompt)region.approved=false;
      // Incomplete outlines can be saved as drafts, but cannot be published.
      if(region.points.length<(region.kind==="polygon"?3:2))continue;
      let geo:object;
      try{geo=regionGeoJSON(region);}catch{throw new HttpError(400,`Invalid outline for ${region.name}`);}
      const validity=await client.query("SELECT ST_IsValid(ST_GeomFromGeoJSON($1)) AS valid",[JSON.stringify(geo)]);
      if(!validity.rows[0].valid && !next.needsReview)throw new HttpError(400,`The outline for "${region.name}" intersects itself. Edit the points before saving.`);
      await client.query("INSERT INTO mona_regions(artwork_id,id,kind,shape,settings) VALUES($1,$2,$3,ST_GeomFromGeoJSON($4),$5)",[id,region.id,region.kind,JSON.stringify(geo),region]);
    }
    await client.query("UPDATE mona_artworks SET data=$1 WHERE id=$2 AND owner_id=$3",[next,id,owner]);
    return next;
  });
  res.json(UpdateArtworkResponse.parse(data));
});
router.delete("/studio/artworks/:id",async(req,res):Promise<void>=>{
  const {id}=parameter(DeleteArtworkParams,req.params);
  const {rowCount}=await pool.query("DELETE FROM mona_artworks WHERE id=$1 AND owner_id=$2",[id,artistId(req)]);
  if(!rowCount)throw new HttpError(404,"Artwork not found");
  res.sendStatus(204);
});
router.post("/studio/artworks/:id/analyze",async(req,res):Promise<void>=>{
  const {id}=parameter(AnalyzeArtworkParams,req.params),owner=artistId(req);
  const result=await transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`${owner}:${id}:analyze`]);
    return analyze(await ownedArtwork(client,id,owner),owner);
  });
  res.json(result);
});
router.post("/studio/artworks/:id/regions/:regionId/preview",async(req,res):Promise<void>=>{
  const {id,regionId}=parameter(PreviewRegionSoundParams,req.params),input=parameter(PreviewRegionSoundBody,req.body),owner=artistId(req);
  const result=await transaction(async client=>{
    const data=await ownedArtwork(client,id,owner,true);
    const region=data.regions.find(r=>r.id===regionId);
    if(!region)throw new HttpError(404,"Save the sound region before generating a preview");
    if(region.prompt!==input.prompt)throw new HttpError(409,"Save the current sound prompt before generating");
    const audioUrl=await generateLoop(input.prompt,input.duration??10,owner);
    region.audioUrl=audioUrl;region.audioPrompt=input.prompt;region.approved=false;
    data.updatedAt=revision();
    await client.query("UPDATE mona_artworks SET data=$1 WHERE id=$2 AND owner_id=$3",[data,id,owner]);
    return {audioUrl,prompt:input.prompt,revision:data.updatedAt};
  });
  res.json(PreviewRegionSoundResponse.parse(result));
});
router.get("/studio/artworks/:id/versions",async(req,res):Promise<void>=>{
  const {id}=parameter(ListArtworkVersionsParams,req.params);
  const artwork=await ownedArtwork(pool,id,artistId(req));
  const {rows}=await pool.query("SELECT version,created_at,jsonb_array_length(manifest->'regions') AS regions FROM mona_versions WHERE artwork_id=$1 ORDER BY version DESC",[id]);
  res.json(ListArtworkVersionsResponse.parse(rows.map(r=>({version:r.version,viewerPath:`/listen/${id}/${r.version}`,createdAt:r.created_at.toISOString(),regionCount:r.regions,active:r.version===artwork.publishedVersion}))));
});
router.post("/studio/artworks/:id/active-version",async(req,res):Promise<void>=>{
  const {id}=parameter(ActivateArtworkVersionParams,req.params),{version}=parameter(ActivateArtworkVersionBody,req.body),owner=artistId(req);
  const data=await transaction(async client=>{
    const artwork=await ownedArtwork(client,id,owner,true);
    const {rowCount}=await client.query("SELECT 1 FROM mona_versions WHERE artwork_id=$1 AND version=$2",[id,version]);
    if(!rowCount)throw new HttpError(404,"Published version not found");
    artwork.publishedVersion=version;artwork.updatedAt=revision();
    await client.query("UPDATE mona_artworks SET data=$1 WHERE id=$2",[artwork,id]);
    return artwork;
  });
  res.json(ActivateArtworkVersionResponse.parse(data));
});
router.post("/studio/artworks/:id/publish",async(req,res):Promise<void>=>{
  const {id}=parameter(PublishArtworkParams,req.params),owner=artistId(req);
  const result=await transaction(async client=>{
    const draft=await ownedArtwork(client,id,owner,true);
    if(!draft.imageUrl||!draft.targetUrl||draft.targetImageUrl!==draft.imageUrl)throw new HttpError(400,"Upload your image and compile its current camera target before publishing");
    if(draft.needsReview)throw new HttpError(400,"Review the preserved region mappings after re-cropping");
    if(!draft.altText.trim())throw new HttpError(400,"Add an artwork description for blind visitors");
    if(!draft.regions.length)throw new HttpError(400,"Add at least one sound region");
    for(const region of draft.regions)if(!region.approved||!region.audioUrl||region.audioPrompt!==region.prompt||region.points.length<(region.kind==="polygon"?3:2))throw new HttpError(400,`"${region.name}" needs a complete outline and approved audio`);
    const invalid=await client.query("SELECT id FROM mona_regions WHERE artwork_id=$1 AND NOT ST_IsValid(shape)",[id]);
    if(invalid.rows.length)throw new HttpError(400,"One or more region outlines need correction before publishing");
    const {rows}=await client.query("SELECT coalesce(max(version),0)+1 AS version FROM mona_versions WHERE artwork_id=$1",[id]);
    const version=Number(rows[0].version);
    // Only narration is synthesized at publish. Approved loops are copied byte-for-byte.
    const alignment=await spokenCue("Point your iPhone toward the artwork. Move slowly until the sounds begin. You can explore from a distance or move closer to a detail.",owner);
    const lost=await spokenCue("The artwork is out of view. Move back a little and point toward the painting to hear it again.",owner);
    const description=await spokenCue(draft.altText,owner);
    const frozen=new Map<string,string>();
    const freeze=async(url:string)=>{
      if(!frozen.has(url))frozen.set(url,await freezeAsset(url,owner,id,client));
      return frozen.get(url)!;
    };
    const regions=[];
    for(const region of draft.regions)regions.push({...region,audioUrl:await freeze(region.audioUrl!)});
    const manifest=GetExperienceResponse.parse({
      artworkId:id,title:draft.title,version,imageUrl:await freeze(draft.imageUrl),imageWidth:draft.imageWidth,imageHeight:draft.imageHeight,altText:draft.altText,
      targetUrl:await freeze(draft.targetUrl),regions,alignmentAudioUrl:await freeze(alignment),lostAudioUrl:await freeze(lost),descriptionAudioUrl:await freeze(description),
    });
    await client.query("INSERT INTO mona_versions(artwork_id,version,manifest) VALUES($1,$2,$3)",[id,version,manifest]);
    if(draft.publishedVersion===null)draft.publishedVersion=version;
    draft.updatedAt=revision();
    await client.query("UPDATE mona_artworks SET data=$1 WHERE id=$2",[draft,id]);
    return {version,viewerPath:`/listen/${id}/${version}`,createdAt:draft.updatedAt,regionCount:regions.length,active:draft.publishedVersion===version};
  });
  res.status(201).json(PublishArtworkResponse.parse(result));
});
export default router;
