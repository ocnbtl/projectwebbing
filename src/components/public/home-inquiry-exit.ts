import {contentWaterMotion} from './content-water-motion';

/** Submerge only the visible content; leave the shared water and navigation in place. */
export function submergeHomeForInquiry(content:HTMLElement,duration=650){
 const panel=content.querySelector<HTMLElement>('[data-guided-panel]:not([hidden])');
 if(!panel)return [];
 const visible=(element:HTMLElement)=>{const b=element.getBoundingClientRect();return b.width>0&&b.height>0&&b.bottom>0&&b.top<innerHeight;};
 const candidates=[...panel.querySelectorAll<HTMLElement>('[data-liquid-stage],[data-studio-intro],[data-inquiry-departure],[data-inquiry-control],[data-variant],[data-message]'),...document.querySelectorAll<HTMLElement>('[data-reading-advance]')].filter(visible);
 const targets=candidates.filter(element=>!candidates.some(parent=>parent!==element&&parent.contains(element)));
 const animations=targets.map(element=>{
  const b=element.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:(b.left+b.width/2)/innerWidth,y:Math.max(.05,Math.min(.95,(b.top+b.height/2)/innerHeight)),strength:.42/Math.sqrt(targets.length),duration:1.6}}));
  return contentWaterMotion(element,false,duration,true);
 });
 // These are full-viewport decorations; fade them without filtering a large canvas.
 document.querySelectorAll<HTMLElement>('[data-reading-haze],[data-real-count] > *').forEach(element=>{
  animations.push(element.animate([{opacity:getComputedStyle(element).opacity},{opacity:0}],{duration,easing:'ease-in',fill:'forwards'}));
 });
 const button=document.querySelector<HTMLElement>('header[data-home="true"] a[href="#inquiry"]');
 if(button&&!button.closest('[inert]')){
  const b=button.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:(b.left+b.width/2)/innerWidth,y:(b.top+b.height/2)/innerHeight,strength:.8,duration:1.5}}));
 }
 animations.forEach(animation=>{animation.id='home-inquiry-submerge';});
 return animations;
}
