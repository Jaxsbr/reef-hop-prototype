import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const types = ['bottle', 'can', 'bag', 'cup', 'boot'];
try {
  const manifest = JSON.parse(await readFile('assets/trash/trash.json', 'utf8'));
  for (const type of types) assert.deepEqual(await readFile(`public/assets/trash/${type}.png`), await readFile(`assets/trash/${type}.png`));
  await page.goto(process.env.REEF_HOP_URL || 'http://127.0.0.1:5183/reef-hop-prototype/');
  await page.waitForFunction(() => window.reefScene?.player);
  const presentation = await page.evaluate(() => {
    const scene = window.reefScene; scene.scene.pause();
    for (let index = 0; index < 5; index++) {
      const random = Math.random;
      try { Math.random = () => (index + .5) / 5; scene.addHazard([1, 2, 3, 1, 2][index], 'rubbish', 310 + index * 125); }
      finally { Math.random = random; }
    }
    return scene.obstacles.map(actor => {
      const body = actor.sprite.getData('trashBody');
      return { type: actor.sprite.getData('trashType'), texture: body.texture.key, childTypes: actor.sprite.list.map(child => child.type), origin: [body.originX, body.originY], scale: [body.scaleX, body.scaleY] };
    });
  });
  assert.deepEqual(presentation.map(actor => actor.type), types);
  for (const actor of presentation) {
    assert.equal(actor.texture, `trash-${actor.type}`);
    assert.deepEqual(actor.childTypes, ['Image'], 'temporary Graphics must be replaced');
    assert.equal(actor.scale[0], actor.scale[1], 'art must keep its proportions');
  }
  await mkdir('captures/trash', { recursive: true });
  await page.locator('#game').screenshot({ path: 'captures/trash/selected-trash-in-game.png' });
  const motion = await page.evaluate(() => {
    const scene = window.reefScene;
    for (const actor of scene.obstacles) { actor.sprite.destroy(); actor.warning.destroy(); }
    scene.obstacles = [];
    // Different lanes avoid collision while remaining close enough to trigger the wake.
    scene.lane = 3; scene.swimPosition.y = 435; scene.running = true; scene.spawnClock = -999;
    scene.addHazard(2, 'rubbish', 300);
    const actor = scene.obstacles.at(-1), samples = [];
    for (let tick = 0; tick < 240; tick++) {
      scene.update(tick * 1000 / 60, 1000 / 60);
      if (actor.sprite.active) samples.push({ y: actor.sprite.y, angle: actor.sprite.angle, wake: actor.wake });
    }
    return { disturbed: actor.disturbed, wakePeak: Math.max(...samples.map(s => s.wake)), yRange: Math.max(...samples.map(s => s.y)) - Math.min(...samples.map(s => s.y)), angleRange: Math.max(...samples.map(s => s.angle)) - Math.min(...samples.map(s => s.angle)), over: scene.over, remaining: scene.obstacles.length, disposed: !actor.sprite.active && !actor.warning.active };
  });
  assert.ok(motion.disturbed && motion.wakePeak > .9 && motion.yRange > 10 && motion.angleRange > 20);
  assert.ok(!motion.over && motion.disposed && motion.remaining === 0, 'passing trash must move and clean up');
  const collisions = [];
  for (let index = 0; index < types.length; index++) {
    await page.evaluate(() => window.reefScene.scene.resume());
    await page.locator('#restart').click();
    await page.waitForFunction(() => window.reefScene?.player && !window.reefScene.over && window.reefScene.distance === 0);
    collisions.push(await page.evaluate(index => {
      const scene = window.reefScene; scene.scene.pause(); scene.running = true; scene.spawnClock = -999;
      const random = Math.random;
      try { Math.random = () => (index + .5) / 5; scene.addHazard(2, 'rubbish', 190); }
      finally { Math.random = random; }
      const actor = scene.obstacles.at(-1); scene.update(0, 16);
      return { type: actor.sprite.getData('trashType'), over: scene.over };
    }, index));
  }
  assert.deepEqual(collisions.map(actor => actor.type), types);
  assert.ok(collisions.every(actor => actor.over), 'every selected type must retain collision');
  await page.evaluate(() => window.reefScene.scene.resume());
  await page.locator('#restart').click();
  await page.waitForFunction(() => window.reefScene?.player && !window.reefScene.over && window.reefScene.obstacles.length === 0);
  assert.deepEqual(errors, []);
  const report = { selectedOptions: Object.values(manifest.items).map(item => item.selectedOption), presentation, motion, collisions, restarted: true, errors };
  await writeFile('captures/trash/smoke-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
