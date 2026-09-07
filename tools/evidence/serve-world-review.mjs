// Local evidence only. Byte ranges let browsers seek the original WebM captures.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('output/playwright/madagin-world-progress');
const mime={'.html':'text/html; charset=utf-8','.json':'application/json','.png':'image/png','.webm':'video/webm','.mp4':'video/mp4'};
http.createServer((req,res)=>{
 try {
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  const stat=fs.statSync(file);if(!stat.isFile()){res.writeHead(404).end();return}
  const headers={'Content-Type':mime[path.extname(file)]??'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
  const match=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  let start=0,end=stat.size-1;
  if(match){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;
   if(start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return}
   headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  }
  res.writeHead(match?206:200,{...headers,'Content-Length':end-start+1});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
 }catch{res.writeHead(404).end()}
}).listen(Number(process.env.MADAGIN_REVIEW_PORT??3143),'127.0.0.1',()=>console.log('Local world review with media seeking ready.'));
