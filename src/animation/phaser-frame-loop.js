import { FrameLoop } from './frame-loop.js';

/** Bind a scheduler to an existing Phaser image; scene lifetime stays with the caller. */
export function attachFrameLoop(image, config, dependencies) {
  const loop = new FrameLoop(config.loop, dependencies);
  image.setTexture(config.texture, loop.state.frame)
    .setOrigin(...config.origin).setScale(config.scale);
  return {
    get state() { return loop.state; },
    update(deltaMs) {
      const { frame } = loop.advance(deltaMs);
      if (image.frame.name !== frame) image.setFrame(frame);
    },
    request(name) { return loop.request(name); },
    dispose() { loop.dispose(); },
  };
}
