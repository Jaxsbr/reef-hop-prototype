import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { ObstacleSpawner, seededRandom } from '../src/obstacle-spawner.js';
import { findRoute, REACTION_SECONDS } from '../src/spawn-route.js';
import { GullFlight } from '../src/gull-flight.js';

const ys = [105, 215, 325, 435];
const rate = key => key === 'bird' ? 1.28 : key === 'shark' ? 1.12 : 1;
const at = (lane, key, seconds, speed) => ({ lane, key,
  x: 190 + speed * Math.expm1(.008 * seconds) / .008 * rate(key) });
const state = lane => ({ lane, y: ys[lane] });

// Independent fine-step gameplay simulation of the witness route. Includes
// swimming sway, rubbish wake movement, actual gull paths, acceleration and
// full jump arcs. Deliberately use the scene's collision rule, not planner bounds.
function verifyRoute(player, hazards, speed, route, variant = 0) {
  assert.ok(route, 'expected a reachable route');
  let lane = player.lane, baseY = player.y ?? ys[lane], nextAction = 0;
  let jump = player.jump ? { start: -player.jump.elapsed, from: player.jump.from } : null;
  let move = player.transition ? { start: -player.transition.elapsed, from: player.transition.from, to: player.transition.to } : null;
  const flights = hazards.map(o => o.key === 'bird' ? new GullFlight({
    kind: ['bob', 'swoop', 'rise', 'glide'][variant % 4], random: () => .7,
  }) : null);
  let travelled = 0;
  const dt = .002;
  for (let t = 0; t <= route.duration + .002; t += dt) {
    if (move) {
      const p = Math.min(1, Math.max(0, (t - move.start) / .14));
      baseY = move.from + (ys[move.to] - move.from) * (1 - (1 - p) ** 3);
      if (p === 1) move = null;
    }
    let x = 190 + Math.sin((t + variant) / .86) * 3;
    let y = baseY + Math.sin((t + variant) / .43) * 9;
    if (jump) {
      const p = Math.min(1, (t - jump.start) / .78);
      y = jump.from + (215 - jump.from) * p - 520 * p * (1 - p);
      x = 190 + Math.sin(Math.PI * p) * 24;
      if (p >= 1) { jump = null; lane = 1; baseY = 215; }
    }
    if (nextAction < route.actions.length && t + 1e-8 >= route.actions[nextAction].time) {
      const action = route.actions[nextAction++];
      assert.ok(!jump, 'planner issued an input during an uninterruptible jump');
      const next = lane + action.direction;
      if (next === 0) { jump = { start: t, from: y }; lane = 0; move = null; }
      else { move = { start: t, from: baseY, to: next }; lane = next; }
    }
    for (let i = 0; i < hazards.length; i++) {
      const o = hazards[i], ox = o.x - travelled * rate(o.key);
      const oy = flights[i] ? flights[i].sample((960 - ox) / 960).y :
        ys[o.lane] + (o.key === 'rubbish' ? Math.sin(t / .9 + variant) * 6 + Math.sin(t / .1 + variant) * 18 : 0);
      assert.ok(!(Math.abs(ox - x) < 44 && Math.abs(oy - y) < 37),
        `route collided at ${t.toFixed(3)}s with ${o.key} in lane ${o.lane}`);
    }
    travelled += speed * Math.exp(.008 * t) * dt;
  }
}

test('rejects a wall across all four lanes, even with different hazard speeds', () => {
  const speed = 400;
  const hazards = [at(0, 'bird', 1.2, speed), ...[1, 2, 3].map(lane => at(lane, 'rubbish', 1.2, speed))];
  for (const lane of [1, 2, 3]) assert.equal(findRoute({ player: state(lane), hazards, speed }), null);
});

test('air can be the reachable fourth lane, with a complete safe landing', () => {
  const speed = 400, player = state(1);
  const hazards = [1, 2, 3].map(lane => at(lane, 'rubbish', 1.2, speed));
  const route = findRoute({ player, hazards, speed });
  assert.ok(route.actions.some(action => action.direction === -1));
  verifyRoute(player, hazards, speed, route);
  // A gull closes the air escape too.
  assert.equal(findRoute({ player, hazards: [...hazards, at(0, 'bird', 1.2, speed)], speed }), null);
});

test('checks an existing jump through its automatic shallow-water landing', () => {
  const player = { lane: 0, y: 215, jump: { from: 215, elapsed: .4 } }, speed = 325;
  assert.equal(findRoute({ player, hazards: [at(1, 'shark', .38, speed)], speed }), null);
  const hazards = [at(3, 'rubbish', 1, speed)];
  verifyRoute(player, hazards, speed, findRoute({ player, hazards, speed }));
});

test('cannot teleport across an occupied middle lane during a water transition', () => {
  const player = { lane: 1, y: 435, transition: { from: 435, to: 1, elapsed: 0 } };
  assert.equal(findRoute({ player, hazards: [{ lane: 2, key: 'rubbish', x: 190 }], speed: 165 }), null);
});

test('reserves reaction time and detects hazards crossing entirely between samples', () => {
  assert.ok(REACTION_SECONDS >= .3);
  for (const speed of [165, 1200, 100000]) {
    assert.equal(findRoute({ player: state(3), hazards: [at(3, 'shark', .1, speed)], speed }), null);
  }
  assert.deepEqual(findRoute({ player: state(2), hazards: [{ lane: 2, key: 'shark', x: 100 }], speed: 165 }).actions, []);
});

test('faster sharks catching up with an earlier wave cannot close all routes', () => {
  const speed = 400;
  const hazards = [at(0, 'bird', 1.2, speed), at(1, 'rubbish', 1.2, speed), at(3, 'rubbish', 1.2, speed)];
  assert.ok(findRoute({ player: state(2), hazards, speed }));
  const shark = at(2, 'shark', 1.2, speed);
  assert.ok(shark.x > hazards[1].x, 'later/further shark catches up with rubbish');
  assert.equal(findRoute({ player: state(2), hazards: [...hazards, shark], speed }), null);
});

test('seeded obstacle randomness is reproducible and independent between runs', () => {
  const a = new ObstacleSpawner({ seed: 123 }), b = new ObstacleSpawner({ seed: 123 });
  const c = new ObstacleSpawner({ seed: 456 });
  const sample = spawner => Array.from({ length: 40 }, () => spawner.candidate(2));
  assert.deepEqual(sample(a), sample(b));
  assert.notDeepEqual(sample(new ObstacleSpawner({ seed: 123 })), sample(c));
});

test('fixed distribution produces all four lanes, all counts, and staggered distinct lanes', () => {
  const spawner = new ObstacleSpawner({ seed: 800 }), counts = [0, 0, 0, 0], lanes = new Set(), kinds = new Set();
  for (let i = 0; i < 10000; i++) {
    const group = spawner.candidate(2); counts[group.length]++;
    assert.equal(new Set(group.map(o => o.lane)).size, group.length);
    for (let j = 0; j < group.length; j++) {
      const o = group[j]; lanes.add(o.lane); kinds.add(o.key);
      assert.equal(o.lane === 0, o.key === 'bird');
      if (j) assert.ok(o.x - group[j - 1].x >= 70);
    }
  }
  assert.deepEqual([...lanes].sort(), [0, 1, 2, 3]);
  assert.equal(kinds.size, 3);
  assert.ok(Math.abs(counts[1] / 10000 - .4) < .02);
  assert.ok(Math.abs(counts[2] / 10000 - .4) < .02);
  assert.ok(Math.abs(counts[3] / 10000 - .2) < .02);
});

test('current lane is favoured over neighbours and distant lanes, including air', () => {
  for (const current of [0, 1, 2, 3]) {
    const spawner = new ObstacleSpawner({ seed: 2026 + current }), hits = [0, 0, 0, 0];
    for (let i = 0; i < 10000; i++) hits[spawner.candidate(current)[0].lane]++;
    for (let lane = 0; lane < 4; lane++) if (lane !== current) assert.ok(hits[current] > hits[lane] * 1.6);
    for (let lane = 0; lane < 4; lane++) if (Math.abs(lane - current) === 1) {
      for (let other = 0; other < 4; other++) if (Math.abs(other - current) > 1) assert.ok(hits[lane] > hits[other] * 2);
    }
  }
});

test('no repeating six-wave cycle in generated runs', () => {
  const spawner = new ObstacleSpawner({ seed: 90 });
  const groups = Array.from({ length: 60 }, () => spawner.candidate(2).map(o => `${o.lane}:${o.key}`).join(','));
  assert.notDeepEqual(groups.slice(0, 6), groups.slice(6, 12));
  assert.ok(new Set(groups).size > 15);
});

test('bounded attempts leave a gap if the player is already trapped', () => {
  let draws = 0;
  const spawner = new ObstacleSpawner({ seed: 0, random: () => { draws++; return .5; } });
  assert.deepEqual(spawner.next({ player: state(2), speed: 165, hazards: [{ lane: 2, key: 'shark', x: 190 }] }), []);
  assert.ok(draws < 100);
});

test('accepted groups have collision-free witnesses across seeds, lanes and speeds', () => {
  const random = seededRandom(975), started = performance.now();
  let accepted = 0, gaps = 0, maximumMs = 0;
  for (const speed of [165, 325, 650, 1200, 5000]) for (let i = 0; i < 120; i++) {
    const lane = 1 + i % 3, player = state(lane);
    const spawner = new ObstacleSpawner({ seed: i + speed });
    // Obstacles from earlier waves, with an independently verified route.
    const existing = new ObstacleSpawner({ seed: i * 21 + 7 }).candidate(lane)
      .map(o => ({ ...o, x: 420 + random() * 450 }));
    const hazards = findRoute({ player, hazards: existing, speed }) ? existing : [];
    const before = performance.now();
    const group = spawner.next({ player, hazards, speed });
    maximumMs = Math.max(maximumMs, performance.now() - before);
    if (!group.length) { gaps++; continue; }
    accepted++;
    const all = [...hazards, ...group], route = findRoute({ player, hazards: all, speed });
    verifyRoute(player, all, speed, route, i % 4);
    assert.ok(route.actions.every(action => action.time >= REACTION_SECONDS));
  }
  assert.ok(accepted > 400);
  console.log(JSON.stringify({ spawnSafetyCases: 600, accepted, gaps,
    elapsedMs: Math.round(performance.now() - started), maximumSpawnMs: +maximumMs.toFixed(2) }));
});

test('spawns remain safe during partially completed moves and jumps', () => {
  let accepted = 0;
  for (const speed of [165, 650, 1200]) for (let i = 0; i < 80; i++) {
    const elapsed = i % 2 ? (i % 7) / 10 : (i % 7) / 50;
    const from = i % 4 < 2 ? 435 : 215, to = 2;
    const p = elapsed / .14;
    const player = i % 2 ? { lane: 0, y: 215, jump: { from: 215 + Math.sin(i) * 9, elapsed } } :
      { lane: to, y: from + (ys[to] - from) * (1 - (1 - p) ** 3), transition: { from, to, elapsed } };
    const spawner = new ObstacleSpawner({ seed: 1800 + i });
    const group = spawner.next({ player, hazards: [], speed });
    if (!group.length) continue;
    accepted++;
    verifyRoute(player, group, speed, findRoute({ player, hazards: group, speed }), i % 4);
  }
  assert.ok(accepted > 200);
});
