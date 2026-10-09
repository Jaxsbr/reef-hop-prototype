import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.REEF_HOP_BROWSER_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
const errors = [], output = 'captures/gull-flight';
await mkdir(output, { recursive: true });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
await page.addInitScript(() => {
  window.gullAudioAudit = { contexts: [], decoded: [], starts: [] };
  const Context = window.AudioContext;
  window.AudioContext = class extends Context {
    constructor(...args) { super(...args); window.gullAudioAudit.contexts.push(this); }
  };
  const decode = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = function (...args) {
    return decode.apply(this, args).then(buffer => { window.gullAudioAudit.decoded.push(buffer.duration); return buffer; });
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer && Math.abs(this.buffer.duration - 1.556) < .01)
      window.gullAudioAudit.starts.push({ duration: this.buffer.duration, time: this.context.currentTime });
    return start.apply(this, args);
  };
});
try {
  await page.goto(process.env.REEF_HOP_URL || 'http://127.0.0.1:5173/reef-hop-prototype/');
  await page.waitForFunction(() => window.reefScene?.player);
  await page.getByRole('button', { name: 'Move down one lane' }).click();
  await page.waitForFunction(() => window.gullAudioAudit.decoded.length === 1);
  const routes = await page.evaluate(() => {
    const s = window.reefScene; s.scene.pause(); s.spawnClock = -999;
    const choices = [];
    for (let i = 0; i < 80; i++) {
      s.addHazard(0, 'bird', 1110); const bird = s.obstacles.at(-1);
      choices.push({ kind: bird.flight.kind, calls: bird.calls.moments.length });
      bird.animation.dispose(); bird.sprite.destroy(); bird.warning.destroy(); s.obstacles.pop();
    }
    s.addHazard(0, 'bird', 960); window.motionBird = s.obstacles.at(-1);
    window.motionBird.calls.moments = [];
    const report = {};
    for (const kind of ['bob', 'swoop', 'rise', 'glide']) {
      const bird = window.motionBird; bird.flight.kind = kind;
      report[kind] = [];
      for (let i = 0; i <= 100; i++) {
        bird.sprite.x = 960 * (1 - i / 100); s.update(s.time.now, 0);
        report[kind].push({ x: bird.sprite.x, y: bird.sprite.y, angle: bird.sprite.angle, warningY: bird.warning.y });
      }
    }
    // Horizontal pacing is still exactly the game's speed times 1.28.
    const speeds = [];
    for (const distance of [0, 1000]) {
      s.distance = distance; window.motionBird.sprite.x = 700;
      s.update(s.time.now, 40);
      speeds.push(700 - window.motionBird.sprite.x);
    }
    s.distance = 0;
    return { choices, report, speeds };
  });
  assert.ok(routes.choices.every((bird, i, all) => !i || bird.kind !== all[i - 1].kind));
  assert.ok(routes.choices.every(bird => bird.calls === 0 || bird.calls === 1));
  assert.ok(routes.choices.some(bird => bird.calls === 0) && routes.choices.some(bird => bird.calls === 1));
  for (const poses of Object.values(routes.report)) {
    assert.ok(poses.every(pose => pose.y >= 97 && pose.y <= 133 && Math.abs(pose.angle) <= 8 && pose.y === pose.warningY));
    assert.ok(Math.max(...poses.map(p => p.y)) - Math.min(...poses.map(p => p.y)) > 10);
  }
  assert.ok(Math.abs(routes.speeds[0] - 165 * .04 * 1.28) < .0001);
  assert.ok(Math.abs(routes.speeds[1] - 325 * .04 * 1.28) < .0001);
  // Sample each real renderer's low/high poses for visual inspection.
  for (const kind of ['bob', 'swoop', 'rise', 'glide']) for (const [label, fraction] of [['early', .28], ['late', .68]]) {
    await page.evaluate(({ kind, fraction }) => {
      const bird = window.motionBird; bird.flight.kind = kind;
      bird.sprite.x = 960 * (1 - fraction); window.reefScene.update(window.reefScene.time.now, 0);
    }, { kind, fraction });
    await page.locator('#game').screenshot({ path: `${output}/${kind}-${label}.png` });
  }
  // Calls begin immediately when their chosen point is reached, with no startup quiet period.
  await page.evaluate(() => {
    const s = window.reefScene, bird = window.motionBird;
    bird.calls.moments = [.2]; bird.calls.next = 0; bird.sprite.x = 768;
    s.update(s.time.now, 0);
  });
  assert.equal(await page.evaluate(() => window.gullAudioAudit.starts.length), 1);
  // Repeated updates do not repeat a call; a silent bird stays silent.
  await page.evaluate(() => {
    const s = window.reefScene;
    for (let i = 0; i < 10; i++) s.update(s.time.now, 40);
    s.addHazard(0, 'bird', 600); s.obstacles.at(-1).calls.moments = [];
    s.update(s.time.now, 0);
  });
  assert.equal(await page.evaluate(() => window.gullAudioAudit.starts.length), 1);
  // Nearby callers both play, including while the first recording is still active.
  await page.evaluate(() => {
    const s = window.reefScene;
    for (let i = 0; i < 2; i++) {
      s.addHazard(0, 'bird', 600); s.obstacles.at(-1).calls.moments = [.2];
    }
    s.update(s.time.now, 0);
  });
  assert.equal(await page.evaluate(() => window.gullAudioAudit.starts.length), 3);
  // Offscreen actors and a lost run do not start further sounds.
  await page.evaluate(() => {
    const s = window.reefScene;
    s.addHazard(0, 'bird', -81); s.obstacles.at(-1).calls.moments = [0];
    s.update(s.time.now, 0);
    s.addHazard(0, 'bird', 600); s.obstacles.at(-1).calls.moments = [0];
    s.over = true; s.update(s.time.now, 0);
  });
  assert.equal(await page.evaluate(() => window.gullAudioAudit.starts.length), 3);
  assert.deepEqual(errors, []);
  const summary = { result: 'passed', routeKinds: Object.keys(routes.report),
    silentChoices: routes.choices.filter(bird => bird.calls === 0).length, sampleSize: routes.choices.length,
    speeds: routes.speeds, playbacks: await page.evaluate(() => window.gullAudioAudit.starts), errors };
  await writeFile(`${output}/smoke-report.json`, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} finally { await browser.close(); }
