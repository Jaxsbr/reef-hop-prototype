import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gestureDirection } from '../src/touch-controls.js';
const start = { x: 100, y: 200, fishY: 250, time: 1000 };

test('swipes require clear vertical intent and work in both directions', () => {
  assert.equal(gestureDirection(start, { x: 105, y: 150, time: 1300 }, 'swipe'), -1);
  assert.equal(gestureDirection(start, { x: 105, y: 250, time: 1300 }, 'swipe'), 1);
  assert.equal(gestureDirection(start, { x: 100, y: 190, time: 1100 }, 'swipe'), 0);
  assert.equal(gestureDirection(start, { x: 170, y: 240, time: 1300 }, 'swipe'), 0);
});

test('taps use the fish position and ignore drags, long holds, and taps on the fish', () => {
  assert.equal(gestureDirection(start, { x: 100, y: 200, time: 1100 }, 'tap'), -1);
  const below = { ...start, y: 320 };
  assert.equal(gestureDirection(below, { x: 100, y: 320, time: 1100 }, 'tap'), 1);
  assert.equal(gestureDirection(start, { x: 100, y: 150, time: 1100 }, 'tap'), 0);
  assert.equal(gestureDirection(start, { x: 100, y: 200, time: 1600 }, 'tap'), 0);
  assert.equal(gestureDirection({ ...start, fishY: 205 }, { x: 100, y: 200, time: 1100 }, 'tap'), 0);
});
