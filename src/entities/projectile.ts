import type { Poolable } from '../engine/pool';

/** Quantos inimigos diferentes um projétil lembra ter acertado (memória circular). */
export const MAX_HIT_MEMORY = 24;

export type ProjectileKind = 'note' | 'kazoo' | 'viola' | 'duck' | 'runa' | 'onda' | 'chinelo' | 'controle' | 'missil';

export interface Projectile extends Poolable {
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  /** Segundos de vida restantes. */
  life: number;
  /** Inimigos extras que ainda pode atravessar. */
  pierce: number;
  /** Ricochetes restantes (muda de rumo para outro inimigo ao acertar). */
  bounces: number;
  /** Segundos de atordoamento aplicados ao inimigo atingido (0 = nenhum). */
  stun: number;
  /** Giro em rad/s para perseguir o inimigo mais próximo (0 = reto). Mísseis da Constelação Afetiva. */
  homing: number;
  /** HP curado a quem atirou e ao aliado mais próximo quando o projétil acerta. */
  healOnHit: number;
  /** Bumerangue: vai e volta até quem atirou (Chinelo Bumerangue de Mãe). */
  boomerang: boolean;
  /** Segundos que faltam para o bumerangue virar e voltar. */
  outLeft: number;
  returning: boolean;
  /** Velocidade de empurrão aplicada ao inimigo atingido, na direção do projétil (0 = nenhum). */
  knock: number;
  /** Marca o inimigo atingido (recebe dano extra). */
  markOnHit: boolean;
  /** Divide-se em duas no próximo ricochete (uma vez). */
  split: boolean;
  /** A cada N ricochetes, explode em área (0 = nunca). */
  explodeEvery: number;
  explodeRadius: number;
  explodeMul: number;
  /** Ricochetes já feitos. */
  jumpsDone: number;
  ownerSlot: number;
  alive: boolean;
  /** uids dos inimigos já atingidos, para não acertar o mesmo duas vezes. */
  hitIds: number[];
  hitCount: number;
}

export function createProjectile(): Projectile {
  return {
    poolIndex: 0,
    kind: 'note',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    damage: 0,
    radius: 0,
    life: 0,
    pierce: 0,
    bounces: 0,
    stun: 0,
    homing: 0,
    healOnHit: 0,
    boomerang: false,
    outLeft: 0,
    returning: false,
    knock: 0,
    markOnHit: false,
    split: false,
    explodeEvery: 0,
    explodeRadius: 0,
    explodeMul: 1,
    jumpsDone: 0,
    ownerSlot: 0,
    alive: false,
    hitIds: new Array<number>(MAX_HIT_MEMORY).fill(0),
    hitCount: 0,
  };
}
