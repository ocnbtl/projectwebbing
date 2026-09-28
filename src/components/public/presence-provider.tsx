"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

export type Peer={x:number;y:number;at:number};
type Presence={count:number|null;connected:boolean;peers:React.RefObject<Map<string,Peer>>;send:(x:number,y:number)=>void};
const context=createContext<Presence>({count:null,connected:false,peers:{current:new Map()},send:()=>{}});
export const usePresence=()=>useContext(context);
export function PresenceProvider({children,enabled}:{children:React.ReactNode;enabled:boolean}) {
  const peers=useRef(new Map<string,Peer>());
  const socket=useRef<WebSocket|null>(null);
  const lastSent=useRef(0);
  const [count,setCount]=useState<number|null>(null);
  const [connected,setConnected]=useState(false);
  useEffect(()=>{
    const endpoint=process.env.NEXT_PUBLIC_PRESENCE_URL;
    if(!enabled||!endpoint)return;
    const peerMap=peers.current;
    let disposed=false,retry:ReturnType<typeof setTimeout>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined,attempt=0;
    const clear=()=>{clearTimeout(retry);clearInterval(heartbeat);};
    const connect=()=>{
      if(disposed||document.hidden)return;
      const ws=new WebSocket(endpoint);socket.current=ws;
      ws.onopen=()=>{attempt=0;setConnected(true);heartbeat=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send("ping");},25000);};
      ws.onmessage=event=>{
        if(event.data==="pong")return;
        try {
          const data=JSON.parse(event.data);
          if((data.type==="presence"||data.type==="leave")&&Number.isInteger(data.count)&&data.count>=0&&data.count<=256)setCount(data.count);
          if(data.type==="point"&&typeof data.id==="string"&&Number.isFinite(data.x)&&Number.isFinite(data.y)&&data.x>=0&&data.x<=1&&data.y>=0&&data.y<=1) {
            if(peers.current.size<256||peers.current.has(data.id))peers.current.set(data.id,{x:data.x,y:data.y,at:performance.now()});
          }
          if(data.type==="leave")peers.current.delete(data.id);
        } catch { /* Discard unknown server payloads. */ }
      };
      ws.onclose=()=>{clearInterval(heartbeat);socket.current=null;peers.current.clear();setCount(null);setConnected(false);if(!disposed&&!document.hidden)retry=setTimeout(connect,Math.min(30000,1000*2**attempt++)+Math.random()*500);};
      ws.onerror=()=>ws.close();
    };
    const visibility=()=>{clear();if(document.hidden)socket.current?.close(1000,"Hidden");else if(!socket.current||socket.current.readyState===WebSocket.CLOSED)connect();};
    retry=setTimeout(connect,0);document.addEventListener("visibilitychange",visibility);
    return()=>{disposed=true;clear();document.removeEventListener("visibilitychange",visibility);socket.current?.close(1000,"Leaving");socket.current=null;peerMap.clear();};
  },[enabled]);
  const send=(x:number,y:number)=>{const now=performance.now();if(socket.current?.readyState===WebSocket.OPEN&&now-lastSent.current>=125){lastSent.current=now;socket.current.send(JSON.stringify({type:"point",x:Math.round(x*1000)/1000,y:Math.round(y*1000)/1000}));}};
  return <context.Provider value={{count,connected,peers,send}}>{children}</context.Provider>;
}
