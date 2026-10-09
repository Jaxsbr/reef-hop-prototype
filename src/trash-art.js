import trash from '../assets/trash/trash.json' with { type: 'json' };

// Center the visible object, rather than the transparent square, at the hazard.
// Uniform scaling preserves the selected silhouettes and existing hazard sizes.
export const TRASH_ART = Object.fromEntries(Object.entries(trash.items).map(([type, item]) => {
  const [left, top, right, bottom] = item.visualBounds;
  return [type, {
    type,
    texture: `trash-${type}`,
    image: `${import.meta.env?.BASE_URL ?? '/'}assets/trash/${item.image}`,
    origin: [(left + right) / (2 * item.width), (top + bottom) / (2 * item.height)],
    scale: item.visibleHeight / (bottom - top),
  }];
}));
