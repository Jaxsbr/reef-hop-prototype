import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage();
try {
  await page.goto(process.env.REEF_HOP_URL || 'http://127.0.0.1:5182');
  await page.waitForFunction(() => window.reefScene?.player);
  const report = await page.evaluate(() => {
    const scene = window.reefScene;
    scene.scene.pause();
    scene.addHazard(1, 'shark', 600);
    const actor = scene.obstacles.at(-1), body = actor.sprite.getData('sharkBody');
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const samples = [], previewFrames = [], jawExamples = [];
    for (let tick = 0; tick < 240; tick++) {
      const x = tick < 60 ? 600 : tick < 180 ? 380 : 80;
      const state = actor.animation.update(1000 / 60, { x, y: 215 }, { x: 190, y: 325 });
      if (body.renderPose) body.renderPose(state); else body.setFrame(state.frame);
      const frame = body.frame;
      ctx.clearRect(0, 0, 384, 256);
      ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
        body.x / body.scaleX + 192 - body.originX * frame.cutWidth,
        body.y / body.scaleY + 256 * .59 - body.originY * frame.cutHeight, frame.cutWidth, frame.cutHeight);
      const pixels = ctx.getImageData(0, 0, 384, 256).data;
      let eyeWeight = 0, eyeX = 0, eyeY = 0, tailWeight = 0, tailX = 0, tailY = 0;
      for (let y = 0; y < 256; y++) for (let x = 0; x < 384; x++) {
        const i = (y * 384 + x) * 4, alpha = pixels[i + 3];
        if (x >= 68 && x < 125 && y >= 105 && y < 178 && alpha > 200 && pixels[i] < 45 && pixels[i+1] < 45 && pixels[i+2] < 60) {
          eyeWeight++; eyeX += x; eyeY += y;
        }
        if (x >= 305 && alpha > 128) { tailWeight++; tailX += x; tailY += y; }
      }
      samples.push({ mode: state.mode, eye: [eyeX / eyeWeight, eyeY / eyeWeight], tail: [tailX / tailWeight, tailY / tailWeight] });
      if (tick % 3 === 0) previewFrames.push(canvas.toDataURL('image/png'));
    }
    // Hold the swim clock still: changing the jaw must not touch the rest of the fish.
    const mouthPixels = [];
    for (const jaw of [0, 1 / 3, 2 / 3, 1]) {
      body.renderPose({ elapsedMs: 0, jaw });
      const source = body.texture.getSourceImage();
      jawExamples.push(source.toDataURL('image/png'));
      mouthPixels.push(source.getContext('2d').getImageData(0, 0, 384, 256).data);
    }
    let outsideJawChanges = 0;
    for (const pixels of mouthPixels.slice(1)) for (let y = 0; y < 256; y++) for (let x = 0; x < 384; x++) {
      if (x >= 35 && x <= 146 && y >= 178 && y <= 245) continue;
      const i = (y * 384 + x) * 4;
      if (Math.max(pixels[i+3], mouthPixels[0][i+3]) < 3) continue;
      if ([0,1,2,3].some(c => Math.abs(pixels[i+c] - mouthPixels[0][i+c]) > 2)) outsideJawChanges++;
    }

    // Drive the actual scene update path through a complete, collision-free pass.
    actor.animation.dispose(); actor.sprite.destroy(); actor.warning.destroy(); scene.obstacles = [];
    scene.addHazard(1, 'shark', 600);
    scene.running = true; scene.spawnClock = -999;
    const passing = scene.obstacles.at(-1), gameplayModes = new Set();
    let stableY = true;
    for (let tick = 0; tick < 240; tick++) {
      scene.update(tick * 1000 / 60, 1000 / 60);
      gameplayModes.add(passing.animation.state.mode);
      stableY &&= passing.sprite.y === 215;
    }
    const range = values => Math.max(...values) - Math.min(...values);
    return {
      eyeDrift: [0, 1].map(axis => range(samples.map(s => s.eye[axis]))),
      tailRange: range(samples.map(s => s.tail[0])),
      maxTailStep: Math.max(...samples.slice(1).map((s, i) => Math.hypot(...s.tail.map((v, axis) => v - samples[i].tail[axis])))),
      modes: [...new Set(samples.map(s => s.mode))], outsideJawChanges,
      gameplay: { modes: [...gameplayModes], stableY, over: scene.over, remaining: scene.obstacles.length },
      samples, previewFrames, jawExamples,
    };
  });
  await mkdir('captures/shark', { recursive: true });
  const { previewFrames, jawExamples, ...metrics } = report;
  await writeFile('captures/shark/motion-report.json', JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ eyeDrift: report.eyeDrift, maxTailStep: report.maxTailStep, tailRange: report.tailRange, modes: report.modes }));
  assert.ok(report.eyeDrift.every(value => value <= .25), 'head/eye must remain registered throughout swim and jaw changes');
  assert.ok(report.maxTailStep < 1, 'tail must move continuously, without frame-sized jumps');
  assert.ok(report.tailRange > 2, 'tail must visibly stroke rather than freeze');
  assert.equal(report.outsideJawChanges, 0, 'jaw swaps must change only the mouth region at a fixed swim phase');
  assert.deepEqual(report.gameplay.modes, ['closed', 'opening', 'open', 'closing']);
  assert.ok(report.gameplay.stableY && !report.gameplay.over);
  assert.equal(report.gameplay.remaining, 0, 'offscreen shark must be cleaned up');
  if (process.env.REEF_HOP_SHARP_MODULE) {
    const sharp = createRequire(import.meta.url)(process.env.REEF_HOP_SHARP_MODULE);
    const frames = await Promise.all(previewFrames.map(data => sharp(Buffer.from(data.split(',')[1], 'base64')).raw().toBuffer()));
    await sharp(Buffer.concat(frames), { raw: { width: 384, height: 256 * frames.length, channels: 4, pageHeight: 256 } })
      .gif({ loop: 0, delay: 50 }).toFile('assets/shark/shark-swim-mouth-preview.gif');
    await sharp({ create: { width: 1536, height: 256, channels: 4, background: '#1796aa' } })
      .composite(jawExamples.map((data, i) => ({ input: Buffer.from(data.split(',')[1], 'base64'), left: i * 384, top: 0 })))
      .png().toFile('captures/shark/registered-jaw-poses.png');
  }
} finally { await browser.close(); }
