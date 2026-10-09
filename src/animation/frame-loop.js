/** A base loop with whole-cycle, named frame substitutions. No renderer or clock. */
export class FrameLoop {
  #baseLoop;
  #frameDurationMs;
  #cycleDurationMs;
  #variants;
  #random;
  #elapsedMs = 0;
  #cycle = 0;
  #active = null;
  #pending = new Set();
  #due = new Map();
  #disposed = false;

  constructor({ baseLoop, frameDurationMs, variants = {} }, { random = Math.random } = {}) {
    if (!Array.isArray(baseLoop) || !baseLoop.length || baseLoop.some(frame => !Number.isInteger(frame) || frame < 0)) {
      throw new RangeError('baseLoop must contain non-negative integer frame indices');
    }
    if (!Number.isFinite(frameDurationMs) || frameDurationMs <= 0) {
      throw new RangeError('frameDurationMs must be positive and finite');
    }
    if (typeof random !== 'function') throw new TypeError('random must be a function');
    this.#baseLoop = [...baseLoop];
    this.#frameDurationMs = frameDurationMs;
    this.#cycleDurationMs = baseLoop.length * frameDurationMs;
    if (!Number.isFinite(this.#cycleDurationMs)) throw new RangeError('cycle duration must be finite');
    this.#random = random;
    this.#variants = Object.entries(variants).map(([name, { replacements, intervalMs, priority = 0 }]) => {
      if (!replacements || !Object.keys(replacements).length || Object.entries(replacements).some(([frame, replacement]) =>
        String(Number(frame)) !== frame || !baseLoop.includes(Number(frame)) || !Number.isInteger(replacement) || replacement < 0)) {
        throw new RangeError(`${name}: replacements must map base frame indices to alternate frame indices`);
      }
      if (!Number.isFinite(priority)) throw new RangeError(`${name}: priority must be finite`);
      if (intervalMs != null && (!Array.isArray(intervalMs) || intervalMs.length !== 2 ||
        intervalMs.some(ms => !Number.isFinite(ms)) || intervalMs[0] <= 0 || intervalMs[1] < intervalMs[0])) {
        throw new RangeError(`${name}: intervalMs must be a positive [min, max] range`);
      }
      return { name, replacements: { ...replacements }, intervalMs: intervalMs ? [...intervalMs] : null, priority };
    }).sort((a, b) => b.priority - a.priority); // Stable ties use configuration order.
    this.reset();
  }

  get state() {
    const phaseIndex = Math.floor((this.#elapsedMs - this.#cycle * this.#cycleDurationMs) / this.#frameDurationMs);
    const baseFrame = this.#baseLoop[phaseIndex];
    return {
      frame: this.#active?.replacements[baseFrame] ?? baseFrame,
      baseFrame, phaseIndex, cycle: this.#cycle,
      variant: this.#active?.name ?? null, elapsedMs: this.#elapsedMs,
    };
  }

  /** Advance by the full animation delta, including every crossed cycle boundary. */
  advance(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('deltaMs must be non-negative and finite');
    if (this.#disposed) return this.state;
    const target = this.#elapsedMs + deltaMs;
    if (!Number.isSafeInteger(Math.floor(target / this.#cycleDurationMs))) throw new RangeError('animation time is too large');
    const targetCycle = Math.floor(target / this.#cycleDurationMs);
    while (this.#cycle < targetCycle) {
      this.#cycle++;
      this.#selectCycle();
    }
    this.#elapsedMs = target;
    return this.state;
  }

  /** Queue a named action for the next eligible boundary; repeated requests coalesce. */
  request(name) {
    if (this.#disposed) return false;
    if (!this.#variants.some(variant => variant.name === name)) throw new RangeError(`Unknown variant: ${name}`);
    this.#pending.add(name);
    return true;
  }

  reset() {
    if (this.#disposed) return this.state;
    this.#elapsedMs = 0;
    this.#cycle = 0;
    this.#active = null;
    this.#pending.clear();
    this.#due.clear();
    for (const variant of this.#variants) this.#schedule(variant, 0);
    return this.state;
  }

  /** Freeze the current frame and release queued actions. Disposal is terminal. */
  dispose() {
    this.#disposed = true;
    this.#pending.clear();
    this.#due.clear();
  }

  #schedule(variant, fromMs) {
    if (!variant.intervalMs) return;
    const [min, max] = variant.intervalMs;
    const sample = min === max ? 0 : this.#random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError('random must return a value in [0, 1)');
    this.#due.set(variant.name, fromMs + min + sample * (max - min));
  }

  #selectCycle() {
    // Always return to a full base cycle after a substitution cycle.
    if (this.#active) {
      this.#active = null;
      return;
    }
    const startMs = this.#cycle * this.#cycleDurationMs;
    this.#active = this.#variants.find(variant => this.#pending.has(variant.name) ||
      (this.#due.has(variant.name) && this.#due.get(variant.name) <= startMs)) ?? null;
    if (this.#active) {
      this.#pending.delete(this.#active.name);
      this.#schedule(this.#active, startMs + this.#cycleDurationMs);
    }
  }
}
