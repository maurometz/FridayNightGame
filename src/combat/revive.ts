// Reviver um aliado caído: quem está vivo e fica perto dele por alguns segundos o levanta.
// Enquanto ninguém chega, o caído fica no chão (os inimigos o ignoram) e o progresso vai voltando.

import { STEP_S } from '../data/balance';
import { REVIVE_DECAY, REVIVE_HP_FRACTION, REVIVE_INVULN_S, REVIVE_RADIUS, REVIVE_TIME_S } from '../data/revive';
import type { World } from '../engine/world';
import type { Player } from '../entities/player';
import { spawnEffect } from './effects';

/** Quantos aliados vivos estão perto do caído. */
export function revivedoresPerto(world: World, caido: Player): number {
  let n = 0;
  for (const q of world.players) {
    if (q === caido || q.hp <= 0) continue;
    if (Math.hypot(q.x - caido.x, q.y - caido.y) <= REVIVE_RADIUS) n++;
  }
  return n;
}

/** Levanta o jogador na hora (usado pelo progresso completo e útil para cartas e testes). */
export function reviver(world: World, p: Player): void {
  world.stats.revives++;
  p.hp = p.maxHp * REVIVE_HP_FRACTION;
  p.invuln = Math.max(p.invuln, REVIVE_INVULN_S);
  p.reviveProgress = 0;
  spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 34, life: 1.4, color: '#7DFF8A', text: 'De pé!' });
  spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 8, radius: 36, life: 0.5, color: '#7DFF8A' });
}

/** Uma vez por passo: avança (ou desfaz) o progresso de reviver de cada caído. */
export function updateRevive(world: World): void {
  for (const p of world.players) {
    if (p.hp > 0) {
      p.reviveProgress = 0;
      continue;
    }
    const n = revivedoresPerto(world, p);
    if (n > 0) {
      // Dois aliados juntos revivem na metade do tempo; mais que isso não acelera.
      p.reviveProgress += STEP_S * Math.min(2, n);
      if (p.reviveProgress >= REVIVE_TIME_S) reviver(world, p);
    } else if (p.reviveProgress > 0) {
      p.reviveProgress = Math.max(0, p.reviveProgress - STEP_S * REVIVE_DECAY);
    }
  }
}
