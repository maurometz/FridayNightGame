// Números de dano flutuantes. Só visual: não mexem na simulação nem no RNG dela.
// Golpes seguidos no mesmo alvo (leque de notas, pulsos) somam num número só; o dano contínuo
// nos jogadores (poças, por exemplo) é acumulado e mostrado a cada ~1/3 de segundo.

import { STEP_S } from '../data/balance';
import type { World } from '../engine/world';
import type { Poolable } from '../engine/pool';
import type { Player } from '../entities/player';

export type DamageKind = 'inimigo' | 'critico' | 'jogador';

export interface DamageNumber extends Poolable {
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number;
  kind: DamageKind;
  /** Quem levou o dano (uid do inimigo, ou negativo para jogadores), para somar golpes seguidos. */
  targetId: number;
}

export const MAX_DAMAGE_NUMBERS = 160;
const LIFE_S = 0.75;
const RISE_PX_S = 16;
/** Golpes no mesmo alvo dentro desta janela viram um só número. */
const MERGE_WINDOW_S = 0.12;
/** De quanto em quanto tempo o dano contínuo em jogadores vira número. */
const FLUSH_EVERY_TICKS = 20;

export function createDamageNumber(): DamageNumber {
  return { poolIndex: 0, x: 0, y: 0, value: 0, life: 0, maxLife: LIFE_S, kind: 'inimigo', targetId: 0 };
}

export function showDamage(world: World, x: number, y: number, value: number, kind: DamageKind, targetId: number): void {
  if (!(value > 0)) return;
  for (const n of world.damageNumbers.active) {
    if (n.targetId === targetId && n.maxLife - n.life < MERGE_WINDOW_S) {
      n.value += value;
      if (kind === 'critico') n.kind = 'critico';
      n.y = Math.min(n.y, y);
      return;
    }
  }
  const n = world.damageNumbers.acquire();
  if (!n) return;
  // Desvio horizontal pequeno e determinístico, para números seguidos não ficarem um em cima do outro.
  n.x = x + ((world.tick * 5 + (targetId & 7)) % 9) - 4;
  n.y = y;
  n.value = value;
  n.kind = kind;
  n.targetId = targetId;
  n.life = n.maxLife = kind === 'critico' ? LIFE_S + 0.2 : LIFE_S;
}

const pendente = new WeakMap<Player, number>();

/** Dano num jogador: golpes grandes aparecem na hora; os pequenos e contínuos são acumulados. */
export function showPlayerDamage(world: World, p: Player, amount: number): void {
  const total = (pendente.get(p) ?? 0) + amount;
  if (amount >= 2) {
    pendente.set(p, 0);
    showDamage(world, p.x, p.y - 30, total, 'jogador', -1 - p.slot);
  } else {
    pendente.set(p, total);
  }
}

export function updateDamageNumbers(world: World): void {
  if (world.tick % FLUSH_EVERY_TICKS === 0) {
    for (const p of world.players) {
      const acc = pendente.get(p) ?? 0;
      if (acc > 0.5) {
        pendente.set(p, 0);
        showDamage(world, p.x, p.y - 30, acc, 'jogador', -1 - p.slot);
      }
    }
  }
  const list = world.damageNumbers.active;
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i]!;
    n.life -= STEP_S;
    n.y -= RISE_PX_S * STEP_S;
    if (n.life <= 0) world.damageNumbers.release(n);
  }
}
