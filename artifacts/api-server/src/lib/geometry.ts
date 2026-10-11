import type { Region } from "./mona-db";

type Point = { x: number; y: number };
export function sampleRegion(region: Pick<Region, "points" | "curved" | "kind">): Point[] {
  if (!region.curved || region.points.length < 3) return region.points;
  const p = region.points;
  const closed = region.kind === "polygon";
  const at = (i: number) => p[closed ? (i + p.length) % p.length : Math.max(0, Math.min(p.length - 1, i))];
  const result: Point[] = [];
  for (let i = 0; i < p.length - (closed ? 0 : 1); i++) {
    const [a,b,c,d] = [at(i-1),at(i),at(i+1),at(i+2)];
    for (let j=0; j<12; j++) {
      const t=j/12, t2=t*t, t3=t2*t;
      const coord = (key: "x"|"y") => Math.max(0,Math.min(1,0.5*((2*b[key])+(-a[key]+c[key])*t+(2*a[key]-5*b[key]+4*c[key]-d[key])*t2+(-a[key]+3*b[key]-3*c[key]+d[key])*t3)));
      result.push({x:coord("x"),y:coord("y")});
    }
  }
  if (!closed) result.push(p[p.length-1]);
  return result;
}
export function regionGeoJSON(region: Region) {
  const pts=sampleRegion(region).map(p=>[p.x,p.y]);
  if (region.kind === "polygon") {
    if (pts.length<3) throw new Error(`Region "${region.name}" needs at least three points`);
    return {type:"Polygon",coordinates:[[...pts,pts[0]]]};
  }
  if (pts.length<2) throw new Error(`Path "${region.name}" needs at least two points`);
  return {type:"LineString",coordinates:pts};
}
