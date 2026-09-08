// An authored channel through the native-cliff collar, not surveyed drainage.
// Elevations were fitted against both rendered terrain resolutions. The final
// point meets the retained valley river; original source assets stay intact.
export const RIDGE_HEADWATER_VERSION = "ridge-headwater-1";
export const RIDGE_HEADWATER_START = -112;
export const RIDGE_HEADWATER_END = -355;
const profile = [[-112,39],[-145,24],[-175,15.6],[-205,11.8],[-235,9.8],[-265,7.6],[-285,6.6],[-305,4.5],[-325,1.1],[-345,-3.6],[-355,-7.3843]] as const;
export function ridgeRiverCenter(z: number) {
  const progress=Math.max(0,Math.min(1,(-315-z)/1395));
  return 34+Math.sin((z+85)*.0085)*(34+progress*108)
    +Math.sin(z*.021)*16+Math.sin(z*.053+.6)*4.5+Math.sin(z*.127-.3)*1.4;
}
export function ridgeHeadwaterLevel(z: number) {
  for(let i=1;i<profile.length;i++) {
    const a=profile[i-1], b=profile[i];
    if(z>=b[0]) {
      const t=Math.max(0,Math.min(1,(a[0]-z)/(a[0]-b[0])));
      // Linear grade guarantees downhill flow without cubic overshoot.
      return a[1]+(b[1]-a[1])*t;
    }
  }
  return profile[profile.length-1][1];
}
export function ridgeHeadwaterHalfWidth(z: number) {
  const p=Math.max(0,Math.min(1,(RIDGE_HEADWATER_START-z)/243));
  const emergence=Math.min(1,p*20);
  return (.12+emergence*.9+p*.85)*(1+Math.sin(z*.073)*.07);
}
export function ridgeHeadwaterPlantExclusion(x: number,z: number) {
  return z<=RIDGE_HEADWATER_START && z>=RIDGE_HEADWATER_END
    && Math.abs(x-ridgeRiverCenter(z))<ridgeHeadwaterHalfWidth(z)*2.4+2;
}

// Fitted to the lower of the two actual rendered valley beds, with a
// positive grade into the retained lake. This corrects the elevated river sheet.
const valleyProfile = [[-355,-7.3843],[-360,-9.6181],[-365,-12.0222],[-370,-14.5624],[-375,-17.0867],[-380,-19.6065],[-385,-22.0367],[-390,-24.6222],[-395,-27.2969],[-400,-29.7318],[-405,-31.9539],[-410,-34.0955],[-415,-35.9467],[-420,-37.6379],[-425,-39.2503],[-430,-40.7121],[-435,-41.7888],[-440,-42.6654],[-445,-43.1275],[-450,-43.3717],[-455,-43.5264],[-460,-43.6758],[-465,-43.7857],[-470,-43.9192],[-475,-43.9897],[-480,-44.166],[-485,-44.2243],[-490,-44.412],[-495,-44.6251],[-500,-44.6586],[-505,-44.8279],[-510,-45.0476],[-515,-45.1424],[-520,-45.1574],[-525,-45.2932],[-530,-45.6093],[-535,-45.6243],[-540,-45.6393],[-545,-45.6543],[-550,-46.1059],[-555,-46.1352],[-560,-46.1502],[-565,-46.6],[-570,-46.635],[-575,-46.65],[-580,-46.7409],[-585,-47.12],[-590,-47.135],[-595,-47.15],[-600,-47.4129],[-605,-47.4279],[-610,-47.4429],[-615,-47.4579],[-620,-47.4729],[-625,-47.4879],[-630,-47.5029],[-635,-47.5179],[-640,-47.5329],[-645,-47.5479],[-650,-47.5629],[-655,-47.5779],[-660,-47.5929],[-665,-47.6079],[-670,-47.6229],[-675,-47.6379],[-680,-47.6529],[-685,-47.6679],[-690,-47.6829],[-695,-47.6979],[-700,-47.7129],[-705,-47.7279],[-710,-47.7429],[-715,-47.7579],[-720,-47.7729],[-725,-47.7879],[-730,-47.8029],[-735,-47.8179],[-740,-47.8329],[-745,-47.8479],[-750,-47.8629],[-755,-47.8779],[-760,-47.8929],[-765,-47.9079],[-770,-47.9229],[-775,-47.9379],[-777,-47.9439]] as const;
export function valleyRiverLevel(z: number) {
  for(let i=1;i<valleyProfile.length;i++) {const a=valleyProfile[i-1],b=valleyProfile[i];if(z>=b[0]) {const t=Math.max(0,Math.min(1,(a[0]-z)/(a[0]-b[0])));return a[1]+(b[1]-a[1])*t;}}
  return valleyProfile[valleyProfile.length-1][1];
}
