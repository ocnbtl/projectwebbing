/** Mobile Safari can show document pixels under its controls, but cannot paint
 * negative document space above scroll zero. The public page reserves a small
 * painted lead-in, and starts at its content origin before the water reveal. */
export function waterPageTop() {
  return parseFloat(getComputedStyle(document.body).getPropertyValue('--water-page-edge')) || 0;
}

export function waterOverscan() {
  return parseFloat(getComputedStyle(document.body).getPropertyValue('--water-overscan')) || 0;
}

export function scrollToWaterTop(behavior: ScrollBehavior = 'instant') {
  window.scrollTo({ top: waterPageTop(), behavior });
}

/** Safari may restore scroll zero after hydration or pageshow. Reconcile only
 * the short initial settling period, and stop immediately on user input. */
export function settleWaterPageTop() {
  let stopped = false;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const align = () => {
    if (!stopped && scrollY < waterPageTop() && (!location.hash || location.hash === '#top')) scrollToWaterTop();
  };
  const settle = () => {
    timers.forEach(clearTimeout);
    if (stopped) return;
    align();
    timers = [0, 120, 350, 800].map(delay => setTimeout(align, delay));
  };
  const stop = () => { stopped = true; timers.forEach(clearTimeout); };
  const pageShow = (event: PageTransitionEvent) => { if (!event.persisted) settle(); };
  const inputs = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const;
  inputs.forEach(event => window.addEventListener(event, stop, { passive: true, capture: true }));
  window.addEventListener('load', settle);
  window.addEventListener('pageshow', pageShow);
  settle();
  return () => {
    stop();
    inputs.forEach(event => window.removeEventListener(event, stop, true));
    window.removeEventListener('load', settle);
    window.removeEventListener('pageshow', pageShow);
  };
}

/** Glass materials sample viewport coordinates from the overscanned texture. */
export function withWaterViewport(fragment: string) {
  return fragment
    .replaceAll('texture2D(uWater,', 'sampleWater(')
    .replace('uniform sampler2D uWater;', 'uniform sampler2D uWater;uniform float uWaterEdge;')
    .replace('void main(){', `vec4 sampleWater(vec2 uv){
      uv.y=(uv.y*uViewport.y+uWaterEdge)/(uViewport.y+2.*uWaterEdge);
      return texture2D(uWater,uv);
    }
    void main(){`);
}

/** Let momentum finish inside the painted buffer, then settle once. Never
 * chase native deceleration with a scrollTo call on every frame. */
export function containWaterScroll() {
 const query=matchMedia('(any-pointer: coarse), (max-width: 900px)');
 let timer:ReturnType<typeof setTimeout>|undefined,lastY=0,touching=false,settling=false,pulsed=false;
 const limits=()=>({min:waterPageTop(),max:Math.max(waterPageTop(),document.documentElement.scrollHeight-innerHeight-waterOverscan())});
 const editing=()=>document.activeElement?.matches('input,textarea,[contenteditable="true"]')||!!(visualViewport&&visualViewport.scale>1.01);
 const pulse=(top:boolean)=>{if(pulsed)return;pulsed=true;window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:.5,y:top?.07:.93,strength:.25,duration:1.25}}));};
 const settle=()=>{clearTimeout(timer);if(!query.matches||editing()||touching||settling)return;const {min,max}=limits(),next=Math.min(max,Math.max(min,scrollY));if(Math.abs(next-scrollY)<1){pulsed=false;return;}settling=true;pulse(scrollY<min);window.scrollTo({top:next,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});timer=setTimeout(()=>{settling=false;pulsed=false;},500);};
 const queue=()=>{if(settling||touching)return;clearTimeout(timer);timer=setTimeout(settle,160);};
 const start=(event:TouchEvent)=>{clearTimeout(timer);touching=true;settling=false;pulsed=false;lastY=event.touches[0]?.clientY??0;};
 const move=(event:TouchEvent)=>{
  if(!query.matches||event.touches.length!==1||editing()||(event.target as Element)?.closest('textarea,[data-scroll-container]'))return;
  const nextY=event.touches[0].clientY,delta=lastY-nextY;lastY=nextY;
  const {min,max}=limits();
  // Catch an outward drag at the content edge without repeatedly moving the page.
  if((delta<0&&scrollY<=min+1)||(delta>0&&scrollY>=max-1)){if(event.cancelable)event.preventDefault();pulse(delta<0);}
 };
 const end=()=>{touching=false;queue();};
 window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:false});
 window.addEventListener('touchend',end,{passive:true});window.addEventListener('touchcancel',end,{passive:true});
 window.addEventListener('scroll',queue,{passive:true});window.addEventListener('scrollend',settle);
 return()=>{clearTimeout(timer);window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',end);window.removeEventListener('touchcancel',end);window.removeEventListener('scroll',queue);window.removeEventListener('scrollend',settle);};
}
