import * as THREE from "three";
import { waterOverscan } from "./water-viewport";
import { getWaterWake, wakeGLSL } from "./water-wake";
import type {NavWaterRequest} from "./nav-water-sampler";
type Field={x:number;y:number;progress:number;hoverX:number;hoverY:number;hover:number};
/** Post-processes the unchanged Balsa field so glass and surrounding water share one displacement. */
export function createWaterRefraction(canvas:HTMLCanvasElement,source:HTMLCanvasElement) {
 const renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:"low-power",preserveDrawingBuffer:true});
 const makeTexture=()=>{const t=new THREE.CanvasTexture(source);t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.colorSpace=THREE.NoColorSpace;return t;};
 let texture=makeTexture(),sourceWidth=source.width,sourceHeight=source.height;
 let wake=getWaterWake();
 const makeWake=()=>{const t=new THREE.DataTexture(wake.data,wake.width,wake.height);t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;};
 let wakeTexture=makeWake(),previous=0;
 const uniforms={uSource:{value:texture},uSourceSize:{value:new THREE.Vector2(sourceWidth,sourceHeight)},uWake:{value:wakeTexture},uAspect:{value:1},uPaintRange:{value:new THREE.Vector2(1,0)},uField:{value:new THREE.Vector4(.5,.5,1,0)},uPointer:{value:new THREE.Vector3(.5,.5,0)},uPulse:{value:new THREE.Vector4(.5,.5,-10,1)},uPulseShape:{value:new THREE.Vector4(0,1,.32,0)},uPulseLife:{value:1.8},uTime:{value:0}};
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`${wakeGLSL}
uniform sampler2D uSource;uniform vec2 uSourceSize;uniform float uAspect;uniform vec2 uPaintRange;uniform vec4 uField;uniform vec3 uPointer;uniform vec4 uPulse;uniform vec4 uPulseShape;uniform float uPulseLife;uniform float uTime;varying vec2 vUv;
 void main(){
 // Actual edge pixels, with unchanged viewport coordinates for shared wakes.
 vec2 uv=vec2(vUv.x,1.-abs(mod(vUv.y*uPaintRange.x-uPaintRange.y,2.)-1.));
 vec2 p=uv;vec3 field=waterWake(uv);p+=field.xy*.055/vec2(uAspect,1.);
 // Moving normals refract the original Balsa image AND catch a broad sky light.
 // Refraction alone was almost invisible against the soft, low-contrast field.
 vec3 normal=normalize(vec3(-field.xy*3.2,1.));
 vec3 sky=normalize(vec3(-.24,.32,1.));
 float reflection=pow(max(0.,dot(normal,sky)),19.)-pow(sky.z,19.);
 float wake=clamp(dot(field.xy,vec2(-.65,.7))*.88,-.043,.095);
 vec2 h=(uv-uPointer.xy)*vec2(uAspect,1.);float near=exp(-dot(h,h)*60.)*uPointer.z;p+=h*near*.055;
 float age=uTime-uPulse.z;vec2 pd=(uv-uPulse.xy)*vec2(uAspect,1.);
 float angle=atan(pd.y,pd.x)+uPulseShape.x;
 float irregular=1.+sin(angle*3.+uPulseShape.w)*.035+sin(angle*5.-uPulseShape.w)*.019;
 float stretch=mix(1.,uPulseShape.y,pow(cos(angle),2.));
 float wave=exp(-pow((length(pd)*stretch*irregular-age*uPulseShape.z)*(26.+sin(uPulseShape.w)*3.),2.))*max(0.,1.-age/uPulseLife)*step(0.,age)*uPulse.w;p+=normalize(pd+vec2(.0001))*wave*.014;
 // A small optical footprint prevents the source's subpixel grain from
 // aliasing into concentric combs under refraction. Unstirred water is exact.
 vec2 footprint=smoothstep(.008,.10,length(field.xy))*.9/uSourceSize;
 p=clamp(p,.001,.999);
 vec3 c=texture2D(uSource,p).rgb*.5;
 c+=(texture2D(uSource,p+vec2(footprint.x,0.)).rgb+texture2D(uSource,p-vec2(footprint.x,0.)).rgb+texture2D(uSource,p+vec2(0.,footprint.y)).rgb+texture2D(uSource,p-vec2(0.,footprint.y)).rgb)*.125;
 c+=vec3(.68,.83,.94)*(wake+max(-.15,reflection)*.10+near*.005+wave*.02);gl_FragColor=vec4(c,1.);}`});
 const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(new THREE.Mesh(geometry,material));
 // Pipelined readback of a small duplicate render avoids synchronous canvas
 // capture just as the navigation and chapter arrow come through the water.
 const probe=new THREE.WebGLRenderTarget(256,128,{depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 const pixels=new Uint8Array(256*128*4);let probing=false,disposed=false;
 const luminance=(event:Event)=>{
  if(probing||disposed)return;probing=true;const request=(event as CustomEvent<NavWaterRequest>).detail;
  const paintScale=uniforms.uPaintRange.value.x,paintOffset=uniforms.uPaintRange.value.y;
  uniforms.uPaintRange.value.set(1,0);
  renderer.setRenderTarget(probe);renderer.render(scene,camera);renderer.setRenderTarget(null);
  uniforms.uPaintRange.value.set(paintScale,paintOffset);
  void renderer.readRenderTargetPixelsAsync(probe,0,0,256,128,pixels).then(()=>{if(!disposed)request.complete(pixels,256,128);}).catch(()=>{}).finally(()=>{probing=false;if(disposed)probe.dispose();});
 };
 window.addEventListener('madagin:water-luminance',luminance);
 const field=(event:Event)=>{const v=(event as CustomEvent<Field>).detail;uniforms.uField.value.set(v.x,1-v.y,v.progress,0);uniforms.uPointer.value.set(v.hoverX,1-v.hoverY,v.hover);};
 const pulse=(event:Event)=>{const v=(event as CustomEvent<{x:number;y:number;strength?:number;duration?:number}>).detail;uniforms.uPulse.value.set(v.x,1-v.y,performance.now()/1000,v.strength??1);uniforms.uPulseLife.value=v.duration??1.8;
  // Choose one coherent wave per interaction, never frame-to-frame jitter.
  uniforms.uPulseShape.value.set(Math.random()*Math.PI*2,.94+Math.random()*.12,.30+Math.random()*.035,Math.random()*Math.PI*2);
 };
 window.addEventListener("madagin:glass-field",field);window.addEventListener("madagin:surface-pulse",pulse);
 return {resize(){renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));const edge=waterOverscan();canvas.dataset.waterEdge=String(edge);renderer.setSize(innerWidth,innerHeight+edge*2,false);uniforms.uAspect.value=innerWidth/innerHeight;uniforms.uPaintRange.value.set((innerHeight+edge*2)/innerHeight,edge/innerHeight);},render(time:number,playing:boolean){
  const current=getWaterWake();if(current!==wake){wake=current;wakeTexture.dispose();wakeTexture=makeWake();uniforms.uWake.value=wakeTexture;}
  if(playing)wake.advance(Math.max(0,time-previous));previous=time;wakeTexture.needsUpdate=true;
  canvas.dataset.wakeEnergy=wake.energy.toExponential(3);canvas.dataset.wakeRevision=String(wake.revision);canvas.dataset.wakeSlope=wake.peakSlope.toFixed(4);
  if(source.width!==sourceWidth||source.height!==sourceHeight){texture.dispose();texture=makeTexture();uniforms.uSource.value=texture;sourceWidth=source.width;sourceHeight=source.height;uniforms.uSourceSize.value.set(sourceWidth,sourceHeight);}
  texture.needsUpdate=true;uniforms.uTime.value=performance.now()/1000;renderer.render(scene,camera);
 },dispose(){disposed=true;window.removeEventListener('madagin:water-luminance',luminance);if(!probing)probe.dispose();window.removeEventListener("madagin:glass-field",field);window.removeEventListener("madagin:surface-pulse",pulse);geometry.dispose();material.dispose();texture.dispose();wakeTexture.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
