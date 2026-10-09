import { FrameLoop } from './frame-loop.js';

/** Persistent pose substitutions, with finite jaw transitions and a continuous swim clock. */
export class SharkMouth {
  constructor(manifest) {
    this.manifest = manifest;
    this.swim = new FrameLoop({ baseLoop: manifest.baseLoop, frameDurationMs: manifest.suggestedFrameDurationMs });
    this.mode = 'closed';
    this.transitionMs = 0;
    this.engaged = false;
    this.closingJaw = 1;
    this.disposed = false;
  }
  get state() {
    const base = this.swim.state;
    const frames = this.manifest.transitions[this.mode];
    const frame = frames
      ? frames[Math.min(frames.length - 1, Math.floor(this.transitionMs / this.manifest.suggestedFrameDurationMs))]
      : this.mode === 'open' ? this.manifest.variants.open.replacements[base.baseFrame] : base.frame;
    const progress = Math.min(1, this.transitionMs / (2 * this.manifest.suggestedFrameDurationMs));
    const eased = progress * progress * (3 - 2 * progress);
    const jaw = this.mode === 'open' ? 1 : this.mode === 'opening' ? eased : this.mode === 'closing' ? this.closingJaw * (1 - eased) : 0;
    return { ...base, frame, jaw, mode: this.mode, engaged: this.engaged };
  }
  update(deltaMs, shark, player) {
    if (this.disposed) return this.state;
    this.swim.advance(deltaMs);
    if (this.mode === 'opening' || this.mode === 'closing') {
      this.transitionMs += deltaMs;
      if (this.transitionMs >= this.manifest.transitions[this.mode].length * this.manifest.suggestedFrameDurationMs) {
        this.mode = this.mode === 'opening' ? 'open' : 'closed';
      }
    }
    const dx = shark.x - player.x;
    if (!this.engaged && dx > 0 && dx < 260 && Math.abs(shark.y - player.y) < 125) {
      this.engaged = true;
      this.mode = 'opening';
      this.transitionMs = 0;
    } else if (this.engaged && dx < -80 && this.mode !== 'closing' && this.mode !== 'closed') {
      this.closingJaw = this.state.jaw;
      this.mode = 'closing';
      this.transitionMs = 0;
    }
    return this.state;
  }
  dispose() { this.disposed = true; this.swim.dispose(); }
}
