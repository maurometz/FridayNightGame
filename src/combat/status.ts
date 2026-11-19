// Estados temporários dos jogadores que atrapalham (debuffs). Os buffs de aliados continuam em teamEffects.addBuff.
// TDAH: de tempos em tempos o jogador se distrai e anda para um lado qualquer por um instante;
// em compensação, quando está focado ataca um pouco mais rápido.

import type { World } from '../engine/world';
import type { Player } from '../entities/player';
import { STEP_S } from '../data/balance';
import { spawnEffect } from './effects';
import { addBuff } from './teamEffects';

/** Duração de cada distração e intervalo (mínimo + sorteio) entre elas. */
export const TDAH_DISTRACAO_S = 0.6;
export const TDAH_INTERVALO_MIN_S = 2.5;
export const TDAH_INTERVALO_VAR_S = 2;
/** Bônus de velocidade de ataque enquanto está focado. */
export const TDAH_FOCO_ATAQUE = 1.15;

const FRASES = ['Ué?', 'Cadê?', 'Olha um passarinho!', 'Eu ia fazer o quê mesmo?', 'Opa, um doce!'];

/** Liga o TDAH por `segundos` (renova se já tinha). */
export function aplicarTdah(p: Player, segundos: number): void {
  p.tdahLeft = Math.max(p.tdahLeft, segundos);
  if (p.tdahNext <= 0) p.tdahNext = TDAH_INTERVALO_MIN_S;
}

export function updateStatus(world: World): void {
  for (const p of world.players) {
    if (p.tdahLeft <= 0) {
      p.distractedLeft = 0;
      continue;
    }
    if (p.hp <= 0) continue;
    p.tdahLeft = Math.max(0, p.tdahLeft - STEP_S);
    if (p.distractedLeft > 0) {
      p.distractedLeft = Math.max(0, p.distractedLeft - STEP_S);
      continue;
    }
    // Focado: ataca um pouco mais rápido.
    addBuff(p, { id: 'tdahFoco', left: 0.2, attack: TDAH_FOCO_ATAQUE });
    p.tdahNext -= STEP_S;
    if (p.tdahNext <= 0) {
      const a = world.rng.next() * Math.PI * 2;
      p.tdahDx = Math.cos(a);
      p.tdahDy = Math.sin(a);
      p.distractedLeft = TDAH_DISTRACAO_S;
      p.tdahNext = TDAH_INTERVALO_MIN_S + world.rng.next() * TDAH_INTERVALO_VAR_S;
      const frase = FRASES[Math.floor(world.rng.next() * FRASES.length)] ?? FRASES[0]!;
      spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 34, life: 1, color: '#ffd9a0', text: frase });
    }
  }
}
