import { WORLD_WIDTH } from './gameplay.js';
import { findRoute } from './spawn-route.js';

// Dedicated per-run random stream: animation/scenery randomness cannot change
// the obstacle sequence. Keep the seed available for replaying reported runs.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ state >>> 15, state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class ObstacleSpawner {
  constructor({ seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0], random } = {}) {
    this.seed = seed;
    this.random = random ?? seededRandom(seed);
  }

  candidate(playerLane) {
    const draw = this.random();
    const count = draw < .4 ? 1 : draw < .8 ? 2 : 3;
    const available = [0, 1, 2, 3], group = [];
    let x = WORLD_WIDTH + 55 + this.random() * 70;
    for (let i = 0; i < count; i++) {
      // Same weights for every run and speed: current lane, neighbours, distant.
      const weights = available.map(lane => [6, 3, 1, .5][Math.abs(lane - playerLane)]);
      let choice = this.random() * weights.reduce((a, b) => a + b, 0);
      let index = 0;
      while (index < weights.length - 1 && choice >= weights[index]) choice -= weights[index++];
      const [lane] = available.splice(index, 1);
      const key = lane === 0 ? 'bird' : this.random() < 1 / 3 ? 'shark' : 'rubbish';
      group.push({ lane, key, x });
      x += 70 + this.random() * 110;
    }
    return group;
  }

  next({ player, hazards, speed }) {
    // Bounded retries keep work small. Failed candidates create no actors,
    // animation clocks or sounds, and cannot retarget existing obstacles.
    for (let attempt = 0; attempt < 8; attempt++) {
      const group = this.candidate(player.lane);
      if (findRoute({ player, hazards: [...hazards, ...group], speed })) return group;
    }
    // Try single obstacles in a random weighted order before leaving a gap.
    const singles = this.candidate(player.lane);
    for (const obstacle of singles) {
      if (findRoute({ player, hazards: [...hazards, obstacle], speed })) return [obstacle];
    }
    return [];
  }
}
