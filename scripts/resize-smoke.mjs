import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.REEF_HOP_PLAYWRIGHT_MODULE || 'playwright');
const output = fileURLToPath(new URL('../captures/resizing/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.REEF_HOP_BROWSER_CHANNEL ? { channel: process.env.REEF_HOP_BROWSER_CHANNEL } : {}),
});
const errors = [], observations = [];
const layouts = [
  ['desktop-landscape', 1440, 900], ['desktop-ultrawide', 2560, 1080],
  ['desktop-portrait', 900, 1440], ['phone-portrait', 390, 844],
  ['phone-landscape', 844, 390], ['small-phone-landscape', 568, 320],
  ['small-phone-portrait', 320, 568], ['tablet-portrait', 768, 1024],
  ['tablet-landscape', 1024, 768], ['large-desktop', 3840, 2160],
];
try {
  // Run both desktop window resizing and mobile viewport/orientation simulation.
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(process.env.REEF_HOP_URL || 'http://127.0.0.1:5179/reef-hop-prototype/');
    await page.waitForFunction(() => window.reefScene?.player);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#reef-app').dataset.screen === 'playing');
    await page.evaluate(() => { window.reefScene.spawn = () => {}; });
    await page.evaluate(() => { window.resizeTestPlayer = window.reefScene.player; });
    for (const [name, width, height] of layouts) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(() => {
        const parent = document.querySelector('#game').getBoundingClientRect();
        const canvas = document.querySelector('canvas').getBoundingClientRect();
        const scale = Math.min(parent.width / 960, parent.height / 520);
        return Math.abs(canvas.width - 960 * scale) < 1 && Math.abs(canvas.height - 520 * scale) < 1;
      });
      const measurement = await page.evaluate(() => {
        const rect = element => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        const s = window.reefScene;
        return { parent: rect(document.querySelector('#game')), canvas: rect(document.querySelector('canvas')),
          viewport: [innerWidth, innerHeight], scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
          backing: [document.querySelector('canvas').width, document.querySelector('canvas').height], dpr: devicePixelRatio,
          cameraWorld: [s.cameras.main.worldView.width, s.cameras.main.worldView.height],
          background: getComputedStyle(document.querySelector('#game')).backgroundColor,
          controls: [...document.querySelectorAll('#menu-button')].map(rect),
          world: [s.scale.gameSize.width, s.scale.gameSize.height], samePlayer: s.player === window.resizeTestPlayer };
      });
      const { parent, canvas } = measurement;
      const factor = Math.min(parent.width / 960, parent.height / 520);
      assert.ok(Math.abs(canvas.width - 960 * factor) < 1, name);
      assert.ok(Math.abs(canvas.height - 520 * factor) < 1, name);
      assert.ok(canvas.width > canvas.height, name);
      assert.ok(Math.abs(canvas.x - parent.x - (parent.width - canvas.width) / 2) <= 1, name);
      assert.ok(Math.abs(canvas.y - parent.y - (parent.height - canvas.height) / 2) <= 1, name);
      assert.deepEqual(measurement.viewport, [width, height]);
      assert.deepEqual(measurement.scroll, [width, height]);
      assert.deepEqual(measurement.world, [960, 520]);
      assert.equal(measurement.background, 'rgb(0, 0, 0)');
      assert.equal(measurement.samePlayer, true);
      const density = Math.min(3, Math.max(1, factor * Math.min(2, measurement.dpr)));
      assert.deepEqual(measurement.backing, [Math.ceil(960 * density), Math.ceil(520 * density)], name + ' physical rendering resolution');
      assert.ok(Math.abs(measurement.cameraWorld[0] - 960) < .01 && Math.abs(measurement.cameraWorld[1] - 520) < .01, name + ' camera preserves gameplay coordinates');
      for (const control of measurement.controls) {
        assert.ok(control.x >= 0 && control.y >= 0 && control.x + control.width <= width + 1 && control.y + control.height <= height + 1, name);
      }
      observations.push({ name, mobile, ...measurement });
      if (!mobile || name.startsWith('phone-')) await page.screenshot({ path: `${output}/${mobile ? 'touch-' : ''}${name}.png` });
    }
    // Check control input and preservation of an active run across rotation.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(() => window.reefScene.lane === 1 && window.reefScene.distance > 0);
    const before = await page.evaluate(() => window.reefScene.distance);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => window.reefScene.distance > 0);
    assert.ok(await page.evaluate(distance => window.reefScene.distance >= distance && window.reefScene.lane === 1 && window.reefScene.player === window.resizeTestPlayer, before));
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => window.reefScene.lane === 2);
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/resize-report.json`, JSON.stringify({ result: 'passed', observations, errors }, null, 2) + '\n');
  console.log(`Passed ${observations.length} desktop/mobile layouts, live resizing, centering, largest fit, and controls; no browser errors.`);
} finally {
  await browser.close();
}
