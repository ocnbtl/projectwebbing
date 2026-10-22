import * as THREE from 'three';
import {liquidLetterFragment} from './liquid-letter-material';
import {easeMonogram,MONOGRAM_SIZE,MONOGRAM_SPREAD} from './monogram-surface';


type Face={family:string;path:string};
type Surface={texture:THREE.DataTexture;size:number};
type Entry={id:number;token:number;host:HTMLElement;canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;face:Face;from:Face;surface?:Surface;start:number;duration:number;mix:number;visible:boolean;playing:boolean;last:number;dirty:boolean;pending:boolean;requested:number;requestedAt:number};
export type MonogramController={setFace:(face:Face,animate?:boolean)=>void;setPlaying:(playing:boolean)=>void;dispose:()=>void};
type Shared={prepare:(face:Face)=>Promise<void>;register:(host:HTMLElement,canvas:HTMLCanvasElement,face:Face,playing:boolean)=>MonogramController};
let shared:Shared|undefined;

const prefix=`uniform sampler2D uShape;uniform vec2 uTexel;uniform float uNormalScale;uniform float uRefractionScale;varying vec2 vUv;
vec4 fieldAt(vec2 uv){return texture2D(uShape,uv);}
float relief(vec2 uv){float d=max(0.,(fieldAt(uv).g*2.-1.)*${MONOGRAM_SPREAD.toFixed(1)});return 6.0*(1.-exp(-d/3.0));}
vec3 monogramNormal(){float x=relief(vUv-vec2(uTexel.x,0.))-relief(vUv+vec2(uTexel.x,0.));float y=relief(vUv-vec2(0.,uTexel.y))-relief(vUv+vec2(0.,uTexel.y));return normalize(vec3(x*.5*uNormalScale,y*.5*uNormalScale,1.));}
`;
const fragment=(prefix+liquidLetterFragment)
 .replace('void main(){',`void main(){vec4 shape=fieldAt(vUv);float sd=(shape.r*2.-1.)*${MONOGRAM_SPREAD.toFixed(1)};float coverage=shape.b;if(coverage<.003)discard;`)
 .replace('vec3 n=normalize(vNormal);','vec3 n=monogramNormal();')
 .replace('vec2 uv=clamp(screen+bend','bend*=uRefractionScale;vec2 uv=clamp(screen+bend')
 // A brighter, feathered rim defines small glyphs without whitening the glass body.
 .replace('gl_FragColor=vec4(color,alpha);','float contour=1.-smoothstep(0.,2.6,abs(sd));float shoulder=1.-smoothstep(0.,6.,abs(sd));color+=vec3(.83,.93,1.)*(contour*.3+shoulder*.075);gl_FragColor=vec4(color,alpha*coverage);');
function createShared():Shared{
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setClearColor(0,0);renderer.setPixelRatio(1);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
 const uniforms={uShape:{value:null as THREE.Texture|null},uTexel:{value:new THREE.Vector2(1/MONOGRAM_SIZE,1/MONOGRAM_SIZE)},uNormalScale:{value:1},uRefractionScale:{value:.18},uWater:{value:null as THREE.Texture|null},uWaterEdge:{value:0},uField:{value:new THREE.Vector3(.5,.5,1)},uSize:{value:new THREE.Vector2()},uViewport:{value:new THREE.Vector2()},uOrigin:{value:new THREE.Vector2()},uHeight:{value:44},uDpr:{value:2},uTime:{value:0},uEmerge:{value:1},uEdgeBoost:{value:1.8},uRipple:{value:new THREE.Vector2()},uHover:{value:0},uBounds:{value:new THREE.Vector2()}};
 const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,fragmentShader:fragment,vertexShader:`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;void main(){vUv=uv;vNormal=vec3(0.,0.,1.);vView=vNormal;vPosition=vec3((uv-.5)*2.5,0.);gl_Position=vec4(position.xy,0.,1.);}`});scene.add(new THREE.Mesh(geometry,material));
 type Reply={id:number;token:number;progress:number;size:number;data:Uint8Array;error?:string};
 const worker=new Worker(new URL('./monogram-worker.ts',import.meta.url),{type:'module'});
 const requests=new Map<number,{resolve:(reply:Reply)=>void;reject:(error:Error)=>void}>();let jobId=0,entryId=0,disposed=false;
 const request=(job:Record<string,unknown>)=>new Promise<Reply>((resolve,reject)=>{const id=++jobId;requests.set(id,{resolve,reject});worker.postMessage({...job,id});});
 worker.onmessage=(event:MessageEvent<Reply>)=>{const reply=event.data,pending=requests.get(reply.id);requests.delete(reply.id);if(reply.error)pending?.reject(Error(reply.error));else pending?.resolve(reply);};
 worker.onerror=()=>{for(const pending of requests.values())pending.reject(Error('Monogram worker unavailable'));requests.clear();};
 const entries=new Set<Entry>();let frame=0,texture:THREE.CanvasTexture|null=null,waterFrame='',waterWidth=0,waterHeight=0,lost=false;
 const make=(reply:Reply):Surface=>{const texture=new THREE.DataTexture(reply.data,reply.size,reply.size);texture.flipY=true;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return {texture,size:reply.size};};
 const release=(entry:Entry)=>{entry.surface?.texture.dispose();entry.surface=undefined;};
 const wake=()=>{if(!frame&&!document.hidden&&!lost&&!disposed)frame=requestAnimationFrame(draw);};
 const prepareShape=(entry:Entry,progress:number)=>{
  if(entry.pending||entry.requested===progress)return;
  entry.pending=true;entry.requested=progress;entry.requestedAt=performance.now();const token=entry.token;
  request({entry:entry.id,token,from:entry.from,face:entry.face,progress}).then(reply=>{
   if(disposed||!entries.has(entry)||entry.token!==token)return;
   if(!entry.surface||entry.surface.size!==reply.size){release(entry);entry.surface=make(reply);}
   else {entry.surface.texture.image.data=reply.data;entry.surface.texture.needsUpdate=true;}
   entry.mix=reply.progress;entry.dirty=true;
  }).catch(()=>{entry.host.dataset.glassState='fallback';entry.duration=0;}).finally(()=>{entry.pending=false;if(entry.token!==token)entry.requested=-1;wake();});
 };
 function draw(now:number){
  frame=0;if(document.hidden||lost||disposed)return;
  const water=document.querySelector<HTMLCanvasElement>('[data-water-canvas][data-ready="true"]');
  if(!water){for(const entry of entries)entry.host.dataset.glassState='fallback';if([...entries].some(e=>e.visible&&e.playing))wake();return;}
  if(!texture||water.width!==waterWidth||water.height!==waterHeight){texture?.dispose();texture=new THREE.CanvasTexture(water);texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;waterWidth=water.width;waterHeight=water.height;}
  if(waterFrame!==water.dataset.frame){texture.needsUpdate=true;waterFrame=water.dataset.frame||'';}
  uniforms.uWater.value=texture;uniforms.uWaterEdge.value=Number(water.dataset.waterEdge||0);uniforms.uViewport.value.set(innerWidth,innerHeight);uniforms.uTime.value=0;
  for(const entry of entries){
   if(!entry.visible||entry.host.closest('[hidden],[inert]'))continue;
   const b=entry.host.getBoundingClientRect();if(b.width<1||b.bottom<0||b.top>innerHeight)continue;
   const progress=entry.duration?easeMonogram((now-entry.start)/entry.duration):1;
   if(progress===1||now-entry.requestedAt>=16)prepareShape(entry,progress);
   const surface=entry.surface;if(!surface)continue;
   const moving=entry.mix<1;
   if(!entry.dirty&&(!moving&&!entry.playing||now-entry.last<(moving?16:32)))continue;
   entry.dirty=false;entry.last=now;
   const dpr=Math.min(devicePixelRatio||1,3),width=Math.max(2,Math.round(b.width*dpr)),height=Math.max(2,Math.round(b.height*dpr));
   renderer.setSize(width,height,false);if(entry.canvas.width!==width||entry.canvas.height!==height){entry.canvas.width=width;entry.canvas.height=height;}
   uniforms.uTexel.value.set(1/surface.size,1/surface.size);uniforms.uNormalScale.value=surface.size/MONOGRAM_SIZE;
   uniforms.uShape.value=surface.texture;uniforms.uOrigin.value.set(b.left,b.top);uniforms.uHeight.value=b.height;uniforms.uSize.value.set(b.width,b.height);uniforms.uDpr.value=dpr;uniforms.uRefractionScale.value=Math.max(.025,Math.min(.17,b.width/innerWidth*.4));
   renderer.render(scene,camera);entry.ctx.clearRect(0,0,width,height);entry.ctx.drawImage(renderer.domElement,0,0,width,height);entry.host.dataset.glassState='ready';entry.host.dataset.morph=entry.mix.toFixed(3);entry.host.dataset.morphMode='contour-worker';
  }
  if([...entries].some(e=>e.visible&&(e.playing||e.mix<1)))wake();
 }
 const invalidate=()=>{for(const entry of entries)entry.dirty=true;wake();};
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{for(const entry of entries){entry.duration=0;entry.dirty=true;}wake();}};
 const contextLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;for(const entry of entries)entry.host.dataset.glassState='fallback';};
 const restored=()=>{lost=false;invalidate();};renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',restored);
 window.addEventListener('resize',invalidate);window.addEventListener('scroll',invalidate,{passive:true});window.addEventListener('madagin:water-ready',invalidate);document.addEventListener('visibilitychange',visibility);
 return {async prepare(face){
  const reply=await request({entry:0,token:0,face,from:face,progress:1});if(disposed)return;const surface=make(reply);
  const source=document.querySelector<HTMLCanvasElement>('[data-water-canvas][data-ready="true"]');
  if(source&&!texture){texture=new THREE.CanvasTexture(source);texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;waterWidth=source.width;waterHeight=source.height;}
  if(texture){uniforms.uWater.value=texture;uniforms.uShape.value=surface.texture;uniforms.uViewport.value.set(innerWidth,innerHeight);uniforms.uSize.value.set(44,44);await renderer.compileAsync(scene,camera);if(!disposed){renderer.setSize(132,132,false);renderer.render(scene,camera);}}
  surface.texture.dispose();
 },register(host,canvas,face,playing){
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Monogram display unavailable');
  const entry:Entry={id:++entryId,token:0,host,canvas,ctx,face,from:face,visible:false,playing,last:0,dirty:true,start:0,duration:0,mix:1,pending:false,requested:-1,requestedAt:0};entries.add(entry);
  const observer=new IntersectionObserver(([item])=>{entry.visible=item.isIntersecting;entry.dirty=true;if(!entry.visible){entry.duration=0;}wake();});observer.observe(host);const resize=new ResizeObserver(invalidate);resize.observe(host);wake();
  return {setFace(next,animate=true){if(next.family===entry.face.family)return;
    entry.from=entry.face;entry.face=next;entry.token++;entry.requested=-1;host.dataset.font=next.family;
    entry.start=performance.now();entry.duration=animate&&entry.playing&&entry.surface?2450:0;entry.dirty=true;wake();},setPlaying(value){entry.playing=value;if(!value)entry.duration=0;entry.dirty=true;wake();},dispose(){observer.disconnect();resize.disconnect();release(entry);entries.delete(entry);worker.postMessage({release:true,entry:entry.id});delete host.dataset.glassState;
    if(!entries.size){disposed=true;cancelAnimationFrame(frame);worker.terminate();for(const pending of requests.values())pending.reject(Error('Monogram disposed'));requests.clear();geometry.dispose();material.dispose();texture?.dispose();renderer.dispose();renderer.forceContextLoss();window.removeEventListener('resize',invalidate);window.removeEventListener('scroll',invalidate);window.removeEventListener('madagin:water-ready',invalidate);document.removeEventListener('visibilitychange',visibility);shared=undefined;}
   }};
 }};
}
export async function prepareMonogram(face:Face){shared??=createShared();await shared.prepare(face);}
export function registerMonogram(host:HTMLElement,canvas:HTMLCanvasElement,face:Face,playing:boolean){shared??=createShared();return shared.register(host,canvas,face,playing);}

