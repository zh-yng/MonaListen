import type { ExperienceManifest } from '@workspace/api-client-react';
import { Matrix4, Vector3 } from 'three';
import { regionGain, sampleRegion } from './region-geometry';
export interface ViewerSession {
  pause(): void;
  resume(): Promise<void>;
  describe(): Promise<void>;
  setVolume(value: number): void;
  stop(): void;
}
export async function startExperience(
  container: HTMLElement,
  manifest: ExperienceManifest,
  callbacks: { onStatus: (status: 'searching' | 'tracking' | 'lost' | 'paused') => void; onError: (message: string) => void },
): Promise<ViewerSession> {
  const iphone=/iPhone|iPod/.test(navigator.userAgent);
  if(!iphone)throw new Error('This listening experience requires an iPhone. Open the shared link in Safari on an iPhone.');
  if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)throw new Error('Camera tracking needs a secure browser page. Open this link directly in iPhone Safari.');
  // Unlock Web Audio immediately during the Begin button's user gesture.
  const context=new AudioContext();
  await context.resume();
  const abort=new AbortController();
  const sources:AudioBufferSourceNode[]=[];
  let mind:any,anchor:any,stopped=false,paused=false,tracked=false,everTracked=false;
  let lostTimer:ReturnType<typeof setTimeout>|undefined;
  let cueSource:AudioBufferSourceNode|undefined;
  let describing=false;
  const master=context.createGain();master.gain.value=0.8;
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-12;compressor.knee.value=18;compressor.ratio.value=8;
  master.connect(compressor);compressor.connect(context.destination);
  const loops=manifest.regions.map(region=>{
    const gain=context.createGain();gain.gain.value=0;
    const pan=context.createStereoPanner();pan.pan.value=region.pan;
    gain.connect(pan);pan.connect(master);
    return {region,outline:sampleRegion(region),gain,pan};
  });
  async function decode(url:string):Promise<AudioBuffer>{
    const response=await fetch(url,{signal:abort.signal});
    if(!response.ok)throw new Error('An experience audio file could not be loaded. Ask the artist to check this published version.');
    return context.decodeAudioData(await response.arrayBuffer());
  }
  const stopCue=()=>{try{cueSource?.stop();}catch{/* already ended */}cueSource=undefined;};
  async function playCue(buffer:AudioBuffer):Promise<void>{
    if(stopped)return;
    stopCue();
    const source=context.createBufferSource();source.buffer=buffer;source.connect(master);cueSource=source;
    await new Promise<void>(resolve=>{source.onended=()=>resolve();source.start();});
  }
  const fade=()=>loops.forEach(loop=>loop.gain.gain.setTargetAtTime(0,context.currentTime,0.15));
  const visibility=()=>{if(document.hidden)session.pause();};
  const pageHide=()=>session.stop();
  const session:ViewerSession={
    pause(){
      if(stopped)return;
      paused=true;tracked=false;fade();stopCue();describing=false;
      if(lostTimer)clearTimeout(lostTimer);
      mind?.controller?.stopProcessVideo();
      mind?.video?.srcObject?.getTracks().forEach((t:MediaStreamTrack)=>{t.enabled=false;});
      if(anchor)anchor.visible=false;
      callbacks.onStatus('paused');
    },
    async resume(){
      if(stopped)throw new Error('This session has ended. Begin listening again.');
      await context.resume();
      paused=false;tracked=false;
      mind.video.srcObject.getTracks().forEach((t:MediaStreamTrack)=>{t.enabled=true;});
      mind.controller.processVideo(mind.video);
      callbacks.onStatus('searching');
    },
    async describe(){
      if(stopped||paused)return;
      describing=true;fade();
      try{
        if(!manifest.descriptionAudioUrl)throw new Error('This artwork has no spoken description.');
        await playCue(await decode(manifest.descriptionAudioUrl));
      }finally{describing=false;}
    },
    setVolume(value){master.gain.setTargetAtTime(Math.max(0,Math.min(1,value)),context.currentTime,0.05);},
    stop(){
      if(stopped)return;
      stopped=true;abort.abort();if(lostTimer)clearTimeout(lostTimer);
      stopCue();sources.forEach(s=>{try{s.stop();}catch{/* already stopped */}});
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('pagehide',pageHide);
      mind?.renderer?.setAnimationLoop(null);
      try{mind?.controller?.stopProcessVideo();}catch{/* startup may be incomplete */}
      mind?.video?.srcObject?.getTracks().forEach((t:MediaStreamTrack)=>t.stop());
      mind?.video?.remove();mind?.renderer?.dispose();
      mind?.renderer?.domElement?.remove();mind?.cssRenderer?.domElement?.remove();
      void context.close();
    },
  };
  try{
    callbacks.onStatus('searching');
    const mindUrl='https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
    const [{MindARThree},buffers,alignment,lost]=await Promise.all([
      import(/* @vite-ignore */mindUrl),
      Promise.all(loops.map(l=>decode(l.region.audioUrl!))),
      decode(manifest.alignmentAudioUrl),
      decode(manifest.lostAudioUrl),
    ]);
    if(!container.isConnected)throw new Error('The listening page was closed.');
    const startTime=context.currentTime+0.1;
    buffers.forEach((buffer,i)=>{
      const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(loops[i].gain);source.start(startTime);sources.push(source);
    });
    container.style.isolation='isolate';
    mind=new MindARThree({container,imageTargetSrc:manifest.targetUrl,maxTrack:1,uiLoading:'no',uiScanning:'no',uiError:'no',warmupTolerance:3,missTolerance:5});
    anchor=mind.addAnchor(0);
    anchor.onTargetFound=()=>{
      if(stopped||paused)return;
      tracked=true;everTracked=true;
      if(lostTimer)clearTimeout(lostTimer);
      if(!describing)stopCue();
      callbacks.onStatus('tracking');
    };
    anchor.onTargetLost=()=>{
      if(stopped||paused)return;
      tracked=false;fade();callbacks.onStatus('lost');
      if(lostTimer)clearTimeout(lostTimer);
      lostTimer=setTimeout(()=>{if(!tracked&&!paused&&!stopped&&everTracked)void playCue(lost);},750);
    };
    await mind.start();
    if(!container.isConnected){session.stop();throw new Error('The listening page was closed.');}
    mind.video.style.zIndex='0';
    mind.renderer.domElement.style.zIndex='1';
    mind.cssRenderer.domElement.style.zIndex='2';
    const inv=new Matrix4(),origin=new Vector3(),point=new Vector3();
    const aspect=manifest.imageHeight/manifest.imageWidth;
    mind.renderer.setAnimationLoop(()=>{
      if(stopped)return;
      // All geometry and positional mixing stays on-device. No API/DB per frame.
      mind.scene.updateMatrixWorld(true);mind.camera.updateMatrixWorld(true);
      if(tracked&&!paused&&!describing&&anchor.group.visible){
        inv.copy(anchor.group.matrixWorld).invert();
        origin.setFromMatrixPosition(mind.camera.matrixWorld).applyMatrix4(inv);
        point.set(0,0,0.5).unproject(mind.camera).applyMatrix4(inv).sub(origin).normalize();
        const t=-origin.z/point.z;
        if(Number.isFinite(t)&&t>=0){
          const p={x:origin.x+t*point.x+0.5,y:0.5-(origin.y+t*point.y)/aspect};
          for(const loop of loops){
            const gain=regionGain(loop.region,p,loop.outline);
            loop.gain.gain.setTargetAtTime(gain,context.currentTime,0.12);
            loop.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,loop.region.pan+(loop.region.sourceX-p.x)*0.6)),context.currentTime,0.12);
          }
        }else fade();
      }else fade();
      mind.renderer.render(mind.scene,mind.camera);
    });
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',pageHide);
    if(!tracked)void playCue(alignment);
    return session;
  }catch(error){
    session.stop();
    const message=error instanceof Error?error.message:'Camera access failed. Allow camera permission in iPhone Safari.';
    callbacks.onError(message);
    throw new Error(message);
  }
}
