import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../assets/shark/shark-swim-mouth.json' with { type: 'json' };
import { SharkMouth } from '../src/animation/shark-mouth.js';
const player={x:190,y:325};
test('peaceful swim, finite opening, sustained phase substitutions, passing and closing',()=>{
 const a=new SharkMouth(manifest);
 assert.equal(a.update(130,{x:600,y:325},player).frame,1);
 assert.equal(a.update(0,{x:430,y:325},player).mode,'opening');
 assert.equal(a.update(130,{x:400,y:325},player).frame,13);
 assert.equal(a.update(130,{x:380,y:325},player).mode,'open');
 const seen=new Set();for(let i=0;i<18;i++)seen.add(a.update(130,{x:300,y:325},player).frame);
 assert.deepEqual([...seen].sort((a,b)=>a-b),[6,7,8,9,10,11]);
 assert.equal(a.update(0,{x:200,y:435},player).mode,'open');
 assert.equal(a.update(0,{x:100,y:435},player).mode,'closing');
 assert.equal(a.update(260,{x:90,y:435},player).mode,'closed');
 const frozen=a.state;a.dispose();assert.deepEqual(a.update(1000,{x:400,y:325},player),frozen);
});
test('distant lanes and already-passed fish do not trigger the jaw',()=>{
 const a=new SharkMouth(manifest);
 assert.equal(a.update(130,{x:400,y:105},player).mode,'closed');
 assert.equal(a.update(130,{x:100,y:325},player).mode,'closed');
});

test('jaw changes do not reset the swim clock, including an early closing transition',()=>{
 const a=new SharkMouth(manifest);
 a.update(440,{x:600,y:325},player);
 const entering=a.update(0,{x:430,y:325},player);
 assert.equal(entering.elapsedMs,440);
 assert.equal(entering.jaw,0);
 const halfOpen=a.update(130,{x:400,y:325},player);
 assert.equal(halfOpen.jaw,.5);
 const closing=a.update(0,{x:100,y:325},player);
 assert.equal(closing.jaw,halfOpen.jaw);
 assert.equal(closing.elapsedMs,halfOpen.elapsedMs);
 const halfClosed=a.update(130,{x:90,y:325},player);
 assert.equal(halfClosed.jaw,.25);
 assert.equal(halfClosed.elapsedMs,700);
 assert.equal(a.update(130,{x:80,y:325},player).jaw,0);
});
