type Point={x:number;y:number};
const smooth=(t:number)=>{const v=Math.max(0,Math.min(1,t));return v*v*v*(v*(v*6-15)+10);};
/** Seeded value noise has zero velocity/acceleration at each random knot. */
export function cursorNoise(time:number,seed:number){
 const at=(i:number)=>{const value=Math.sin(i*127.1+seed*311.7)*43758.5453;return (value-Math.floor(value))*2-1;};
 const i=Math.floor(time),blend=smooth(time-i);return at(i)+(at(i+1)-at(i))*blend;
}

/** An asymmetric, tapered ribbon, not a dashed line with two visible caps. */
export function cursorGlow(points:Point[],position:number,span:number,width:number,time:number,seed:number){
 const sample=(t:number)=>{
  const index=((t%1+1)%1)*points.length,i=Math.floor(index),f=index-i,a=points[i],b=points[(i+1)%points.length];
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
 };
 const inner:Point[]=[],outer:Point[]=[];
 for(let i=0;i<=48;i++){
  const t=i/48,p=position-span+t*span,c=sample(p),a=sample(p-.002),b=sample(p+.002);
  const length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
  const envelope=smooth(t/.52)*smooth((1-t)/.36);
  const uneven=.82+cursorNoise(t*3.4+time*.32,seed+9)*.3;
  const half=width*envelope*uneven,drift=Math.sin(t*9+time*.71)*.45*envelope;
  outer.push({x:c.x+nx*(half+drift),y:c.y+ny*(half+drift)});
  inner.push({x:c.x+nx*(-half+drift),y:c.y+ny*(-half+drift)});
 }
 return [...outer,...inner.reverse()].map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')+'Z';
}
