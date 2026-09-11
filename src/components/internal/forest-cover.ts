import {DataTexture, LinearFilter, RGBAFormat, UnsignedByteType} from "three";

export const FOREST_COVER = {version:"forest-cover-1",size:512,minX:-900,minZ:-1700,width:1800,depth:1900,heightMin:-150,heightRange:500} as const;
export type CrownFootprint = {x:number;z:number;ground:number;radiusX:number;radiusZ:number};
const pixels=new Uint8Array(FOREST_COVER.size**2*4);
export const forestCoverTexture=new DataTexture(pixels,FOREST_COVER.size,FOREST_COVER.size,RGBAFormat,UnsignedByteType);
forestCoverTexture.minFilter=forestCoverTexture.magFilter=LinearFilter;
forestCoverTexture.generateMipmaps=false;forestCoverTexture.needsUpdate=true;
const zones=new Map<string,CrownFootprint[]>();
let pending=false;

// Shared shelter/contact approximation, not a replacement for directional
// shadows. Only actual planted crown footprints contribute; height rejection
// prevents a ridge tree from shading a distant cliff or lower valley floor.
export function rasterizeForestCover(footprints:CrownFootprint[],target:Uint8Array) {
  const {size,minX,minZ,width,depth,heightMin,heightRange}=FOREST_COVER;
  const density=new Float32Array(size*size),height=new Float32Array(size*size);
  for(const crown of footprints){
    const rx=Math.max(1.2,crown.radiusX),rz=Math.max(1.2,crown.radiusZ);
    const x0=Math.max(0,Math.floor((crown.x-rx-minX)/width*size)),x1=Math.min(size-1,Math.ceil((crown.x+rx-minX)/width*size));
    const z0=Math.max(0,Math.floor((crown.z-rz-minZ)/depth*size)),z1=Math.min(size-1,Math.ceil((crown.z+rz-minZ)/depth*size));
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
      const dx=(minX+(x+.5)/size*width-crown.x)/rx,dz=(minZ+(z+.5)/size*depth-crown.z)/rz;
      const r2=dx*dx+dz*dz;if(r2>=1)continue;
      const weight=(1-r2)**2,index=z*size+x;
      density[index]+=weight;height[index]+=weight*crown.ground;
    }
  }
  for(let i=0;i<density.length;i++){
    const cover=1-Math.exp(-density[i]*1.7);
    // Premultiply encoded height by coverage for valid bilinear edge samples.
    const encoded=density[i]>0?Math.max(0,Math.min(1,(height[i]/density[i]-heightMin)/heightRange)):0;
    target[i*4]=Math.round(255*cover);target[i*4+1]=Math.round(255*cover*encoded);target[i*4+2]=0;target[i*4+3]=255;
  }
}

function scheduleUpdate(){
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{
    pending=false;const crowns=[...zones.values()].flat();
    rasterizeForestCover(crowns,pixels);forestCoverTexture.needsUpdate=true;
    document.documentElement.dataset.madaginForestCover=JSON.stringify({...FOREST_COVER,trees:crowns.length,textureBytes:pixels.byteLength,source:"actual-planted-crown-bounds",interpretation:"shelter-and-contact-approximation"});
  });
}
export function registerForestCover(zone:string,crowns:CrownFootprint[]){
  zones.set(zone,crowns);scheduleUpdate();
  return ()=>{if(zones.get(zone)===crowns){zones.delete(zone);scheduleUpdate();}};
}
