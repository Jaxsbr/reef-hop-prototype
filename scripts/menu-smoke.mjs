import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
const output = fileURLToPath(new URL('../captures/menus/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.REEF_HOP_BROWSER_CHANNEL ? { channel: process.env.REEF_HOP_BROWSER_CHANNEL } : {}),
});
const errors = [], layouts = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
await context.addInitScript(() => {
  window.audioChecks = { gains: [], oscillators: 0 };
  const gain = AudioContext.prototype.createGain, oscillator = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createGain = function () { const node = gain.call(this); window.audioChecks.gains.push(node); return node; };
  AudioContext.prototype.createOscillator = function () { window.audioChecks.oscillators++; return oscillator.call(this); };
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
const screen = next => page.waitForFunction(next => document.querySelector('#reef-app').dataset.screen === next, next);
const snapshot = () => page.evaluate(() => {
  const s = window.reefScene;
  return { lane: s.lane, time: s.motionTime, distance: s.distance, jump: !!s.jump, texture: s.player.texture.key,
    x: s.player.x, y: s.player.y, frame: s.player.frame.name, hazards: s.obstacles.map(o => [o.sprite.x,o.sprite.y]) };
});
const start = async () => {
  await page.getByRole('button', { name: 'Play', exact: true }).click(); await screen('playing');
  // Keep lifecycle and input checks deterministic; collision is exercised explicitly below.
  await page.evaluate(() => { window.reefScene.spawn = () => {}; });
};
const touch = await context.newCDPSession(page);
async function gesture(from, to = from) {
  const rect = await page.locator('#game canvas').boundingBox();
  const p = ([x,y]) => ({ x: rect.x + x * rect.width / 960, y: rect.y + y * rect.height / 520, id: 1 });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p(from)] });
  if (to !== from) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p(to)] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
try {
  await page.goto(process.env.REEF_HOP_URL || 'http://localhost:5179/reef-hop-prototype/');
  await page.waitForFunction(() => window.reefScene?.player);
  assert.equal(await page.evaluate(() => window.reefScene.running), false);
  await page.keyboard.press('ArrowUp');
  assert.equal((await snapshot()).lane, 2);
  for (const [name,width,height] of [['desktop',1440,900],['phone',390,844],['small-phone',320,568],['landscape',844,390],['small-landscape',568,320],['tablet',768,1024]]) {
    await page.setViewportSize({width,height}); await page.waitForTimeout(350);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      buttons: [...document.querySelectorAll('#menu-panel button')].map(b => {
        const r=b.getBoundingClientRect();return {label:b.textContent.trim(),fits:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};
      }),
    }));
    assert.equal(layout.overflow,false,name);
    assert.ok(layout.buttons.every(b=>b.fits),`${name}: ${JSON.stringify(layout.buttons)}`);
    layouts.push({name,width,height,...layout});
    await page.screenshot({path:`${output}/splash-${name}.png`});
  }
  console.log('Layouts passed');
  await page.setViewportSize({width:1440,height:900});
  const audio = page.getByRole('switch',{name:'Audio',exact:true});
  const masterIndex = await page.evaluate(()=>audioChecks.gains.length);
  await audio.click();
  assert.equal(await audio.getAttribute('aria-checked'),'false');
  await page.waitForTimeout(350);
  assert.ok(await page.evaluate(index=>audioChecks.gains[index].gain.value<.001,masterIndex));
  const mutedOscillators=await page.evaluate(()=>audioChecks.oscillators);
  await page.getByRole('button',{name:'Change fish, currently Sunny'}).click();
  assert.equal(await page.evaluate(()=>audioChecks.oscillators),mutedOscillators);
  await audio.click();
  assert.equal(await audio.getAttribute('aria-checked'),'true');
  assert.ok(await page.evaluate(()=>audioChecks.oscillators)>mutedOscillators);
  console.log('Audio passed');
  const fullscreen=page.getByRole('switch',{name:'Fullscreen',exact:true});
  if (await fullscreen.isEnabled()) {
    await fullscreen.click(); await page.waitForFunction(()=>!!document.fullscreenElement);
    assert.equal(await fullscreen.getAttribute('aria-checked'),'true');
    await fullscreen.click(); await page.waitForFunction(()=>!document.fullscreenElement);
  }
  console.log('Fullscreen passed');
  await page.getByRole('button',{name:'Change fish, currently Blue'}).click();
  await start();
  assert.equal((await snapshot()).texture,'rosie-swim-blink');
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(()=>window.reefScene.lane===1);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>window.reefScene.lane===2);
  await gesture([700,350],[700,220]);
  await page.waitForFunction(()=>window.reefScene.lane===1);
  await gesture([700,220],[700,350]);
  await page.waitForFunction(()=>window.reefScene.lane===2);
  await gesture([700,180]); // A tap must not move in swipe mode.
  assert.equal((await snapshot()).lane,2);
  await page.evaluate(()=>{const s=window.reefScene;s.addHazard(3,'rubbish',850);s.addHazard(0,'bird',850);});
  await page.getByRole('button',{name:'Pause game'}).click();await screen('paused');
  await page.waitForTimeout(350);
  const frozen=await snapshot();await page.waitForTimeout(500);
  assert.deepEqual(await snapshot(),frozen);
  await page.keyboard.press('ArrowUp');assert.deepEqual(await snapshot(),frozen);
  await page.getByRole('button',{name:'Tap above or below the fish'}).click();
  await page.screenshot({path:`${output}/pause-desktop.png`});
  await page.setViewportSize({width:568,height:320});await page.waitForTimeout(350);
  await page.screenshot({path:`${output}/pause-small-landscape.png`});
  await page.getByRole('button',{name:'Continue',exact:true}).click();await screen('playing');
  await gesture([700,200]);await page.waitForFunction(()=>window.reefScene.lane===1);
  await gesture([700,430]);await page.waitForFunction(()=>window.reefScene.lane===2);
  await gesture([700,350],[700,220]);assert.equal((await snapshot()).lane,2);
  // An air jump must retain its elapsed time across a pause longer than the whole jump.
  await page.keyboard.press('ArrowUp');await page.waitForTimeout(160);
  await page.keyboard.press('ArrowUp');await page.waitForFunction(()=>!!window.reefScene.jump);
  await page.keyboard.press('Escape');await screen('paused');
  const airborne=await snapshot();assert.equal(airborne.jump,true);
  await page.waitForTimeout(950);assert.deepEqual(await snapshot(),airborne);
  await page.getByRole('button',{name:'Continue',exact:true}).click();await screen('playing');
  assert.equal((await snapshot()).jump,true);
  await page.waitForFunction(()=>!window.reefScene.jump&&window.reefScene.lane===1);
  // A water-lane tween also resumes from its paused position, without consuming wall time.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');await screen('paused');
  await page.evaluate(()=>{const s=window.reefScene;window.pausedY=s.swimPosition.y;
    s.events.once('resume',()=>{window.resumedY=s.swimPosition.y;});});
  await page.waitForTimeout(350);
  await page.getByRole('button',{name:'Continue',exact:true}).click();await screen('playing');
  assert.equal(await page.evaluate(()=>window.pausedY===window.resumedY),true);
  await page.waitForFunction(()=>!window.reefScene.laneTransition);
  await page.getByRole('button',{name:'Pause game'}).click();
  await page.getByRole('button',{name:'Exit to menu'}).click();await screen('menu');
  assert.equal(await page.getByRole('button',{name:'Tap above or below the fish'}).getAttribute('aria-pressed'),'true');
  await start();assert.equal((await snapshot()).lane,2);assert.ok((await snapshot()).distance<2);
  // Trigger the actual collision path, not a direct UI call.
  await page.evaluate(()=>{const s=window.reefScene;s.addHazard(s.lane,'shark',s.player.x);});
  await screen('replay');await page.waitForTimeout(350);
  await page.screenshot({path:`${output}/replay-landscape.png`});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  await page.screenshot({path:`${output}/replay-phone.png`});
  await page.getByRole('button',{name:'Change fish, currently Rosie'}).click();
  await page.getByRole('button',{name:'Play again',exact:true}).click();await screen('playing');
  assert.equal((await snapshot()).texture,'kiwi-swim-blink');assert.equal((await snapshot()).lane,2);
  await page.evaluate(()=>{window.reefScene.spawn=()=>{};});
  await page.keyboard.press('ArrowDown');assert.equal((await snapshot()).lane,3); // no duplicate key listeners after restarts
  await page.screenshot({path:`${output}/game-phone.png`});
  await page.evaluate(()=>{const s=window.reefScene;s.addHazard(s.lane,'shark',s.player.x);});
  await screen('replay');await page.getByRole('button',{name:'Back to menu'}).click();await screen('menu');
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({result:'passed',layouts,errors},null,2)+'\n');
  console.log('Passed splash layouts, fish selection, audio/mute SFX, fullscreen, real touch tap/swipe, keyboard, pause/jump freeze, exit, collision/replay, and repeated starts.');
} catch (error) {
  console.log('Failure state', await snapshot(), await page.locator('#reef-app').getAttribute('data-screen'));
  await page.screenshot({path:`${output}/failure.png`}); throw error;
} finally { await browser.close(); }
