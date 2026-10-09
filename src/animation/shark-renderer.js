// The generated cells are useful mouth references, but are not registered animation
// poses. Keep one body plate and move its tail continuously; jaw swaps are local.
let nextTextureId = 0;

const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function canvas(width, height) {
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  return result;
}

/** Construct registered jaw plates once, shared by sharks using this source texture. */
function jawPlates(source, manifest) {
  const { frameWidth: width, frameHeight: height, rig } = manifest;
  const extract = (index, dx = 0, dy = 0) => {
    const result = canvas(width, height), ctx = result.getContext('2d');
    ctx.drawImage(source, index % manifest.columns * width,
      Math.floor(index / manifest.columns) * height, width, height, dx, dy, width, height);
    return result;
  };
  const base = extract(rig.bodyFrame);
  const basePixels = base.getContext('2d').getImageData(0, 0, width, height);
  const [left, top, right, bottom] = rig.mouthBounds;
  return rig.jawPoses.map(({ frame, offset: [dx, dy] }) => {
    if (frame === rig.bodyFrame) return base;
    const plate = extract(frame, dx, dy), ctx = plate.getContext('2d');
    const target = ctx.getImageData(0, 0, width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      // Exact base pixels outside this small mouth window, including the whole eye.
      const edge = smooth(Math.min(x - left, right - x, y - top, bottom - y) / 7);
      const jawShape = smooth((1 - ((x - 88) / 64) ** 2 - ((y - 204) / 39) ** 2) * 3);
      const weight = edge * jawShape;
      const i = (y * width + x) * 4;
      const a = basePixels.data[i + 3] * (1 - weight), b = target.data[i + 3] * weight;
      for (let c = 0; c < 3; c++) target.data[i + c] = a + b ? (basePixels.data[i + c] * a + target.data[i + c] * b) / (a + b) : 0;
      target.data[i + 3] = a + b;
    }
    ctx.putImageData(target, 0, 0);
    return plate;
  });
}

const platesByTexture = new WeakMap();

/** Phaser image with an independently animated jaw and tail, and a fixed head anchor. */
export function createSharkRenderer(scene, manifest) {
  const sourceTexture = scene.textures.get('shark-swim-mouth');
  let plates = platesByTexture.get(sourceTexture);
  if (!plates) {
    plates = jawPlates(sourceTexture.getSourceImage(), manifest);
    platesByTexture.set(sourceTexture, plates);
  }
  const { frameWidth: width, frameHeight: height, rig } = manifest;
  const key = `shark-pose-${nextTextureId++}`;
  const texture = scene.textures.createCanvas(key, width, height);
  const pose = canvas(width, height), ctx = pose.getContext('2d');
  const image = scene.add.image(0, 0, key).setOrigin(...manifest.origin).setScale(manifest.scale);

  image.renderPose = ({ elapsedMs = 0, jaw = 0 } = {}) => {
    // Add premultiplied contributions, avoiding alpha loss during a mouth crossfade.
    const position = Math.max(0, Math.min(1, jaw)) * (plates.length - 1);
    const lower = Math.floor(position), upper = Math.min(lower + 1, plates.length - 1), mix = position - lower;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - mix;
    ctx.drawImage(plates[lower], 0, 0);
    if (mix) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = mix;
      ctx.drawImage(plates[upper], 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const output = texture.context;
    output.clearRect(0, 0, width, height);
    output.drawImage(pose, 0, 0, rig.tailStart, height, 0, 0, rig.tailStart, height);
    const phase = elapsedMs / rig.strokeDurationMs * Math.PI * 2;
    const at = x => {
      const weight = smooth((x - rig.tailStart) / (width - rig.tailStart));
      return {
        x: x + Math.sin(phase - weight * .45) * rig.tailAmplitude * weight,
        y: Math.sin(phase - weight * .45) * 2 * weight,
      };
    };
    // Fine strips form a connected bend with no whole-frame translation or squash.
    for (let x = rig.tailStart; x < width; x += 2) {
      const end = Math.min(x + 2, width), a = at(x), b = at(end);
      output.drawImage(pose, x, 0, end - x, height, a.x, a.y, b.x - a.x + .35, height);
    }
    texture.refresh();
    return image;
  };
  image.renderPose();
  image.once('destroy', () => scene.textures.remove(key));
  return image;
}
