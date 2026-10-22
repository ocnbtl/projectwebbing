import { emergenceGLSL } from "./water-optics";

// Shared optical material for the homepage meshes and the typeface study.
import {withWaterViewport} from './water-viewport';
export const liquidLetterFragment = withWaterViewport(`${emergenceGLSL}
      uniform vec3 uField; uniform vec2 uSize; uniform sampler2D uWater;uniform vec2 uViewport;uniform vec2 uOrigin;uniform float uHeight;uniform float uDpr;uniform float uTime;uniform float uEmerge;uniform float uEdgeBoost;uniform vec2 uRipple;uniform float uHover;uniform vec2 uBounds;
      varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;
      void main(){
        vec3 n=normalize(vNormal);vec3 eye=normalize(vView);
        float facing=abs(dot(n,eye));float edge=pow(1.-facing,1.8);
        vec2 screen=vec2(gl_FragCoord.x/uDpr+uOrigin.x,uViewport.y-uOrigin.y-uHeight+gl_FragCoord.y/uDpr)/uViewport;
        vec3 surface=emergenceField(screen,uField.xy,uViewport.x/uViewport.y,uField.z);
        float depth=1.-uEmerge;
        float swell=sin(dot(screen,vec2(31.,19.))+uTime*1.65)*.48
                   +sin(dot(screen,vec2(-21.,37.))-uTime*1.12)*.32
                   +sin(dot(screen,vec2(53.,-17.))+uTime*2.1)*.20;
        float localDepth=depth+swell*.10*sin(uEmerge*3.14159265);
        float dry=1.-smoothstep(.04,.45,localDepth);
        float meniscus=exp(-pow((localDepth-.16)*16.,2.))*pow(abs(swell),3.)*.4;
        n=normalize(n+vec3(surface.xy*(12.+depth*7.),surface.z*.055+meniscus*.09));
        facing=abs(dot(n,eye));edge=pow(1.-facing,1.8);
        float wave=sin(vPosition.x*3.2+uTime*.6)*sin(vPosition.y*4.1-uTime*.4);
        vec2 fromPointer=vPosition.xy-uRipple;
        float lens=exp(-dot(fromPointer,fromPointer)*1.9)*uHover;
        vec2 bend=n.xy*(.010+edge*.037)+surface.xy*(.5+depth)+fromPointer*lens*.022+(1.-uEmerge)*vec2(sin(vPosition.y*8.+uTime),wave)*.012;
        vec2 uv=clamp(screen+bend,vec2(.002),vec2(.998));
        vec3 behind=texture2D(uWater,uv).rgb;
        float split=.00085*edge;
        behind.r=texture2D(uWater,uv+vec2(split,0.)).r;
        behind.b=texture2D(uWater,uv-vec2(split,0.)).b;
        vec3 light=normalize(vec3(-.45,.85,1.));
        vec3 movingLight=normalize(vec3(-.55+uRipple.x*uHover*.18,.9+uRipple.y*uHover*.12,1.));
        float reflected=pow(max(dot(reflect(-movingLight,n),eye),0.),90.);
        float softbox=pow(max(dot(reflect(-normalize(vec3(.7,.45,1.)),n),eye),0.),22.)*.22;
        float rim=pow(edge,.65)*(.22+.56*max(dot(n,light),0.));
        vec2 underUV=clamp(screen+bend*(1.35+depth),vec2(.012),vec2(.988));
        float diffusion=depth*.009;
        vec3 submerged=texture2D(uWater,underUV).rgb*.5;
        submerged+=texture2D(uWater,underUV+vec2(diffusion,diffusion*.7)).rgb*.25;
        submerged+=texture2D(uWater,underUV-vec2(diffusion,diffusion*.7)).rgb*.25;
        vec3 color=mix(submerged*vec3(.84,.92,.97),behind*1.035+vec3(.008,.014,.018),dry);
        float polished=pow(edge,3.)*.55+pow(max(0.,1.-abs(facing-.45)*9.),3.)*.17;
        color+=vec3(.84,.94,1.)*(rim*uEdgeBoost*.62+reflected*.95+softbox+polished*uEdgeBoost*.85)*mix(uEmerge*.2,1.,dry);
        color+=vec3(.3,.42,.55)*max(0.,uEdgeBoost-1.2)*.06*uEmerge;
        float silk=pow(max(0.,1.-abs(fromPointer.x*.48+fromPointer.y*.62)),18.)*uHover;
        color+=vec3(.86,.92,1.)*silk*edge*.45+vec3(.9,.85,.74)*reflected*uHover*.18;
        color+=vec3(.64,.81,.91)*surface.z*.07+vec3(.76,.9,.96)*meniscus*.13;
        // The full outline is visible through depth before surface tension
        // sharpens it. Patchy wave crests replace the former top-down wipe.
        float alpha=smoothstep(.01,.3,uEmerge)*mix(.14+uEmerge*.54,1.,dry);
        gl_FragColor=vec4(color,alpha);
      }`);
