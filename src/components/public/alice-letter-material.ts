import { wakeGLSL } from "./water-wake";

// A shallow sheet of glass rises through the simulated height field. Refraction
// follows its slope; changing depth attenuates contrast and broadens reflections.
import {withWaterViewport} from './water-viewport';
export const aliceLetterFragment = withWaterViewport(`${wakeGLSL}
uniform sampler2D uSurface;
uniform sampler2D uWater;
uniform vec2 uViewport;
uniform vec2 uOrigin;
uniform vec2 uHostSize;
uniform vec2 uLetterSize;
uniform float uDpr;
uniform float uProgress;
uniform float uTime;
uniform vec2 uPointer;
uniform float uHover;
uniform float uCuts[6];
uniform float uReveal;
uniform float uMotionScale;
uniform float uOpticalBoost;
varying vec2 vUv;
void main(){
 vec2 screen=(gl_FragCoord.xy/uDpr+vec2(uOrigin.x,uViewport.y-uOrigin.y-uHostSize.y))/uViewport;
 vec3 wave=waterWake(screen);
 float ascent=smoothstep(.015,.985,uProgress);
 float letter=0.; float lo=.04; float hi=.96;
 for(int i=0;i<6;i++){if(vUv.x>uCuts[i]){letter=float(i)+1.;lo=uCuts[i];}else{hi=uCuts[i];break;}}
 // Keep M whole; reveal the remaining letters from the measured first gap.
 if(vUv.x>mix(uCuts[0],1.,uReveal))discard;
 float phase=letter*2.399963;
 // The shared water slope carries neighbouring letters together; each letter
 // has a small independent response, rather than seven synchronized glints.
 float drift=sin(uTime*.83+phase)*.55+.24*sin(uTime*1.19-phase*1.7)+wave.z*110.;
 float level=mix(-.034,.0045,ascent)+drift*.0012*ascent;
 float depth=min(max(0.,wave.z-level),.026*(1.-ascent)+.002);
 // A continuous optical transition replaces the narrow waterline threshold
 // that made all seven rims suddenly brighten late in the entrance.
 float wet=clamp((1.-ascent)*(.94+wave.z*3.),0.,1.);
 // The displacement uses the same surface slope as the surrounding water.
 // A paraxial approximation of air-to-water refraction (IOR 1.333).
 // The first term is the water layer shared with the background renderer.
 // No scaling: a bounded local refraction and slow surface drift move the
 // silhouette by pixels, with exactly the same size and optical spacing.
 vec2 optical=wave.xy*(.022+depth*(1.-1./1.333)*1.6);
 float capHeight=uLetterSize.x*.12;
 vec2 refractedPixels=clamp(wave.xy*vec2(35.,26.),vec2(-4.5),vec2(4.5))*(1.-ascent*.82);
 float afloat=smoothstep(.48,1.,uProgress);
 refractedPixels+=vec2(sin(uTime*.57+phase)*.48,drift)*clamp(capHeight*.017,.7,2.6)*afloat;
 vec2 uv=vUv-refractedPixels*uMotionScale/uLetterSize;
 float angle=sin(uTime*.69+phase)*.004*afloat*uMotionScale;
 vec2 center=vec2((lo+hi)*.5,.5),local=(uv-center)*uLetterSize;
 uv=center+mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*local/uLetterSize;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
 vec4 glyph=texture2D(uSurface,uv);
 vec2 softness=vec2(1.05*wet)/uLetterSize;
 glyph=glyph*.5+(texture2D(uSurface,uv+vec2(softness.x,0.))+texture2D(uSurface,uv-vec2(softness.x,0.))+texture2D(uSurface,uv+vec2(0.,softness.y))+texture2D(uSurface,uv-vec2(0.,softness.y)))*.125;
 if(glyph.a<.002)discard;
 vec3 n=normalize(glyph.rgb*2.-1.);
 n=normalize(n+vec3(-wave.xy*(1.5+wet*2.),0.));
 float edge=pow(1.-abs(n.z),1.5);
 vec2 fromPointer=uv-uPointer;
 float lens=exp(-dot(fromPointer*vec2(1.,.36),fromPointer*vec2(1.,.36))*42.)*uHover;
 vec2 bend=(n.xy*(.005+edge*.008)+fromPointer*lens*.004)/vec2(uViewport.x/uViewport.y,1.);
 vec2 behindUV=clamp(screen+bend+optical,vec2(.003),vec2(.997));
 float haze=depth*.17;
 vec3 behind=texture2D(uWater,behindUV).rgb*.40;
 behind+=texture2D(uWater,behindUV+vec2(haze,0.)).rgb*.15;
 behind+=texture2D(uWater,behindUV-vec2(haze,0.)).rgb*.15;
 behind+=texture2D(uWater,behindUV+vec2(0.,haze)).rgb*.15;
 behind+=texture2D(uWater,behindUV-vec2(0.,haze)).rgb*.15;
 float lightVariation=sin(uTime*.39+phase*1.71)*.06+sin(uTime*.21-phase)*.035;
 vec3 light=normalize(vec3(-.45+lightVariation+fromPointer.x*lens,.75+sin(phase+uTime*.27)*.045+fromPointer.y*lens,1.));
 float reflection=pow(max(0.,dot(reflect(-light,n),vec3(0.,0.,1.))),mix(76.,15.,wet));
 float fresnel=.025+.975*pow(1.-max(0.,n.z),5.);
 float rim=pow(edge,.65)*(.24+.52*max(0.,dot(n,light)));
 float edgeScale=mix(1.75,1.,smoothstep(380.,1100.,uLetterSize.x));
 float meniscus=exp(-pow((wave.z-level)/.005,2.))*edge;
 vec3 glass=behind*1.035+vec3(.008,.014,.018);
 glass+=vec3(.84,.94,1.)*(rim*.88*edgeScale+reflection*.29+fresnel*.36)*(1.-wet*.68)*uOpticalBoost;
 // Preserve clear transmission. Small lettering strengthens only the optical
 // edges above, without adding a uniform pale fill over the moving water.
 glass+=vec3(.70,.87,.98)*meniscus*.16;
 glass=mix(glass,behind*vec3(.84,.92,.97),wet*.38);
 float visibility=smoothstep(.025,.94,uProgress);
 gl_FragColor=vec4(glass,glyph.a*visibility);
}`);
