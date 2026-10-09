import rosie from '../../assets/fish/rosie/rosie-swim-blink.json' with { type: 'json' };
import sunny from '../../assets/fish/sunny/sunny-swim-blink.json' with { type: 'json' };
import blue from '../../assets/fish/blue/blue-swim-blink.json' with { type: 'json' };
import kiwi from '../../assets/fish/kiwi/kiwi-swim-blink.json' with { type: 'json' };

function actor(name, manifest, [left, top, right, bottom], visibleWidth) {
  const center = [(left + right) / 2, (top + bottom) / 2];
  const scale = visibleWidth / (right - left);
  return {
    texture: `${name}-swim-blink`,
    image: `${import.meta.env?.BASE_URL ?? '/'}assets/${manifest.image}`,
    sheet: { frameWidth: manifest.frameWidth, frameHeight: manifest.frameHeight, endFrame: manifest.frameCount - 1 },
    loop: {
      baseLoop: manifest.baseLoop,
      frameDurationMs: manifest.suggestedFrameDurationMs,
      variants: { blink: { replacements: manifest.variants.blink.replacements, intervalMs: [3000, 6500] } },
    },
    // Fixed bounds center and uniform scale preserve each silhouette and registered snout.
    origin: [center[0] / manifest.frameWidth, center[1] / manifest.frameHeight],
    scale,
    presentation: {
      bounds: [left, top, right, bottom], visibleWidth,
      snoutOffset: manifest.snoutAnchor.map((point, axis) => (point - center[axis]) * scale),
    },
  };
}

const rectangle = ({ left, top, right, bottom }) => [left, top, right, bottom];
// Sunny's min/max bounds are inclusive; convert their union to exclusive edges.
const sunnyBounds = [
  Math.min(...sunny.visibleBounds.map(pose => pose.minX)),
  Math.min(...sunny.visibleBounds.map(pose => pose.minY)),
  Math.max(...sunny.visibleBounds.map(pose => pose.maxX)) + 1,
  Math.max(...sunny.visibleBounds.map(pose => pose.maxY)) + 1,
];

// Manifest owns the art mapping; this registry owns runtime timing and presentation.
export const ACTOR_ANIMATIONS = {
  fish_orange: actor('sunny', sunny, sunnyBounds, 64),
  fish_blue: actor('blue', blue, blue.unionBounds, 76),
  fish_pink: actor('rosie', rosie, rectangle(rosie.visualBounds), 70),
  fish_green: actor('kiwi', kiwi, rectangle(kiwi.visualBounds), 64),
};
