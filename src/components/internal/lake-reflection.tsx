"use client";

import {useEffect, useMemo} from "react";
import {BufferGeometry, Matrix4, Mesh, PlaneGeometry, ShaderMaterial} from "three";
import {Reflector} from "three/examples/jsm/objects/Reflector.js";
import {LAKE_WATER_LEVEL} from "./lake-shore";

// One low-resolution reflected scene, clipped at the actual lake plane. The
// reflected terrain and plants are the same objects visitors fly through.
export function LakeSurface({geometry,material,compact}:{geometry:BufferGeometry;material:ShaderMaterial;compact:boolean}) {
  const resources=useMemo(()=>{
    const plane=new PlaneGeometry(1,1);
    const size=compact?512:1024;
    const reflector=new Reflector(plane,{textureWidth:size,textureHeight:size,multisample:0,clipBias:.001});
    reflector.rotation.x=-Math.PI/2;
    reflector.position.y=LAKE_WATER_LEVEL;
    reflector.updateMatrixWorld(true);
    const inverse=new Matrix4().copy(reflector.matrixWorld).invert();
    return {plane,reflector,inverse,size};
  },[compact]);
  useEffect(()=>{
    document.documentElement.dataset.madaginLakeOptics=JSON.stringify({version:"water-light-1",reflection:"actual-scene-planar",resolution:resources.size,plane:LAKE_WATER_LEVEL,depth:"shared-terrain-bed",authoredBasin:true});
    return ()=>{resources.reflector.dispose();resources.plane.dispose();delete document.documentElement.dataset.madaginLakeOptics;};
  },[resources]);
  return <mesh geometry={geometry} material={material} name="Madagin depth-coupled lake with actual terrain reflections"
    onBeforeRender={function(this:Mesh,renderer,scene,camera,geometry,drawMaterial,group){
      if(camera.position.y<=LAKE_WATER_LEVEL+.2||scene.userData.madaginWaterReflection)return;
      const visible=this.visible;
      this.visible=false;
      scene.userData.madaginWaterReflection=true;
      // A channel reuses the lake texture. Exclude its consumers while writing
      // that texture, avoiding a WebGL read/write feedback loop and recursion.
      const hidden:Mesh[]=[];
      scene.traverseVisible(object=>{
        if(object instanceof Mesh&&!Array.isArray(object.material)
          &&(object.material as ShaderMaterial).uniforms?.uLakeReflection){hidden.push(object);object.visible=false;}
      });
      try {
        resources.reflector.onBeforeRender(renderer,scene,camera,geometry,drawMaterial,group);
        const reflectionMaterial=resources.reflector.material as ShaderMaterial;
        material.uniforms.uLakeReflection.value=resources.reflector.getRenderTarget().texture;
        material.uniforms.uLakeReflectionMatrix.value.copy(reflectionMaterial.uniforms.textureMatrix.value).multiply(resources.inverse);
        material.uniforms.uLakeReflectionReady.value=1;
      } finally {for(const object of hidden)object.visible=true;this.visible=visible;scene.userData.madaginWaterReflection=false;}
    }}/>
}
