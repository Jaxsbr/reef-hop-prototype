// Each gull independently has a 50% chance of one call during its visible flight.
export class GullCalls {
 constructor({random=Math.random}={}){
  this.moments=random()<.5?[]:[random()];
  this.next=0;
 }
 update(_deltaMs,progress){
  // Progress is 0 at the right edge and 1 at the left edge.
  if(progress<0||progress>=1||this.next>=this.moments.length)return false;
  if(progress<this.moments[this.next])return false;
  this.next++;return true;
 }
}
