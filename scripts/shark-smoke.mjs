const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1100,height:820}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.REEF_HOP_URL || 'http://127.0.0.1:5182');await page.waitForFunction(()=>window.reefScene?.player);
 await mkdir('captures/shark',{recursive:true});
 const report=await page.evaluate(()=>{
  const s=window.reefScene;s.scene.pause();s.running=true;s.spawnClock=-999;
  s.addHazard(1,'shark',600);const o=s.obstacles.at(-1),p=s.player;
  p.x=190;p.y=325;
  const steps=[];
  const tick=(x,y,ms)=>{o.sprite.x=x;o.sprite.y=y;const state=o.animation.update(ms,o.sprite,p);o.sprite.getData('sharkBody').renderPose(state);steps.push(state);return state;};
  tick(600,215,130);tick(430,215,0);tick(400,215,130);tick(380,215,130);
  const frames=[];for(let i=0;i<18;i++)frames.push(tick(300,215,130).frame);
  tick(100,215,0);tick(90,215,130);tick(80,215,130);
  return {steps,frames,texture:o.sprite.getData('sharkBody').texture.key};
 });
 assert.equal(report.steps[0].mode,'closed');assert.equal(report.steps[1].mode,'opening');assert.equal(report.steps[3].mode,'open');
 assert.deepEqual([...new Set(report.frames)].sort((a,b)=>a-b),[6,7,8,9,10,11]);assert.equal(report.steps.at(-1).mode,'closed');
 await page.evaluate(()=>{const s=window.reefScene,o=s.obstacles.pop();o.animation.dispose();o.sprite.destroy();o.warning.destroy();s.addHazard(1,'shark',600);});
 for(const [name,x,dt] of [['peaceful',600,0],['opening',430,0],['open',380,260],['closing',100,0],['closed',80,260]]){
 await page.evaluate(({x,dt})=>{const s=window.reefScene,o=s.obstacles.at(-1);o.sprite.x=x;const a=o.animation.update(dt,o.sprite,s.player);o.sprite.getData('sharkBody').renderPose(a);},{x,dt});
 await page.locator('#game').screenshot({path:`captures/shark/${name}.png`});
 }
 await page.evaluate(()=>window.reefScene.scene.resume());
 await page.getByRole('button',{name:'↻ Restart',exact:true}).click();await page.waitForFunction(()=>window.reefScene.obstacles.length===0);
 assert.deepEqual(errors,[]);await writeFile('captures/shark/smoke-report.json',JSON.stringify({result:'passed',...report,errors},null,2));console.log('Shark browser rendering, jaw transitions, sustained swimming, restart: passed');
}finally{await browser.close();}
