"use client";

import { useEffect, useRef } from "react";
import { useWaterMotion } from "./water-surface";
import { usePresence } from "./presence-provider";
import { advanceAmbientCursor, createAmbientCursor, type CursorTarget } from "./ambient-cursor-motion";
import { sampleWake, type WakePoint } from "./cursor-wake";
import styles from "./connection-playground.module.css";




type Light = { x: number; y: number; heading: number; speed: number; phase: number };
const colors = ["#FF8FC5", "#F39BCA", "#FFC1DD", "#F49FD7"];

export function ConnectionPlayground({ enabled }: { enabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { playing } = useWaterMotion();
  const presence = usePresence();
  const state = useRef(presence);
  useEffect(() => { state.current = presence; }, [presence]);

  useEffect(() => {
    const el = canvas.current, ctx = el?.getContext("2d");
    if (!enabled || !el || !ctx) return;
    let frame = 0, previous = performance.now(), width = innerWidth, height = innerHeight;
    const target = { x: -1, y: -1 };
    const self: Light = { x: -1, y: -1, heading: 0, speed: 0, phase: 0 };
    const trails = new Map<string, WakePoint[]>();
    const points = new Map<string, Light>();
    type Particle=Pick<WakePoint,'x'|'y'|'time'>;
    let gathering:{start:number;x:number;y:number;pixels:Particle[]}|null=null;
    let magnet:HTMLElement|null=null,orbitAmount=0,orbitCenter={x:width/2,y:height/2,radius:45},dt=16;
    const rendered=new Map<string,{x:number;y:number;vx:number;vy:number;phase:number;opacity:number}>();
    const ambient = Array.from({ length: 6 }, (_, i) => {const cursor=createAmbientCursor(i);cursor.hold=.15+i*.24+Math.random()*.6;return cursor;});
    const magnetChange=(event:Event)=>{
      const next=(event as CustomEvent<{element:HTMLElement|null}>).detail.element;
      const inScene=next?.closest('[data-scene="experiences"]');
      if(inScene){magnet=next;return;}
      if(magnet){
        // Resume a real gesture from the orbit, preserving its velocity and
        // each visitor's queued destination. There is no detached pixel cloud.
        ambient.forEach((cursor,i)=>{const p=rendered.get(`ambient-${i}`);if(!p)return;cursor.position={x:p.x/width,y:p.y/height};cursor.journey=null;cursor.hold=.04+i*.035;cursor.idle=0;const light=points.get(`ambient-${i}`);if(light){light.x=p.x;light.y=p.y;}});
      }
      magnet=null;
    };
    const gather=(event:Event)=>{const d=(event as CustomEvent<{x:number;y:number}>).detail;gathering={...d,start:performance.now(),pixels:[...trails.values()].flat().filter((p,i)=>performance.now()-p.time<800&&i%2===0)};el.dataset.gathering="true";};
    let targets:CursorTarget[]=[],lastTargets=-Infinity,seeded=false;
    let occupied:{left:number;right:number;top:number;bottom:number}[]=[];
    const clearance=(x:number,y:number)=>occupied.reduce((distance,b)=>Math.min(distance,Math.hypot(Math.max(b.left-x,0,x-b.right),Math.max(b.top-y,0,y-b.bottom))),Infinity);
    const refreshTargets=(now:number)=>{
      if(now-lastTargets<1200)return;lastTargets=now;
      // The decorative gestures belong in the water around the content, not
      // on the words. Real visitors still retain their actual coordinates.
      occupied=Array.from(document.querySelectorAll<HTMLElement>('[data-scene="experiences"] h2,[data-scene="experiences"] p,[data-scene="experiences"] [data-cursor-magnet],[data-nav-item],[data-real-count] [role="status"]')).flatMap(element=>{
        const b=element.getBoundingClientRect();if(!b.width||!b.height||b.bottom<0||b.top>height||element.closest('[hidden]'))return [];
        return [{left:b.left-24,right:b.right+24,top:b.top-24,bottom:b.bottom+24}];
      });
      targets=[];
      // Stratified sampling spreads destinations through all the available
      // space without concentrating every gesture on the same few anchors.
      for(let row=0;row<7;row++)for(let col=0;col<10;col++){
        const x=.07+(col+.2+Math.random()*.6)/10*.86,y=.16+(row+.2+Math.random()*.6)/7*.71;
        if(clearance(x*width,y*height)>62)targets.push({x,y});
      }
      if(!seeded&&targets.length){ambient.forEach((cursor,i)=>{cursor.position={...targets[Math.floor((i+.5)*targets.length/ambient.length)]};});seeded=true;}
    };
    const resize = () => {
      width = innerWidth; height = innerHeight;
      const dpr = Math.min(devicePixelRatio, 1.5);
      el.width = width * dpr; el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); trails.clear();lastTargets=-Infinity;
    };
    const follow = (light: Light, x: number, y: number, dt: number, lag: number) => {
      const ease = playing ? 1 - Math.exp(-dt / lag) : 1;
      const dx = (x - light.x) * ease, dy = (y - light.y) * ease;
      if (Math.hypot(dx, dy) > .1) light.heading = Math.atan2(dy, dx);
      light.speed += (Math.hypot(dx, dy) / Math.max(dt, 1) * 1000 - light.speed) * .2;
      light.x += dx; light.y += dy;
    };
    const draw = (id: string, light: Light, color: string, now: number, opacity = 1) => {
      let p=rendered.get(id);if(!p){p={x:light.x,y:light.y,vx:0,vy:0,phase:rendered.size*2.39996,opacity:0};rendered.set(id,p);}
      const angle=p.phase+now*(.00065+Math.sin(p.phase)*.00009),radius=orbitCenter.radius+Math.sin(now*.0013+p.phase)*6;
      const aimX=light.x+(orbitCenter.x+Math.cos(angle)*radius-light.x)*orbitAmount,aimY=light.y+(orbitCenter.y+Math.sin(angle)*radius-light.y)*orbitAmount;
      const steps=Math.max(1,Math.ceil(dt/16)),seconds=dt/1000/steps;
      for(let i=0;i<steps;i++){p.vx+=((aimX-p.x)*100-p.vx*20)*seconds;p.vy+=((aimY-p.y)*100-p.vy*20)*seconds;p.x+=p.vx*seconds;p.y+=p.vy*seconds;}
      const trail=trails.get(id)||[];trails.set(id,trail);if(playing)sampleWake(trail,p.x,p.y,now,Math.min(310,65+Math.hypot(p.vx,p.vy)*.42));
      p.opacity+=(opacity+(1-opacity)*orbitAmount*.8-p.opacity)*(1-Math.exp(-dt/230));opacity=p.opacity;
      const grid=width<600?10:12;let lastDistance=Infinity;ctx.save();ctx.fillStyle=color;
      // Space squares along the travelled path. World-grid snapping and
      // index-based satellite squares caused one-frame ghosts in an orbit.
      for(let i=trail.length-1;i>=0;i--){const point=trail[i],age=Math.min(1,(now-point.time)/1100),spread=(1-orbitAmount*.7)*(1.5+age*8),offset=(Math.sin(point.distance*.137+p.phase)*.5+Math.sin(point.distance*.059+p.phase*2.1)*.3)*spread,x=point.x+point.nx*offset,y=point.y+point.ny*offset;if(lastDistance-point.distance<grid*.85)continue;lastDistance=point.distance;
        const decay=1.15+(Math.sin(point.distance*.13)*.5+.5)*.8;
        ctx.globalAlpha=Math.pow(1-age,decay)*opacity*.84*(.55+.45*Math.sin(point.distance*.16+p.phase)**2);const size=(grid-2)*(1-age*.3);ctx.fillRect(x-size/2,y-size/2,size,size);
        if(Math.sin(point.distance*.073+p.phase)>.35){ctx.globalAlpha*=.42*(1-orbitAmount*.8);const side=spread*1.8;ctx.fillRect(x+point.nx*side-size*.3,y+point.ny*side-size*.3,size*.6,size*.6);}
      }
      if(id!=='self'||!document.documentElement.hasAttribute('data-glass-cursor')){ctx.fillStyle='#FFD0E7';ctx.globalAlpha=.84*opacity;ctx.fillRect(p.x-grid/2,p.y-grid/2,grid-2,grid-2);}
      ctx.restore();
    };
    const render = (now: number) => {
      dt = Math.min(64, Math.max(0, now - previous)); previous = now;

      refreshTargets(now);
      ctx.clearRect(0, 0, width, height);
      orbitAmount+=(Number(!!magnet)-orbitAmount)*(1-Math.exp(-dt/(magnet?260:135)));
      if(magnet){const b=magnet.getBoundingClientRect();orbitCenter={x:b.left+b.width/2,y:b.top+b.height/2,radius:b.width/2+16};}
      el.dataset.orbiting=String(!!magnet);el.dataset.orbitAmount=orbitAmount.toFixed(3);
      if(gathering){const t=Math.min(1,(now-gathering.start)/610),ease=t*t*(3-2*t);
       gathering.pixels.forEach((p,i)=>{const swirl=Math.sin(t*Math.PI)*(i%2?1:-1)*12;const x=p.x+(gathering!.x-p.x)*ease+swirl,y=p.y+(gathering!.y-p.y)*ease;ctx.fillStyle=colors[i%4];ctx.globalAlpha=(1-t)*.8;const size=10*(1-t*.85);ctx.fillRect(x-size/2,y-size/2,size,size);});ctx.globalAlpha=1;return;
      }
      if (target.x >= 0) {
        follow(self, target.x, target.y, dt, 155);
        draw("self", self, "#F8B0D6", now);
        // Relay the input once; remote peers smooth it locally, avoiding two
        // layers of lag that erase the visitor's small changes in direction.
        state.current.send(target.x / width, target.y / height);
      }
      // Ambient gestures are decorative only: they never enter the count or relay.
      if (playing) ambient.forEach((cursor, i) => {
        if (width < 700 && i >= 5) return;
        advanceAmbientCursor(cursor, dt / 1000, width, height,Math.random,targets);
        const original={
          x: cursor.position.x * width, y: cursor.position.y * height,
          heading: cursor.heading, speed: cursor.speed, phase: cursor.phase,
        };
        const display=points.get(`ambient-${i}`)||{...original};
        follow(display,original.x,original.y,dt,65+i*13);points.set(`ambient-${i}`,display);
        draw(`ambient-${i}`,display,colors[i%colors.length],now,Math.min(1,cursor.age/.8)*(.16+.60*Math.exp(-cursor.idle*.48)));
      });
      let peers = 0;
      for (const [id, peer] of state.current.peers.current) {
        if (now - peer.at > 6000) { points.delete(id); trails.delete(id); rendered.delete(id); continue; }
        if (peers++ >= 40) break;
        const light = points.get(id) || { x: peer.x * width, y: peer.y * height, heading: 0, speed: 0, phase: Math.random() * 6 };
        follow(light, peer.x * width, peer.y * height, dt, 85);
        points.set(id, light); draw(id, light, "#F5ACD4", now);
      }
      for (const id of trails.keys()) {
        if (id !== "self" && !id.startsWith("ambient-") && !state.current.peers.current.has(id)) { trails.delete(id); points.delete(id); rendered.delete(id); }
      }
      el.dataset.livePeers = String(Math.min(peers, 40));
      el.dataset.pixels=String([...trails.values()].reduce((sum,trail)=>sum+trail.length,0));
      el.dataset.ambientLights = String(playing ? (width < 700 ? 5 : 6) : 0);
      el.dataset.ambientMoving=String(ambient.filter(cursor=>cursor.journey).length);
      el.dataset.attentionTargets=String(targets.length);
      el.dataset.selfX = String(Math.round(self.x));
    };
    const move = (event: PointerEvent) => {
      target.x = event.clientX; target.y = event.clientY;
      if (self.x < 0) { self.x = target.x; self.y = target.y; }
      if (!playing) render(performance.now());
    };
    const leave = () => { target.x = -1; };
    const loop = (now: number) => {
      frame = 0;
      if (document.hidden || !playing) return;
      render(now); frame = requestAnimationFrame(loop);
    };
    const visibility = () => {
      cancelAnimationFrame(frame); frame = 0;
      el.closest("[data-connected]")?.setAttribute("data-visible", String(!document.hidden));
      if (!document.hidden) { previous = performance.now(); if (playing) frame = requestAnimationFrame(loop); else render(previous); }
    };
    window.addEventListener("madagin:connection-depart",gather);
    window.addEventListener("madagin:cursor-magnet",magnetChange);
    resize(); render(previous); if (playing) frame = requestAnimationFrame(loop);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);window.removeEventListener("madagin:connection-depart",gather);
      window.removeEventListener("madagin:cursor-magnet",magnetChange);
      window.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave);
      window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, playing]);

  if (!enabled) return null;
  const live = presence.connected && presence.count !== null;
  return <div className={styles.connection} data-real-count={presence.count ?? ""} data-connected={live} data-playing={playing}>
    <canvas ref={canvas} className={styles.trails} aria-hidden="true" />
  </div>;
}
