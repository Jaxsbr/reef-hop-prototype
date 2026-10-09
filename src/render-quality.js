// Keep gameplay coordinates fixed while giving the renderer enough physical pixels.
// The 3x ceiling bounds fill-rate/memory on 4K screens and high-density phones.
export function renderDensity(displayWidth, worldWidth, deviceDensity = 1) {
  return Math.min(3, Math.max(1, displayWidth / worldWidth * Math.min(2, deviceDensity)));
}

export function installRenderQuality(game, width, height) {
  const apply = () => {
    const density = renderDensity(game.scale.displaySize.width, width, window.devicePixelRatio || 1);
    const pixelWidth = Math.ceil(width * density), pixelHeight = Math.ceil(height * density);
    game.scale.baseSize.setSize(pixelWidth, pixelHeight);
    if (game.canvas.width !== pixelWidth || game.canvas.height !== pixelHeight) {
      game.canvas.width = pixelWidth;
      game.canvas.height = pixelHeight;
      game.renderer.resize(pixelWidth, pixelHeight);
    }
    // Input is expressed in backing pixels, then camera transforms it to world space.
    game.scale.displayScale.set(pixelWidth / game.scale.canvasBounds.width, pixelHeight / game.scale.canvasBounds.height);
    for (const scene of game.scene.getScenes(true)) {
      const camera = scene.cameras.main;
      if (camera.width !== pixelWidth || camera.height !== pixelHeight
        || camera.zoomX !== pixelWidth / width || camera.zoomY !== pixelHeight / height) {
        camera.setSize(pixelWidth, pixelHeight)
          .setZoom(pixelWidth / width, pixelHeight / height).centerOn(width / 2, height / 2);
      }
    }
  };
  game.scale.on('resize', apply);
  // Also restore the camera after fish selection or restart creates a new scene.
  game.events.on('prerender', apply);
  game.events.once('destroy', () => {
    game.scale.off('resize', apply);
    game.events.off('prerender', apply);
  });
}
