"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useWaterMotion } from "./water-surface";
import { paintCursorEmergence } from "./cursor-emergence";
import {cursorContour, cursorContourPoints, contourPath} from "./cursor-contour";
import {cursorGlow, cursorNoise} from "./cursor-glow";
import styles from "./glass-cursor.module.css";

/** One small lens follows the real hit point. It never participates in hit testing. */
export function GlassCursor() {
  const cursor=useRef<HTMLDivElement>(null);
  const {playing}=useWaterMotion();
  const pathname=usePathname(),motion=useRef(playing),sync=useRef<()=>void>(()=>{}),completed=useRef(false);
  const location=useRef({x:0,y:0,known:false});
  useEffect(()=>{
    const el=cursor.current;if(!el)return;
    const root=document.documentElement;
    const supported=matchMedia("(any-pointer: fine) and (any-hover: hover) and (forced-colors: none)");
    const paths=[...el.querySelectorAll<SVGPathElement>('[data-cursor-dot]')];
    const lens=el.querySelector<SVGSVGElement>('[data-cursor-rim]')!;
    const rim=lens.querySelector<SVGPathElement>('[data-rim]')!,energyRim=lens.querySelector<SVGPathElement>('[data-energy-rim]')!,orbit=lens.querySelector<SVGGElement>('[data-orbit]')!;
    const glowPaths=[...orbit.querySelectorAll<SVGPathElement>('path')],seed=Math.random()*1000;
    let magnet:HTMLElement|null=null,pressed=false,pressAmount=0,clock=0,lastPaint=0,orbitPosition=Math.random();
    const shape={x:0,y:0,w:18,h:18},goal={...shape};
    const unlock=()=>{if(magnet){magnet.removeAttribute('data-magnetized');window.dispatchEvent(new CustomEvent('madagin:cursor-magnet',{detail:{element:null}}));}magnet=null;el.dataset.locked='false';el.dataset.rippleActive='false';el.style.setProperty('--cursor-energy','0');};
    let frame=0,x=location.current.x,y=location.current.y,shown=false;
    let elapsed=completed.current?1150:0,previous=0,settlingSent=false;
    const hero=document.querySelector<HTMLElement>('[data-guided-panel="hero"]:not([hidden])');
    let ready=pathname!=="/"||!hero||hero.dataset.landingReady==="true";
    const hide=()=>{
      unlock();pressed=false;pressAmount=0;el.style.setProperty('--cursor-press','0');
      shown=false;cancelAnimationFrame(frame);frame=0;
      location.current.known=false;
      previous=0;
      el.dataset.visible="false";el.dataset.pressed="false";
      root.removeAttribute("data-glass-cursor");
    };
    const targetState=(target:EventTarget|null)=>{
      const node=target instanceof Element?target:null;
      const editor=node?.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
      const editing=!!editor;
      el.dataset.editing=String(editing&&(editor===document.activeElement||editor.contains(document.activeElement)));
      const control=node?.closest('a[href],button,[role="button"],summary,label,[data-cursor="control"]');
      const disabled=control?.matches(':disabled,[aria-disabled="true"]')||node?.closest('[inert]');
      el.dataset.over=editing?"text":control&&!disabled?"control":"surface";
      let next=!editing&&!disabled?node?.closest<HTMLElement>('[data-cursor-magnet]')??null:null;
      if(!next&&magnet&&!editing&&!disabled){const b=magnet.getBoundingClientRect(),margin=Number(magnet.dataset.magnetRelease||22);if(x>b.left-margin&&x<b.right+margin&&y>b.top-margin&&y<b.bottom+margin)next=magnet;}
      if(next!==magnet){unlock();magnet=next;if(next){next.dataset.magnetized='true';el.dataset.locked='true';window.dispatchEvent(new CustomEvent('madagin:cursor-magnet',{detail:{element:next}}));}}
    };
    const paint=(now:number)=>{
      frame=0;if(!ready||!location.current.known||!supported.matches||document.hidden)return;
      const dt=Math.min(48,now-lastPaint||16);lastPaint=now;clock+=dt/1000;
      if(magnet&&(!magnet.isConnected||magnet.closest('[inert],[hidden]')||magnet.dataset.busy==='true'))unlock();
      const box=magnet?.getBoundingClientRect(),inset=Number(magnet?.dataset.magnetInset||0);
      const arrowLock=!!magnet&&(['hero','chapter','wide','up'].includes(magnet.dataset.variant||'')||magnet.dataset.cursorOrbit==='true');
      const editing=el.dataset.editing==='true';
      pressAmount+=((pressed?1:0)-pressAmount)*(motion.current?1-Math.exp(-dt/(pressed?145:240)):1);
      el.style.setProperty('--cursor-press',pressAmount.toFixed(3));
      const orbitActive=arrowLock||editing||pressAmount>.005;
      el.dataset.rippleActive=String(orbitActive&&motion.current);
      // Slow random targets interpolate continuously; never flicker per frame.
      // Editing keeps a clear circular pointer. A held press adds energy through
      // a smooth envelope, so release settles instead of snapping the glow off.
      const moving=!!box&&motion.current,breath=cursorNoise(clock*.48,seed);
      const pulse=motion.current?.5+.5*Math.sin(clock*5.2+cursorNoise(clock*.42,seed+8)*.65):.5;
      const swell=(moving?.65+breath*.85:editing&&motion.current?.35+pulse*.45:0)+pressAmount*(box?1+pulse:2+pulse*1.6);
      goal.x=box?box.left+box.width/2+(moving?cursorNoise(clock*.37,seed+1)*.38:0):x;
      goal.y=box?box.top+box.height/2+(moving?cursorNoise(clock*.41,seed+2)*.38:0):y;
      // Leave room for the deepest inward wave, rim stroke, and soft glow.
      // Pull tension is outward-only, so this clearance survives pointer tugging.
      goal.w=box?box.width-inset*2+20+swell:18+swell;goal.h=box?box.height-inset*2+20+swell:18+swell;
      if(!shown){Object.assign(shape,{x,y,w:18,h:18});}
      const ease=motion.current?1-Math.exp(-dt/(magnet?95:55)):1;
      for(const key of ['x','y','w','h'] as const)shape[key]+=(goal[key]-shape[key])*ease;
      el.style.transform=`translate3d(${shape.x-shape.w/2}px,${shape.y-shape.h/2}px,0)`;
      el.style.width=`${shape.w}px`;el.style.height=`${shape.h}px`;
      lens.setAttribute('viewBox',`0 0 ${shape.w} ${shape.h}`);
      const pullX=box?Math.max(-3.5,Math.min(3.5,(x-goal.x)*.035)):0,pullY=box?Math.max(-3.5,Math.min(3.5,(y-goal.y)*.055)):0;
      const points=cursorContourPoints(shape.w,shape.h,clock+seed,moving?2.1+breath*.45:0,pullX,pullY),contour=contourPath(points);
      rim.setAttribute('d',contour);energyRim.setAttribute('d',contour);
      if(orbitActive&&motion.current){
        orbitPosition+=dt/1000*((box?.13:.24)+cursorNoise(clock*.43,seed+3)*.045);
        const span=.24+cursorNoise(clock*.31,seed+4)*.07,width=box?2.2+cursorNoise(clock*.54,seed+5)*.75:.8+pressAmount*.3;
        const glow=cursorGlow(points,orbitPosition,span,width,clock,seed);
        glowPaths.forEach(path=>path.setAttribute('d',glow));
        orbit.dataset.span=span.toFixed(3);orbit.dataset.width=width.toFixed(3);
      }
      const energy=(arrowLock&&motion.current?.44+cursorNoise(clock*.61,seed+6)*.1:editing&&motion.current?.3+pulse*.12:0)+pressAmount*(.5+pulse*.22);
      el.style.setProperty('--cursor-energy',String(Math.min(1,energy)));
      if(!shown){shown=true;el.dataset.visible="true";root.setAttribute("data-glass-cursor","");}
      if(!motion.current||completed.current)elapsed=1150;
      else if(previous)elapsed+=Math.min(now-previous,50);
      previous=now;
      const revealAmount=elapsed>=1150?1:paintCursorEmergence(paths,elapsed*2200/1150);
      el.style.setProperty("--cursor-lens",String(revealAmount));
      el.dataset.phase=elapsed>=1150?"ready":"forming";
      if(elapsed>=930&&!settlingSent){settlingSent=true;window.dispatchEvent(new Event("madagin:cursor-settling"));}
      if(elapsed>=1150){completed.current=true;previous=0;}
      const unsettled=Math.abs(shape.x-goal.x)+Math.abs(shape.y-goal.y)+Math.abs(shape.w-goal.w)+Math.abs(shape.h-goal.h)>.05;
      if(elapsed<1150||unsettled||(motion.current&&(!!magnet||editing||pressed||pressAmount>.005)))frame=requestAnimationFrame(paint);
    };
    const wake=()=>{if(!frame&&ready&&location.current.known&&supported.matches&&!document.hidden)frame=requestAnimationFrame(paint);};
    const reveal=()=>{ready=true;wake();};
    const move=(event:PointerEvent)=>{
      if(event.pointerType!=="mouse"||!supported.matches||document.hidden){hide();return;}
      x=event.clientX;y=event.clientY;location.current={x,y,known:true};targetState(event.target);wake();
    };
    const down=(event:PointerEvent)=>{
      if(event.pointerType!=="mouse"){hide();return;}
      if(shown){pressed=true;el.dataset.pressed="true";wake();}
    };
    const up=()=>{pressed=false;el.dataset.pressed="false";wake();};
    const activateLock=(event:MouseEvent)=>{
      // The visible magnetic outline is the hit area the visitor sees. Honor
      // it inside the existing release margin, without stealing another control.
      if(!event.isTrusted||event.detail===0||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!shown||!magnet)return;
      const target=event.target instanceof Element?event.target:null,locked=magnet;
      if(locked.contains(target)||target?.closest('a[href],button,input,textarea,select,[contenteditable],[role="button"]'))return;
      if(!locked.isConnected||locked.closest('[hidden],[inert]')||locked.matches(':disabled,[aria-disabled="true"]')||locked.dataset.busy==='true')return;
      const b=locked.getBoundingClientRect(),margin=Number(locked.dataset.magnetRelease||22);
      if(event.clientX<b.left-margin||event.clientX>b.right+margin||event.clientY<b.top-margin||event.clientY>b.bottom+margin)return;
      event.preventDefault();event.stopImmediatePropagation();
      locked.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,detail:1,clientX:event.clientX,clientY:event.clientY}));
    };
    const out=(event:PointerEvent)=>{if(!event.relatedTarget)hide();};
    const key=(event:KeyboardEvent)=>{if(event.key==="Tab"||event.key==="Escape")hide();};
    const focus=()=>{targetState(document.elementFromPoint(x,y));wake();};
    const scroll=()=>{if(shown){targetState(document.elementFromPoint(x,y));wake();}};
    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("pointerover",move,{passive:true});
    window.addEventListener("madagin:landing-ready",reveal);
    window.addEventListener("pointerdown",down,{passive:true});
    window.addEventListener("pointerup",up,{passive:true});
    window.addEventListener("click",activateLock,true);
    window.addEventListener("pointercancel",hide);
    window.addEventListener("blur",hide);
    window.addEventListener("scroll",scroll,{passive:true});
    window.addEventListener("madagin:cursor-refresh",scroll);
    document.addEventListener("pointerout",out);
    document.addEventListener("visibilitychange",hide);
    document.addEventListener("keydown",key);
    document.addEventListener("focusin",focus);document.addEventListener("focusout",focus);
    supported.addEventListener("change",hide);
    sync.current=wake;wake();
    return()=>{
      sync.current=()=>{};
      hide();window.removeEventListener("pointermove",move);window.removeEventListener("pointerdown",down);
      window.removeEventListener("pointerover",move);window.removeEventListener("madagin:landing-ready",reveal);
      window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",hide);
      window.removeEventListener("click",activateLock,true);
      window.removeEventListener("blur",hide);window.removeEventListener("scroll",scroll);window.removeEventListener("madagin:cursor-refresh",scroll);
      document.removeEventListener("pointerout",out);document.removeEventListener("visibilitychange",hide);
      document.removeEventListener("keydown",key);supported.removeEventListener("change",hide);
      document.removeEventListener("focusin",focus);document.removeEventListener("focusout",focus);
    };
  },[pathname]);
  useEffect(()=>{motion.current=playing;sync.current();},[playing]);
  return <div ref={cursor} className={styles.cursor} data-glass-pointer="" data-visible="false" data-phase="waiting" data-playing={playing} aria-hidden="true">
   <svg className={styles.formation} viewBox="0 0 72 72">{Array.from({length:48},(_,i)=><path key={i} data-cursor-dot="" opacity="0"/>)}</svg>
   <span className={styles.lens}><svg viewBox="0 0 18 18" data-cursor-rim=""><path data-energy-rim="" className={styles.energy}/><path data-rim="" d={cursorContour(18,18)}/><g data-orbit="" className={styles.orbit}><path className={styles.bloom}/><path className={styles.wisp}/></g></svg></span>
  </div>;
}
