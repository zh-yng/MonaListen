// Browser-only distributed build avoids MindAR's unused Node/canvas dependencies.
const compilerUrl='https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';
export async function compileTarget(imageUrl: string, onProgress?: (percent: number) => void): Promise<Blob> {
  onProgress?.(0);
  let module:any;
  try{module=await import(/* @vite-ignore */compilerUrl);}
  catch{throw new Error('The camera target compiler could not load. Check your connection and try again.');}
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('The artwork image could not be loaded for target compilation.'));
    img.src=imageUrl;
  });
  if(image.naturalWidth<128||image.naturalHeight<128)throw new Error('Use an image at least 128 pixels wide and tall for camera tracking.');
  // Bound GPU usage without changing normalized coordinates or artwork aspect.
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
  const compiler=new module.Compiler();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const data:any[]=await Promise.race([
      compiler.compileImageTargets([canvas],(p:number)=>onProgress?.(Math.round(p))),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Target compilation took too long. Try a smaller image or a browser with WebGL enabled.')),180000);}),
    ]);
    if(!data[0]?.trackingData?.length)throw new Error('This image has too few distinctive details for tracking. Try a sharper, higher-contrast artwork photograph.');
    const bytes=compiler.exportData() as Uint8Array;
    onProgress?.(100);
    return new Blob([new Uint8Array(bytes)],{type:'application/octet-stream'});
  }finally{if(timer)clearTimeout(timer);}
}
