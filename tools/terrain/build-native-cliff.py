"""Retain a native-grid CUDEM cliff window; only scene translation and collar blending are authored."""
from pathlib import Path
import json,hashlib,numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
src_path=ROOT/'world-source/dem/noaa-cudem-kauai-2021/ncei19_n22x25_w159x75_2021v1.tif'
sha=hashlib.sha256(src_path.read_bytes()).hexdigest();assert sha=='1c73d38004fa26eeba80b0a9e1bdd317b097eb007cebe53bcf76f39149e0bcec'
src=Image.open(src_path);sx,sy,_=src.tag_v2[33550];_,_,_,lon0,lat0,_=src.tag_v2[33922]
lon,lat=-159.649,22.174;dx=sx*111320*np.cos(np.radians(lat));dz=sy*111320
nx,nz=round(480/dx),round(310/dz);ix=round((lon-lon0)/sx-.5)-nx//2;iz=round((lat0-lat)/sy-.5)-nz//2
h=np.asarray(src.crop((ix,iz,ix+nx+1,iz+nz+1)),dtype=np.float32);assert np.isfinite(h).all() and (h>-9990).all()
# sceneYawDegrees is clockwise in the source raster's east/south plane;
# np.rot90(...,-1) is equivalent to -90 degrees around Three.js positive Y.
data={'version':'native-cliff-1','sourceSha256':sha,'source':'NOAA CUDEM Hawaii 2021','sourceUrl':'https://chs.coast.noaa.gov/htdata/raster2/elevation/NCEI_ninth_Topobathy_Hawaii_9428/tiles/ncei19_n22x25_w159x75_2021v1.tif','sourcePixelWindow':[ix,iz,nx+1,nz+1],'sourceCenter':[lon,lat],'sceneYawDegrees':90,'sourceGridMeters':[float(dz),float(dx)],'rows':nx+1,'columns':nz+1,'x0':-300,'z0':-250,'width':float(nz*dz),'depth':float(nx*dx),'verticalTranslation':-40,'collarMeters':40,'sourceRange':[float(h.min()),float(h.max())],'precisionMeters':.01,'elevations':[round(float(v),2) for v in np.rot90(h,-1).ravel()]}
out=ROOT/'src/components/internal/native-cliff-field.json';out.write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
proof={k:v for k,v in data.items() if k!='elevations'};proof.update({'rights':'NOAA public domain in the United States; CIRES CUDEM DOI 10.25921/ds9v-ky35','accuracy':'Nominal 1/9 arc-second grid, mixed/interpolated sources; not uniform 3 m survey accuracy','transform':'Native source grid and metres retained. Geographic window rotated 90 degrees about vertical and translated into an authored scene. Only 40 m boundary collar blends to retained terrain. No residual extraction, relief exaggeration or geographic continuity claim for the whole world.','fieldBytes':out.stat().st_size,'fieldSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'quantizationMaxErrorMeters':float(np.max(np.abs(h-np.round(h,2))))})
p=ROOT/'output/releases/madagin-native-cliff-20260908/source-field.json';p.write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in proof.items() if k in ['sourceRange','fieldBytes','sourceGridMeters','width','depth','quantizationMaxErrorMeters']}))
