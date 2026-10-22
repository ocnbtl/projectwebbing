export type NavWaterRegion={x:number;y:number;w:number;h:number};
export type NavWaterRequest={complete:(pixels:Uint8Array,width:number,height:number)=>void};
const linear=Array.from({length:256},(_,n)=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
/** A tiny GPU probe completes asynchronously. Never copy/read the full water
 * canvas: even an off-thread bitmap copy can stall its rendering context. */
export function createNavWaterSampler(onSample:(values:number[][])=>void){
 let busy=false,disposed=false,last=-Infinity,timer:ReturnType<typeof setTimeout>|undefined;
 return {sample(canvas:HTMLCanvasElement,regions:NavWaterRegion[]){
  if(busy||disposed||canvas.dataset.ready!=='true'||performance.now()-last<450)return false;busy=true;last=performance.now();
  clearTimeout(timer);timer=setTimeout(()=>{busy=false;},1600);
  const request:NavWaterRequest={complete(pixels,width,height){
   clearTimeout(timer);busy=false;if(disposed)return;
   const values=regions.map(r=>{
    const levels:number[]=[];
    for(let y=0;y<12;y++)for(let x=0;x<24;x++){
     const px=Math.max(0,Math.min(width-1,Math.floor((r.x+r.w*(x+.5)/24)*width))),py=Math.max(0,Math.min(height-1,Math.floor((1-r.y-r.h*(y+.5)/12)*height))),i=(py*width+px)*4;
     levels.push(.2126*linear[pixels[i]]+.7152*linear[pixels[i+1]]+.0722*linear[pixels[i+2]]);
    }
    return levels;
   });onSample(values);
  }};
  window.dispatchEvent(new CustomEvent<NavWaterRequest>('madagin:water-luminance',{detail:request}));return true;
 },dispose(){disposed=true;clearTimeout(timer);}};
}
