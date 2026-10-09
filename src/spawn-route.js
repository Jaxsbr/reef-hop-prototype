import {
  LANE_Y, PLAYER_X, LANE_MOVE_MS, JUMP_MS,
  COLLISION_X, COLLISION_Y, SPEED_GROWTH, hazardRate, laneEase, jumpY,
} from './gameplay.js';

const STEP = .02;
const MOVE_STEPS = 10; // 140ms movement plus 60ms to settle before another input.
const JUMP_STEPS = 40; // Entire 780ms jump, automatic landing, then 20ms to settle.
export const REACTION_SECONDS = .3;
const BUFFER = 5;
const travel = (speed, t) => speed * Math.expm1(SPEED_GROWTH * t) / SPEED_GROWTH;
const travelTime = (speed, pixels) => Math.log1p(SPEED_GROWTH * pixels / speed) / SPEED_GROWTH;

// A conservative swept check: compare bounds over every 20ms interval, rather
// than sampling only endpoints and potentially stepping over a fast obstacle.
// Bird routes stay within this envelope; rubbish includes its maximum wake bob.
function hazardBounds(hazard) {
  if (hazard.key === 'bird') return [97, 133];
  const y = LANE_Y[hazard.lane], bob = hazard.key === 'rubbish' ? 24 : 0;
  return [y - bob, y + bob];
}

function jumpBounds(from, a, b) {
  const values = [jumpY(from, a), jumpY(from, b)];
  const vertex = (520 - (LANE_Y[1] - from)) / 1040 * JUMP_MS / 1000;
  if (vertex > a && vertex < b) values.push(jumpY(from, vertex));
  return [Math.min(...values), Math.max(...values)];
}

function moveY(from, to, elapsed) {
  return from + (to - from) * laneEase(elapsed / (LANE_MOVE_MS / 1000));
}

function moveBounds(from, to, a, b) {
  // Phaser can start/finish a tween one frame either side of its nominal time.
  const ys = [moveY(from, to, a - .04), moveY(from, to, b + .04)];
  return [Math.min(...ys), Math.max(...ys)];
}

/**
 * Find a route from the actual player state until every approaching hazard has
 * passed. Air is a full jump action, never a lane the player can park in.
 * The result is a witness input schedule; null means no safe route was found.
 * Conservative envelopes can reject a playable group, but never intentionally
 * admit a group by requiring frame-perfect movement or an interrupted jump.
 */
export function findRoute({ player, hazards, speed }) {
  const ahead = hazards.filter(o => o.x >= PLAYER_X - 3 - COLLISION_X - BUFFER);
  if (!ahead.length) return { actions: [], duration: 0 };

  const remainingJump = player.jump ? Math.max(0, JUMP_MS / 1000 - player.jump.elapsed) : 0;
  const remainingMove = player.transition ? Math.max(0, LANE_MOVE_MS / 1000 - player.transition.elapsed) : 0;
  const initialSteps = Math.ceil((Math.max(remainingJump, remainingMove) + REACTION_SECONDS) / STEP);
  const lastPass = Math.max(...ahead.map(o => travelTime(speed,
    Math.max(0, o.x - (PLAYER_X - 3 - COLLISION_X - BUFFER)) / hazardRate(o.key))));
  const endStep = Math.max(initialSteps, Math.ceil(lastPass / STEP) + JUMP_STEPS);

  // Cache only hazards crossing the player's horizontal envelope at each step.
  // Include the jump's 24px forward excursion and the normal 3px swim sway.
  const blocked = Array.from({ length: endStep }, (_, step) => {
    const a = travel(speed, step * STEP), b = travel(speed, (step + 1) * STEP);
    return ahead.filter(o => {
      const rate = hazardRate(o.key);
      return o.x - b * rate <= PLAYER_X + 24 + COLLISION_X + BUFFER &&
        o.x - a * rate >= PLAYER_X - 3 - COLLISION_X - BUFFER;
    }).map(hazardBounds);
  });
  const clear = (start, length, boundsAt) => {
    for (let i = 0; i < length; i++) {
      const hazardsHere = blocked[start + i];
      if (!hazardsHere?.length) continue;
      const [lo, hi] = boundsAt(i * STEP, (i + 1) * STEP);
      // +/-9 includes swim sway and variation in the jump's takeoff height.
      if (hazardsHere.some(([bottom, top]) =>
        lo - 9 - COLLISION_Y - BUFFER <= top && hi + 9 + COLLISION_Y + BUFFER >= bottom)) return false;
    }
    return true;
  };

  const initialLane = player.jump ? 1 : player.lane;
  const initialBounds = (a, b) => {
    if (player.jump) return jumpBounds(player.jump.from, player.jump.elapsed + a, player.jump.elapsed + b);
    if (player.transition) {
      const move = player.transition;
      return moveBounds(move.from, LANE_Y[move.to], move.elapsed + a, move.elapsed + b);
    }
    return [player.y ?? LANE_Y[initialLane], player.y ?? LANE_Y[initialLane]];
  };
  if (!clear(0, initialSteps, initialBounds)) return null;

  const states = Array.from({ length: endStep + 1 }, () => new Map());
  states[initialSteps].set(initialLane, { previous: null, time: initialSteps, lane: initialLane });
  const finish = node => {
    const actions = [];
    for (let n = node; n.previous; n = n.previous) {
      if (n.direction) actions.push({ time: n.previous.time * STEP, direction: n.direction });
    }
    return { actions: actions.reverse(), duration: node.time * STEP };
  };
  for (let step = initialSteps; step <= endStep; step++) {
    for (const [lane, node] of states[step]) {
      if (step >= endStep) return finish(node);
      const edges = [{ lane, length: MOVE_STEPS, direction: 0, bounds: () => [LANE_Y[lane], LANE_Y[lane]] }];
      for (const direction of [-1, 1]) {
        const next = lane + direction;
        if (next < 0 || next > 3) continue;
        if (next === 0) {
          edges.push({ lane: 1, length: JUMP_STEPS, direction, bounds: (a, b) => jumpBounds(LANE_Y[1], a, b) });
        } else {
          edges.push({ lane: next, length: MOVE_STEPS, direction,
            bounds: (a, b) => moveBounds(LANE_Y[lane], LANE_Y[next], a, b) });
        }
      }
      for (const edge of edges) {
        const end = Math.min(endStep, step + edge.length);
        // Do not finish the search while a jump is still in flight.
        if (edge.length === JUMP_STEPS && end - step < JUMP_STEPS) continue;
        if (!states[end].has(edge.lane) && clear(step, end - step, edge.bounds)) {
          states[end].set(edge.lane, { previous: node, time: end, lane: edge.lane, direction: edge.direction });
        }
      }
    }
  }
  return null;
}
