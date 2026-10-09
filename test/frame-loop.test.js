import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FrameLoop } from '../src/animation/frame-loop.js';

const manifest = JSON.parse(readFileSync(new URL('../assets/fish/rosie/rosie-swim-blink.json', import.meta.url)));
const swim = { baseLoop: manifest.baseLoop, frameDurationMs: 130 };
const blink = { replacements: manifest.variants.blink.replacements, intervalMs: [780, 780] };
const withBlink = { ...swim, variants: { blink } };
const frames = loop => Array.from({ length: 6 }, (_, i) => i ? loop.advance(130).frame : loop.state.frame);

test('normal swimming follows all six manifest frames and wraps', () => {
  const loop = new FrameLoop(swim);
  assert.deepEqual(frames(loop), [0, 1, 2, 3, 4, 5]);
  assert.equal(loop.advance(130).frame, 0);
  assert.equal(loop.state.cycle, 1);
});

test('blink substitutes exactly frames 2 and 3, then returns to a complete base cycle', () => {
  const loop = new FrameLoop(withBlink);
  loop.advance(780);
  assert.equal(loop.state.variant, 'blink');
  assert.deepEqual(frames(loop), [0, 6, 7, 3, 4, 5]);
  loop.advance(130);
  assert.equal(loop.state.variant, null);
  assert.deepEqual(frames(loop), [0, 1, 2, 3, 4, 5]);
});

test('a request in mid-cycle preserves phase until the next boundary', () => {
  const loop = new FrameLoop({ ...swim, variants: { blink: { replacements: blink.replacements } } });
  loop.advance(325);
  const before = loop.state;
  loop.request('blink');
  loop.request('blink');
  assert.deepEqual(loop.state, before);
  assert.equal(loop.advance(454).frame, 5);
  assert.equal(loop.state.variant, null);
  assert.equal(loop.advance(1).variant, 'blink');
  assert.equal(loop.advance(130).frame, 6);
  loop.advance(1430);
  assert.equal(loop.state.variant, null); // Coalesced request was consumed once.
});

test('random intervals are injected, quantized to cycle starts, and measured from variant end', () => {
  const samples = [0.5, 0.25, 0];
  const loop = new FrameLoop({ ...swim, variants: {
    blink: { ...blink, intervalMs: [1000, 2000] },
  } }, { random: () => samples.shift() });
  assert.equal(loop.advance(1500).variant, null);
  assert.equal(loop.advance(60).variant, 'blink'); // Due at 1500, starts at 1560.
  assert.equal(loop.advance(780).variant, null); // Ends 2340; next deadline 3590.
  assert.equal(loop.advance(780).variant, null);
  assert.equal(loop.advance(780).variant, 'blink'); // Next boundary is 3900.
});

test('one large delta processes every missed cycle with the same random stream as small deltas', () => {
  const config = { ...swim, variants: { blink: { ...blink, intervalMs: [900, 2400] } } };
  const seeded = () => { let seed = 51; return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; };
  const slow = new FrameLoop(config, { random: seeded() });
  const fast = new FrameLoop(config, { random: seeded() });
  const deltas = [7, 16, 41, 400, 131, 5, 780, 3000];
  let elapsed = 0;
  for (let i = 0; i < 400; i++) { const delta = deltas[i % deltas.length]; slow.advance(delta); elapsed += delta; }
  assert.deepEqual(fast.advance(elapsed), slow.state);
  for (let i = 0; i < 60; i++) assert.deepEqual(fast.advance(130), slow.advance(130));
});

test('fractional frame durations retain phase across differently sized updates', () => {
  const loop = new FrameLoop({ baseLoop: [11, 8, 3], frameDurationMs: 12.5 });
  assert.equal(loop.advance(12.25).frame, 11);
  assert.equal(loop.advance(0.25).frame, 8);
  assert.equal(loop.advance(25).frame, 11);
  assert.equal(loop.advance(37500).cycle, 1001);
});

test('synthetic shark bite uses different frames and an external trigger through the same interface', () => {
  const loop = new FrameLoop({
    baseLoop: [20, 22, 21, 23], frameDurationMs: 100,
    variants: { bite: { replacements: { 22: 30, 21: 31 } } },
  });
  loop.advance(250);
  loop.request('bite');
  assert.equal(loop.advance(150).variant, 'bite');
  assert.deepEqual([loop.state.frame, loop.advance(100).frame, loop.advance(100).frame, loop.advance(100).frame], [20, 30, 31, 23]);
  assert.equal(loop.advance(100).variant, null);
  assert.equal(loop.advance(100).frame, 22);
});

test('overlapping actions use priority, retain losers, and never combine replacements', () => {
  const loop = new FrameLoop({ ...swim, variants: {
    blink: { replacements: blink.replacements },
    bite: { replacements: { 1: 9 }, priority: 10 },
  } });
  loop.request('blink'); loop.request('bite');
  assert.equal(loop.advance(780).variant, 'bite');
  assert.equal(loop.advance(130).frame, 9);
  assert.equal(loop.advance(130).frame, 2); // No blink frame 7 mixed into bite.
  assert.equal(loop.advance(520).variant, null);
  assert.equal(loop.advance(780).variant, 'blink');
});

test('simultaneously due timed actions use stable configuration order for priority ties', () => {
  const samples = [0, 0.9, 0];
  const loop = new FrameLoop({ ...swim, variants: {
    first: { ...blink, intervalMs: [780, 1560] }, second: { replacements: { 3: 9 }, intervalMs: [780, 780] },
  } }, { random: () => samples.shift() });
  assert.equal(loop.advance(780).variant, 'first');
  assert.equal(loop.advance(780).variant, null);
  assert.equal(loop.advance(780).variant, 'second');
});

test('each actor owns independent timing and queued actions', () => {
  const first = new FrameLoop(withBlink);
  const second = new FrameLoop(withBlink);
  first.request('blink'); first.advance(910);
  assert.equal(first.state.frame, 6);
  assert.equal(second.state.frame, 0);
  assert.equal(second.advance(130).frame, 1);
});

test('reset discards requests, phase and deadlines; dispose freezes and is terminal', () => {
  const loop = new FrameLoop(withBlink);
  loop.request('blink'); loop.advance(910);
  assert.deepEqual(loop.reset(), new FrameLoop(withBlink).state);
  assert.equal(loop.advance(130).frame, 1);
  loop.request('blink');
  const before = loop.state;
  loop.dispose(); loop.dispose();
  assert.equal(loop.request('blink'), false);
  assert.deepEqual(loop.advance(10000), before);
  assert.deepEqual(loop.reset(), before);
});

test('invalid configuration, randomness and time fail explicitly', () => {
  for (const config of [
    { ...swim, baseLoop: [] }, { ...swim, baseLoop: [-1] }, { ...swim, frameDurationMs: 0 },
    { ...swim, variants: { action: { replacements: { 40: 7 } } } },
    { ...swim, variants: { action: { replacements: { 1: -1 } } } },
    { ...swim, variants: { action: { replacements: { '01': 7 } } } },
    { ...swim, variants: { action: { ...blink, intervalMs: 0 } } },
    { ...swim, variants: { action: { ...blink, intervalMs: [50, 10] } } },
  ]) assert.throws(() => new FrameLoop(config), RangeError);
  assert.throws(() => new FrameLoop({ ...swim, variants: { blink: { ...blink, intervalMs: [1, 2] } } }, { random: () => 1 }), RangeError);
  const loop = new FrameLoop(swim);
  for (const delta of [-1, NaN, Infinity]) assert.throws(() => loop.advance(delta), RangeError);
  assert.throws(() => loop.request('missing'), RangeError);
});

test('runtime atlas is an exact copy of the approved eight-cell sheet and matches its manifest', () => {
  const source = readFileSync(new URL('../assets/fish/rosie/rosie-swim-blink-sheet.png', import.meta.url));
  const runtime = readFileSync(new URL('../public/assets/rosie-swim-blink-sheet.png', import.meta.url));
  assert.deepEqual(runtime, source);
  assert.equal(runtime.readUInt32BE(16), manifest.columns * manifest.frameWidth);
  assert.equal(runtime.readUInt32BE(20), manifest.rows * manifest.frameHeight);
  assert.equal(manifest.frameCount, 8);
  assert.ok([...manifest.baseLoop, ...Object.values(blink.replacements)].every(frame => frame < manifest.frameCount));
});
