// Isolated, oversampled glyph sprites follow the same circular path. No glyph
// is sliced out of a neighbouring letter or stretched to fit a curved ribbon.
const MAX_TURN=158*Math.PI/180,EDGE_GAP=12,ARC_SPACING=1.2;
type Glyph={image:HTMLCanvasElement;x:number;center:number;width:number;height:number;pad:number};

export function getActionButtonWidth(area:DOMRect,source:DOMRect,target:DOMRect,preferred:number,rimInset:number){
 void target;void preferred;
 const arc=actionArc(source),end=source.left+arc.x;
 const clearance=(source.height*.5+3)*Math.sin(arc.angle)+(area.width<600?6:EDGE_GAP);
 return Math.min(area.width,Math.max(140,2*(end-clearance-(area.left+area.width/2)+rimInset)));
}
export function actionArc(source:DOMRect){
 const start=source.width*.045,length=(source.width-start)*ARC_SPACING;
 // Preserve the approved turn; add optical breathing room along its length.
 const angle=Math.min(MAX_TURN,(source.width-start)*1.08/(source.height*.57+3)),radius=length/angle;
 return {start,length,angle,radius,x:start+radius*Math.sin(angle),y:radius*(1-Math.cos(angle))};
}
export function createActionCurl(canvas:HTMLCanvasElement){
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Action lettering unavailable');
 let width=0,height=0,ratio=1,originX=0,originY=0,wordWidth=0,wordHeight=0,start=0,angle=0,glyphs:Glyph[]=[];
 return {
  resize({area,source,target,font,color,size,spacing}:{area:DOMRect;source:DOMRect;target:DOMRect;font:string;color:string;size:number;spacing:string}){
   width=area.width;height=area.height;ratio=Math.min(Math.max(devicePixelRatio||1,2),2.5);
   canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
   originX=source.left-area.left;originY=source.top-area.top+source.height/2;wordWidth=source.width;wordHeight=source.height;
   const measure=document.createElement('canvas').getContext('2d')!;measure.font=font;measure.letterSpacing=spacing;
   const metrics=measure.measureText('action'),baseline=(source.height-metrics.fontBoundingBoxAscent-metrics.fontBoundingBoxDescent)/2+metrics.fontBoundingBoxAscent;
   const tracking=parseFloat(spacing)||0,word='action',pad=Math.max(4,size*.1),resolution=4;
   glyphs=[...word].map((letter,i)=>{
    // Prefix advances preserve font kerning at curl=0. Each sprite contains
    // only its own glyph, including overhangs and transparent sampling gutters.
    const own=measure.measureText(letter),x=measure.measureText(word.slice(0,i+1)).width-own.width;
    const advance=own.width-tracking,inkWidth=Math.max(advance,own.actualBoundingBoxRight)+Math.max(0,own.actualBoundingBoxLeft),w=inkWidth+pad*2,h=source.height+pad*2;
    const image=document.createElement('canvas');image.width=Math.ceil(w*resolution);image.height=Math.ceil(h*resolution);
    const ink=image.getContext('2d')!;ink.scale(resolution,resolution);ink.font=font;ink.fillStyle=color;
    ink.fillText(letter,pad+Math.max(0,own.actualBoundingBoxLeft),pad+baseline);
    return {image,x:x-Math.max(0,own.actualBoundingBoxLeft),center:x+advance/2,width:w,height:h,pad};
   });
   const arc=actionArc(source);start=arc.start;angle=arc.angle;
   canvas.dataset.radius=arc.radius.toFixed(2);canvas.dataset.angle=(angle*180/Math.PI).toFixed(2);
   canvas.dataset.destination=JSON.stringify({x:target.right+EDGE_GAP-area.left,y:target.top+target.height/2-area.top});
   canvas.dataset.inkHeight=String(source.height);canvas.dataset.bendStart=start.toFixed(2);canvas.dataset.arcLength=(arc.length+start).toFixed(2);canvas.dataset.wordWidth=source.width.toFixed(2);
   canvas.dataset.glyphRendering='isolated';
  },
  draw(curl:number){
   if(!width||!height)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
   for(const glyph of glyphs){
    let x=glyph.center,y=0,turn=0;
    if(glyph.center>start&&curl>.0001){
     const length=wordWidth-start,t=(glyph.center-start)/length,bend=angle*curl;
     turn=bend*t;const r=length*(1+(ARC_SPACING-1)*curl)/bend;
     x=start+r*Math.sin(turn);y=r*(1-Math.cos(turn));
    }
    ctx.save();ctx.translate(originX+x,originY+y);ctx.rotate(turn);
    ctx.drawImage(glyph.image,glyph.x-glyph.center-glyph.pad,-wordHeight/2-glyph.pad,glyph.width,glyph.height);ctx.restore();
   }
  },
  dispose(){glyphs=[];ctx.clearRect(0,0,canvas.width,canvas.height);},
 };
}
