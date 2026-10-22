"use client";
import {useEffect,useRef} from "react";
import {useWaterMotion} from "./water-surface";
import {createNavWaterSampler} from "./nav-water-sampler";

const W=24,H=12,PAD=10;
const linear=Array.from({length:256},(_,n)=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
const luminance=(r:number,g:number,b:number)=>.2126*linear[Math.round(r)]+.7152*linear[Math.round(g)]+.0722*linear[Math.round(b)];
const risk=(l:number)=>{const t=Math.max(0,Math.min(1,(l-.16)/.40));return t*t*(3-2*t);};
const intersects=(a:DOMRect,b:DOMRect)=>a.bottom>b.top&&a.top<b.bottom&&a.right>b.left&&a.left<b.right;
type Ink={el:HTMLElement;goal:number;candidate:number;candidateSince:number;target:Float32Array;box:DOMRect;water:number[]};

/** Contrast is decided for each whole word. A soft vertical sweep reveals
 * the exterior stroke; settled states are entirely on or entirely off. */
export function NavClarity({children}:{children:React.ReactNode}){
 const host=useRef<HTMLDivElement>(null);const {playing}=useWaterMotion();
 useEffect(()=>{
  const root=host.current;if(!root)return;
  const inks=new Map<HTMLElement,Ink>();
  // Read image brightness separately from the shared water renderer.
  const imageCanvas=document.createElement('canvas');imageCanvas.width=W;imageCanvas.height=H;
  const imageCtx=imageCanvas.getContext('2d',{willReadFrequently:true});
  let sampleFrame=0,lastSample=0,disposed=false;
  let deferred:ReturnType<typeof setTimeout>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  let pending:Ink[]=[];
  const water=createNavWaterSampler(values=>{pending.forEach((ink,i)=>{ink.water=values[i]??[];});wake();});
  const make=(el:HTMLElement)=>{
   const ink:Ink={el,goal:0,candidate:0,candidateSince:0,target:new Float32Array(W*H),box:el.getBoundingClientRect(),water:[]};
   el.dataset.contrastDirection=el.dataset.word==='About'?'down':'up';
   el.dataset.contrastStroke='off';inks.set(el,ink);return ink;
  };
  const sync=()=>{
   sampleFrame=0;if(disposed||document.hidden)return;
   const wait=75-(performance.now()-lastSample);if(wait>0){clearTimeout(deferred);deferred=setTimeout(wake,wait);return;}lastSample=performance.now();
   for(const el of inks.keys())if(!root.contains(el)){delete el.dataset.contrastDirection;delete el.dataset.contrastStroke;inks.delete(el);}
   const styles=new Map<Element,CSSStyleDeclaration>();
   const style=(el:Element)=>{let s=styles.get(el);if(!s){s=getComputedStyle(el);styles.set(el,s);}return s;};
   const visible=(el:Element):boolean=>{if(el.matches('[hidden],[inert]'))return false;const s=style(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.1&&(!el.parentElement||visible(el.parentElement));};
   const mobile=matchMedia('(max-width:800px)').matches;
   const active=Array.from(root.querySelectorAll<HTMLElement>('header [data-nav-item] [data-nav-ink]')).filter(el=>visible(el)&&(!el.hasAttribute('data-nav-ink-mobile')||mobile)).map(el=>inks.get(el)??make(el));
   for(const ink of active){
    const b=ink.el.getBoundingClientRect();ink.box=new DOMRect(b.left-PAD,b.top-PAD,b.width+PAD*2,b.height+PAD*2);
   }
   const waterCanvas=document.querySelector<HTMLCanvasElement>('[data-water-canvas][data-ready="true"]'),wb=waterCanvas?new DOMRect(0,0,innerWidth,innerHeight):undefined;
   if(waterCanvas&&wb?.width&&wb.height&&water.sample(waterCanvas,active.map(({box:b})=>({x:(b.left-wb.left)/wb.width,y:(b.top-wb.top)/wb.height,w:b.width/wb.width,h:b.height/wb.height}))))pending=active;
   const maxBottom=Math.max(0,...active.map(i=>i.box.bottom));
   const textRects:DOMRect[]=[];const visited=new Set<Node>();
   for(const block of document.querySelectorAll<HTMLElement>('main h1,main h2,main h3,main p,main blockquote,main figcaption,main a')){
    const b=block.getBoundingClientRect();if(b.top>maxBottom||b.bottom<0||!visible(block))continue;
    const color=style(block).color.match(/[\d.]+/g)?.map(Number);if(!color||luminance(color[0],color[1],color[2])<.3)continue;
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node:Node|null;
    while((node=walker.nextNode())){if(visited.has(node))continue;visited.add(node);for(const match of (node.textContent??'').matchAll(/\S+/g)){const range=document.createRange();range.setStart(node,match.index!);range.setEnd(node,match.index!+match[0].length);textRects.push(...range.getClientRects());}}
   }
   const images=Array.from(document.querySelectorAll<HTMLImageElement>('main img')).filter(img=>img.complete&&img.naturalWidth&&visible(img));
   for(const ink of active){
    const b=ink.box;ink.target.set(Array.from({length:W*H},(_,i)=>risk(ink.water[i]??0)));
    // Sample across the word so a bright image or crossing text can trigger
    // protection, but never use these individual tiles as the visible mask.
    for(let y=0;y<4;y++)for(let x=0;x<6;x++){
     const px=b.left+b.width*(x+.5)/6,py=b.top+b.height*(y+.5)/4;
     const stack=document.elementsFromPoint(px,py).filter(el=>!el.closest('header')&&el!==document.body&&el!==document.documentElement);
     let level:number|undefined;
     for(const el of stack){const rgba=style(el).backgroundColor.match(/[\d.]+/g)?.map(Number);if(rgba&&(rgba[3]??1)>.9){level=luminance(rgba[0],rgba[1],rgba[2]);break;}}
     if(level!==undefined)for(let yy=y*3;yy<y*3+3;yy++)for(let xx=x*4;xx<x*4+4;xx++)ink.target[yy*W+xx]=risk(level);
    }
    for(const img of images){
     const r=img.getBoundingClientRect();if(!intersects(r,b))continue;
     const s=style(img),fit=s.objectFit;
     const scale=fit==='cover'?Math.max(r.width/img.naturalWidth,r.height/img.naturalHeight):Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight);
     const sx=fit==='fill'?r.width/img.naturalWidth:scale,sy=fit==='fill'?r.height/img.naturalHeight:scale;
     const pos=s.objectPosition.split(' ').map(v=>parseFloat(v)/100);
     const left=r.left+(r.width-img.naturalWidth*sx)*(pos[0]??.5),top=r.top+(r.height-img.naturalHeight*sy)*(pos[1]??.5);
     try{if(!imageCtx)continue;imageCtx.clearRect(0,0,W,H);imageCtx.drawImage(img,(left-b.left)/b.width*W,(top-b.top)/b.height*H,img.naturalWidth*sx/b.width*W,img.naturalHeight*sy/b.height*H);const data=imageCtx.getImageData(0,0,W,H).data;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){const px=b.left+b.width*(x+.5)/W,py=b.top+b.height*(y+.5)/H,i=y*W+x;if(px<r.left||px>r.right||py<r.top||py>r.bottom)continue;const alpha=data[i*4+3]/255;ink.target[i]=ink.target[i]*(1-alpha)+risk(luminance(data[i*4],data[i*4+1],data[i*4+2]))*alpha;}
     }catch{imageCanvas.width=W;/* Reset any taint; retain the water/surface reading. */}
    }
    for(const r of textRects){if(!intersects(r,b))continue;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const px=b.left+b.width*(x+.5)/W,py=b.top+b.height*(y+.5)/H;if(px>=r.left&&px<=r.right&&py>=r.top&&py<=r.bottom)ink.target[y*W+x]=Math.max(.8,ink.target[y*W+x]);}}
    const mean=ink.target.reduce((total,value)=>total+value,0)/ink.target.length;
    const bright=ink.target.reduce((total,value)=>total+(value>.55?1:0),0)/ink.target.length;
    // Separate enter/leave thresholds stop the water's highlights from
    // making the complete outline flicker near the contrast boundary.
    const goal=ink.goal?(mean>.055||bright>.025?1:0):(mean>.11||bright>.08?1:0);
    const now=performance.now();
    if(goal!==ink.candidate){ink.candidate=goal;ink.candidateSince=now;}
    // Require sustained contrast changes, with a longer release to avoid
    // repeatedly reversing the outline on passing water highlights.
    if(goal!==ink.goal){
     const remaining=(goal?120:420)-(now-ink.candidateSince);
     if(remaining<=0){ink.goal=goal;ink.el.dataset.contrastStroke=goal?'on':'off';}
     else {clearTimeout(deferred);deferred=setTimeout(wake,Math.max(75,remaining));}
    }
   }
  };
  const wake=()=>{if(!sampleFrame&&!document.hidden&&!disposed)sampleFrame=requestAnimationFrame(sync);};
  const loop=()=>{wake();if(playing&&!document.hidden)timer=setTimeout(loop,250);};
  const visibility=()=>{clearTimeout(timer);clearTimeout(deferred);cancelAnimationFrame(sampleFrame);sampleFrame=0;if(!document.hidden)loop();};
  loop();window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',wake);window.addEventListener('madagin:water-ready',wake);document.addEventListener('visibilitychange',visibility);
  const observer=new MutationObserver(wake);observer.observe(root,{childList:true,subtree:true});
  return()=>{disposed=true;water.dispose();cancelAnimationFrame(sampleFrame);clearTimeout(timer);clearTimeout(deferred);observer.disconnect();for(const ink of inks.values()){delete ink.el.dataset.contrastDirection;delete ink.el.dataset.contrastStroke;}window.removeEventListener('scroll',wake);window.removeEventListener('resize',wake);window.removeEventListener('madagin:water-ready',wake);document.removeEventListener('visibilitychange',visibility);};
 },[playing]);
 return <div ref={host} style={{display:'contents'}}>{children}</div>;
}
