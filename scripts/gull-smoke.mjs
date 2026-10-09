import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.REEF_HOP_BROWSER_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
await mkdir('captures/gull', { recursive: true });
try {
  await page.goto(process.env.REEF_HOP_URL || 'http://127.0.0.1:5184/reef-hop-prototype/');
  await page.waitForFunction(() => window.reefScene?.player);
  const report = await page.evaluate(() => {
    const scene = window.reefScene;
    scene.scene.pause();
    scene.addHazard(0, 'bird', 510);
    scene.addHazard(0, 'bird', 750);
    const first = scene.obstacles.at(-2), second = scene.obstacles.at(-1);
    const body = first.sprite.getData('birdBody');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = [], poses = [], eyeCenters = [], bounds = [];
    for (let f = 0; f < 8; f++) {
      const frame = scene.textures.get('gull-flap-blink').get(f);
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, 512, 512, 0, 0, 512, 512);
      const data = ctx.getImageData(0, 0, 512, 512).data;
      pixels.push(data); poses.push(canvas.toDataURL('image/png'));
      let weight = 0, sx = 0, sy = 0, left = 512, top = 512, right = 0, bottom = 0;
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * 4;
        if (data[i+3] >= 128) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x+1); bottom = Math.max(bottom, y+1); }
        if (f < 6 && x > 140 && x < 185 && y > 255 && y < 295 && data[i+3] > 200 && data[i] < 65 && data[i+1] < 75 && data[i+2] < 85) { weight++; sx += x; sy += y; }
      }
      bounds.push([left, top, right, bottom]);
      if (f < 6) eyeCenters.push([sx / weight, sy / weight]);
    }
    let outsideEyeChanges = 0, alphaChanges = 0, eyeChanges = 0;
    for (const [base, alt] of [[1, 6], [2, 7]]) for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const inside = ((x - 159.33333333333334) / 30) ** 2 + ((y - 274.3333333333333) / 34.166666666666664) ** 2 <= 1;
      if (pixels[base][i+3] !== pixels[alt][i+3]) alphaChanges++;
      if ([0,1,2,3].some(c => pixels[base][i+c] !== pixels[alt][i+c])) {
        if (inside) eyeChanges++; else outsideEyeChanges++;
      }
    }
    const origin = [body.originX, body.originY], scale = [body.scaleX, body.scaleY];
    const seen = new Set([first.animation.state.frame]), variants = new Set(), previewFrames = [];
    let stable = true;
    for (let tick = 0; tick < 90; tick++) {
      first.animation.update(100); seen.add(first.animation.state.frame); variants.add(first.animation.state.variant);
      stable &&= body.originX === origin[0] && body.originY === origin[1] && body.scaleX === scale[0] && body.scaleY === scale[1] && body.x === 0 && body.y === 0;
      previewFrames.push(poses[first.animation.state.frame]);
    }
    const independent = second.animation.state.elapsedMs === 0;
    window.gullTestActor = first;
    window.gullTestSecond = second;
    return { outsideEyeChanges, alphaChanges, eyeChanges, seen: [...seen].sort(), variants: [...variants], stable, independent, bounds,
      eyeDrift: [0,1].map(axis => Math.max(...eyeCenters.map(p => p[axis])) - Math.min(...eyeCenters.map(p => p[axis]))), previewFrames };
  });
  assert.equal(report.outsideEyeChanges, 0);
  assert.equal(report.alphaChanges, 0);
  assert.ok(report.eyeChanges > 100);
  assert.deepEqual(report.seen, [0,1,2,3,4,5,6,7]);
  assert.ok(report.variants.includes('blink'));
  assert.ok(report.stable && report.independent);
  assert.ok(report.bounds.every(([l,t,r,b]) => l >= 16 && t >= 16 && r <= 496 && b <= 496));
  assert.ok(report.eyeDrift.every(value => value < 2), `head/eye registration drift: ${report.eyeDrift}`);
  await page.evaluate(() => { window.gullTestActor.sprite.getData('birdBody').setFrame(0); });
  await page.locator('#game').screenshot({ path: 'captures/gull/in-game-open.png' });
  await page.evaluate(() => { window.gullTestActor.sprite.getData('birdBody').setFrame(7); });
  await page.locator('#game').screenshot({ path: 'captures/gull/in-game-blink.png' });
  const lifecycle = await page.evaluate(() => {
    const scene = window.reefScene, first = window.gullTestActor, second = window.gullTestSecond;
    scene.running = true; scene.spawnClock = -999;
    const before = first.animation.state.elapsedMs, x = first.sprite.x;
    scene.update(scene.time.now, 16);
    const advanced = first.animation.state.elapsedMs === before + 16 && first.sprite.x < x;
    first.sprite.x = -81; scene.update(scene.time.now, 0);
    const cleaned = !scene.obstacles.includes(first) && first.animation.request('blink') === false && !first.sprite.scene;
    // Real bird collision path, with the existing horizontal/vertical limits.
    const bird = second.sprite;
    bird.x = scene.player.x + 44.1; bird.y = scene.player.y;
    scene.update(scene.time.now, 0); const outsideX = scene.over;
    bird.x = scene.player.x + 43.9; bird.y = scene.player.y + 37.1;
    scene.update(scene.time.now, 0); const outsideY = scene.over;
    bird.y = scene.player.y + 36.9; scene.update(scene.time.now, 0);
    const inside = scene.over, lost = second.animation.state;
    second.animation.update(1000);
    const frozen = JSON.stringify(second.animation.state) === JSON.stringify(lost) && second.animation.request('blink') === false;
    window.previousGull = second.animation;
    scene.scene.resume();
    return { advanced, cleaned, outsideX, outsideY, inside, frozen };
  });
  assert.deepEqual(lifecycle, { advanced:true, cleaned:true, outsideX:false, outsideY:false, inside:true, frozen:true });
  await page.waitForFunction(() => window.reefScene.scene.isActive());
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.reefScene.over && window.reefScene.distance === 0);
  assert.equal(await page.evaluate(() => window.reefScene.obstacles.length), 0);
  const restarted = await page.evaluate(() => {
    const scene = window.reefScene;
    scene.addHazard(0, 'bird', 550);
    window.restartGull = scene.obstacles.at(-1).animation;
    const fresh = window.restartGull.state.elapsedMs === 0 && window.restartGull.request('blink');
    scene.scene.restart();
    return fresh;
  });
  assert.ok(restarted);
  await page.waitForFunction(() => window.reefScene.obstacles.length === 0 && window.restartGull.request('blink') === false);
  // Let the actual scene advance freely: air gulls pass safely above the player.
  await page.evaluate(() => {
    const scene = window.reefScene;
    scene.spawn = () => scene.addHazard(0, 'bird', 1110);
    scene.running = true;
  });
  const natural = await page.evaluate(() => new Promise(resolve => {
    const start = performance.now(), frames = new Set(), observed = new Set(); let blinks = 0;
    function sample() {
      for (const bird of window.reefScene.obstacles) {
        observed.add(bird); frames.add(bird.animation.state.frame);
        if (bird.animation.state.frame === 7) blinks++;
      }
      if (performance.now() - start < 14000) requestAnimationFrame(sample);
      else resolve({ seenBirds:observed.size, frames:[...frames].sort(), blinks, over:window.reefScene.over });
    }
    sample();
  }));
  assert.ok(natural.seenBirds >= 4 && !natural.over);
  assert.ok(natural.blinks > 0, 'occasional automatic blink must occur during real air-hazard passes');
  await page.locator('#game').screenshot({ path:'captures/gull/natural-passes.png' });
  assert.deepEqual(errors, []);
  const { previewFrames, ...metrics } = report;
  if (process.env.REEF_HOP_SHARP_MODULE) {
    const sharp = createRequire(import.meta.url)(process.env.REEF_HOP_SHARP_MODULE);
    const frames = await Promise.all(previewFrames.map(data => sharp(Buffer.from(data.split(',')[1], 'base64')).flatten({ background:'#72bdd8' }).resize(256,256).ensureAlpha().raw().toBuffer()));
    await sharp(Buffer.concat(frames), { raw:{ width:256, height:256*frames.length, channels:4, pageHeight:256 } }).gif({ loop:0, delay:100 }).toFile('assets/gull/gull-flap-with-blink-preview.gif');
  }
  const result = { result:'passed', ...metrics, lifecycle, natural, errors };
  await writeFile('captures/gull/smoke-report.json', JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }
