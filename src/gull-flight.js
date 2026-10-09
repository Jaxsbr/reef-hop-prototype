export const GULL_FLIGHT_KINDS=Object.freeze(['bob','swoop','rise','glide']);

// Smooth vertical routes across the screen, independent of horizontal game speed.
export class GullFlight {
 constructor({kind,previousKind,random=Math.random}={}){
  const choices=GULL_FLIGHT_KINDS.filter(candidate=>candidate!==previousKind);
  this.kind=kind??choices[Math.floor(random()*choices.length)];
  if(!GULL_FLIGHT_KINDS.includes(this.kind))throw new Error(`Unknown gull flight: ${this.kind}`);
  this.offset=(random()-.5)*3;
  this.amplitude=.82+random()*.18;
  this.phase=random()*Math.PI*2;
  this.cycles=2+random()*1.2;
  // Move the low point slightly so even birds with the same route have distinct passes.
  this.turn=.24+random()*.10;
 }
 sample(progress){
  const p=Math.max(0,Math.min(1,progress));
  let y,slope;
  if(this.kind==='bob'){
   const phase=p*Math.PI*2*this.cycles+this.phase;
   y=111+7*this.amplitude*Math.sin(phase);
   slope=7*this.amplitude*Math.PI*2*this.cycles*Math.cos(phase);
  }else{
   const routes={
    swoop:[[0,106],[this.turn,131],[.68,99],[1,119]],
    rise:[[0,130],[.54,99],[1,117]],
    glide:[[0,102],[.45,128],[1,104]],
   };
   const points=routes[this.kind];
   let index=0;while(index<points.length-2&&p>points[index+1][0])index++;
   const [start,a]=points[index],[end,b]=points[index+1];
   const u=(p-start)/(end-start),ease=u*u*(3-2*u);
   y=a+(b-a)*ease;slope=(b-a)*6*u*(1-u)/(end-start);
   y=112+(y-112)*this.amplitude;slope*=this.amplitude;
  }
  // A left-facing bird tilts its beak down while descending and up while climbing.
  const angle=Math.max(-8,Math.min(8,-Math.atan(slope/960)*180/Math.PI));
  return {y:y+this.offset,angle};
 }
}
