import type { Point, SoundRegion } from '@workspace/api-client-react';
export function sampleRegion(region: SoundRegion): Point[] {
  if (!region.curved || region.points.length < 3) return region.points;
  const p = region.points, closed = region.kind === 'polygon';
  const at = (i:number) => p[closed ? (i+p.length)%p.length : Math.max(0,Math.min(p.length-1,i))];
  const result:Point[]=[];
  for(let i=0;i<p.length-(closed?0:1);i++){
    const [a,b,c,d]=[at(i-1),at(i),at(i+1),at(i+2)];
    for(let j=0;j<12;j++){
      const t=j/12,t2=t*t,t3=t2*t;
      const coord=(k:'x'|'y')=>Math.max(0,Math.min(1,0.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3)));
      result.push({x:coord('x'),y:coord('y')});
    }
  }
  if(!closed)result.push(p[p.length-1]);
  return result;
}
function segmentDistance(p:Point,a:Point,b:Point):number{
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function regionGain(region:SoundRegion,point:Point,outline:Point[]=sampleRegion(region)):number{
  let distance:number;
  if(region.falloffMode==='source') distance=Math.hypot(point.x-region.sourceX,point.y-region.sourceY);
  else {
    let inside=false;
    if(region.kind==='polygon')for(let i=0,j=outline.length-1;i<outline.length;j=i++){
      const a=outline[i],b=outline[j];
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    if(inside)distance=0;
    else {
      distance=Infinity;
      for(let i=0;i<outline.length-(region.kind==='polygon'?0:1);i++)distance=Math.min(distance,segmentDistance(point,outline[i],outline[(i+1)%outline.length]));
    }
  }
  const t=Math.max(0,Math.min(1,1-distance/region.radius));
  const attenuation=region.falloffCurve==='smooth'?t*t*(3-2*t):region.falloffCurve==='exponential'?t*t*t:t;
  return region.volume*attenuation;
}
