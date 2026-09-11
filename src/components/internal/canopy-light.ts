import {BufferGeometry, Vector3} from "three";

export const CANOPY_LIGHT_VERSION="canopy-light-1";

// Leaves remain the source geometry. A crown-scale normal field gives the
// collection a shared light-facing side while retaining local blade curvature.
// This is an authored foliage-lighting approximation, not measured scattering.
export function shapeCanopyLight(geometry:BufferGeometry){
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox!,center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3());
  const positions=geometry.getAttribute("position"),normals=geometry.getAttribute("normal"),envelope=new Vector3(),blade=new Vector3();
  for(let i=0;i<positions.count;i++){
    envelope.set((positions.getX(i)-center.x)/Math.max(size.x*.5,.01),(positions.getY(i)-center.y)/Math.max(size.y*.5,.01)*.65+.3,(positions.getZ(i)-center.z)/Math.max(size.z*.5,.01));
    if(envelope.lengthSq()<1e-6)envelope.set(0,1,0);else envelope.normalize();
    blade.fromBufferAttribute(normals,i);if(blade.dot(envelope)<0)blade.negate();
    blade.multiplyScalar(.24).addScaledVector(envelope,.76).normalize();
    normals.setXYZ(i,blade.x,blade.y,blade.z);
  }
  normals.needsUpdate=true;
  geometry.userData.canopyLight={version:CANOPY_LIGHT_VERSION,geometryChanged:false,leafNormalWeight:.24};
  return geometry;
}
