import { reduceCooldowns } from '../characters/kitHooks';
import { raioDaAura } from '../characters/thayssaState';
import { BRILHO } from '../data/foods';
import {
  BRILHO_XP,
  GARGALHADA_CHANCE,
  GARGALHADA_XP,
  ENTREGA_XP_SHARE,
  RISADA_COOLDOWN_CUT_S,
  RISADA_SPARKLE_CHANCE,
} from '../data/thayssa';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { World } from '../engine/world';
import { spawnGem } from './gems';
import { spawnFood } from './foods';
import { grantXp } from './leveling';

/** Jogadores vivos a no máximo `radius` de (x, y). */
export function jogadoresNoRaio(world: World, x: number, y: number, radius: number): Player[] {
  const r2 = radius * radius;
  return world.players.filter((a) => a.hp > 0 && (a.x - x) ** 2 + (a.y - y) ** 2 <= r2);
}

/**
 * Passiva Risada Contagiante e cartas ligadas a abates dentro da aura da Thayssa.
 * Chamada quando um inimigo morre.
 */
export function onEnemyKilled(world: World, e: Enemy): void {
  for (const t of world.players) {
    if (t.hp <= 0 || t.kit?.type !== 'thayssa') continue;
    const s = t.kit;
    const radius = raioDaAura(s);
    if ((t.x - e.x) ** 2 + (t.y - e.y) ** 2 > radius * radius) continue;

    const allies = jogadoresNoRaio(world, t.x, t.y, radius);

    // Cada abate na aura reduz a recarga dos aliados na aura.
    for (const a of allies) reduceCooldowns(a, RISADA_COOLDOWN_CUT_S);

    // 10% de chance de soltar um brilho: cura pequena ou gema de XP.
    if (world.rng.next() < RISADA_SPARKLE_CHANCE) {
      if (world.rng.next() < 0.5) spawnFood(world, BRILHO, e.x, e.y);
      else spawnGem(world, e.x, e.y, BRILHO_XP);
    }

    // Gargalhada Perdida: 15% de chance de XP extra.
    if (s.mods.gargalhada && world.rng.next() < GARGALHADA_CHANCE) spawnGem(world, e.x + 4, e.y, GARGALHADA_XP);

    // Entrega Calorosa: aliados na aura recebem 50% do XP do inimigo.
    if (s.mods.entrega) for (const a of allies) grantXp(world, a, e.def.xp * ENTREGA_XP_SHARE);
  }
}
