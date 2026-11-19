import type { Poolable } from '../engine/pool';

export interface Gem extends Poolable {
  x: number;
  y: number;
  xp: number;
  /** Já foi atraída por um jogador e está voando até ele. */
  magnet: boolean;
  alive: boolean;
}

export function createGem(): Gem {
  return { poolIndex: 0, x: 0, y: 0, xp: 0, magnet: false, alive: false };
}
