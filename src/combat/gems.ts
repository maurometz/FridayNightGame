import { GEM_COLLECT_DIST, GEM_MAGNET_SPEED, STEP_S } from '../data/balance';
import { pickupRadius, type Player } from '../entities/player';
import type { World } from '../engine/world';
import { grantXp } from './leveling';

export function spawnGem(world: World, x: number, y: number, xp: number): boolean {
  const g = world.gems.acquire();
  if (!g) return false;
  g.x = x;
  g.y = y;
  g.xp = xp;
  g.magnet = false;
  g.alive = true;
  return true;
}

/** Atrai e coleta gemas. Quem coleta recebe o XP (ou Salgadinhos, depois do nível máximo). */
export function updateGems(world: World): void {
  const list = world.gems.active;

  for (const g of list) {
    let target: Player | null = null;
    let bestD2 = Infinity;
    for (const p of world.players) {
      if (p.hp <= 0) continue;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        target = p;
      }
    }
    if (!target) continue;

    const dist = Math.sqrt(bestD2);
    if (!g.magnet && dist <= pickupRadius(target)) g.magnet = true;
    if (!g.magnet) continue;

    if (dist <= GEM_COLLECT_DIST) {
      grantXp(world, target, g.xp);
      g.alive = false;
      continue;
    }
    const step = Math.min(dist, GEM_MAGNET_SPEED * STEP_S);
    g.x += ((target.x - g.x) / dist) * step;
    g.y += ((target.y - g.y) / dist) * step;
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const g = list[i]!;
    if (!g.alive) world.gems.release(g);
  }
}
