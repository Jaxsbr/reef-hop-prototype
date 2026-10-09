import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTOR_ANIMATIONS } from '../src/animation/actors.js';
import { FrameLoop } from '../src/animation/frame-loop.js';

const characters = { fish_orange: 'sunny', fish_blue: 'blue', fish_pink: 'rosie', fish_green: 'kiwi' };
const load = name => JSON.parse(readFileSync(new URL(`../assets/fish/${name}/${name}-swim-blink.json`, import.meta.url)));

test('all four picker identities have distinct approved runtime textures', () => {
  assert.deepEqual(Object.keys(ACTOR_ANIMATIONS).sort(), Object.keys(characters).sort());
  assert.equal(new Set(Object.values(ACTOR_ANIMATIONS).map(actor => actor.texture)).size, 4);
  // Decorative prototype fish remain available independently of player artwork.
  for (const key of ['fish_blue', 'fish_green', 'fish_pink']) {
    assert.ok(readFileSync(new URL(`../public/assets/${key}.png`, import.meta.url)).length);
  }
});

for (const [key, name] of Object.entries(characters)) {
  test(`${name}: runtime atlas and registry match the approved eight-frame manifest`, () => {
    const manifest = load(name), actor = ACTOR_ANIMATIONS[key];
    const source = readFileSync(new URL(`../assets/fish/${name}/${manifest.image}`, import.meta.url));
    const runtime = readFileSync(new URL(`../public${actor.image}`, import.meta.url));
    assert.deepEqual(runtime, source);
    assert.equal(runtime.readUInt32BE(16), manifest.columns * actor.sheet.frameWidth);
    assert.equal(runtime.readUInt32BE(20), manifest.rows * actor.sheet.frameHeight);
    assert.equal(actor.sheet.endFrame + 1, manifest.frameCount);
    assert.equal(manifest.frameCount, 8);
    assert.deepEqual(actor.loop.baseLoop, [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(actor.loop.variants.blink.replacements, { 1: 6, 2: 7 });
    assert.equal(actor.loop.frameDurationMs, manifest.suggestedFrameDurationMs);
  });

  test(`${name}: swimming, requested blink, base return and independent timing use the real actor config`, () => {
    const actor = ACTOR_ANIMATIONS[key];
    const first = new FrameLoop(actor.loop, { random: () => 0 });
    const second = new FrameLoop(actor.loop, { random: () => 0.99 });
    assert.deepEqual(Array.from({ length: 6 }, (_, i) => i ? first.advance(130).frame : first.state.frame), [0, 1, 2, 3, 4, 5]);
    first.request('blink');
    first.advance(130);
    assert.deepEqual(Array.from({ length: 6 }, (_, i) => i ? first.advance(130).frame : first.state.frame), [0, 6, 7, 3, 4, 5]);
    assert.equal(first.advance(130).variant, null);
    assert.equal(second.state.elapsedMs, 0);
    first.reset();
    assert.equal(first.advance(3120).variant, 'blink');
    assert.equal(second.advance(3120).variant, null);
    first.dispose();
    assert.equal(first.request('blink'), false);
    assert.equal(second.request('blink'), true);
  });

  test(`${name}: fixed presentation centers manifest bounds and registers its own snout`, () => {
    const actor = ACTOR_ANIMATIONS[key], manifest = load(name);
    const [left, top, right, bottom] = actor.presentation.bounds;
    const [cx, cy] = actor.origin.map((origin, axis) => origin * [manifest.frameWidth, manifest.frameHeight][axis]);
    assert.ok(left >= 0 && top >= 0 && right <= manifest.frameWidth && bottom <= manifest.frameHeight);
    assert.ok(Math.abs(cx - (left + right) / 2) < 1e-10);
    assert.ok(Math.abs(cy - (top + bottom) / 2) < 1e-10);
    assert.ok(Math.abs((right - left) * actor.scale - actor.presentation.visibleWidth) < 1e-10);
    assert.deepEqual(actor.presentation.snoutOffset, [(manifest.snoutAnchor[0] - cx) * actor.scale, (manifest.snoutAnchor[1] - cy) * actor.scale]);
    assert.ok(actor.presentation.snoutOffset[0] > 0 && actor.presentation.snoutOffset[0] < 40);
  });
}

test('presentation preserves compact Sunny, elongated Blue and taller Kiwi', () => {
  const rendered = name => {
    const actor = ACTOR_ANIMATIONS[name], [l, t, r, b] = actor.presentation.bounds;
    return { width: (r - l) * actor.scale, height: (b - t) * actor.scale };
  };
  const sunny = rendered('fish_orange'), blue = rendered('fish_blue'), kiwi = rendered('fish_green');
  assert.ok(sunny.width < blue.width);
  assert.ok(kiwi.height > sunny.height && kiwi.height > blue.height);
  assert.equal(new Set(Object.values(ACTOR_ANIMATIONS).map(actor => actor.origin.join(','))).size, 4);
});
