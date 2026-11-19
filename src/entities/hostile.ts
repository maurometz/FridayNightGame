import type { Poolable } from '../engine/pool';

export type HostileKind = 'notificacao' | 'pedra' | 'pipoca' | 'formulario' | 'espinho' | 'agua' | 'latido' | 'tinta';

/** Projétil inimigo. Machuca jogadores e pode ser bloqueado pelo arco da Thaisa (Fortaleza Acústica). */
export interface Hostile extends Poolable {
  kind: HostileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  life: number;
  /** Giro em rad/s para seguir o jogador mais próximo (0 = reto). */
  homing: number;
  speed: number;
  alive: boolean;
}

export function createHostile(): Hostile {
  return { poolIndex: 0, kind: 'notificacao', x: 0, y: 0, vx: 0, vy: 0, damage: 0, radius: 3, life: 0, homing: 0, speed: 0, alive: false };
}
