import { STEP_S } from '../data/balance';
import { WEAPONS } from '../data/weapons';
import type { Enemy } from '../entities/enemy';
import { attackSpeed, type Player } from '../entities/player';
import type { World } from '../engine/world';
import { spawnProjectile } from './projectiles';

/** Inimigo vivo mais próximo de `p` dentro de `range`, ou null. */
export function nearestEnemy(world: World, p: { x: number; y: number }, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestD2 = range * range;
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best;
}

/**
 * Arma genérica: leque no inimigo mais próximo ao fim da recarga.
 * Usada pelos personagens cujo kit próprio ainda não foi implementado.
 */
export function updateGenericWeapon(world: World, p: Player): void {
  const w = WEAPONS[p.weaponId];

  if (p.weaponCd > 0) p.weaponCd -= STEP_S;
  if (p.weaponCd > 0) return;

  const target = nearestEnemy(world, p, w.range);
  if (!target) return; // sem alvo: a arma fica pronta e atira assim que aparecer um

  const count = w.count + p.extraProjectiles;
  const base = Math.atan2(target.y - p.y, target.x - p.x);
  const stepAngle = count > 1 ? w.spread / (count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const ok = spawnProjectile(world, {
      kind: 'note',
      x: p.x,
      y: p.y - 8, // sai da altura do peito, não dos pés
      angle: base + (i - (count - 1) / 2) * stepAngle,
      speed: w.speed,
      damage: w.damage * p.damageMul,
      radius: w.radius,
      life: w.lifetime,
      pierce: w.pierce,
      ownerSlot: p.slot,
    });
    if (!ok) break;
  }
  p.weaponCd = w.cooldown / attackSpeed(p);
}
