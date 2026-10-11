import { ReplitConnectors } from "@replit/connectors-sdk";
import { createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { saveBytes } from "./assets";
import { HttpError } from "./mona-db";

const connectors=new ReplitConnectors();
let status:{ready:boolean;until:number}|undefined;
export async function elevenReady():Promise<boolean> {
  if(status && status.until>Date.now())return status.ready;
  try {
    const response=await connectors.proxy("elevenlabs","/v1/models",{method:"GET"});
    status={ready:response.ok,until:Date.now()+30000};
  }catch{status={ready:false,until:Date.now()+30000};}
  return status.ready;
}
async function audioRequest(path:string,body:object,owner:string):Promise<string>{
  let response:Response;
  try{response=await connectors.proxy("elevenlabs",path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}
  catch{throw new HttpError(503,"Connect ElevenLabs to generate sound and spoken guidance");}
  if(!response.ok)throw new HttpError(502,`ElevenLabs could not generate audio (${response.status}). Check connection permissions and credits.`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length||bytes.length>20000000)throw new HttpError(502,"ElevenLabs returned an invalid audio file");
  return saveBytes(bytes,owner,"audio/mpeg");
}
export async function generateLoop(prompt:string,duration:number,owner:string):Promise<string> {
  return audioRequest("/v1/sound-generation",{text:prompt,duration_seconds:duration,model_id:"eleven_text_to_sound_v2",loop:true,prompt_influence:0.3},owner);
}
export async function spokenCue(text:string,owner:string):Promise<string>{
  const hash=createHash("sha256").update(text).digest("hex");
  const {rows}=await pool.query("SELECT url FROM mona_cues WHERE owner_id=$1 AND text_hash=$2",[owner,hash]);
  if(rows[0])return rows[0].url;
  // Query available voices rather than assume a hard-coded voice is accessible.
  let voices:Response;
  try{voices=await connectors.proxy("elevenlabs","/v1/voices",{method:"GET"});}catch{throw new HttpError(503,"Connect ElevenLabs before publishing audible guidance");}
  if(!voices.ok)throw new HttpError(502,"ElevenLabs voices could not be loaded");
  const data=await voices.json() as {voices?:{voice_id:string}[]};
  const voice=data.voices?.[0]?.voice_id;
  if(!voice)throw new HttpError(502,"Your ElevenLabs account has no available voice");
  const url=await audioRequest(`/v1/text-to-speech/${encodeURIComponent(voice)}`,{text,model_id:"eleven_multilingual_v2"},owner);
  await pool.query("INSERT INTO mona_cues(owner_id,text_hash,url) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[owner,hash,url]);
  return url;
}
