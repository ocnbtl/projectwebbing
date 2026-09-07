"use client";

import {useFrame} from "@react-three/fiber";
import {useMemo, useRef} from "react";
import {DirectionalLight, Object3D, Vector3} from "three";

// Preserve the shared sun direction and energy. Spend the single shadow map on
// the visible foreground instead of one fixed kilometre-wide area at the origin.
export function JourneySun({direction,shadows}:{direction:Vector3;shadows:boolean}) {
  const light=useRef<DirectionalLight>(null);
  const target=useMemo(()=>new Object3D(),[]);
  const scratch=useMemo(()=>({forward:new Vector3(),center:new Vector3(),right:new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize(),up:new Vector3()}),[direction]);
  useFrame(({camera})=>{
    if(!light.current)return;
    camera.getWorldDirection(scratch.forward);
    scratch.center.copy(camera.position).addScaledVector(scratch.forward,100);
    scratch.up.crossVectors(direction,scratch.right).normalize();
    // Snap in the light plane, so stationary surfaces don't crawl across texels
    // when the camera moves by less than one shadow sample.
    const texel=360/2048;
    for(const axis of [scratch.right,scratch.up]){
      const coordinate=scratch.center.dot(axis);
      scratch.center.addScaledVector(axis,Math.round(coordinate/texel)*texel-coordinate);
    }
    target.position.copy(scratch.center);target.updateMatrixWorld();
    light.current.position.copy(scratch.center).addScaledVector(direction,720);
  });
  return <>
    <primitive object={target}/>
    <directionalLight ref={light} target={target} castShadow={shadows} color="#f4dac1" intensity={2.62}
      shadow-bias={-0.00012} shadow-normalBias={0.12} shadow-radius={2.2}
      shadow-camera-left={-180} shadow-camera-right={180} shadow-camera-top={180} shadow-camera-bottom={-180}
      shadow-camera-near={2} shadow-camera-far={1900} shadow-mapSize-width={2048} shadow-mapSize-height={2048}/>
  </>;
}
