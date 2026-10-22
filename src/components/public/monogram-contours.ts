/** Transport one filled outline between faces. Distance-field crossfades can
 * invent intersecting rims; contour correspondence keeps one physical surface. */
import outlineSamples from './monogram-outline-samples.json';
type Point={x:number;y:number};
type Loop={points:Point[];area:number;hole:boolean};
export type Contours=Loop[];
const cache=new Map<string,Contours>();
const area=(points:Point[])=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0)/2;
const center=(points:Point[])=>points.reduce((sum,p)=>({x:sum.x+p.x/points.length,y:sum.y+p.y/points.length}),{x:0,y:0});
export function monogramContours(family:string):Contours{
 const existing=cache.get(family);if(existing)return existing;
 // Sample SVG curves once at asset-build time, not on the animation thread.
 const samples=(outlineSamples as Record<string,number[][][]>)[family];
 if(!samples)throw Error(`Missing monogram outline: ${family}`);
 const contours=samples.map(loop=>{
  const points=loop.map(([x,y])=>({x,y}));
  return {points,area:area(points),hole:false};
 }).filter(loop=>Math.abs(loop.area)>.05).sort((a,b)=>Math.abs(b.area)-Math.abs(a.area));
 const winding=Math.sign(contours[0]?.area??1);for(const loop of contours){loop.hole=Math.sign(loop.area)!==winding;if(winding<0){loop.points.reverse();loop.area*=-1;}}
 cache.set(family,contours);return contours;
}
function align(from:Point[],to:Point[]){
 // Elastic correspondence follows the actual stems and terminals, instead of
 // assigning equal perimeter fractions (which cross the M's interior).
 const anchor=(points:Point[])=>{let start=0;for(let i=1;i<points.length;i++)if(points[i].x-points[i].y*.8<points[start].x-points[start].y*.8)start=i;return [...points.slice(start),...points.slice(0,start),points[start]];};
 const a=anchor(from),b=anchor(Math.sign(area(from))===Math.sign(area(to))?to:[...to].reverse()),n=a.length,m=b.length;
 const costs=new Float64Array(n*m).fill(Infinity),steps=new Uint8Array(n*m);
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){
  const dx=a[i].x-b[j].x,dy=a[i].y-b[j].y,cost=dx*dx+dy*dy;
  if(!i&&!j){costs[0]=cost;continue;}
  const diagonal=i&&j?costs[(i-1)*m+j-1]:Infinity,vertical=i?costs[(i-1)*m+j]+32:Infinity,horizontal=j?costs[i*m+j-1]+32:Infinity;
  const best=Math.min(diagonal,vertical,horizontal);steps[i*m+j]=best===diagonal?0:best===vertical?1:2;costs[i*m+j]=cost+best;
 }
 const left:Point[]=[],right:Point[]=[];let i=n-1,j=m-1;
 while(i||j){left.push(a[i]);right.push(b[j]);const step=steps[i*m+j];if(step!==2)i--;if(step!==1)j--;}
 left.push(a[0]);right.push(b[0]);return {from:left.reverse(),to:right.reverse()};
}
export function matchMonogramContours(from:Contours,to:Contours){
 const remaining=new Set(to),pairs:{from:Point[];to:Point[];hole:boolean}[]=[];
 for(const loop of from){
  const origin=center(loop.points);let best:Loop|undefined,score=Infinity;
  for(const candidate of remaining){if(candidate.hole!==loop.hole)continue;const target=center(candidate.points),cost=Math.hypot(origin.x-target.x,origin.y-target.y)+Math.abs(Math.log((Math.abs(loop.area)+1)/(Math.abs(candidate.area)+1)))*32;if(cost<score){score=cost;best=candidate;}}
  if(best){remaining.delete(best);pairs.push({...align(loop.points,best.points),hole:loop.hole});}
  else pairs.push({from:loop.points,to:loop.points.map(()=>origin),hole:loop.hole});
 }
 for(const loop of remaining){const origin=center(loop.points);pairs.push({from:loop.points.map(()=>origin),to:loop.points,hole:loop.hole});}
 return (progress:number)=>{
  const twist=Math.sin(progress*Math.PI)*.12;
  const contours=pairs.map(pair=>{
   const points=pair.from.map((p,i)=>{
    const q=pair.to[i],x=p.x+(q.x-p.x)*progress-128,y=p.y+(q.y-p.y)*progress-128;
    const angle=twist*Math.max(0,1-Math.hypot(x,y)/170),c=Math.cos(angle),s=Math.sin(angle);
    return{x:128+x*c-y*s,y:128+x*s+y*c};
   });return {points,area:area(points),hole:pair.hole};
  });
  const path=new Path2D(),holes=new Path2D();for(const loop of contours){const outline=loop.hole?holes:path;outline.moveTo(loop.points[0].x,loop.points[0].y);for(const p of loop.points.slice(1))outline.lineTo(p.x,p.y);outline.closePath();}
  // Counters remain cutouts even while crossing a changing outside contour.
  // Nonzero-filling a temporarily exterior counter would create stray ink.
  return {path,holes,contours};
 };
}
