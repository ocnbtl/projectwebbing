const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
const point=(radius:number,angle:number)=>`${(36+Math.cos(angle)*radius).toFixed(3)} ${(36+Math.sin(angle)*radius).toFixed(3)}`;

/** Round-ended arcs begin as pinpoints, then flatten into one continuous rim. */
export function paintCursorEmergence(paths:SVGPathElement[],elapsed:number){
 elapsed=elapsed<650?elapsed*1.18:elapsed+117*(1-Math.min(1,(elapsed-650)/700));
 const gather=smooth((elapsed-650)/900),join=smooth((elapsed-1250)/800),handoff=smooth((elapsed-1780)/420);
 paths.forEach((path,index)=>{
  const ring=Math.floor(index/16),dot=index%16;
  const birth=smooth((elapsed-ring*105-dot*22)/230);
  const radius=(16+ring*13)*(1-gather)+8.4*gather;
  const angle=dot*Math.PI/8-Math.PI/2+(ring-1)*.18*(1-gather);
  const half=.001+(Math.PI/16+.004)*join;
  path.setAttribute("d",`M${point(radius,angle-half)} A${radius.toFixed(3)} ${radius.toFixed(3)} 0 0 1 ${point(radius,angle+half)}`);
  path.setAttribute("stroke-width",String(1.7*(1-join)+.65*join));
  path.setAttribute("opacity",String(birth*(.84-ring*.12)*(1-handoff)));
 });
 return handoff;
}
