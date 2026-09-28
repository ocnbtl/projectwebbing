import { DurableObject } from "cloudflare:workers";

/** Transient presence only: no database writes, identities, or cursor history. */
export class PresenceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  sockets() { return this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN); }
  broadcast(value, except) {
    const message = JSON.stringify(value);
    for (const peer of this.sockets()) {
      if (peer === except) continue;
      try { peer.send(message); } catch { peer.close(1011, "Reconnect"); }
    }
  }
  async fetch() {
    if (this.sockets().length >= 256) return new Response("Room full", { status:503 });
    const [client,server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const id = crypto.randomUUID();
    server.serializeAttachment({ id, last:0, window:Date.now(), messages:0 });
    server.send(JSON.stringify({ type:"welcome", id }));
    this.broadcast({ type:"presence", count:this.sockets().length });
    return new Response(null, { status:101, webSocket:client });
  }
  webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 160) { ws.close(1009,"Invalid message"); return; }
    const state = ws.deserializeAttachment();
    if (!state) { ws.close(1008,"Session expired"); return; }
    const now = Date.now();
    if (now-state.window >= 1000) { state.window=now; state.messages=0; }
    state.messages++;
    if (state.messages > 24) { ws.close(1008,"Too many updates"); return; }
    ws.serializeAttachment(state);
    let point;
    try { point=JSON.parse(raw); } catch { ws.close(1008,"Invalid payload"); return; }
    if (point.type !== "point" || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x<0 || point.x>1 || point.y<0 || point.y>1) { ws.close(1008,"Invalid coordinates"); return; }
    if (now-state.last < 100) return;
    state.last=now;ws.serializeAttachment(state);
    this.broadcast({ type:"point", id:state.id, x:point.x, y:point.y },ws);
  }
  webSocketClose(ws, code) {
    const state=ws.deserializeAttachment();ws.close(code===1005 ? 1000 : code);
    this.broadcast({ type:"leave", id:state?.id, count:this.sockets().length });
  }
  webSocketError(ws) { ws.close(1011,"Reconnect");this.broadcast({type:"presence",count:this.sockets().length}); }
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname==="/health") return Response.json({service:"madagin-presence",version:1});
    if(url.pathname!=="/connect" || request.method!=="GET") return new Response("Not found",{status:404});
    const allowed=(env.ALLOWED_ORIGINS||"").split(",");
    if(!allowed.includes(request.headers.get("Origin"))) return new Response("Origin not allowed",{status:403});
    if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket") return new Response("WebSocket required",{status:426});
    return env.PRESENCE.getByName("madagin-public").fetch(request);
  }
};
