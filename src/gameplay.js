// Movement and collision values shared by the scene and spawn safety planner.
export const WORLD_WIDTH = 960;
export const LANE_Y = Object.freeze([105, 215, 325, 435]);
export const PLAYER_X = 190;
export const LANE_MOVE_MS = 140;
export const JUMP_MS = 780;
export const COLLISION_X = 44;
export const COLLISION_Y = 37;
export const SPEED_GROWTH = .16 / 20;
export const hazardRate = key => key === 'bird' ? 1.28 : key === 'shark' ? 1.12 : 1;
export const gameSpeed = distance => 165 + distance * .16;
export const spawnInterval = speed => Math.max(.8, 1.85 * 165 / speed);
export const laneEase = p => 1 - (1 - Math.min(1, Math.max(0, p))) ** 3;
export const jumpY = (from, elapsed) => {
  const p = Math.min(1, Math.max(0, elapsed / (JUMP_MS / 1000)));
  return from + (LANE_Y[1] - from) * p - 130 * 4 * p * (1 - p);
};
