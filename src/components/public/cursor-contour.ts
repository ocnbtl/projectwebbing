/** Uniform perimeter sampling keeps even the ends of a wide capsule smooth. */
export function cursorContourPoints(width:number,height:number,time=0,energy=0,pullX=0,pullY=0){
 const horizontal=width>=height,radius=Math.max(1,Math.min(width,height)/2-1),half=Math.abs(width-height)/2;
 const points=[],straight=half*2,arc=Math.PI*radius,total=straight*2+arc*2;
 for(let i=0;i<192;i++){
  const distance=i/192*total;
  let px:number,py:number,nx=0,ny=0;
  if(distance<straight){px=-half+distance;py=-radius;ny=-1;}
  else if(distance<straight+arc){const angle=(distance-straight)/radius-Math.PI/2;px=half+Math.cos(angle)*radius;py=Math.sin(angle)*radius;nx=Math.cos(angle);ny=Math.sin(angle);}
  else if(distance<straight*2+arc){px=half-(distance-straight-arc);py=radius;ny=1;}
  else {const angle=(distance-straight*2-arc)/radius+Math.PI/2;px=-half+Math.cos(angle)*radius;py=Math.sin(angle)*radius;nx=Math.cos(angle);ny=Math.sin(angle);}
  if(!horizontal){[px,py]=[-py,px];[nx,ny]=[-ny,nx];}
  const angle=Math.atan2(py,px),c=Math.cos(angle),s=Math.sin(angle);
  const pullLength=Math.hypot(pullX,pullY),alignment=pullLength?(c*pullX+s*pullY)/pullLength:0;
  const tension=Math.max(0,alignment)**5*Math.min(14,pullLength);
  const phase=i/192*Math.PI*2;
  const wave=energy*(Math.sin(phase*3-time*.92+Math.sin(time*.47))*.7+Math.sin(phase*5+time*.67+Math.sin(time*.31))*.25+Math.sin(phase*2-time*.38)*.5);
  points.push({x:width/2+px+nx*wave+c*tension,y:height/2+py+ny*wave+s*tension});
 }
 return points;
}

// Periodic Catmull–Rom interpolation: a continuous tangent through the rounded
// ends, rather than a polygon whose segments show up on wide controls.
export function contourPath(points:{x:number;y:number}[]){
 const n=points.length,at=(i:number)=>points[(i+n)%n],f=(v:number)=>v.toFixed(3);
 let path=`M${f(points[0].x)} ${f(points[0].y)}`;
 for(let i=0;i<n;i++){const a=at(i-1),b=at(i),c=at(i+1),d=at(i+2);path+=` C${f(b.x+(c.x-a.x)/6)} ${f(b.y+(c.y-a.y)/6)} ${f(c.x-(d.x-b.x)/6)} ${f(c.y-(d.y-b.y)/6)} ${f(c.x)} ${f(c.y)}`;}
 return path+'Z';
}
export function cursorContour(width:number,height:number,time=0,energy=0,pullX=0,pullY=0){return contourPath(cursorContourPoints(width,height,time,energy,pullX,pullY));}
