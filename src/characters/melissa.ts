import { damageArea, damageEnemy } from '../combat/enemies';
import { addBuff, aliadosPerto, onGroupSpotHit } from '../combat/teamEffects';
import { ENTRADA_AREA, ENTRADA_DAMAGE, ENTRADA_RADIUS, PASSE_RANGE, PASSE_S, TORCIDA_BONUS, TORCIDA_RADIUS } from '../data/team';
import { spawnEffect } from '../combat/effects';
import { healPlayer } from '../combat/playerStats';
import { nearestEnemy } from '../combat/weapons';
import { STEP_S } from '../data/balance';
import {
  ATRASADA_HOLD_S,
  ATRASADA_MIN_CLOSING_PX,
  ATRASADA_SPEED_MUL,
  BIS_WINDOW_S,
  BURST_DURATION_S,
  BURST_SPEED_MUL,
  CAMERA_EXTRA_S,
  CRIT_MUL,
  FANCAM_ARC_DEG,
  FANCAM_BLIND_S,
  FANCAM_COOLDOWN_S,
  FANCAM_RANGE,
  FANDOM_CRIT,
  FANDOM_RADIUS,
  FLORETE_ARC_DEG,
  FLORETE_COOLDOWN_S,
  FLORETE_DAMAGE,
  FLORETE_REACH,
  HOLOFOTE_DURATION_S,
  HOLOFOTE_RANGE,
  INVESTIDA_COOLDOWN_S,
  INVESTIDA_DAMAGE,
  INVESTIDA_DISTANCE,
  INVESTIDA_DURATION_S,
  INVESTIDA_HIT_RADIUS,
  LIGHTSTICK_REACH_MUL,
  PROTAGONISTA_CRIT_MUL,
  PROTAGONISTA_DURATION_S,
  PROTAGONISTA_INVULN_S,
  REACAO_COOLDOWN_S,
  REACAO_DAMAGE,
  REACAO_RADIUS,
  REACAO_STUN_S,
  ROTINA_EVERY_HITS,
  SHOW_DAMAGE,
  SHOW_RADIUS,
} from '../data/melissa';
import type { Enemy } from '../entities/enemy';
import { attackSpeed, type Player } from '../entities/player';
import type { PlayerInput } from '../engine/input';
import { inBackArc, wrapAngle } from '../engine/math';
import type { World } from '../engine/world';
import type { MelissaState } from './melissaState';

const DEG = Math.PI / 180;

export { inBackArc };

export function alcanceDoFlorete(s: MelissaState): number {
  return FLORETE_REACH * (s.mods.lightstick ? LIGHTSTICK_REACH_MUL : 1);
}

export function multiplicadorDeCritico(s: MelissaState): number {
  return (s.protagonistaLeft > 0 ? PROTAGONISTA_CRIT_MUL : CRIT_MUL) + (s.mods.closeUp ? 0.5 : 0);
}

/** Dispara a Reação Exagerada: onda que atordoa e causa dano ao redor. */
function reacaoExagerada(world: World, p: Player, s: MelissaState): void {
  damageArea(world, p.x, p.y - 8, REACAO_RADIUS, REACAO_DAMAGE * p.damageMul, p, REACAO_STUN_S);
  spawnEffect(world, { kind: 'ring', x: p.x, y: p.y - 8, radius: REACAO_RADIUS, life: 0.35, color: '#ff4d8d' });
  spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 30, life: 1, color: '#ff9ec4', text: 'Reação Exagerada!' });
  if (s.mods.protagonista) {
    s.protagonistaLeft = PROTAGONISTA_DURATION_S;
    p.invuln = Math.max(p.invuln, PROTAGONISTA_INVULN_S);
  }
}

/**
 * Golpe da Melissa num inimigo. Se o inimigo tem Holofote e ela está nas costas dele,
 * é crítico (x2, ou x3 com a Síndrome), consome o Holofote e dá explosão de velocidade.
 */
export function acertarInimigo(world: World, p: Player, s: MelissaState, e: Enemy, baseDamage: number): boolean {
  let damage = baseDamage;
  let crit = false;
  if (e.spot > 0 && inBackArc(e.facing, e.x, e.y, p.x, p.y)) {
    crit = true;
    damage *= multiplicadorDeCritico(s);
    e.spot = 0;
    s.burstLeft = BURST_DURATION_S + (s.mods.afterparty ? 1.5 : 0);
    s.spotHits++;
    // Passe de Bastidores: cada Holofote acertado cura; Autógrafo no Ato atordoa.
    if (s.mods.backstage) healPlayer(p, 4);
    if (s.mods.autografo) e.stun = Math.max(e.stun, 1);
    // Investida do Encore: acertar um Holofote reseta a recarga do avanço.
    if (s.mods.investida) s.dashCd = 0;
    // Rotina de Fim de Semana: a cada 3 Holofotes, uma Reação Exagerada sem recarga.
    if (s.mods.rotina && s.spotHits % ROTINA_EVERY_HITS === 0) s.reacaoFree = true;
    // Show Inesperado: o primeiro Holofote de cada inimigo explode em luz.
    if (s.mods.showInesperado && !e.spotUsed) {
      damageArea(world, e.x, e.y, SHOW_RADIUS, SHOW_DAMAGE * p.damageMul, p);
      spawnEffect(world, { kind: 'ring', x: e.x, y: e.y, radius: SHOW_RADIUS, life: 0.3, color: '#fff3a0' });
    }
    e.spotUsed = true;
    spawnEffect(world, { kind: 'text', x: e.x, y: e.y - 14, life: 0.6, color: '#7ad7ff', text: 'CRÍTICO' });
    // Passe de Holofote: um aliado ganha crítico em outro inimigo próximo por 3 s.
    if (s.mods.passe) {
      const other = nearestEnemyExcept(world, e, PASSE_RANGE);
      if (other) {
        other.passeLeft = PASSE_S;
        other.passeOwner = p.slot;
      }
    }
    // Coreografia de Grupo: conta para os Holofotes do grupo.
    onGroupSpotHit(world);
  }
  damageEnemy(world, e, damage, p);
  return crit;
}

/** Inimigo vivo mais próximo de `from`, ignorando o próprio, dentro de `range`. */
function nearestEnemyExcept(world: World, from: Enemy, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestD2 = range * range;
  for (const n of world.enemies.active) {
    if (!n.alive || n === from) continue;
    const d2 = (n.x - from.x) ** 2 + (n.y - from.y) ** 2;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = n;
    }
  }
  return best;
}

/** Coloca Holofotes (nas costas) nos inimigos mais próximos que ainda não têm um. */
function colocarHolofotes(world: World, p: Player, s: MelissaState): void {
  const count = s.mods.extraHolofote ? 2 : 1;
  const duration = HOLOFOTE_DURATION_S + (s.mods.camera ? CAMERA_EXTRA_S : 0);
  const r2 = HOLOFOTE_RANGE * HOLOFOTE_RANGE;
  for (let n = 0; n < count; n++) {
    let best: Enemy | null = null;
    let bestD2 = r2;
    for (const e of world.enemies.active) {
      if (!e.alive || e.spot > 0) continue;
      const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    if (!best) return;
    best.spot = duration;
  }
}

function golpeDeFlorete(world: World, p: Player, s: MelissaState, angle: number): void {
  const reach = alcanceDoFlorete(s);
  const half = (FLORETE_ARC_DEG * DEG) / 2;
  const damage = FLORETE_DAMAGE * p.damageMul;
  const oy = p.y - 8;
  // Copia a lista: acertar pode matar e liberar inimigos só no fim do passo, então é seguro iterar.
  for (const e of world.enemies.active) {
    if (!e.alive) continue;
    const dx = e.x - p.x;
    const dy = e.y - oy;
    const dist = Math.hypot(dx, dy);
    if (dist > reach + e.def.radius) continue;
    const off = Math.abs(wrapAngle(Math.atan2(dy, dx) - angle));
    if (off > half && dist > e.def.radius + 6) continue;
    acertarInimigo(world, p, s, e, damage);
  }
  spawnEffect(world, { kind: 'arc', x: p.x, y: oy, radius: reach, angle, halfArc: half, life: 0.16, color: '#7ad7ff', sprite: 'melissaArco' });
  colocarHolofotes(world, p, s);
}

function iniciarInvestida(world: World, p: Player, s: MelissaState, input: PlayerInput): void {
  let dx = input.moveX;
  let dy = input.moveY;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    dx = p.facing;
    dy = 0;
  } else {
    dx /= len;
    dy /= len;
  }
  s.dashDirX = dx;
  s.dashDirY = dy;
  s.dashLeft = INVESTIDA_DURATION_S;
  s.dashHits.length = 0;

  // Entrada Sincronizada: um aliado a até 4 tiles avança junto, e os dois causam dano em área.
  if (s.mods.entrada) {
    const ally = aliadosPerto(world, p, ENTRADA_RADIUS)[0];
    if (ally) {
      const speed = INVESTIDA_DISTANCE / INVESTIDA_DURATION_S;
      ally.forcedMove = { vx: dx * speed, vy: dy * speed, left: INVESTIDA_DURATION_S };
      for (const who of [p, ally]) {
        damageArea(world, who.x, who.y - 8, ENTRADA_AREA, ENTRADA_DAMAGE * p.damageMul, p);
        spawnEffect(world, { kind: 'ring', x: who.x, y: who.y - 8, radius: ENTRADA_AREA, life: 0.3, color: '#7ad7ff' });
      }
    }
  }
  if (s.bisReady) {
    // Segundo avanço gratuito (Bis de Coreografia).
    s.bisReady = false;
    s.bisWindow = 0;
    s.dashIsBis = true;
  } else {
    s.dashIsBis = false;
    s.dashCd = INVESTIDA_COOLDOWN_S;
  }
}

function andarNaInvestida(world: World, p: Player, s: MelissaState): void {
  const speed = INVESTIDA_DISTANCE / INVESTIDA_DURATION_S;
  p.x += s.dashDirX * speed * STEP_S;
  p.y += s.dashDirY * speed * STEP_S;
  p.moving = true;
  for (const e of world.enemies.active) {
    if (!e.alive || s.dashHits.includes(e.uid)) continue;
    const reach = INVESTIDA_HIT_RADIUS + e.def.radius;
    if ((e.x - p.x) ** 2 + (e.y - (p.y - 8)) ** 2 > reach * reach) continue;
    s.dashHits.push(e.uid);
    acertarInimigo(world, p, s, e, INVESTIDA_DAMAGE * p.damageMul);
  }
  s.dashLeft -= STEP_S;
  if (s.dashLeft <= 0) {
    s.dashLeft = 0;
    // Bis de Coreografia: depois do primeiro avanço, abre a janela do segundo.
    if (s.mods.bis && !s.dashIsBis) {
      s.bisReady = true;
      s.bisWindow = BIS_WINDOW_S;
    }
  }
}

function aliadoMaisProximo(world: World, p: Player): number {
  let best = Infinity;
  for (const o of world.players) {
    if (o === p || o.hp <= 0) continue;
    best = Math.min(best, Math.hypot(o.x - p.x, o.y - p.y));
  }
  return best === Infinity ? -1 : best;
}

export function updateMelissa(world: World, p: Player, input: PlayerInput): void {
  const s = p.kit;
  if (!s || s.type !== 'melissa') return;
  const dt = STEP_S;

  // Temporizadores.
  if (s.cd > 0) s.cd -= dt;
  if (s.reacaoCd > 0) s.reacaoCd -= dt;
  if (s.dashCd > 0) s.dashCd -= dt;
  if (s.fancamCd > 0) s.fancamCd -= dt;
  if (s.coberturaCd > 0) s.coberturaCd -= dt;
  if (s.burstLeft > 0) s.burstLeft -= dt;
  if (s.protagonistaLeft > 0) s.protagonistaLeft -= dt;
  if (s.bisWindow > 0) {
    s.bisWindow -= dt;
    if (s.bisWindow <= 0) s.bisReady = false;
  }

  // Atrasada com Estilo: +25% de velocidade enquanto se aproxima de um aliado.
  const ally = aliadoMaisProximo(world, p);
  if (ally >= 0 && s.prevAllyDist >= 0 && s.prevAllyDist - ally > ATRASADA_MIN_CLOSING_PX) s.approachLeft = ATRASADA_HOLD_S;
  s.prevAllyDist = ally;
  if (s.approachLeft > 0) s.approachLeft -= dt;
  p.kitSpeedMul = (s.burstLeft > 0 ? BURST_SPEED_MUL : 1) * (s.approachLeft > 0 ? ATRASADA_SPEED_MUL : 1);

  // Torcida Organizada: aliados perto ganham +5% de velocidade de ataque.
  if (s.mods.torcida) {
    for (const a of aliadosPerto(world, p, TORCIDA_RADIUS)) {
      addBuff(a, { id: `torcida${p.slot}`, left: 0.2, attack: 1 + TORCIDA_BONUS });
    }
  }

  // Fandom Organizado: aliados perto ganham +5% de crítico.
  if (s.mods.fandom) {
    for (const o of world.players) {
      if (o === p || o.hp <= 0) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) <= FANDOM_RADIUS) o.auraCrit += FANDOM_CRIT;
    }
  }

  // Reação Exagerada: ao sofrer dano (12 s de recarga) ou grátis pela Rotina de Fim de Semana.
  if (s.reacaoFree) {
    s.reacaoFree = false;
    reacaoExagerada(world, p, s);
  }
  if (s.reacaoPending) {
    s.reacaoPending = false;
    if (s.reacaoCd <= 0) {
      s.reacaoCd = REACAO_COOLDOWN_S;
      reacaoExagerada(world, p, s);
    }
  }

  // Investida do Encore (tecla de ação).
  if (input.action && !s.prevAction && s.mods.investida && s.dashLeft <= 0 && (s.dashCd <= 0 || s.bisReady)) {
    iniciarInvestida(world, p, s, input);
  }
  s.prevAction = input.action;
  if (s.dashLeft > 0) andarNaInvestida(world, p, s);

  // Flash de Fancam: cone que desorienta os inimigos à frente.
  if (s.mods.fancam && s.fancamCd <= 0) {
    const target = nearestEnemy(world, p, FANCAM_RANGE);
    if (target) {
      const angle = Math.atan2(target.y - (p.y - 8), target.x - p.x);
      const half = (FANCAM_ARC_DEG * DEG) / 2;
      for (const e of world.enemies.active) {
        if (!e.alive) continue;
        const dx = e.x - p.x;
        const dy = e.y - (p.y - 8);
        if (Math.hypot(dx, dy) > FANCAM_RANGE + e.def.radius) continue;
        if (Math.abs(wrapAngle(Math.atan2(dy, dx) - angle)) <= half) e.blind = FANCAM_BLIND_S;
      }
      spawnEffect(world, {
        kind: 'beam',
        x: p.x,
        y: p.y - 8,
        x2: p.x + Math.cos(angle) * FANCAM_RANGE,
        y2: p.y - 8 + Math.sin(angle) * FANCAM_RANGE,
        life: 0.2,
        color: '#ffffff',
      });
      s.fancamCd = FANCAM_COOLDOWN_S;
    }
  }

  // Golpe de florete no inimigo mais próximo ao alcance.
  if (s.cd > 0 || s.dashLeft > 0) return;
  const reach = alcanceDoFlorete(s);
  const target = nearestEnemy(world, p, reach + 8);
  if (!target) return;
  golpeDeFlorete(world, p, s, Math.atan2(target.y - (p.y - 8), target.x - p.x));
  s.cd = FLORETE_COOLDOWN_S / attackSpeed(p);
}
