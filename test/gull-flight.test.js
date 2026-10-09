import test from 'node:test';
import assert from 'node:assert/strict';
import { GullFlight, GULL_FLIGHT_KINDS } from '../src/gull-flight.js';

test('vertical flight routes stay in the air and move smoothly without large tilts',()=>{
 for(const kind of GULL_FLIGHT_KINDS)for(const randomValue of [0,.5,.999]){
  const flight=new GullFlight({kind,random:()=>randomValue});
  let last=flight.sample(0);
  for(let i=1;i<=1000;i++){
   const pose=flight.sample(i/1000);
   assert.ok(pose.y>=97&&pose.y<=133,`${kind}: ${pose.y}`);
   assert.ok(Math.abs(pose.angle)<=8);
   assert.ok(Math.abs(pose.y-last.y)<.17,`${kind} has a position jump`);
   assert.ok(Math.abs(pose.angle-last.angle)<.4,`${kind} has an orientation jump`);
   last=pose;
  }
 }
});

test('short bobs are distinct from a low dip, climb and descending glide',()=>{
 const bob=new GullFlight({kind:'bob',random:()=>.5});
 const bobYs=Array.from({length:101},(_,i)=>bob.sample(i/100).y);
 assert.ok(Math.max(...bobYs)-Math.min(...bobYs)<14);
 const swoop=new GullFlight({kind:'swoop',random:()=>.5});
 assert.ok(swoop.sample(swoop.turn).y>128);
 assert.ok(swoop.sample(.68).y<101);
 assert.ok(swoop.sample(1).y>swoop.sample(.68).y);
 const rise=new GullFlight({kind:'rise',random:()=>.5});
 assert.ok(rise.sample(0).y>122&&rise.sample(.54).y<101);
 const glide=new GullFlight({kind:'glide',random:()=>.5});
 assert.ok(glide.sample(.45).y>glide.sample(0).y+17);
 assert.ok(glide.sample(1).y<glide.sample(.45).y-15);
});

test('consecutive gulls choose different route families, with variation within each family',()=>{
 let previousKind;
 for(let i=0;i<12;i++){
  const flight=new GullFlight({previousKind,random:()=>.4});
  assert.notEqual(flight.kind,previousKind);previousKind=flight.kind;
 }
 const low=new GullFlight({kind:'swoop',random:()=>.1});
 const high=new GullFlight({kind:'swoop',random:()=>.9});
 assert.notEqual(low.turn,high.turn);
 assert.notDeepEqual(low.sample(.2),high.sample(.2));
});

test('flight progress clamps cleanly offscreen and beak tilt follows climbing/descending',()=>{
 const flight=new GullFlight({kind:'swoop',random:()=>.5});
 assert.deepEqual(flight.sample(-1),flight.sample(0));
 assert.deepEqual(flight.sample(2),flight.sample(1));
 assert.ok(flight.sample(.1).angle<0);
 assert.ok(flight.sample(.5).angle>0);
 assert.throws(()=>new GullFlight({kind:'invalid'}),/Unknown gull flight/);
});
