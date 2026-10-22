"use client";
import {useLayoutEffect,useRef} from 'react';
import {useWaterMotion} from './water-surface';

/** Cache real DOM line positions once; refract that bitmap, not a live SVG filter.
 * Small overlapping scan bands avoid filter re-rasterization and torn edges on iOS. */
export function IntroWaterReveal({visible,children,onSettling}:{visible:boolean;children:React.ReactNode;onSettling:()=>void}){
 const text=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),callback=useRef(onSettling),{playing}=useWaterMotion();
 const revealed=useRef(false);
 useLayoutEffect(()=>{callback.current=onSettling;},[onSettling]);
 useLayoutEffect(()=>{
  const el=text.current,out=canvas.current;if(!el||!out)return;
  // Hidden is also the server-rendered state. Never expose the live paragraph
  // while fonts or the first canvas frame are still being prepared.
  el.style.opacity='0';out.style.opacity='0';out.dataset.state='waiting';
  if(!visible)return;
  let frame=0,disposed=false,settled=false,finished=false,renderedSize:{width:number;height:number}|null=null;
  const finish=()=>{if(disposed)return;finished=true;revealed.current=true;cancelAnimationFrame(frame);el.style.opacity='1';out.style.opacity='0';out.dataset.state='settled';if(!settled){settled=true;callback.current();}};
  // A paused/resumed surface must not replay text that has already arrived.
  if(!playing||revealed.current){finish();return;}
  const render=()=>{
   if(disposed||finished)return;
   const b=el.getBoundingClientRect(),p=el.querySelector('p')??el,style=getComputedStyle(p),dpr=Math.min(devicePixelRatio||1,2),pad=10;
   const source=document.createElement('canvas');source.width=Math.ceil((b.width+pad*2)*dpr);source.height=Math.ceil((b.height+pad*2)*dpr);
   out.width=source.width;out.height=source.height;out.style.width=(b.width+pad*2)+'px';out.style.height=(b.height+pad*2)+'px';
   const ctx=source.getContext('2d'),dest=out.getContext('2d');if(!ctx||!dest){finish();return;}
   dest.clearRect(0,0,out.width,out.height);
   renderedSize={width:b.width,height:b.height};
   ctx.scale(dpr,dpr);ctx.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;ctx.fillStyle=style.color;
   ctx.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;
   const metrics=ctx.measureText('Mg'),descent=metrics.fontBoundingBoxDescent??parseFloat(style.fontSize)*.22;
   const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),range=document.createRange();
   const lines:{text:string;x:number;y:number;bottom:number}[]=[];let node:Node|null;
   while((node=walker.nextNode())){
    const value=node.textContent??'';
    for(let i=0;i<value.length;i++){
     range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();if(!r.height)continue;
     let line=lines[lines.length-1];if(!line||Math.abs(line.y-r.top)>2){line={text:'',x:r.left,y:r.top,bottom:r.bottom};lines.push(line);}line.text+=value[i];
    }
   }
   lines.forEach(line=>ctx.fillText(line.text,line.x-b.left+pad,line.bottom-b.top+pad-descent));
   const mist=document.createElement('canvas');mist.width=source.width;mist.height=source.height;
   const mistCtx=mist.getContext('2d');if(mistCtx){mistCtx.filter='blur('+1.4*dpr+'px)';mistCtx.drawImage(source,0,0);}
   const duration=1900;let start:number|undefined;el.style.opacity='0';out.style.opacity='1';out.dataset.state='emerging';
   let pulseSent=false;
   const tick=(now:number)=>{
    if(disposed||finished)return;if(document.hidden){finish();return;}
    // Use the frame clock for both endpoints. A rAF timestamp can precede
    // performance.now() during setup; negative alpha is ignored by Canvas2D,
    // leaving its default alpha of 1 and flashing the entire paragraph.
    start??=now;
    const t=Math.max(0,Math.min(1,(now-start)/duration)),ease=t*t*t*(t*(t*6-15)+10),depth=1-ease;
    // Two broad travelling swells, gently damped. No per-frame random noise.
    // Resolve the displacement before blending into DOM text, so the two
    // representations do not show offset outlines during the handoff.
    const focus=Math.min(1,t/.76),waveDepth=1-focus*focus*(3-2*focus);
    const blend=Math.max(0,(t-.8)/.2),handoff=blend*blend*(3-2*blend);
    dest.clearRect(0,0,out.width,out.height);el.style.opacity=String(handoff);out.style.transform='translateY('+waveDepth*2.2+'px)';
    for(let y=0;y<source.height;y+=2){
     const h=Math.min(2,source.height-y),offset=(Math.sin(y/dpr*.052-t*4.3)*2.4+Math.sin(y/dpr*.021+t*2.1)*1.2)*waveDepth*dpr;
     dest.globalAlpha=ease*(1-handoff);dest.drawImage(source,0,y,source.width,h,offset,y,source.width,h);
     if(mistCtx){dest.globalAlpha=ease*depth*.45*(1-handoff);dest.drawImage(mist,0,y,source.width,h,offset*.75,y,source.width,h);}
    }
    if(t>.28&&!pulseSent){pulseSent=true;const line=lines[Math.floor(lines.length/2)];if(line)window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:(b.left+b.width*.48)/innerWidth,y:(line.y+8)/innerHeight,strength:.18,duration:1.7}}));}
    if(t>=.82&&!settled){settled=true;callback.current();}
    if(t<1)frame=requestAnimationFrame(tick);else finish();
   };
   frame=requestAnimationFrame(tick);
  };
  void document.fonts.ready.then(render).catch(finish);
  // Mobile browser chrome changes viewport height without changing this text.
  // Only a real reflow invalidates the cached line positions.
  const resize=new ResizeObserver(()=>{
   if(!renderedSize||finished)return;
   const box=el.getBoundingClientRect();
   if(Math.abs(box.width-renderedSize.width)>1||Math.abs(box.height-renderedSize.height)>1)finish();
  });
  resize.observe(el);
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();out.style.opacity='0';};
 },[visible,playing]);
 return <div data-intro-water-reveal="" style={{position:'relative'}}><div ref={text} style={{opacity:0}}>{children}</div><canvas ref={canvas} aria-hidden="true" style={{position:'absolute',left:-10,top:-10,pointerEvents:'none',opacity:0}}/></div>;
}
