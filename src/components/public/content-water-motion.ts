/** Content passes through a refracting surface; the shared water stays put. */
export function contentWaterMotion(element:HTMLElement,entering:boolean,duration=700,smooth=false){
 // About contains long text and a continuously redrawn sculpture. Filtering
 // that whole surface re-rasterizes every glyph and strand on every frame.
 // Keep the water pulse in the background and composite the content once.
 if(smooth){
  // Preserve layout transforms (including centered controls). Replacing one
  // with an identity transform makes the first exit frame jump sideways.
  const style=getComputedStyle(element),base=style.transform==='none'?'':style.transform;
  const submerged={opacity:0,transform:`translate3d(0,18px,0) ${base}`.trim()};
  const surfaced={opacity:entering?1:Number(style.opacity),transform:base||'none'};
  return element.animate(entering?[submerged,surfaced]:[surfaced,submerged],{
   duration,easing:entering?'cubic-bezier(.22,1,.36,1)':'cubic-bezier(.45,0,.65,1)',
   fill:entering?'none':'forwards',
  });
 }
 const ns='http://www.w3.org/2000/svg',id=`content-water-${Math.random().toString(36).slice(2)}`;
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.position='absolute';
 const defs=document.createElementNS(ns,'defs'),filter=document.createElementNS(ns,'filter');filter.id=id;filter.setAttribute('x','-5%');filter.setAttribute('y','-5%');filter.setAttribute('width','110%');filter.setAttribute('height','110%');
 const noise=document.createElementNS(ns,'feTurbulence');noise.setAttribute('type','fractalNoise');noise.setAttribute('baseFrequency','.007 .019');noise.setAttribute('numOctaves','1');noise.setAttribute('seed',String(Math.floor(Math.random()*100)));noise.setAttribute('result','water');
 const displacement=document.createElementNS(ns,'feDisplacementMap');displacement.setAttribute('in','SourceGraphic');displacement.setAttribute('in2','water');displacement.setAttribute('xChannelSelector','R');displacement.setAttribute('yChannelSelector','G');
 const blur=document.createElementNS(ns,'feGaussianBlur');blur.setAttribute('stdDeviation',entering?'3':'0');
 displacement.setAttribute('scale',entering?'8':'0');
 filter.append(noise,displacement,blur);defs.append(filter);svg.append(defs);document.body.append(svg);
 // A CSS filter list containing url() switches discretely instead of smoothly
 // interpolating its blur. Keep the reference fixed and animate the SVG itself.
 const shallow={opacity:1,filter:`url(#${id})`},deep={opacity:0,filter:`url(#${id})`};
 const animation=element.animate(entering?[deep,shallow]:[shallow,deep],{duration,easing:entering?'cubic-bezier(.16,.7,.22,1)':'cubic-bezier(.45,0,.65,1)',fill:entering?'none':'forwards'});
 let frame=0;const start=performance.now();const paint=(now:number)=>{const t=Math.min(1,(now-start)/duration),depth=entering?1-t:t;displacement.setAttribute('scale',String(8*depth*depth));blur.setAttribute('stdDeviation',String(3*depth*depth));if(t<1)frame=requestAnimationFrame(paint);};frame=requestAnimationFrame(paint);
 const clean=()=>{cancelAnimationFrame(frame);svg.remove();};animation.finished.then(clean,clean);
 return animation;
}
