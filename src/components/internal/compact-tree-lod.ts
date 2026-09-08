import {BufferGeometry, Float32BufferAttribute} from "three";

// Keep complete connected leaf cards throughout the 3D crown. This is an
// art-directed distant derivative, not a billboard or a new plant source.
export function createDistantLeaves(source:BufferGeometry) {
  const position=source.getAttribute("position"),index=source.getIndex();
  if(!index)throw new Error("Distant foliage requires indexed connected leaves");
  const parent=Uint32Array.from({length:position.count},(_,i)=>i);
  const root=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<index.count;i+=3){parent[root(index.getX(i+1))]=root(index.getX(i));parent[root(index.getX(i+2))]=root(index.getX(i));}
  const groups=new Map<number,number[]>();
  for(let i=0;i<index.count;i+=3){const key=root(index.getX(i)),group=groups.get(key)??[];group.push(index.getX(i),index.getX(i+1),index.getX(i+2));groups.set(key,group);}
  const attributes=Object.fromEntries(Object.keys(source.attributes).map(name=>[name,[] as number[]]));
  const faces:number[]=[];let offset=0,leaf=0,retained=0;
  for(const group of groups.values()){
    if(leaf++%4!==0)continue;
    const vertices=[...new Set(group)],remap=new Map(vertices.map((v,i)=>[v,offset+i]));
    const center=[0,1,2].map(c=>vertices.reduce((sum,i)=>sum+position.getComponent(i,c),0)/vertices.length);
    for(const [name,values] of Object.entries(attributes)){
      const attribute=source.getAttribute(name);
      for(const i of vertices)for(let c=0;c<attribute.itemSize;c++){
        const value=attribute.getComponent(i,c);
        values.push(name==="position"?center[c]+(value-center[c])*2:value);
      }
    }
    faces.push(...group.map(i=>remap.get(i)!));offset+=vertices.length;retained++;
  }
  const result=new BufferGeometry();
  for(const [name,values] of Object.entries(attributes))result.setAttribute(name,new Float32BufferAttribute(values,source.getAttribute(name).itemSize));
  result.setIndex(faces);result.computeBoundingBox();result.computeBoundingSphere();
  result.userData.distantLeaves={version:"compact-crown-lod-1",sourceLeaves:groups.size,retainedLeaves:retained,expansion:2,sourceTriangles:index.count/3,triangles:faces.length/3};
  return result;
}
