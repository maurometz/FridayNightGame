import { STEP_S } from '../data/balance';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { clamp, wrapAngle } from '../engine/math';
import { pushOutOfWalls } from '../engine/walls';
import type { World } from '../engine/world';
import { spawnHazard, spawnHostile } from './hostile';
import { expulsarDaZona } from './safeRoom';

// Comportamentos dos inimigos comuns (bestiário, LORE seção 11). Cada um é uma pequena máquina de estados
// guardada em aiState/aiT/aiCd do Enemy. Os chefes ficam em bosses.ts.

/** Valores dos comportamentos. Ajustáveis nos playtests. */
export const AI = {
  abacaxi: { spikes: 8, speed: 80, damage: 6, life: 1.4 },
  azeitona: { orbit: 0.9, orbitDist: 80, pocaEvery: 2.6, pocaRadius: 10, pocaLife: 3, pocaSlowS: 1.2 },
  cafe: { explodeDist: 20, warnS: 0.3, radius: 30, damage: 9 },
  chimarrao: { keepMin: 100, keepMax: 140, cooldown: 2.4, range: 240, speed: 95, damage: 6, life: 3 },
  cachorroquente: { engage: 160, windupS: 0.8, dashS: 0.5, dashSpeed: 230, recoverS: 1.4, cooldown: 1.6, moloEvery: 0.12, moloRadius: 10, moloLife: 2.5, moloSlowS: 1.5 },
  veioloco: { turnEvery: 0.5, gritoEvery: 4, gritoRadius: 70, gritoDamage: 4, gritoSlowS: 1.5, throwEvery: 2.5, throwSpeed: 90, throwDamage: 6 },
  kpopers: { buffEvery: 3, buffRadius: 70, heal: 4, healCapMul: 4 },
  coelho: { vanishS: 0.8, cooldown: 3.2, minDist: 40, maxDist: 70, boostRadius: 70, boostSpeed: 90 },
  canhoto: { flank: 1.2, cooldown: 3, speed: 85, damage: 6, homing: 1.4, life: 3, range: 220 },
} as const;

/** Gira o inimigo em direção a `ang` com a velocidade de giro dele. */
function virar(e: Enemy, ang: number): void {
  const max = e.def.turnRate * STEP_S;
  e.facing += clamp(wrapAngle(ang - e.facing), -max, max);
}

function andar(e: Enemy, velocidade: number): void {
  e.x += Math.cos(e.facing) * velocidade * STEP_S;
  e.y += Math.sin(e.facing) * velocidade * STEP_S;
}

/** Mantém a distância ideal do alvo: aproxima se longe, afasta se perto. Devolve a distância. */
function manterDistancia(e: Enemy, alvo: Player, min: number, max: number, vel: number): number {
  const dx = alvo.x - e.x;
  const dy = alvo.y - e.y;
  const d = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  if (d > max) {
    virar(e, ang);
    andar(e, vel);
  } else if (d < min) {
    e.facing = ang; // continua olhando para o alvo enquanto recua
    e.x -= Math.cos(ang) * vel * 0.6 * STEP_S;
    e.y -= Math.sin(ang) * vel * 0.6 * STEP_S;
  } else {
    virar(e, ang);
  }
  return d;
}

/** Move o inimigo conforme o comportamento dele. `vel` já considera lentidão. */
export function moverInimigo(world: World, e: Enemy, alvo: Player, vel: number): void {
  const dx = alvo.x - e.x;
  const dy = alvo.y - e.y;
  const d = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const dt = STEP_S;

  switch (e.def.behavior) {
    case 'tanque-espinhos': {
      // Lento e resistente: vai direto. Os espinhos saem quando morre (onEnemyDeathEffect).
      virar(e, ang);
      andar(e, vel);
      return;
    }
    case 'enxame-poca': {
      // Enxame: cerca o jogador. Algumas azeitonas deixam poças escorregadias (lentidão) pelo caminho.
      const lado = e.uid % 2 === 0 ? 1 : -1;
      const quanto = clamp(d / AI.azeitona.orbitDist, 0, 1);
      virar(e, ang + lado * AI.azeitona.orbit * quanto);
      andar(e, vel);
      e.aiCd -= dt;
      if (e.aiCd <= 0) {
        e.aiCd = AI.azeitona.pocaEvery + (e.uid % 5) * 0.2;
        if (e.uid % 3 === 0) {
          spawnHazard(world, {
            x: e.x,
            y: e.y,
            radius: AI.azeitona.pocaRadius,
            delay: 0.05,
            life: AI.azeitona.pocaLife,
            damage: 0,
            dps: 0,
            slowFor: AI.azeitona.pocaSlowS,
            color: '#7a8f3a',
          });
        }
      }
      return;
    }
    case 'velocista-explosivo': {
      // Trêmulo e rápido. Ao encostar, explode em calor e cafeína (sem drops).
      virar(e, ang + Math.sin(world.tick * 0.4 + e.uid) * 0.5);
      andar(e, vel);
      if (d < AI.cafe.explodeDist) {
        spawnHazard(world, { x: e.x, y: e.y, radius: AI.cafe.radius, delay: AI.cafe.warnS, damage: AI.cafe.damage, color: '#c97a3a' });
        e.alive = false;
      }
      return;
    }
    case 'atirador-fervente': {
      // Média distância: água fervente e erva-mate.
      const c = AI.chimarrao;
      manterDistancia(e, alvo, c.keepMin, c.keepMax, vel);
      e.aiCd -= dt;
      if (e.aiCd <= 0 && d < c.range) {
        e.aiCd = c.cooldown;
        spawnHostile(world, { kind: 'agua', x: e.x, y: e.y, angle: ang, speed: c.speed, damage: c.damage, radius: 3, life: c.life });
      }
      return;
    }
    case 'investida-molho': {
      // Aproxima, avisa (para e mira), investe em linha reta deixando rastro de molhos e se recupera.
      const m = AI.cachorroquente;
      if (e.aiState === 0) {
        virar(e, ang);
        andar(e, vel);
        e.aiCd -= dt;
        if (d < m.engage && e.aiCd <= 0) {
          e.aiState = 1;
          e.aiT = m.windupS;
          e.aiDir = ang;
          e.facing = ang;
        }
      } else if (e.aiState === 1) {
        e.aiT -= dt; // aviso: parado e mirando
        if (e.aiT <= 0) {
          e.aiState = 2;
          e.aiT = m.dashS;
          e.aiT2 = 0;
        }
      } else if (e.aiState === 2) {
        e.aiT -= dt;
        e.aiT2 -= dt;
        e.facing = e.aiDir;
        andar(e, m.dashSpeed * world.enemySpeedMul);
        if (e.aiT2 <= 0) {
          e.aiT2 = m.moloEvery;
          spawnHazard(world, { x: e.x, y: e.y, radius: m.moloRadius, delay: 0.05, life: m.moloLife, damage: 0, slowFor: m.moloSlowS, color: '#d9462f' });
        }
        if (e.aiT <= 0) {
          e.aiState = 3;
          e.aiT = m.recoverS;
        }
      } else {
        e.aiT -= dt;
        andar(e, vel * 0.3);
        if (e.aiT <= 0) {
          e.aiState = 0;
          e.aiCd = m.cooldown;
        }
      }
      return;
    }
    case 'erratico-grito': {
      // Errático. De vez em quando grita (onda que empurra e atrasa) e arremessa alguma coisa.
      const v = AI.veioloco;
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = v.turnEvery;
        e.facing = world.rng.next() < 0.4 ? ang : world.rng.next() * Math.PI * 2;
      }
      andar(e, vel);
      e.aiCd -= dt;
      if (e.aiCd <= 0) {
        e.aiCd = v.gritoEvery;
        spawnHazard(world, { kind: 'ring', x: e.x, y: e.y, radius: 0, delay: 0.6, expand: 90, maxRadius: v.gritoRadius, thickness: 8, damage: v.gritoDamage, slowFor: v.gritoSlowS, color: '#e8d27a' });
      }
      e.aiT2 -= dt;
      if (e.aiT2 <= 0) {
        e.aiT2 = v.throwEvery;
        spawnHostile(world, { kind: 'pedra', x: e.x, y: e.y, angle: world.rng.next() * Math.PI * 2, speed: v.throwSpeed, damage: v.throwDamage, radius: 3, life: 2 });
      }
      return;
    }
    case 'grupo-lightstick': {
      // Grupo sincronizado: anda junto e, na coreografia, cura/anima os inimigos próximos.
      const k = AI.kpopers;
      virar(e, ang);
      andar(e, vel);
      e.aiCd -= dt;
      if (e.aiCd <= 0) {
        e.aiCd = k.buffEvery;
        for (const o of world.enemies.active) {
          if (!o.alive || o === e || o.def.boss) continue;
          if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > k.buffRadius ** 2) continue;
          o.hp = Math.min(o.def.hp * k.healCapMul, o.hp + k.heal);
        }
      }
      return;
    }
    case 'teleporte-acelera': {
      // Some e reaparece perto do jogador. Ao chegar, empurra os vizinhos para a frente (acelera o ritmo).
      const c = AI.coelho;
      if (e.aiState === 0) {
        virar(e, ang);
        andar(e, vel);
        e.aiCd -= dt;
        if (e.aiCd <= 0) {
          e.aiState = 1;
          e.aiT = c.vanishS;
          e.untargetable = true;
        }
      } else {
        e.aiT -= dt;
        if (e.aiT <= 0) {
          const a = world.rng.next() * Math.PI * 2;
          const r = c.minDist + world.rng.next() * (c.maxDist - c.minDist);
          e.x = alvo.x + Math.cos(a) * r;
          e.y = alvo.y + Math.sin(a) * r;
          e.untargetable = false;
          e.aiState = 0;
          e.aiCd = c.cooldown;
          for (const o of world.enemies.active) {
            if (!o.alive || o === e || o.def.boss) continue;
            if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > c.boostRadius ** 2) continue;
            const aa = Math.atan2(alvo.y - o.y, alvo.x - o.x);
            o.kx += Math.cos(aa) * c.boostSpeed;
            o.ky += Math.sin(aa) * c.boostSpeed;
          }
        }
      }
      return;
    }
    case 'flanqueador-curvo': {
      // Contorna e ataca pelo lado cego com projéteis que curvam.
      const f = AI.canhoto;
      const lado = e.uid % 2 === 0 ? 1 : -1;
      virar(e, ang + lado * f.flank);
      andar(e, vel);
      e.aiCd -= dt;
      if (e.aiCd <= 0 && d < f.range) {
        e.aiCd = f.cooldown;
        spawnHostile(world, { kind: 'pedra', x: e.x, y: e.y, angle: ang - lado * 0.6, speed: f.speed, damage: f.damage, radius: 3, life: f.life, homing: f.homing });
      }
      return;
    }
    default: {
      // Perseguição simples.
      virar(e, ang);
      andar(e, vel);
    }
  }
}

/** Efeitos ao morrer. O abacaxi dispara espinhos em todas as direções. */
export function onEnemyDeathEffect(world: World, e: Enemy): void {
  if (e.def.behavior !== 'tanque-espinhos') return;
  const a = AI.abacaxi;
  for (let i = 0; i < a.spikes; i++) {
    spawnHostile(world, { kind: 'espinho', x: e.x, y: e.y, angle: (i / a.spikes) * Math.PI * 2, speed: a.speed, damage: a.damage, radius: 3, life: a.life });
  }
}

/** Empurra o inimigo para fora das paredes do cenário. */
export function resolverParedes(world: World, e: Enemy): void {
  // Safe Room: os inimigos não entram.
  const z = expulsarDaZona(world, e.x, e.y, e.def.radius);
  if (z.hit) {
    e.x = z.x;
    e.y = z.y;
  }
  if (world.walls.length === 0) return;
  const r = pushOutOfWalls(world.walls, e.x, e.y, e.def.radius);
  if (!r.hit) return;
  e.x = r.x;
  e.y = r.y;
}
