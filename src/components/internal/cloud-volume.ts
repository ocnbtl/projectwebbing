import {BackSide, Data3DTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, ShaderMaterial, Vector3} from "three";
import type {WorldQualityTier} from "./world-ecology";

export const CLOUD_VOLUME_VERSION="cloud-volume-1";

// A small deterministic density field stays on the GPU. Interpolated 3D samples
// give the sky actual depth; camera rays never project noise onto a vertical dome.
function densityTexture() {
  const size=64,data=new Uint8Array(size**3);
  for(let i=0;i<data.length;i++){
    let value=(i+419701)>>>0;
    value=Math.imul(value^(value>>>16),0x7feb352d);
    value=Math.imul(value^(value>>>15),0x846ca68b);
    data[i]=(value^(value>>>16))>>>24;
  }
  const texture=new Data3DTexture(data,size,size,size);
  texture.name="Madagin cloud density field";texture.format=RedFormat;
  texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;
  texture.generateMipmaps=true;
  texture.wrapS=RepeatWrapping;texture.wrapT=RepeatWrapping;texture.wrapR=RepeatWrapping;
  texture.unpackAlignment=1;texture.needsUpdate=true;
  return texture;
}

export function createCloudVolumeMaterial(tier:WorldQualityTier,sunDirection:Vector3) {
  const noise=densityTexture();
  const material=new ShaderMaterial({
    name:"Madagin cloud volume",side:BackSide,depthWrite:false,toneMapped:true,
    defines:{CLOUD_STEPS:tier==="conservative"?64:tier==="balanced"?80:96},
    uniforms:{uTime:{value:0},uSunDirection:{value:sunDirection.clone()},uCloudNoise:{value:noise}},
    vertexShader:`varying vec3 vSkyPosition;
      void main(){vec4 p=modelMatrix*vec4(position,1.0);vSkyPosition=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`
      precision highp sampler3D;
      uniform sampler3D uCloudNoise;
      uniform float uTime;
      uniform vec3 uSunDirection;
      varying vec3 vSkyPosition;
      float density(vec3 p,float footprint) {
        float h=(p.y-700.0)/460.0;
        float profile=smoothstep(0.0,0.12,h)*(1.0-smoothstep(0.55,1.0,h));
        if(profile<=0.0)return 0.0;
        vec3 q=(p-vec3(-4.5,0.0,2.2)*uTime)*0.000055;
        // A ray step covers a finite world interval. Filter the density at that
        // interval before thresholding; implicit screen derivatives cannot
        // account for undersampling along the ray through this volume.
        float lod=log2(max(0.0001,footprint*0.000055*64.0));
        float broad=textureLod(uCloudNoise,q,max(0.0,lod)).r;
        float billow=textureLod(uCloudNoise,q*2.03+vec3(0.17,0.41,0.73),max(0.0,lod+1.02)).r;
        float detail=textureLod(uCloudNoise,q*4.11+vec3(0.53,0.09,0.31),max(0.0,lod+2.04)).r;
        float weather=textureLod(uCloudNoise,vec3(q.x*0.19,0.37,q.z*0.19),max(0.0,lod-2.4)).r;
        float body=broad*0.60+billow*0.28+detail*0.12;
        float coverage=smoothstep(0.42,0.68,weather);
        return smoothstep(0.53,0.67,body+profile*0.07)*profile*coverage;
      }
      void main() {
        vec3 direction=normalize(vSkyPosition-cameraPosition);
        float h=smoothstep(-0.08,0.82,direction.y);
        vec3 sky=mix(vec3(0.15,0.31,0.38),vec3(0.012,0.066,0.17),h);
        float sun=pow(max(dot(direction,uSunDirection),0.0),180.0);
        sky+=vec3(1.0,0.5,0.2)*sun*0.94;
        float transmittance=1.0;vec3 scattered=vec3(0.0);
        if(direction.y>0.005) {
          float start=max(0.0,(700.0-cameraPosition.y)/direction.y);
          float finish=min(30000.0,(1160.0-cameraPosition.y)/direction.y);
          if(finish>start) {
            float stepLength=(finish-start)/float(CLOUD_STEPS);
            // Fixed spatial stratification breaks the common horizontal sample
            // planes. It does not animate noise or blur the resulting image.
            float phase=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
            for(int i=0;i<CLOUD_STEPS;i++) {
              vec3 p=cameraPosition+direction*(start+(float(i)+phase)*stepLength);
              float cloud=density(p,stepLength);
              if(cloud<0.0001)continue;
              float distanceFade=1.0-smoothstep(12000.0,30000.0,length(p-cameraPosition));
              float extinction=1.0-exp(-cloud*stepLength*0.009*distanceFade);
              // Beer attenuation toward the same sun, with a soft sky bounce.
              float shadow=density(p+uSunDirection*60.0,80.0)*80.0
                +density(p+uSunDirection*180.0,160.0)*160.0
                +density(p+uSunDirection*380.0,220.0)*220.0;
              float direct=exp(-shadow*0.009);
              float forward=pow(max(dot(direction,uSunDirection),0.0),5.0);
              vec3 lighting=vec3(0.23,0.30,0.35)+vec3(1.03,0.97,0.83)*direct*(0.68+forward*0.25);
              float haze=1.0-exp(-length(p-cameraPosition)*0.00012);
              lighting=mix(lighting,sky,haze);
              scattered+=transmittance*extinction*lighting;
              transmittance*=1.0-extinction;
              if(transmittance<0.015)break;
            }
          }
        }
        gl_FragColor=vec4(sky*transmittance+scattered,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return {material,dispose:()=>{material.dispose();noise.dispose();}};
}
