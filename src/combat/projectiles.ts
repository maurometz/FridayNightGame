import { MAX_ENEMY_RADIUS, STEP_S } from '../data/balance';
import type { Enemy } from '../entities/enemy';
import { MAX_HIT_MEMORY, type Projectile, type ProjectileKind } from '../entities/projectile';
import type { World } from '../engine/world';
import { onProjectileHit } from '../characters/kitHooks';
import { CHINELO } from '../data/sharedWeapons';
import { damageArea, damageEnemy, knockEnemy, sweepEnemies } from './enemies';
import { wrapAngle } from '../engine/math';
import { healPlayer } from './playerStats';
import { aliadosPerto } from './teamEffects';
import { spawnEffect } from './effects';

export interface ProjectileSpec {
  kind: ProjectileKind;
  x: number;
  y: number;
  /** Direção em radianos. */
  angle: number;
  speed: number;
  damage: number;
  radius: number;
  life: number;
  ownerSlot: number;
  pierce?: number;
  bounces?: number;
  stun?: number;
  homing?: number;
  healOnHit?: number;
  /** Segundos de ida antes de voltar. Se definido, o projétil é um bumerangue. */
  boomerangOut?: number;
  knock?: number;
  markOnHit?: boolean;
  split?: boolean;
  explodeEvery?: number;
  explodeRadius?: number;
  explodeMul?: number;
}

/** Cria um projétil a partir do pool. Devolve null se o limite foi atingido. */
export function spawnProjectile(world: World, s: ProjectileSpec): Projectile | null {
  const pr = world.projectiles.acquire();
  if (!pr) return null;
  pr.kind = s.kind;
  pr.x = s.x;
  pr.y = s.y;
  pr.vx = Math.cos(s.angle) * s.speed;
  pr.vy = Math.sin(s.angle) * s.speed;
  pr.damage = s.damage;
  pr.radius = s.radius;
  pr.life = s.life;
  pr.pierce = s.pierce ?? 0;
  pr.bounces = s.bounces ?? 0;
  pr.stun = s.stun ?? 0;
  pr.homing = s.homing ?? 0;
  pr.healOnHit = s.healOnHit ?? 0;
  pr.boomerang = s.boomerangOut !== undefined;
  pr.outLeft = s.boomerangOut ?? 0;
  pr.returning = false;
  pr.knock = s.knock ?? 0;
  pr.markOnHit = s.markOnHit ?? false;
  pr.split = s.split ?? false;
  pr.explodeEvery = s.explodeEvery ?? 0;
  pr.explodeRadius = s.explodeRadius ?? 0;
  pr.explodeMul = s.explodeMul ?? 1;
  pr.jumpsDone = 0;
  pr.ownerSlot = s.ownerSlot;
  pr.alive = true;
  pr.hitCount = 0;
  return pr;
}

function alreadyHit(p: Projectile, uid: number): boolean {
  const n = Math.min(p.hitCount, MAX_HIT_MEMORY);
  for (let i = 0; i < n; i++) if (p.hitIds[i] === uid) return true;
  return false;
}

function remember(p: Projectile, uid: number): void {
  p.hitIds[p.hitCount % MAX_HIT_MEMORY] = uid;
  p.hitCount++;
}

/** Procura o inimigo vivo mais próximo de `from` dentro de `range`, ignorando os já atingidos e `skip`. */
function nextBounceTarget(world: World, pr: Projectile, from: Enemy, range: number, skip?: Enemy): Enemy | null {
  const near = world.hash.query(from.x, from.y, range, world.scratch);
  let best: Enemy | null = null;
  let bestD2 = Infinity;
  for (const n of near) {
    if (n === from || n === skip || !n.alive || alreadyHit(pr, n.uid)) continue;
    const dx = n.x - from.x;
    const dy = n.y - from.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = n;
    }
  }
  return best;
}

/** Alcance de busca do próximo alvo de um ricochete. */
const BOUNCE_RANGE = 90;

/** Cria uma cópia de `pr` em direção a `target`, com a mesma memória de acertos. */
function splitProjectile(world: World, pr: Projectile, target: Enemy): void {
  const speed = Math.hypot(pr.vx, pr.vy);
  const copy = spawnProjectile(world, {
    kind: pr.kind,
    x: pr.x,
    y: pr.y,
    angle: Math.atan2(target.y - pr.y, target.x - pr.x),
    speed,
    damage: pr.damage,
    radius: pr.radius,
    life: pr.life,
    pierce: pr.pierce,
    bounces: pr.bounces,
    stun: pr.stun,
    explodeEvery: pr.explodeEvery,
    explodeRadius: pr.explodeRadius,
    explodeMul: pr.explodeMul,
    ownerSlot: pr.ownerSlot,
  });
  if (!copy) return;
  copy.jumpsDone = pr.jumpsDone;
  copy.hitCount = pr.hitCount;
  for (let i = 0; i < MAX_HIT_MEMORY; i++) copy.hitIds[i] = pr.hitIds[i]!;
}

/** Move os projéteis, resolve acertos contra o hash de inimigos e libera o que morreu. */
export function updateProjectiles(world: World): void {
  const list = world.projectiles.active;
  const hash = world.hash;

  for (const pr of list) {
    if (pr.boomerang) {
      if (!pr.returning) {
        pr.outLeft -= STEP_S;
        if (pr.outLeft <= 0) {
          // Vira: pode acertar de novo na volta, com mais dano.
          pr.returning = true;
          pr.hitCount = 0;
          pr.damage *= CHINELO.returnMul;
        }
      } else {
        const owner = world.players[pr.ownerSlot];
        if (owner) {
          const dx = owner.x - pr.x;
          const dy = owner.y - 8 - pr.y;
          const d = Math.hypot(dx, dy);
          if (d < 8) {
            pr.alive = false;
            continue;
          }
          const sp = Math.hypot(pr.vx, pr.vy) || CHINELO.speed;
          pr.vx = (dx / d) * sp;
          pr.vy = (dy / d) * sp;
        }
      }
    }
    if (pr.homing > 0) {
      // Míssil teleguiado: gira em direção ao inimigo vivo mais próximo.
      let alvo: Enemy | null = null;
      let melhor = Infinity;
      for (const e of world.enemies.active) {
        if (!e.alive || e.untargetable) continue;
        const d = (e.x - pr.x) ** 2 + (e.y - pr.y) ** 2;
        if (d < melhor) {
          melhor = d;
          alvo = e;
        }
      }
      if (alvo) {
        const atual = Math.atan2(pr.vy, pr.vx);
        const desejado = Math.atan2(alvo.y - pr.y, alvo.x - pr.x);
        const passo = pr.homing * STEP_S;
        const novo = atual + Math.max(-passo, Math.min(passo, wrapAngle(desejado - atual)));
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(novo) * sp;
        pr.vy = Math.sin(novo) * sp;
      }
    }
    pr.x += pr.vx * STEP_S;
    pr.y += pr.vy * STEP_S;
    pr.life -= STEP_S;
    if (pr.life <= 0) {
      pr.alive = false;
      continue;
    }

    const near = hash.query(pr.x, pr.y, pr.radius + MAX_ENEMY_RADIUS + 2, world.scratch);
    for (const e of near) {
      if (!e.alive || alreadyHit(pr, e.uid)) continue;
      const dx = e.x - pr.x;
      const dy = e.y - pr.y;
      const reach = pr.radius + e.def.radius;
      if (dx * dx + dy * dy > reach * reach) continue;

      const owner = world.players[pr.ownerSlot];
      if (pr.stun > 0) e.stun = Math.max(e.stun, pr.stun);
      if (pr.knock > 0) {
        const speed = Math.hypot(pr.vx, pr.vy) || 1;
        knockEnemy(e, pr.vx / speed, pr.vy / speed, pr.knock, pr.ownerSlot);
      }
      if (pr.markOnHit) e.marked = true;
      if (pr.healOnHit > 0 && owner) {
        // Míssil da Constelação Afetiva: cura quem atirou e o aliado mais próximo.
        healPlayer(owner, pr.healOnHit);
        const aliado = aliadosPerto(world, owner, 160)[0];
        if (aliado) healPlayer(aliado, pr.healOnHit);
      }
      onProjectileHit(owner, pr, e);
      damageEnemy(world, e, pr.damage, owner);
      remember(pr, e.uid);

      if (pr.bounces > 0) {
        // Ricochete: muda de rumo para outro inimigo próximo. Sem alvo, o projétil some.
        const next = nextBounceTarget(world, pr, e, BOUNCE_RANGE);
        if (next) {
          const speed = Math.hypot(pr.vx, pr.vy);
          const angle = Math.atan2(next.y - pr.y, next.x - pr.x);
          pr.vx = Math.cos(angle) * speed;
          pr.vy = Math.sin(angle) * speed;
          pr.bounces--;
          pr.jumpsDone++;

          // Explosão a cada N saltos (Mestre da Nota Longa).
          if (pr.explodeEvery > 0 && pr.jumpsDone % pr.explodeEvery === 0) {
            damageArea(world, e.x, e.y, pr.explodeRadius, pr.damage * pr.explodeMul, owner);
            spawnEffect(world, { kind: 'ring', x: e.x, y: e.y, radius: pr.explodeRadius, life: 0.3, color: '#7ad7ff' });
          }

          // Divisão em duas (Referência Cruzada): uma segunda runa vai para outro alvo, uma vez.
          if (pr.split) {
            pr.split = false;
            const other = nextBounceTarget(world, pr, e, BOUNCE_RANGE, next);
            if (other) splitProjectile(world, pr, other);
          }
          break;
        }
        pr.alive = false;
        break;
      }
      if (pr.pierce <= 0) {
        pr.alive = false;
        break;
      }
      pr.pierce--;
    }
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const pr = list[i]!;
    if (!pr.alive) world.projectiles.release(pr);
  }
  sweepEnemies(world);
}
