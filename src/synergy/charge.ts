import {
  COMMITTEE_CHARGE_PER_S,
  COMMITTEE_NEAR_PX,
  COMMITTEE_PER_KILL,
  SYNERGY_CHARGE_PER_DAMAGE,
  SYNERGY_CHARGE_PER_S,
  SYNERGY_MAX,
  SYNERGY_NEAR_PX,
} from '../data/synergy';
import type { Player } from '../entities/player';
import type { World } from '../engine/world';
import type { PairState } from './state';

/** Barra do par formado por dois slots, se existir. */
export function parDe(world: World, i: number, j: number): PairState | undefined {
  const a = Math.min(i, j);
  const b = Math.max(i, j);
  return world.synergy.pairs.find((p) => p.a === a && p.b === b);
}

function distancia(a: Player, b: Player): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Os dois jogadores do par estão vivos e a até `px` um do outro? */
export function parPerto(world: World, par: PairState, px: number): boolean {
  const a = world.players[par.a];
  const b = world.players[par.b];
  return !!a && !!b && a.hp > 0 && b.hp > 0 && distancia(a, b) <= px;
}

/** Os cinco estão vivos e a no máximo 10 tiles entre quaisquer dois? (Só existe no co-op com 5 jogadores.) */
export function comiteProximo(world: World): boolean {
  if (world.players.length !== 5) return false;
  if (world.players.some((p) => p.hp <= 0)) return false;
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      if (distancia(world.players[i]!, world.players[j]!) > COMMITTEE_NEAR_PX) return false;
    }
  }
  return true;
}

/** Carga por tempo: 1% por segundo no par quando os dois estão a até 6 tiles; 0,5% por segundo no Comitê. */
export function carregarPorTempo(world: World, dt: number): void {
  for (const par of world.synergy.pairs) {
    if (parPerto(world, par, SYNERGY_NEAR_PX)) par.bar = Math.min(SYNERGY_MAX, par.bar + SYNERGY_CHARGE_PER_S * dt);
  }
  const c = world.synergy.committee;
  if (c.t < 0 && comiteProximo(world)) c.bar = Math.min(SYNERGY_MAX, c.bar + COMMITTEE_CHARGE_PER_S * dt);
}

/** O jogador causou dano: carrega as barras dos pares dele que estão perto (+0,2% a cada 10 de dano). */
export function onDamageDealt(world: World, dono: Player | undefined, dano: number): void {
  if (!dono || dano <= 0) return;
  for (const par of world.synergy.pairs) {
    if (par.a !== dono.slot && par.b !== dono.slot) continue;
    if (parPerto(world, par, SYNERGY_NEAR_PX)) par.bar = Math.min(SYNERGY_MAX, par.bar + dano * SYNERGY_CHARGE_PER_DAMAGE);
  }
}

/** Abate de um dos cinco, dentro do grupo: +0,1% na barra do Comitê. */
export function onKillSynergy(world: World, dono: Player | undefined): void {
  if (!dono || world.synergy.committee.t >= 0 || !comiteProximo(world)) return;
  const c = world.synergy.committee;
  c.bar = Math.min(SYNERGY_MAX, c.bar + COMMITTEE_PER_KILL);
}
