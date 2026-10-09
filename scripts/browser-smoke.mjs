import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ACTOR_ANIMATIONS } from '../src/animation/actors.js';

// Use a locally installed Playwright, or point this variable at a bundled index.mjs.
const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
const output = fileURLToPath(new URL('../captures/animation/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.REEF_HOP_BROWSER_CHANNEL ? { channel: process.env.REEF_HOP_BROWSER_CHANNEL } : {}),
});
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
const errors = [], observations = {};
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const state = () => page.evaluate(() => {
  const s = window.reefScene;
  return { lane: s.lane, jump: !!s.jump, over: s.over, distance: s.distance,
    texture: s.player.texture.key, frame: s.player.frame.name,
    origin: [s.player.originX, s.player.originY], scale: [s.player.scaleX, s.player.scaleY],
    position: [s.player.x, s.player.y], animation: s.playerAnimation?.state ?? null };
});
const choices = [
  ['sunny', '🟠 Sunny', 'fish_orange'], ['blue', '🔵 Blue', 'fish_blue'],
  ['rosie', '🩷 Rosie', 'fish_pink'], ['kiwi', '🟢 Kiwi', 'fish_green'],
];
try {
  await page.goto(process.env.REEF_HOP_URL || 'http://127.0.0.1:5178/');
  await page.waitForFunction(() => window.reefScene?.player);
  assert.equal((await state()).texture, 'sunny-swim-blink');
  for (const [name, label, key] of choices) {
    const config = ACTOR_ANIMATIONS[key];
    await page.evaluate(() => {
      window.fishAnimation = window.reefScene.playerAnimation;
      window.fishAnimation.request('blink');
    });
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForFunction(texture => window.reefScene?.player.texture.key === texture &&
      window.reefScene.playerAnimation !== window.fishAnimation, config.texture);
    const selected = await state();
    assert.equal(selected.lane, 2);
    assert.equal(selected.distance, 0);
    assert.equal(selected.over, false);
    assert.ok(selected.animation);
    assert.deepEqual(selected.origin, config.origin);
    assert.deepEqual(selected.scale, [config.scale, config.scale]);
    assert.equal(await page.evaluate(() => window.fishAnimation.request('blink')), false);
    assert.equal(await page.evaluate(texture => window.reefScene.textures.get(texture).frameTotal, config.texture), 9);
    assert.ok(await page.evaluate(() => window.reefScene.backgroundFish.every(fish =>
      ['fish_blue', 'fish_green', 'fish_pink'].includes(fish.object.texture.key))));
    await page.locator('#game').screenshot({ path: `${output}/${name}-swimming.png` });

    // Observe automatic blinking and repeated swimming at normal game speed while idle.
    const observed = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(), frames = new Set(), blinkCycles = new Set(), baseCycles = new Set();
      const player = window.reefScene.player, scale = [player.scaleX, player.scaleY], origin = [player.originX, player.originY];
      let aligned = true;
      function sample() {
        const s = window.reefScene, a = s.playerAnimation.state;
        frames.add(a.frame);
        (a.variant ? blinkCycles : baseCycles).add(a.cycle);
        aligned &&= s.player.scaleX === scale[0] && s.player.scaleY === scale[1] &&
          s.player.originX === origin[0] && s.player.originY === origin[1] &&
          Math.abs(s.player.x - 190) <= 3.01 && Math.abs(s.player.y - 325) <= 9.01;
        if (performance.now() - start < 16000) requestAnimationFrame(sample);
        else resolve({ frames: [...frames].sort((a, b) => a - b), blinkCycles: [...blinkCycles], baseCycles: [...baseCycles], aligned });
      }
      sample();
    }));
    assert.deepEqual(observed.frames, [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.ok(observed.blinkCycles.length >= 2);
    assert.ok(observed.baseCycles.length >= 10);
    assert.ok(observed.aligned);
    observations[name] = observed;
    await page.evaluate(() => window.reefScene.playerAnimation.request('blink'));
    await page.waitForFunction(() => window.reefScene.player.frame.name === 7);
    await page.locator('#game').screenshot({ path: `${output}/${name}-blinking.png` });

    const beforeMove = (await state()).animation.elapsedMs;
    await page.getByRole('button', { name: 'Move up one lane' }).click();
    await page.waitForFunction(() => Math.abs(window.reefScene.swimPosition.y - 215) < 0.1);
    assert.equal((await state()).lane, 1);
    assert.ok((await state()).animation.elapsedMs > beforeMove);
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(() => !!window.reefScene.jump);
    assert.equal((await state()).lane, 0);
    await page.locator('#game').screenshot({ path: `${output}/${name}-jumping.png` });
    await page.waitForFunction(() => !window.reefScene.jump && window.reefScene.lane === 1);
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => Math.abs(window.reefScene.swimPosition.y - 325) < 0.1);
    assert.equal((await state()).lane, 2);
    assert.ok((await state()).distance > 0);
    assert.deepEqual((await state()).scale, selected.scale);

    // Run the real collision code with zero delta to compare the same limits for every fish.
    const collision = await page.evaluate(() => {
      const s = window.reefScene;
      s.scene.pause();
      s.update(s.time.now, 0);
      s.addHazard(s.lane, 'shark', s.player.x + 44.1);
      const hazard = s.obstacles.at(-1).sprite;
      hazard.y = s.player.y;
      s.update(s.time.now, 0);
      const outsideX = s.over;
      hazard.x = s.player.x + 43.9;
      hazard.y = s.player.y + 37.1;
      s.update(s.time.now, 0);
      const outsideY = s.over;
      hazard.y = s.player.y + 36.9;
      window.previousAnimation = s.playerAnimation;
      s.update(s.time.now, 0);
      const inside = s.over;
      s.scene.resume();
      return { outsideX, outsideY, inside };
    });
    assert.deepEqual(collision, { outsideX: false, outsideY: false, inside: true });
    const lost = await state();
    assert.equal(await page.evaluate(() => window.previousAnimation.request('blink')), false);
    await page.waitForFunction(() => !window.reefScene.cameras.main.flashEffect.isRunning);
    await page.locator('#game').screenshot({ path: `${output}/${name}-collision.png` });
    assert.deepEqual((await state()).animation, lost.animation);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !window.reefScene.over && window.reefScene.distance === 0);
    assert.equal((await state()).lane, 2);
    assert.ok((await state()).animation.elapsedMs < lost.animation.elapsedMs);

    // Restart during a jump resets phase and movement, disposing the prior actor.
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(() => Math.abs(window.reefScene.swimPosition.y - 215) < 0.1);
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(() => !!window.reefScene.jump);
    await page.evaluate(() => { window.previousAnimation = window.reefScene.playerAnimation; });
    await page.getByRole('button', { name: '↻ Restart', exact: true }).click();
    await page.waitForFunction(() => window.reefScene.playerAnimation !== window.previousAnimation);
    assert.equal((await state()).jump, false);
    assert.equal((await state()).lane, 2);
    assert.equal(await page.evaluate(() => window.previousAnimation.request('blink')), false);
    await page.getByRole('button', { name: 'Move down one lane' }).click();
    await page.waitForFunction(() => Math.abs(window.reefScene.swimPosition.y - 435) < 0.1);
    assert.equal((await state()).lane, 3);
    console.log(`${name}: eight frames, ${observed.blinkCycles.length} automatic blinks, controls/collision/restart passed`);
  }
  assert.deepEqual(errors, []);
  const report = JSON.stringify({ result: 'passed', observations, errors, captures: output }, null, 2);
  await writeFile(`${output}/smoke-report.json`, report + '\n');
  console.log(report);
} finally {
  await browser.close();
}
