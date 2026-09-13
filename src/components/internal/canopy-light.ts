import {BufferGeometry, Mesh, Object3D, Vector3} from "three";

export const CANOPY_LIGHT_VERSION="canopy-light-2";
export const CROWN_SHELTER_VERSION="crown-shelter-1";

// A bounded ambient shelter bake from the actual modeled leaf area above each
// point. Rotating a tree around its trunk preserves this overhead relationship.
// Directional lighting and moving shadow geometry remain the renderer's job.
export function bakeCrownShelter(tree:Object3D){
  const meshes:Mesh[]=[];tree.traverse(child=>{if(child instanceof Mesh)meshes.push(child);});
  const leaf=meshes.find(mesh=>/leaves/.test((Array.isArray(mesh.material)?mesh.material[0]:mesh.material).name));
  if(!leaf||leaf.geometry.userData.crownShelter)return;
  const geometry=leaf.geometry;geometry.computeBoundingBox();
  const box=geometry.boundingBox!,size=box.getSize(new Vector3()),n=32,layers=24;
  const density=new Float32Array(n*n*layers),overhead=new Float32Array(density.length);
  const p=geometry.getAttribute("position"),index=geometry.index!,a=new Vector3(),b=new Vector3(),c=new Vector3();
  const gx=(x:number)=>(x-box.min.x)/size.x*(n-1),gz=(z:number)=>(z-box.min.z)/size.z*(n-1);
  const gy=(y:number)=>Math.max(0,Math.min(layers-1,Math.floor((y-box.min.y)/size.y*(layers-1))));
  const cellArea=size.x*size.z/(n*n);
  for(let i=0;i<index.count;i+=3){
    a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));
    const x=gx((a.x+b.x+c.x)/3),z=gz((a.z+b.z+c.z)/3),y=gy((a.y+b.y+c.y)/3);
    const area=Math.abs(b.sub(a).cross(c.sub(a)).y)*.5/cellArea;
    const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
    for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){
      const xx=Math.min(n-1,ix+dx),zz=Math.min(n-1,iz+dz);
      density[(y*n+zz)*n+xx]+=area*(dx?fx:1-fx)*(dz?fz:1-fz);
    }
  }
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    let sum=0;for(let y=layers-1;y>=0;y--){const i=(y*n+z)*n+x;overhead[i]=sum;sum+=density[i];}
  }
  const shelter=(x:number,y:number,z:number)=>{
    if(x<box.min.x||x>box.max.x||z<box.min.z||z>box.max.z||y>box.max.y)return 1;
    const xx=Math.floor(gx(x)),zz=Math.floor(gz(z)),layer=gy(y);let sum=0,weight=0;
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const ix=xx+dx,iz=zz+dz;if(ix<0||ix>=n||iz<0||iz>=n)continue;
      const w=dx===0&&dz===0?4:dx===0||dz===0?2:1;
      sum+=overhead[(layer*n+iz)*n+ix]*w;weight+=w;
    }
    return .5+.5*Math.exp(-.22*sum/Math.max(1,weight));
  };
  for(const mesh of meshes){
    const g=mesh.geometry,position=g.getAttribute("position"),color=g.getAttribute("color");
    let minimum=1,maximum=0;
    // Keep shade coherent within a blade, so the bake cannot create a voxel
    // checkerboard across its surface. Wood is smoothly shaded at its vertices.
    const stride=mesh===leaf?geometry.userData.branchCrowns.leafStride:1;
    for(let i=0;i<position.count;i+=stride){
      const shade=shelter(position.getX(i),position.getY(i),position.getZ(i));minimum=Math.min(minimum,shade);maximum=Math.max(maximum,shade);
      for(let j=0;j<stride;j++)color.setXYZ(i+j,color.getX(i+j)*shade,color.getY(i+j)*shade,color.getZ(i+j)*shade);
    }
    color.needsUpdate=true;g.userData.crownShelter={version:CROWN_SHELTER_VERSION,minimum,maximum,source:"modeled-overhead-leaf-area",grid:[n,n,layers]};
  }
}

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
    blade.multiplyScalar(.42).addScaledVector(envelope,.58).normalize();
    normals.setXYZ(i,blade.x,blade.y,blade.z);
  }
  normals.needsUpdate=true;
  geometry.userData.canopyLight={version:CANOPY_LIGHT_VERSION,geometryChanged:false,leafNormalWeight:.42};
  return geometry;
}
