import {ridgeRiverCenter} from "./ridge-headwater";

// Authored channel sections, not a hydraulic simulation or surveyed drainage.
// Terrain and surface depth attributes consume this same section.
export const CHANNEL_PROFILE_VERSION = "connected-water-1";
const clamp = (v:number) => Math.max(0,Math.min(1,v));
const smooth = (a:number,b:number,v:number) => {const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};

export function riverCenter(z:number) {
  const confluence=1-smooth(-792,-724,z);
  return ridgeRiverCenter(z)+confluence*(Math.sin((z+752)*.052)*2.4+Math.sin((z+781)*.11)*.75);
}

export function riverHalfWidth(z:number) {
  const progress=clamp((-315-z)/480),confluence=1-smooth(-792,-724,z);
  const source=.035+(1-smooth(-388,-313,z))*.965;
  const base=(4.7+progress*6.9+Math.sin(z*.037+.8)*(.58+progress*.34)+Math.sin(z*.091-1.2)*.28)*source;
  return base*(1+confluence*(.62+Math.sin((z+777)*.055)*.08))*channelWidthScale(z);
}

// Open the inlet through the lake's shallow shelf. Outside this bounded
// mouth, the accepted lake bed and all existing shore coves are unchanged.
export function lakeInletCut(x:number,z:number) {
  const across=Math.abs(x-riverCenter(z))/riverHalfWidth(z);
  const weight=smooth(-835,-818,z)*(1-smooth(-770,-764,z))*(1-smooth(.65,1.25,across));
  return {weight,depth:.48+1.65*Math.max(0,1-across*across)};
}

export const LAKE_INLET_GLSL = `
float inletSmooth(float a,float b,float v){float t=clamp((v-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
float inletCenter(float z){
  float p=clamp((-315.-z)/1395.,0.,1.);
  float c=1.-inletSmooth(-792.,-724.,z);
  return 34.+sin((z+85.)*.0085)*(34.+p*108.)+sin(z*.021)*16.+sin(z*.053+.6)*4.5+sin(z*.127-.3)*1.4
    +c*(sin((z+752.)*.052)*2.4+sin((z+781.)*.11)*.75);
}
float inletWidth(float z){
  float p=clamp((-315.-z)/480.,0.,1.);
  float c=1.-inletSmooth(-792.,-724.,z);
  return (4.7+p*6.9+sin(z*.037+.8)*(.58+p*.34)+sin(z*.091-1.2)*.28)*(1.+c*(.62+sin((z+777.)*.055)*.08));
}
float inletBedDepth(float x,float z,float originalDepth){
  if(z<=-835.||z>=-764.)return originalDepth;
  float across=abs(x-inletCenter(z))/inletWidth(z);
  float w=inletSmooth(-835.,-818.,z)*(1.-inletSmooth(-770.,-764.,z))*(1.-inletSmooth(.65,1.25,across));
  return mix(originalDepth,max(originalDepth,.48+1.65*max(0.,1.-across*across)),w);
}`;

export function channelWidthScale(z:number) {
  const reach=smooth(-760,-720,z)*(1-smooth(-465,-425,z));
  // Unequal pools and constrictions span tens of metres. Endpoints retain
  // the accepted headwater and lake footprint.
  return 1-reach*(.2+.16*Math.sin((z+612)*.031)+.07*Math.sin((z+601)*.078));
}

export function channelBedOffset(across:number,z:number) {
  const edge=Math.abs(across);
  const original=-.5+Math.pow(Math.min(edge,2.2),1.7)*.42;
  const reach=smooth(-850,-830,z)*(1-smooth(-452,-418,z));
  if(edge>=1)return original;
  const bank=Math.pow(1-edge*edge,1.2);
  const deepRun=.95+.7*(.5+.5*Math.sin((z+648)*.039));
  const outerScour=1+across*Math.sin((z+590)*.026)*.48;
  return original-reach*bank*deepRun*outerScour;
}

export function outflowHalfWidth(progress:number) {
  const taper=1-smooth(.72,1,progress)*.86;
  return (6.4+Math.sin(progress*10.4+.5)*1.5+Math.sin(progress*19.7)*.65+progress*2.2)*taper;
}

export function outflowBedOffset(across:number,progress:number) {
  const edge=Math.min(Math.abs(across),1.5);
  const depth=.95+.38*Math.sin(progress*Math.PI)**2;
  return -.35-depth*Math.pow(Math.max(0,1-edge*edge),1.3)
    +Math.max(0,edge-1)*1.7;
}
