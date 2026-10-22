// A temporary, unindexed native-Safari comparison. Deliberately bypass the
// application layout, navigation, animation libraries, and water compositor.
const modes = ["page", "canvas", "fixed", "auto"] as const;
type Mode = (typeof modes)[number];

export function GET(request: Request) {
  const selected = new URL(request.url).searchParams.get("mode");
  const mode: Mode = modes.includes(selected as Mode) ? selected as Mode : "page";
  const labels: Record<Mode, string> = {
    page: "A · Page background",
    canvas: "B · Canvas background",
    fixed: "C · Fixed background",
    auto: "D · Automatic viewport",
  };
  const links = modes.map(value => `<a href="?mode=${value}"${value === mode ? ' aria-current="page"' : ""}>${labels[value]}</a>`).join("");
  const rootPaint = mode === "page" || mode === "auto";
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1${mode === "auto" ? "" : ",viewport-fit=cover"}">
<meta name="robots" content="noindex,nofollow"><title>Safari surface check · Madagin</title>
<style>
*{box-sizing:border-box}html{margin:0;background:transparent;color:#fff;font:16px/1.5 system-ui,sans-serif}
body{margin:0;min-height:300vh;background-color:#0f2334;${rootPaint ? "background-image:repeating-linear-gradient(90deg,transparent 0 48px,#ffffff24 48px 96px),linear-gradient(160deg,#6d326c 0%,#214a64 33%,#268d8d 66%,#a65e36 100%);background-size:100% 100%;" : ""}}
canvas{display:block;position:${mode === "fixed" ? "fixed" : "absolute"};top:0;left:0;width:100%;height:${mode === "fixed" ? "100lvh" : "300vh"};pointer-events:none}
main{position:relative;margin:auto;max-width:36rem;padding:calc(32px + env(safe-area-inset-top,0px)) 24px calc(32px + env(safe-area-inset-bottom,0px))}
h1{font-size:1.5rem;line-height:1.2;font-weight:500}p{max-width:30rem}nav{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:24px 0}
a{color:inherit;text-decoration:none;border:1px solid #ffffff80;border-radius:14px;padding:12px;min-height:48px}a[aria-current]{background:#ffffff24;border-color:#fff}
a:focus-visible{outline:3px solid #fff;outline-offset:3px}.note{font-size:.85rem;color:#ffffffbd}#readout{overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace}
.marker{margin-top:65vh;font-size:1.2rem}.home{display:inline-block;margin-top:20px}
</style></head><body>${rootPaint ? "" : '<canvas aria-hidden="true"></canvas>'}
<main><p class="note">MADAGIN · PHONE DISPLAY CHECK · 16 OCT</p><h1>${labels[mode]}</h1>
<p>Compare the areas behind Safari’s clock and address bar with the colorful artwork on this page. Scroll down, then back up.</p>
<p>Try A and B first. Does the artwork continue behind the controls, or do both areas stay flat navy?</p>
<nav aria-label="Background comparisons">${links}</nav>
<p class="note">Each comparison opens a fresh page. These checks do not change the website or save information.</p>
<details><summary>Display details</summary><p id="readout"></p></details>
<p class="marker">Halfway down. Check the top and bottom edges again.</p>
<p class="marker">Return to the top to try another comparison.</p><a class="home" href="/">Return to Madagin ↗</a></main>
<script>
const canvas=document.querySelector('canvas');
function measure(){
 if(canvas){
  canvas.width=Math.ceil(innerWidth);canvas.height=Math.ceil(${mode === "fixed" ? "innerHeight" : "innerHeight*3"});
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  gradient.addColorStop(0,'#6d326c');gradient.addColorStop(.33,'#214a64');gradient.addColorStop(.66,'#268d8d');gradient.addColorStop(1,'#a65e36');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#ffffff24';for(let x=48;x<canvas.width;x+=96)ctx.fillRect(x,0,48,canvas.height);
 }
 document.querySelector('#readout').textContent=navigator.userAgent+' | viewport '+innerWidth+' × '+innerHeight+' | visual '+(visualViewport?Math.round(visualViewport.height):'unavailable');
}
measure();addEventListener('resize',measure);
</script></body></html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  });
}
