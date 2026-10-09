// Distances are CSS pixels so gestures feel the same at every canvas scale.
export function gestureDirection(start, end, mode) {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (mode === 'swipe') {
    return Math.abs(dy) >= 24 && Math.abs(dy) > Math.abs(dx) * 1.2 ? Math.sign(dy) : 0;
  }
  if (mode === 'tap' && Math.hypot(dx, dy) <= 14 && end.time - start.time <= 500) {
    const offset = end.y - start.fishY;
    return Math.abs(offset) > 8 ? Math.sign(offset) : 0;
  }
  return 0;
}

export function installGameControls(game, { getScene, getMode, isPlaying }) {
  const canvas = game.canvas;
  const listeners = new AbortController();
  let gesture = null;
  canvas.style.touchAction = 'none';
  const cancel = () => { gesture = null; };
  const on = (target, event, handler) => target.addEventListener(event, handler, { signal: listeners.signal });
  on(window, 'keydown', event => {
    if (!isPlaying() || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) getScene()?.move(event.key === 'ArrowUp' ? -1 : 1);
  });
  on(canvas, 'pointerdown', event => {
    if (gesture || !event.isPrimary || event.button !== 0 || !isPlaying()) return;
    const scene = getScene();
    if (!scene || scene.over) return;
    const rect = canvas.getBoundingClientRect();
    gesture = {
      id: event.pointerId, scene, mode: getMode(), x: event.clientX, y: event.clientY,
      fishY: rect.top + scene.player.y * rect.height / 520, time: event.timeStamp,
    };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  on(canvas, 'pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const start = gesture;
    cancel();
    if (!isPlaying() || start.scene !== getScene() || start.mode !== getMode()) return;
    const direction = gestureDirection(start, { x: event.clientX, y: event.clientY, time: event.timeStamp }, start.mode);
    if (direction) start.scene.move(direction);
  });
  for (const event of ['pointercancel', 'lostpointercapture']) on(canvas, event, cancel);
  on(window, 'blur', cancel);
  on(window, 'resize', cancel);
  on(document, 'visibilitychange', cancel);
  return { cancel, dispose() { cancel(); listeners.abort(); } };
}
