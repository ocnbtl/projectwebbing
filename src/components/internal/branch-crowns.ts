import {BufferGeometry,Color,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Vector3} from "three";

export const BRANCH_CROWNS_VERSION="branch-crowns-4";
type Surface={positions:number[];uvs:number[];colors:number[];indices:number[]};
const surface=():Surface=>({positions:[],uvs:[],colors:[],indices:[]});
const up=new Vector3(0,1,0);

// Unequal ascending leaders fork into terminal foliage clusters. Every blade
// remains attached to the wood graph; these are authored broadleaf forms, not
// a reconstruction of a named Hawaiian species.
export function createBranchCrown(variant:number,stand=false) {
  let seed=53183+variant*149;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const wood=surface(),leaves=surface(),clusterNormals:number[]=[];let shoots=0,blades=0;
  let clusterCenter=new Vector3();
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
    const outward=root.clone().sub(clusterCenter).addScaledVector(up,.035).normalize();
    for(let i=0;i<7;i++)clusterNormals.push(outward.x,outward.y,outward.z);
    blades++;
  };
  const shoot=(start:Vector3,end:Vector3,angle:number,shade:number)=>{
    shoots++;const mid=start.clone().lerp(end,.52).add(new Vector3(0,.012,0));
    branch([start,mid,end],.0017);
    for(let blade=0;blade<(stand?6:8);blade++){
      const t=.08+blade*(stand?.15:.115),point=t<.52?start.clone().lerp(mid,t/.52):mid.clone().lerp(end,(t-.52)/.48),size=(stand?.058+random()*.022:.046+random()*.015)*(1-t*.2);
      const sign=blade%2?1:-1;
      leaf(point,angle+sign*(.7+random()*.65),size,-.65+random()*1.4,shade*(.86+random()*.2));
    }
    leaf(end,angle,stand?.061:.048,-.25+random()*.6,shade);
  };
  const trunk=[new Vector3(0,0,0),new Vector3(.006,.13,-.008),new Vector3(-.016,.3,.012),new Vector3(.012,.46,.004),new Vector3(-.015,.61,.025)];
  branch(trunk,.025);
  const onPath=(a:Vector3,b:Vector3,c:Vector3,t:number)=>t<.5?a.clone().lerp(b,t*2):b.clone().lerp(c,(t-.5)*2);
  for(let i=0;i<8;i++){
    const angle=i*2.399963+variant*.7+(random()-.5)*.8;
    const t=.15+random()*.8,start=trunk[2].clone().lerp(trunk[3],t);
    const spread=(.235+random()*.13)*(variant===2?.86:1);
    const end=new Vector3(Math.cos(angle)*spread,.43+i/7*.34+random()*.12,Math.sin(angle)*spread*(variant%2===0?.86:1.09));
    const elbow=start.clone().lerp(end,.45).addScaledVector(up,.06);
    branch([start,elbow,end],.014*(1-i/7*.3));
    // Unequal forks occupy separate lobes, with open seams between some lobes.
    // Foliage is carried near the ends rather than tiled along a flat tier.
    for(let fork=0;fork<3;fork++){
      const anchor=onPath(start,elbow,end,.44+fork*.26);
      const a=angle+(fork-1)*(.7+random()*.6),extent=.095+random()*.07;
      const tip=anchor.clone().add(new Vector3(Math.cos(a)*extent,-.04+random()*.13,Math.sin(a)*extent));
      const bend=anchor.clone().lerp(tip,.5).addScaledVector(up,.025);
      branch([anchor,bend,tip],.005);
      clusterCenter=tip.clone().addScaledVector(up,.025);
      const shade=.66+tip.y*.2;
      for(let twig=0;twig<(stand?4:6);twig++){
        const base=onPath(anchor,bend,tip,.6+random()*.4),azimuth=a+twig*2.399963+random()*.7;
        const radius=.06+random()*.055;
        const target=tip.clone().add(new Vector3(Math.cos(azimuth)*radius,-.07+random()*.15,Math.sin(azimuth)*radius));
        const middle=base.clone().lerp(target,.5).addScaledVector(up,.016);
        branch([base,middle,target],.0024);
        for(let shootIndex=0;shootIndex<(stand?2:3);shootIndex++){
          const root=onPath(base,middle,target,.35+shootIndex*(stand?.6:.3));
          const direction=azimuth+(shootIndex-1)*(.7+random()*.5);
          const shootEnd=root.clone().add(new Vector3(Math.cos(direction)*(.042+random()*.03),-.03+random()*.075,Math.sin(direction)*(.042+random()*.03)));
          shoot(root,shootEnd,direction,shade);
        }
      }
    }
  }
  const geometry=(s:Surface)=>{
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(s.positions,3));g.setAttribute('uv',new Float32BufferAttribute(s.uvs,2));g.setAttribute('color',new Float32BufferAttribute(s.colors,3));if(s===leaves)g.setAttribute('clusterNormal',new Float32BufferAttribute(clusterNormals,3));g.setIndex(s.indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.branchCrowns={version:BRANCH_CROWNS_VERSION,variant,shoots,blades,clusters:24,leafStride:7,leafRootIndex:1};return g;
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
