import { SHIELD_CAP_FRACTION } from '../data/thaisa';
import type { World } from '../engine/world';
import type { Player } from '../entities/player';
import { showPlayerDamage } from './damageNumbers';

/** Dano ao jogador: o escudo absorve primeiro, o resto vai para o HP. */
export function damagePlayer(p: Player, rawAmount: number, world?: World): void {
  const amount = rawAmount * p.damageTakenMul;
  if (world) showPlayerDamage(world, p, amount);
  const absorbed = Math.min(p.shield, amount);
  p.shield -= absorbed;
  p.hp -= amount - absorbed;
}

/** Teto do escudo, em fração do HP máximo. */
export function shieldCap(p: Player): number {
  return p.maxHp * SHIELD_CAP_FRACTION;
}

export function addShield(p: Player, amount: number): void {
  p.shield = Math.min(shieldCap(p), p.shield + amount);
}

/**
 * Cura. Com o Rodízio Livre, a cura que passaria do HP máximo vira escudo.
 * Devolve quanto de HP foi de fato recuperado.
 */
export function healPlayer(p: Player, amount: number): number {
  if (p.hp <= 0) return 0;
  const before = p.hp;
  const total = p.hp + amount;
  p.hp = Math.min(p.maxHp, total);
  const overflow = total - p.hp;
  if (overflow > 0 && p.kit?.type === 'thaisa' && p.kit.mods.rodizio) addShield(p, overflow);
  return p.hp - before;
}
