import {monogramContours,matchMonogramContours,type Contours} from './monogram-contours';
import {createMonogramField,packMonogramField} from './monogram-surface';

type Face={family:string;path:string};
type Request={id:number;entry:number;token:number;face:Face;from:Face;progress:number;release?:boolean};
type State={token:number;contours:Contours;morph:ReturnType<typeof matchMonogramContours>};
const states=new Map<number,State>(),cache=new Map<string,Uint8Array>();
// This worker owns rasterization, pixel readback, distance transforms and
// contour matching. The window receives only the finished glass texture.
self.onmessage=(event:MessageEvent<Request>)=>{
 const job=event.data;
 if(job.release){states.delete(job.entry);return;}
 try{
  let data:Uint8Array,size:number;
  if(job.progress>=1){
   let packed=cache.get(job.face.family);
   if(!packed){packed=packMonogramField(createMonogramField(job.face.path));cache.set(job.face.family,packed);if(cache.size>32)cache.delete(cache.keys().next().value!);}
   data=packed.slice();size=384;
   // Keep only current geometry for a possible interruption by a study selection.
   states.delete(job.entry);
  }else{
   let state=states.get(job.entry);
   if(!state||state.token!==job.token){
    const from=state?.contours??monogramContours(job.from.family);
    state={token:job.token,contours:from,morph:matchMonogramContours(from,monogramContours(job.face.family))};states.set(job.entry,state);
   }
   const shape=state.morph(job.progress);state.contours=shape.contours;
   size=192;data=packMonogramField(createMonogramField(shape.path,size,shape.holes));
  }
  self.postMessage({id:job.id,token:job.token,progress:job.progress,size,data}, {transfer:[data.buffer]});
 }catch(error){self.postMessage({id:job.id,error:String(error)});}
};
