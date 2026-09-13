import {BufferGeometry,Color,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Vector3} from "three";

export const BRANCH_CROWNS_VERSION="branch-crowns-3";
type Surface={positions:number[];uvs:number[];colors:number[];indices:number[]};
const surface=():Surface=>({positions:[],uvs:[],colors:[],indices:[]});
const up=new Vector3(0,1,0);

// Two authored generic broadleaf forms. A continuous branching graph carries
// the leaves: scaffold -> lateral -> shoot -> paired blades. It is not an
// opaque volume fitted inside the old point cloud, nor a species claim.
export function createBranchCrown(variant:number,stand=false) {
  let seed=53183+variant*149;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const wood=surface(),leaves=surface();let shoots=0,blades=0;
  const vertex=(s:Surface,p:Vector3,u:number,v:number,c:Color)=>{
    const i=s.positions.length/3;s.positions.push(p.x,p.y,p.z);s.uvs.push(u,v);s.colors.push(c.r,c.g,c.b);return i;
  };
  const branch=(points:Vector3[],radius:number)=>{
    const base=wood.positions.length/3,sides=4;
    for(let j=0;j<points.length;j++){
      const t=j/(points.length-1),direction=points[Math.min(j+1,points.length-1)].clone().sub(points[Math.max(0,j-1)]).normalize();
      const a=new Vector3().crossVectors(Math.abs(direction.y)>.96?new Vector3(1,0,0):up,direction).normalize(),b=new Vector3().crossVectors(direction,a);
      const r=radius*(1-t*.88),color=new Color().setRGB(.12+.035*t,.105+.025*t,.065+.018*t);
      for(let k=0;k<sides;k++){
        const angle=k/sides*Math.PI*2;
        vertex(wood,points[j].clone().addScaledVector(a,Math.cos(angle)*r).addScaledVector(b,Math.sin(angle)*r),k/sides,t,color);
        if(j){const i=base+j*sides+k,n=base+j*sides+(k+1)%sides;wood.indices.push(i,i-sides,n,n,i-sides,n-sides);}
      }
    }
  };
  const leaf=(root:Vector3,angle:number,length:number,tilt:number,shade:number)=>{
    const d=new Vector3(Math.cos(angle),tilt,Math.sin(angle)).normalize(),side=new Vector3(-d.z,0,d.x).normalize();
    const color=new Color().setRGB(.12*shade,.195*shade,.055*shade),base=leaves.positions.length/3;
    // Rounded shoulders and a drooping tip replace the flat diamond outline.
    // The base remains exactly attached to its twig; the center cups upward.
    const outline=[[0,0],[.28,-.31],[.68,-.36],[1,0],[.68,.36],[.28,.31]];
    vertex(leaves,root.clone().addScaledVector(d,length*.48).addScaledVector(up,length*.095),.5,.48,color.clone().multiplyScalar(1.04));
    for(const [t,w]of outline){
      const p=root.clone().addScaledVector(d,length*t).addScaledVector(side,length*w).addScaledVector(up,(Math.sin(t*Math.PI)*.045-t*t*.07)*length);
      vertex(leaves,p,w/.74+.5,t,color.clone().multiplyScalar(.92+.08*t));
    }
    for(let i=0;i<6;i++)leaves.indices.push(base,base+1+i,base+1+(i+1)%6);
    blades++;
  };
  const shoot=(start:Vector3,end:Vector3,angle:number,shade:number)=>{
    shoots++;const mid=start.clone().lerp(end,.52).add(new Vector3(0,.012,0));
    branch([start,mid,end],.0017);
    for(let pair=0;pair<(stand?3:4);pair++){
      const t=.12+pair*(stand?.3:.23),point=t<.52?start.clone().lerp(mid,t/.52):mid.clone().lerp(end,(t-.52)/.48),size=(stand?.074+random()*.026:.058+random()*.021)*(1-t*.2);
      for(const sign of [-1,1])leaf(point,angle+sign*(.76+random()*.46),size,-.45+random()*.95,shade*(.86+random()*.2));
    }
    leaf(end,angle,stand?.077:.060,-.12+random()*.5,shade);
  };
  const trunk=[new Vector3(0,0,0),new Vector3(.006,.13,-.008),new Vector3(-.016,.3,.012),new Vector3(.012,.46,.004),new Vector3(-.015,.61,.025)];
  branch(trunk,.025);
  // Unequal lower, middle and emergent scaffolds occupy a deep crown. The
  // previous single shallow umbrella exposed nearly every trunk in a stand.
  for(let i=0;i<15;i++){
    const angle=i*2.399963+variant*.7+(random()-.5)*.23;
    const tier=Math.floor(i/5),ring=i/14,spread=[.36,.37,.3][tier]*(.75+random()*.5)*(variant===2?.86:1);
    const start=trunk[2+Math.min(2,tier)].clone();
    const crownHeight=[.44,.68,.82][tier]+random()*.17+.055*Math.sin(angle*2+variant);
    const end=new Vector3(Math.cos(angle)*spread+(tier===2?.065*Math.cos(variant+1):0),crownHeight,Math.sin(angle)*spread*(variant%2===0?.86:1.09));
    const elbow=start.clone().lerp(end,.5).add(new Vector3(0,.055,0));
    branch([start,start.clone().lerp(elbow,.55),elbow,elbow.clone().lerp(end,.55),end],.0145*(1-ring*.35));
    for(let j=0;j<(stand?4:6);j++){
      const t=.25+j*(stand?.23:.145),anchor=elbow.clone().lerp(end,Math.max(0,(t-.5)*2));
      if(t<.5)anchor.copy(start).lerp(elbow,t*2);
      const side=j%2?1:-1,a=angle+side*(.55+random()*.6),extent=.085+random()*.08;
      const tip=anchor.clone().add(new Vector3(Math.cos(a)*extent,.025+random()*.055,Math.sin(a)*extent));
      const shade=.55+.34*ring;
      const bend=anchor.clone().lerp(tip,.54).addScaledVector(up,.014);
      branch([anchor,bend,tip],.0036);
      for(let k=0;k<(stand?2:3);k++){
        const along=.28+k*(stand?.62:.31),base=along<.54?anchor.clone().lerp(bend,along/.54):bend.clone().lerp(tip,(along-.54)/.46),sway=a+(k%2?1:-1)*(.52+random()*.35);
        const target=base.clone().add(new Vector3(Math.cos(sway)*(.055+random()*.04),-.025+random()*.085,Math.sin(sway)*(.055+random()*.04)));
        shoot(base,target,sway,shade);
      }
    }
  }
  const geometry=(s:Surface)=>{
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(s.positions,3));g.setAttribute('uv',new Float32BufferAttribute(s.uvs,2));g.setAttribute('color',new Float32BufferAttribute(s.colors,3));g.setIndex(s.indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.branchCrowns={version:BRANCH_CROWNS_VERSION,variant,shoots,blades,leafStride:7,leafRootIndex:1};return g;
  };
  const group=new Group();
  for(const [name,s]of [['wood',wood],['leaves',leaves]] as const){const material=new MeshStandardMaterial({vertexColors:true,roughness:.88});material.name=`authored-${name}`;group.add(new Mesh(geometry(s),material));}
  return group;
}

// Keep grounded source positions, but remove the packed rows that were hidden
// by the old noisy crowns. Crown-size spacing permits overlapping canopy and
// smaller understory trees; deterministic priority avoids manifest-order rows.
export function selectBranchGrovePlacements(placements:number[][]) {
  const rank=(p:number[])=>{const n=Math.sin(p[2]*12.9898+p[4]*78.233)*43758.5453;return n-Math.floor(n);};
  const height=(p:number[])=>(p[1]===0?17.5:p[1]===1?10:5.3)*Math.max(.55,Math.min(1.45,p[7]));
  const bins=new Map<string,number[][]>(),selected:number[][]=[],cell=16;
  for(const p of [...placements].sort((a,b)=>rank(a)-rank(b))){
    const x=Math.floor(p[2]/cell),z=Math.floor(p[4]/cell),h=height(p);let occupied=false;
    for(let dz=-1;dz<=1&&!occupied;dz++)for(let dx=-1;dx<=1&&!occupied;dx++){
      occupied=(bins.get(`${x+dx},${z+dz}`)??[]).some(q=>Math.hypot(p[2]-q[2],p[4]-q[4])<.25*(h+height(q))&&Math.abs(p[3]-q[3])<Math.max(h,height(q))*.7);
    }
    if(occupied)continue;const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(p);bins.set(key,bucket);selected.push(p);
  }
  return selected;
}
