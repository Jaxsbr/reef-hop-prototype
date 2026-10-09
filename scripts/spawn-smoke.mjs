import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.REEF_HOP_BROWSER_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
const errors = [], output = 'captures/spawning';
await mkdir(output, { recursive: true });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
try {
  await page.goto(process.env.REEF_HOP_URL || 'http://127.0.0.1:5178/reef-hop-prototype/');
  await page.waitForFunction(() => window.reefScene?.spawner);
  const firstSeed = await page.evaluate(() => window.reefScene.spawner.seed);
  await page.locator('#restart').click();
  await page.waitForFunction(seed => window.reefScene.spawner.seed !== seed, firstSeed);
  const result = await page.evaluate(async () => {
    const { findRoute } = await import('/reef-hop-prototype/src/spawn-route.js');
    const { ObstacleSpawner } = await import('/reef-hop-prototype/src/obstacle-spawner.js');
    const s = window.reefScene;
    // Run real Phaser clocks, tweens, actors, collision and cleanup with a
    // deterministic manual frame clock. Only the TweenManager wall clock is
    // replaced; no movement/collision behaviour is mocked.
    s.sys.game.loop.stop();
    const dt = 20;
    s.tweens.getDelta = () => dt;
    let time = s.time.now;
    const snapshot = () => ({ player: { lane: s.lane, y: s.swimPosition.y,
      jump: s.jump ? { from: s.jump.from, elapsed: (s.time.now - s.jump.start) / 1000 } : null,
      transition: s.laneTransition ? { ...s.laneTransition, elapsed: (s.time.now - s.laneTransition.start) / 1000 } : null },
      hazards: s.obstacles.map(o => ({ lane: o.lane, key: o.key, x: o.sprite.x })),
      speed: 165 + s.distance * .16 });
    const clear = () => {
      for (const o of s.obstacles) { o.animation?.dispose(); o.sprite.destroy(); o.warning.destroy(); }
      s.obstacles = []; s.tweens.killAll(); s.laneTransition = null; s.jump = null;
      s.over = false; s.running = true; s.spawnClock = 0;
      s.player.clearTint(); s.lane = 2; s.swimPosition.y = 325;
    };
    const reports = [], groups = [], spawnCosts = [], planningCosts = [];
    const spawnerFor = seed => {
      const spawner = new ObstacleSpawner({ seed }), next = spawner.next.bind(spawner);
      spawner.next = context => {
        const start = performance.now(), group = next(context);
        planningCosts.push(performance.now() - start); return group;
      };
      return spawner;
    };
    let pending = [], plannedAt = time;
    const originalSpawn = s.spawn.bind(s);
    s.spawn = () => {
      const before = s.obstacles.length, start = performance.now(); originalSpawn();
      spawnCosts.push(performance.now() - start);
      const added = s.obstacles.slice(before);
      if (!added.length) return;
      groups.push(added.map(o => ({ lane: o.lane, key: o.key, x: o.sprite.x })));
      const route = findRoute(snapshot());
      if (!route) throw new Error('scene accepted a group without a reachable route');
      pending = route.actions.slice(); plannedAt = time;
    };
    for (const speed of [165, 325, 650, 1200]) {
      clear(); s.distance = (speed - 165) / .16;
      s.spawner = spawnerFor(speed + 42); pending = [];
      const before = groups.length;
      for (let frame = 0; frame < 1500; frame++) {
        if (pending.length && (time - plannedAt) / 1000 + 1e-9 >= pending[0].time) {
          const action = pending.shift();
          if (s.jump) throw new Error('route attempted to interrupt a real jump');
          s.move(action.direction);
        }
        time += dt; s.sys.step(time, dt);
        if (s.over) throw new Error(`actual Phaser collision at speed ${speed}, frame ${frame}`);
      }
      reports.push({ startingSpeed: speed, seconds: 30, groups: groups.length - before, endingDistance: s.distance });
    }
    // Explicit air escape through a water wall exercises real takeoff/landing.
    clear(); s.distance = (400 - 165) / .16; s.spawnClock = -999;
    s.lane = 1; s.swimPosition.y = 215;
    const x = 190 + 400 * Math.expm1(.008 * 1.2) / .008;
    for (const lane of [1, 2, 3]) s.addHazard(lane, 'rubbish', x);
    const jumpRoute = findRoute(snapshot());
    if (!jumpRoute) throw new Error('missing air escape');
    pending = jumpRoute.actions.slice(); plannedAt = time; let airborne = false;
    for (let frame = 0; frame < 150; frame++) {
      if (pending.length && (time - plannedAt) / 1000 + 1e-9 >= pending[0].time) s.move(pending.shift().direction);
      time += dt; s.sys.step(time, dt); airborne ||= !!s.jump;
      if (s.over) throw new Error('actual collision on planned air escape');
    }
    if (!airborne || s.jump || s.lane !== 1) throw new Error('air escape failed to land');
    // Capture a real random group with all actor renderers intact.
    clear(); s.distance = 0; s.spawnClock = -999;
    s.spawner = spawnerFor(104); s.spawn();
    for (let frame = 0; frame < 125; frame++) { time += dt; s.sys.step(time, dt); }
    s.sys.game.renderer.preRender(); s.sys.game.scene.render(s.sys.game.renderer); s.sys.game.renderer.postRender();
    return { runs: reports, totalGroups: groups.length, counts: [...new Set(groups.map(g => g.length))].sort(),
      lanes: [...new Set(groups.flat().map(o => o.lane))].sort(),
      staggered: groups.filter(g => g.length > 1).every(g => new Set(g.map(o => o.x)).size === g.length),
      airEscape: { airborne, landed: true },
      maximumSpawnMs: Math.max(...spawnCosts), averageSpawnMs: spawnCosts.reduce((a, b) => a + b, 0) / spawnCosts.length,
      maximumPlanningMs: Math.max(...planningCosts), averagePlanningMs: planningCosts.reduce((a, b) => a + b, 0) / planningCosts.length,
      seed: s.spawner.seed, animationActors: s.obstacles.map(o => ({ key: o.key, flight: o.flight?.kind ?? null,
        calls: o.calls?.moments ?? null, animated: !!o.animation })) };
  });
  assert.deepEqual(result.counts, [1, 2, 3]);
  assert.deepEqual(result.lanes, [0, 1, 2, 3]);
  assert.ok(result.staggered);
  assert.ok(result.totalGroups > 80);
  assert.deepEqual(errors, []);
  await page.locator('#game').screenshot({ path: `${output}/random-obstacles.png` });
  await writeFile(`${output}/smoke-report.json`, JSON.stringify({ ...result, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, errors }, null, 2));
} finally { await browser.close(); }
