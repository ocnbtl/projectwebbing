"""Ground patchy secondary canopy on the exact accepted public ridge.

This derives authored ecology from the existing geometry, not surveyed vegetation.
Requires NumPy and Pillow; run export-ridge-base.mjs first. Original assets are read only.
"""
from pathlib import Path
import hashlib, json, math
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'output/releases/madagin-ridge-20260906'
OUT = ROOT / 'public/world/ridge-canopy-v1'
OUT.mkdir(parents=True, exist_ok=True)
N = 321
X0, X1, Z0, Z1 = -310., 310., -315., 285.
xs, zs = np.linspace(X0,X1,N), np.linspace(Z0,Z1,N)
xx, zz = np.meshgrid(xs,zs)
dx, dz = (X1-X0)/(N-1), (Z1-Z0)/(N-1)
positions = np.fromfile(WORK/'base-positions.f32',dtype='<f4').reshape(-1,3)
indices = np.fromfile(WORK/'base-indices.u32',dtype='<u4').reshape(-1,3)
base = np.full((N,N),-np.inf,dtype=np.float32)
for triangle in indices:
    a,b,c = positions[triangle]
    determinant = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
    if abs(determinant)<1e-7: continue
    ix0=max(0,int(math.ceil((min(a[0],b[0],c[0])-X0)/dx-1e-5)))
    ix1=min(N-1,int(math.floor((max(a[0],b[0],c[0])-X0)/dx+1e-5)))
    iz0=max(0,int(math.ceil((min(a[2],b[2],c[2])-Z0)/dz-1e-5)))
    iz1=min(N-1,int(math.floor((max(a[2],b[2],c[2])-Z0)/dz+1e-5)))
    if ix0>ix1 or iz0>iz1: continue
    x,z=xx[iz0:iz1+1,ix0:ix1+1],zz[iz0:iz1+1,ix0:ix1+1]
    u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/determinant
    v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/determinant
    inside=(u>=-1e-4)&(v>=-1e-4)&(u+v<=1.0001)
    target=base[iz0:iz1+1,ix0:ix1+1]
    target[inside]=np.maximum(target[inside],(u*a[1]+v*b[1]+(1-u-v)*c[1])[inside])
assert np.isfinite(base).all(), 'Missing source terrain samples'

def smooth(a,b,v):
    t=np.clip((v-a)/(b-a),0,1)
    return t*t*(3-2*t)

height=base.copy()
mask=smooth(-290,-245,xx)*(1-smooth(245,285,xx))*smooth(-280,-232,zz)*(1-smooth(202,250,zz))*smooth(-4,18,base)
gz,gx=np.gradient(height,dz,dx)
slope=np.hypot(gx,gz)
# D8 steepest descent, only strict decreases: the drainage graph is acyclic.
flat=height.ravel(); downstream=np.full(N*N,-1,dtype=np.int32); best=np.zeros_like(height)
for oz,ox in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
    za,zb=max(0,-oz),min(N,N-oz);xa,xb=max(0,-ox),min(N,N-ox)
    decline=(height[za:zb,xa:xb]-height[za+oz:zb+oz,xa+ox:xb+ox])/math.hypot(ox*dx,oz*dz)
    win=decline>best[za:zb,xa:xb]
    best[za:zb,xa:xb][win]=decline[win]
    zi,xi=np.mgrid[za:zb,xa:xb]
    downstream.reshape(N,N)[za:zb,xa:xb][win]=((zi+oz)*N+xi+ox)[win]
area=np.ones(N*N,dtype=np.float32)*dx*dz
for i in np.argsort(flat)[::-1]:
    if downstream[i]>=0: area[downstream[i]]+=area[i]
drainage=np.clip(np.log1p(area.reshape(N,N)/50)/7,0,1)
valid=downstream>=0
assert (flat[np.where(valid)[0]]>flat[downstream[valid]]).all()
def sample(field,x,z):
    fx=np.clip((x-X0)/(X1-X0)*(N-1),0,N-1.001); fz=np.clip((z-Z0)/(Z1-Z0)*(N-1),0,N-1.001)
    ix,iz=np.floor(fx).astype(int),np.floor(fz).astype(int);fx-=ix;fz-=iz
    return (field[iz,ix]*(1-fx)+field[iz,ix+1]*fx)*(1-fz)+(field[iz+1,ix]*(1-fx)+field[iz+1,ix+1]*fx)*fz
# A patchy secondary canopy follows the resolved slopes and contributing area.
# Jittered cells avoid planting rows; steep rock and drainage thalwegs remain open.
rng=np.random.default_rng(6090603)
canopy=[]
for z in np.arange(-232,216,5):
    for x in np.arange(-252,252,5):
        x+=float(rng.uniform(-2.8,2.8));zj=z+float(rng.uniform(-2.8,2.8))
        h=float(sample(height,x,zj));m=float(sample(mask,x,zj));sl=float(sample(slope,x,zj));flow=float(sample(drainage,x,zj))
        patch=.5+.5*math.sin(x*.026+math.sin(zj*.023)*1.6)*math.sin(zj*.039+x*.007)
        probability=(.6+.38*patch)*(1-smooth(.7,1.6,sl))
        if m<.45 or h<0 or flow>.75 or rng.random()>probability: continue
        # Lower exposed crowns, varied mature crowns in sheltered ground.
        height_m=float(rng.uniform(6.0,12.0))*(1-.27*min(sl,1))
        canopy.append([round(x,3),round(h-.16,3),round(zj,3),round(float(rng.uniform(0,math.tau)),4),round(height_m,3),round(float(rng.uniform(.8,1.35)),3)])



# Spatial buckets retain the actual indexed triangle authority for root placement.
from collections import defaultdict
buckets=defaultdict(list)
for i,triangle in enumerate(indices):
    t=positions[triangle]
    if abs(np.cross(t[1]-t[0],t[2]-t[0])[1])<1e-7: continue
    for bz in range(int(np.floor(t[:,2].min()/10)),int(np.floor(t[:,2].max()/10))+1):
        for bx in range(int(np.floor(t[:,0].min()/10)),int(np.floor(t[:,0].max()/10))+1): buckets[(bx,bz)].append(i)
def exact_height(x,z):
    t=positions[indices[buckets[(math.floor(x/10),math.floor(z/10))]]]
    a,b,c=t[:,0],t[:,1],t[:,2]
    det=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2])
    u=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/det
    v=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/det
    inside=(u>=-1e-5)&(v>=-1e-5)&(u+v<=1.00001)
    assert inside.any()
    return float((u*a[:,1]+v*b[:,1]+(1-u-v)*c[:,1])[inside].max())
errors=[];selected=[];max_gap=0.;max_burial=0.
for c in canopy:
    h=exact_height(c[0],c[2]);errors.append(abs(c[1]+.16-h))
    c[1]=round(h-.16,4)
    samples=[exact_height(c[0]+math.cos(a)*.15,c[2]+math.sin(a)*.15) for a in np.arange(8)*math.tau/8]
    gap=max(0,c[1]-min(samples));burial=max(samples)-c[1]
    if gap>.10 or burial>.45: continue
    max_gap=max(max_gap,gap);max_burial=max(max_burial,burial);selected.append(c)
canopy=selected
(OUT/'canopy.json').write_text(json.dumps(canopy,separators=(',',':'))+'\n')
manifest={
 'id':'madagin-ridge-canopy-v1','baselineCommit':'7536e49f76b352bfb3faab46d78174426455fda7',
 'terrainSource':'public/world/v115/madagin-ridge-to-valley-high-v1.15.glb / RIDGE_V115_HIGH',
 'terrainSha256':hashlib.sha256((ROOT/'public/world/v115/madagin-ridge-to-valley-high-v1.15.glb').read_bytes()).hexdigest(),
 'geometryRecipe':'Pinned createRidgeErosionTerrainGeometry; renderer geometry unchanged. Triangle-authoritative root placement after raster slope and D8 screening.',
 'model':'public/world/canopy-v1/vegetation-mid.glb','modelSha256':hashlib.sha256((ROOT/'public/world/canopy-v1/vegetation-mid.glb').read_bytes()).hexdigest(),
 'variants':[14,15,4,6], 'license':'Existing CC0 Poly Haven tree_small_02 and pachira_aquatica_01 derivatives; see canopy-v1/PROVENANCE.md.',
 'count':len(canopy),'seed':6090603,'fields':['x','rootY','z','rotationRadians','heightMeters','widthRatio'],
 'placementPolicy':'5 m jittered candidates, patch gaps, slope < 1.6, positive ground and interior join fade; open high-accumulation thalwegs. Authored ecology, not a surveyed species distribution.',
 'rootChecks':{'sampleRadiusMeters':.15,'footprintSamples':8,'maximumGapMeters':max_gap,'maximumBurialMeters':max_burial,'gridApproximationMaximumBeforeCorrectionMeters':max(errors)},
 'drainage':{'method':'Strictly downhill D8 on accepted base; dry contributing-area habitat only','edges':int(valid.sum()),'allEdgesDecrease':True},
 'scope':'Desktop secondary canopy; compact keeps its existing ecology and receives no new model or terrain requests.',
 'sha256':hashlib.sha256((OUT/'canopy.json').read_bytes()).hexdigest(),'bytes':(OUT/'canopy.json').stat().st_size
}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
