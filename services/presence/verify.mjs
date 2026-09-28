import assert from "node:assert/strict";
import WebSocket from "ws";
const base=process.argv[2]||"ws://127.0.0.1:8787/connect";
const origin=process.argv[3]||"http://localhost:3000";
const clients=[];
async function connect() {
 const ws=new WebSocket(base,{origin});const messages=[];ws.on("message",raw=>{try{messages.push(JSON.parse(raw));}catch{}});
 await new Promise((resolve,reject)=>{ws.once("open",resolve);ws.once("error",reject);});
 clients.push(ws);return{ws,messages};
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 const a=await connect(),b=await connect();await delay(200);
 assert.equal(a.messages.filter(m=>m.type==="presence").at(-1).count,2);
 a.ws.send(JSON.stringify({type:"point",x:.3,y:.7}));await delay(160);
 const point=b.messages.find(m=>m.type==="point");assert.equal(point.x,.3);assert.equal(point.y,.7);assert.ok(point.id);
 a.ws.close();await delay(160);assert.equal(b.messages.find(m=>m.type==="leave").count,1);
 b.ws.send(JSON.stringify({type:"point",x:99,y:0}));
 await new Promise(resolve=>b.ws.once("close",code=>{assert.equal(code,1008);resolve();}));
 const forbidden=await fetch(base.replace("ws:","http:").replace("wss:","https:"),{headers:{Origin:"https://unrelated.example"}});
 assert.equal(forbidden.status,403);
 const invalidUpgrade=await fetch(base.replace("ws:","http:").replace("wss:","https:"),{headers:{Origin:origin}});
 assert.equal(invalidUpgrade.status,426);
 console.log(JSON.stringify({passed:["shared count","cursor relay","disconnect count","coordinate validation","origin restriction","upgrade validation"]}));
} finally {for(const ws of clients)ws.close();}
