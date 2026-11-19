// Poderes gerais das cartas (ver entities/perks.ts). Ficam num só lugar para valerem para todos os personagens:
// o dano passa por damageEnemy, os golpes recebidos por hitPlayer e os abates por killEnemy.

import { STEP_S } from '../data/balance';
import type { World } from '../engine/world';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { spawnEffect } from './effects';
import { damageArea, knockEnemy } from './enemies';
import {
  REQUIEM_DAMAGE,
  REQUIEM_COOLDOWN_S,
  REQUIEM_INVULN_S,
  REQUIEM_KNOCK,
  REQUIEM_RADIUS,
  REQUIEM_RANGE,
  REQUIEM_REVIVE_HP,
} from '../data/felipe';
import { addShield, healPlayer } from './playerStats';

/** Raio em que "dano de perto" vale: 3,5 tiles. */
const CLOSE_PX = 56;
/** Chance de um abate explodir (com a carta Pipoca Explosiva). */
const BLAST_CHANCE = 0.3;
const BLAST_RADIUS = 34;
/** Escudo máximo que a regeneração de escudo mantém, em fração do HP máximo. */
const SHIELD_REGEN_CAP = 0.25;

/** Multiplicador de dano dos poderes que dependem da situação. */
export function perkDamageMul(killer: Player, e: Enemy): number {
  const k = killer.perks;
  let m = 1;
  const frac = killer.maxHp > 0 ? killer.hp / killer.maxHp : 1;
  if (k.lowHpDamage > 0 && frac < 0.5) m *= 1 + k.lowHpDamage;
  if (k.fullHpDamage > 0 && frac >= 0.9) m *= 1 + k.fullHpDamage;
  if (k.bossDamage > 0 && e.def.boss) m *= 1 + k.bossDamage;
  if (k.closeDamage > 0 && Math.hypot(e.x - killer.x, e.y - killer.y) <= CLOSE_PX) m *= 1 + k.closeDamage;
  return m;
}

/** Multiplicador de um crítico: x2, mais o bônus dos poderes. */
export function critMultiplier(killer: Player): number {
  return 2 + killer.perks.critDamage;
}

/** Depois de causar dano: roubo de vida. */
export function afterDamagePerks(killer: Player, dealt: number): void {
  const ls = killer.perks.lifesteal;
  if (ls > 0 && dealt > 0 && killer.hp > 0) healPlayer(killer, dealt * ls);
}

let blastDepth = 0;

/** Depois de um abate: cura por abate e a explosão da Pipoca Explosiva. */
export function onKillPerks(world: World, killer: Player, e: Enemy): void {
  const k = killer.perks;
  if (k.killHeal > 0 && killer.hp > 0) healPlayer(killer, k.killHeal);
  if (k.killBlast > 0 && blastDepth < 2 && world.rng.next() < BLAST_CHANCE) {
    blastDepth++;
    damageArea(world, e.x, e.y, BLAST_RADIUS, k.killBlast * killer.damageMul, killer);
    spawnEffect(world, { kind: 'ring', x: e.x, y: e.y, radius: BLAST_RADIUS, life: 0.25, color: '#ffb347' });
    blastDepth--;
  }
}

/**
 * Antes de um golpe atingir o jogador. Devolve false se ele desviou (o golpe é ignorado).
 * Os espinhos machucam quem está em volta.
 */
export function beforeHitPerks(world: World, victim: Player): boolean {
  const k = victim.perks;
  if (k.dodge > 0 && world.rng.next() < k.dodge) {
    spawnEffect(world, { kind: 'text', x: victim.x, y: victim.y - 30, life: 0.7, color: '#bdf7ff', text: 'Desviou!' });
    return false;
  }
  if (k.thorns > 0) damageArea(world, victim.x, victim.y - 6, 20, k.thorns, victim);
  return true;
}

/**
 * Requiem da Morte (Felipe): quem cai perto dele (ou ele mesmo) se levanta com metade da vida,
 * e uma onda empurra e fere os inimigos em volta.
 */
function requiem(world: World, victim: Player): void {
  if (victim.hp > 0) return;
  for (const f of world.players) {
    const s = f.kit;
    if (s?.type !== 'felipe' || !s.mods.requiem || s.requiemCd > 0) continue;
    if (f !== victim && (f.hp <= 0 || Math.hypot(f.x - victim.x, f.y - victim.y) > REQUIEM_RANGE)) continue;
    s.requiemCd = REQUIEM_COOLDOWN_S;
    victim.hp = victim.maxHp * REQUIEM_REVIVE_HP;
    victim.invuln = Math.max(victim.invuln, REQUIEM_INVULN_S);
    for (const e of world.enemies.active) {
      if (!e.alive) continue;
      const dx = e.x - victim.x;
      const dy = e.y - victim.y;
      const d = Math.hypot(dx, dy);
      if (d <= REQUIEM_RADIUS + e.def.radius) knockEnemy(e, d > 0 ? dx / d : 1, d > 0 ? dy / d : 0, REQUIEM_KNOCK, f.slot);
    }
    damageArea(world, victim.x, victim.y - 8, REQUIEM_RADIUS, REQUIEM_DAMAGE * f.damageMul, f);
    spawnEffect(world, { kind: 'text', x: victim.x, y: victim.y - 34, life: 1.6, color: '#c9f5d2', text: 'Réquiem da Morte!' });
    spawnEffect(world, { kind: 'ring', x: victim.x, y: victim.y - 8, radius: REQUIEM_RADIUS, life: 0.6, color: '#9be7a8' });
    return;
  }
}

/** Depois de um golpe: o Requiem e a Segunda Chance levantam quem caiu. */
export function afterHitPerks(world: World, victim: Player): void {
  requiem(world, victim);
  const k = victim.perks;
  if (victim.hp > 0 || k.secondWind <= 0) return;
  k.secondWind--;
  victim.hp = victim.maxHp * 0.4;
  victim.invuln = Math.max(victim.invuln, 1.5);
  addShield(victim, victim.maxHp * 0.15);
  spawnEffect(world, { kind: 'text', x: victim.x, y: victim.y - 34, life: 1.4, color: '#ffe9a8', text: 'Segunda Chance!' });
  spawnEffect(world, { kind: 'ring', x: victim.x, y: victim.y - 8, radius: 50, life: 0.5, color: '#ffe9a8' });
}

/** Regeneração de escudo, uma vez por passo. */
export function updatePerks(world: World): void {
  for (const p of world.players) {
    if (p.hp <= 0 || p.perks.shieldRegen <= 0) continue;
    if (p.shield < p.maxHp * SHIELD_REGEN_CAP) addShield(p, p.perks.shieldRegen * STEP_S);
  }
}
