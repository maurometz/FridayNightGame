import { aberturaDoGolpe, alcanceDoGolpe } from '../characters/thaisaState';
import { PLAYER_INVULN_S, PLAYER_RADIUS, STEP_S } from '../data/balance';
import type { Hazard, HazardKind } from '../entities/hazard';
import type { Hostile, HostileKind } from '../entities/hostile';
import type { Player } from '../entities/player';
import { onPlayerHit } from '../characters/kitHooks';
import { wrapAngle } from '../engine/math';
import type { World } from '../engine/world';
import { spawnEffect } from './effects';
import { damagePlayer } from './playerStats';
import { hitPlayer } from './teamEffects';

export interface HazardSpec {
  kind?: HazardKind;
  x: number;
  y: number;
  radius: number;
  /** Segundos de aviso antes de causar dano. */
  delay: number;
  /** Segundos que continua no chão depois do impacto. */
  life?: number;
  damage?: number;
  dps?: number;
  slowFor?: number;
  expand?: number;
  maxRadius?: number;
  thickness?: number;
  /** Empurrão no impacto (ver Hazard.push). */
  push?: number;
  pushS?: number;
  color?: string;
  /** Imagem animada do aviso (ver Hazard.sprite). */
  sprite?: string;
}

/** Cria um perigo no chão (aviso, depois dano). Devolve null se o limite foi atingido. */
export function spawnHazard(world: World, s: HazardSpec): Hazard | null {
  const h = world.hazards.acquire();
  if (!h) return null;
  h.kind = s.kind ?? 'circle';
  h.x = s.x;
  h.y = s.y;
  h.radius = s.radius;
  h.delay = s.delay;
  h.warnTotal = s.delay;
  h.life = s.life ?? 0;
  h.damage = s.damage ?? 0;
  h.dps = s.dps ?? 0;
  h.slowFor = s.slowFor ?? 0;
  h.expand = s.expand ?? 0;
  h.maxRadius = s.maxRadius ?? s.radius;
  h.thickness = s.thickness ?? 8;
  h.push = s.push ?? 0;
  h.pushS = s.pushS ?? 0;
  h.color = s.color ?? '#ff5a5a';
  h.sprite = s.sprite ?? '';
  h.active = false;
  h.alive = true;
  h.hit.length = 0;
  return h;
}

export interface HostileSpec {
  kind: HostileKind;
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  radius?: number;
  life: number;
  homing?: number;
}

/** Cria um projétil inimigo. */
export function spawnHostile(world: World, s: HostileSpec): Hostile | null {
  const p = world.hostiles.acquire();
  if (!p) return null;
  p.kind = s.kind;
  p.x = s.x;
  p.y = s.y;
  p.speed = s.speed;
  p.vx = Math.cos(s.angle) * s.speed;
  p.vy = Math.sin(s.angle) * s.speed;
  p.damage = s.damage;
  p.radius = s.radius ?? 3;
  p.life = s.life;
  p.homing = s.homing ?? 0;
  p.alive = true;
  return p;
}

/** Dano de perigo ou projétil em um jogador, respeitando a invulnerabilidade curta. Devolve se acertou. */
function machucar(world: World, p: Player, damage: number): boolean {
  if (p.hp <= 0 || p.invuln > 0 || damage <= 0) return false;
  hitPlayer(world, p, damage);
  p.invuln = PLAYER_INVULN_S;
  onPlayerHit(p);
  return true;
}

/** Perigos no chão: aviso, impacto e (poças, multas, ondas) persistência. */
export function updateHazards(world: World): void {
  const list = world.hazards.active;
  for (const h of list) {
    if (!h.active) {
      h.delay -= STEP_S;
      if (h.delay > 0) continue;
      h.active = true;
      if (h.kind === 'circle') {
        for (const p of world.players) {
          if (p.hp <= 0) continue;
          if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 > (h.radius + PLAYER_RADIUS) ** 2) continue;
          machucar(world, p, h.damage);
          if (h.slowFor > 0) p.slowLeft = Math.max(p.slowLeft, h.slowFor);
          if (h.push !== 0) {
            // Empurrão para longe do centro (ou puxão para o centro, se negativo). Vale mesmo com a invulnerabilidade curta.
            const dx = p.x - h.x;
            const dy = p.y - h.y;
            const d = Math.hypot(dx, dy) || 1;
            p.forcedMove = { vx: (dx / d) * h.push, vy: (dy / d) * h.push, left: h.pushS > 0 ? h.pushS : 0.3 };
          }
        }
        spawnEffect(world, { kind: 'ring', x: h.x, y: h.y, radius: h.radius, life: 0.25, color: h.color });
        if (h.life <= 0) h.alive = false;
      }
      continue;
    }

    if (h.kind === 'circle') {
      h.life -= STEP_S;
      for (const p of world.players) {
        if (p.hp <= 0) continue;
        if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 > (h.radius + PLAYER_RADIUS) ** 2) continue;
        if (h.dps > 0) damagePlayer(p, h.dps * STEP_S, world);
        if (h.slowFor > 0) p.slowLeft = Math.max(p.slowLeft, h.slowFor);
      }
      if (h.life <= 0) h.alive = false;
    } else {
      // Onda: anel que se expande e machuca uma vez quem ele cruza.
      h.radius += h.expand * STEP_S;
      for (const p of world.players) {
        if (p.hp <= 0 || h.hit.includes(p.slot)) continue;
        const d = Math.hypot(p.x - h.x, p.y - h.y);
        if (Math.abs(d - h.radius) <= h.thickness / 2 + PLAYER_RADIUS) {
          h.hit.push(p.slot);
          machucar(world, p, h.damage);
        }
      }
      if (h.radius >= h.maxRadius) h.alive = false;
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const h = list[i]!;
    if (!h.alive) world.hazards.release(h);
  }
}

/** A Thaisa com Fortaleza Acústica bloqueia projéteis inimigos enquanto o arco está ativo. */
function bloqueadoPelaThaisa(world: World, h: Hostile): Player | null {
  for (const t of world.players) {
    const k = t.kit;
    if (t.hp <= 0 || k?.type !== 'thaisa' || !k.mods.fortaleza || k.blockLeft <= 0) continue;
    const dx = h.x - t.x;
    const dy = h.y - (t.y - 8);
    if (Math.hypot(dx, dy) > alcanceDoGolpe(k) + h.radius) continue;
    if (Math.abs(wrapAngle(Math.atan2(dy, dx) - k.aim)) <= aberturaDoGolpe(k) / 2) return t;
  }
  return null;
}

/** Projéteis inimigos: andam (alguns seguem o jogador), acertam jogadores e podem ser bloqueados. */
export function updateHostiles(world: World): void {
  const list = world.hostiles.active;
  for (const h of list) {
    if (h.homing > 0) {
      let alvo: Player | null = null;
      let melhor = Infinity;
      for (const p of world.players) {
        if (p.hp <= 0) continue;
        const d = (p.x - h.x) ** 2 + (p.y - h.y) ** 2;
        if (d < melhor) {
          melhor = d;
          alvo = p;
        }
      }
      if (alvo) {
        const atual = Math.atan2(h.vy, h.vx);
        const desejado = Math.atan2(alvo.y - h.y, alvo.x - h.x);
        const passo = h.homing * STEP_S;
        const novo = atual + Math.max(-passo, Math.min(passo, wrapAngle(desejado - atual)));
        h.vx = Math.cos(novo) * h.speed;
        h.vy = Math.sin(novo) * h.speed;
      }
    }
    h.x += h.vx * STEP_S * world.enemySpeedMul;
    h.y += h.vy * STEP_S * world.enemySpeedMul;
    h.life -= STEP_S;
    if (h.life <= 0) {
      h.alive = false;
      continue;
    }
    const bloqueou = bloqueadoPelaThaisa(world, h);
    if (bloqueou) {
      h.alive = false;
      spawnEffect(world, { kind: 'ring', x: h.x, y: h.y, radius: 8, life: 0.2, color: '#ffe08a' });
      continue;
    }
    for (const p of world.players) {
      if (p.hp <= 0) continue;
      if ((p.x - h.x) ** 2 + (p.y - 8 - h.y) ** 2 > (h.radius + PLAYER_RADIUS) ** 2) continue;
      if (machucar(world, p, h.damage)) {
        h.alive = false;
        break;
      }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const h = list[i]!;
    if (!h.alive) world.hostiles.release(h);
  }
}
