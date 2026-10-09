import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HAZARD_ANIMATIONS } from '../src/animation/actors.js';
import { FrameLoop } from '../src/animation/frame-loop.js';

const manifest = JSON.parse(readFileSync(new URL('../assets/gull/gull-flap-blink.json', import.meta.url)));

test('gull atlas matches runtime dimensions and keeps the collision body anchor through every wing pose', () => {
  const actor = HAZARD_ANIMATIONS.bird;
  const source = readFileSync(new URL('../assets/gull/gull-flap-blink-sheet.png', import.meta.url));
  assert.deepEqual(readFileSync(new URL(`../public${actor.image}`, import.meta.url)), source);
  assert.equal(source.readUInt32BE(16), actor.sheet.frameWidth * 4);
  assert.equal(source.readUInt32BE(20), actor.sheet.frameHeight * 2);
  assert.equal(actor.sheet.endFrame, 7);
  assert.deepEqual(actor.origin, manifest.bodyAnchor.map((value, axis) => value / [manifest.frameWidth, manifest.frameHeight][axis]));
  for (const bounds of manifest.visibleBounds) {
    assert.ok(bounds.left >= 16 && bounds.top >= 16 && bounds.right <= 496 && bounds.bottom <= 496);
  }
});

test('gulls flap independently, substitute the matching wing poses for a blink, and freeze on disposal', () => {
  const actor = HAZARD_ANIMATIONS.bird;
  const first = new FrameLoop(actor.loop, { random: () => 0 });
  const second = new FrameLoop(actor.loop, { random: () => .99 });
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => i ? first.advance(100).frame : first.state.frame), [0, 1, 2, 3, 4, 5]);
  first.request('blink');
  first.advance(100);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => i ? first.advance(100).frame : first.state.frame), [0, 6, 7, 3, 4, 5]);
  assert.equal(first.advance(100).variant, null);
  assert.equal(second.advance(3000).variant, null);
  first.dispose();
  const frozen = first.state;
  assert.deepEqual(first.advance(6000), frozen);
  assert.equal(first.request('blink'), false);
  assert.equal(second.request('blink'), true);
});
