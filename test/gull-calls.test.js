import test from 'node:test';
import assert from 'node:assert/strict';
import { GullCalls } from '../src/gull-calls.js';

const sequence=(...values)=>()=>{
 assert.ok(values.length,'random sequence exhausted');return values.shift();
};

test('a gull can remain silent for its entire visible flight',()=>{
 const calls=new GullCalls({random:sequence(0.1)});
 for(let i=0;i<=120;i++)assert.equal(calls.update(40,i/120),false);
});

test('one call waits for a random point in the flight and never repeats',()=>{
 const calls=new GullCalls({random:sequence(0.85,0.73)});
 assert.equal(calls.update(100,-0.1),false);
 assert.equal(calls.update(1000,0.72),false);
 assert.equal(calls.update(40,0.73),true);
 assert.equal(calls.update(2000,0.99),false);
});

test('calls do not trigger before entry or after exit',()=>{
 const calls=new GullCalls({random:sequence(0.99,0)});
 assert.equal(calls.update(2000,-0.01),false);
 assert.equal(calls.update(0,0),true);
 assert.equal(calls.update(1000,0.9),false);
 assert.equal(calls.update(1000,1),false);
 assert.equal(calls.update(1000,1.1),false);
});

test('each gull gets independent random timing',()=>{
 const first=new GullCalls({random:sequence(0.85,0.2)});
 const second=new GullCalls({random:sequence(0.85,0.8)});
 assert.equal(first.update(500,0.3),true);
 assert.equal(second.update(500,0.3),false);
 assert.equal(second.update(1000,0.8),true);
});

test('50% of choices are silent and 50% call once, with no double calls',()=>{
 const counts=[0,0];
 for(let i=0;i<100;i++){
  const roll=(i+.5)/100;
  counts[new GullCalls({random:()=>roll}).moments.length]++;
 }
 assert.deepEqual(counts,[50,50]);
});

test('nearby callers have independent opportunities without a shared cooldown',()=>{
 const first=new GullCalls({random:sequence(.5,.2)});
 const second=new GullCalls({random:sequence(.99,.2)});
 assert.equal(first.update(0,.2),true);
 assert.equal(second.update(0,.2),true);
 assert.equal(first.update(40,.3),false);
 assert.equal(second.update(40,.3),false);
});
