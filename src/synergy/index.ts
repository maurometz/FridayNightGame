import { spawnEffect } from '../combat/effects';
import { damageEnemy, knockEnemy } from '../combat/enemies';
import { pushMessage } from '../combat/messages';
import { healPlayer } from '../combat/playerStats';
import { onUltimateUsed } from '../combat/teamEffects';
import { STEP_S } from '../data/balance';
import {
  COMMITTEE_PER_PAIR_ULT,
  SAIDEIRA_COOLDOWN_S,
  SAIDEIRA_DURATION_S,
  SAIDEIRA_HEAL_FRACTION,
  SAIDEIRA_INVULN_S,
  SAIDEIRA_LINES,
  SAIDEIRA_PULSE_DAMAGE,
  SAIDEIRA_PULSE_KNOCK,
  SAIDEIRA_PULSE_RADIUS,
  SYNERGY_ACTIVATE_PX,
  SYNERGY_MAX,
  ULT,
  ULTIMATE_COOLDOWN_S,
  ULTIMATE_DURATION_S,
  duplaDe,
  type DuplaDef,
} from '../data/synergy';
import type { Player } from '../entities/player';
import type { World } from '../engine/world';
import { carregarPorTempo, comiteProximo, parDe } from './charge';
import type { ActiveUltimate, PairState } from './state';
import { encerrarUltimate, iniciarUltimate, tickUltimate } from './ultimates';

export { onDamageDealt, onKillSynergy } from './charge';
export { createSynergy } from './state';

/** Uma Ultimate de dupla que o jogador pode usar agora. */
export interface UltimateDisponivel {
  par: PairState;
  parceiro: Player;
  dupla: DuplaDef;
}

function distancia(a: Player, b: Player): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Ultimates de dupla já ativas para um par? */
function emAndamento(world: World, par: PairState): boolean {
  return world.synergy.active.some((u) => u.a === par.a && u.b === par.b);
}

/** Dos pares do jogador, o que pode ser usado agora: barra cheia, recarga zerada e parceiro a até 8 tiles. */
export function ultimateDisponivel(world: World, p: Player): UltimateDisponivel | null {
  let melhor: UltimateDisponivel | null = null;
  let melhorDist = Infinity;
  for (const par of world.synergy.pairs) {
    if (par.a !== p.slot && par.b !== p.slot) continue;
    const parceiro = world.players[par.a === p.slot ? par.b : par.a];
    if (!parceiro || parceiro.hp <= 0) continue;
    if (par.bar < SYNERGY_MAX || par.cooldown > 0 || emAndamento(world, par)) continue;
    const d = distancia(p, parceiro);
    if (d > SYNERGY_ACTIVATE_PX) continue;
    const dupla = duplaDe(p.characterId, parceiro.characterId);
    if (!dupla) continue;
    if (d < melhorDist) {
      melhorDist = d;
      melhor = { par, parceiro, dupla };
    }
  }
  return melhor;
}

/** A Saideira pode ser usada: os cinco vivos e juntos, barra cheia, recarga zerada. */
export function saideiraPronta(world: World): boolean {
  const c = world.synergy.committee;
  return c.t < 0 && c.bar >= SYNERGY_MAX && c.cooldown <= 0 && comiteProximo(world);
}

/** Nome para o HUD de cada par ativo ou carregando. */
export function nomeDaDupla(world: World, par: PairState): string {
  const a = world.players[par.a];
  const b = world.players[par.b];
  return (a && b && duplaDe(a.characterId, b.characterId)?.name) || 'Dupla';
}

function iniciarSaideira(world: World, p: Player): void {
  const c = world.synergy.committee;
  c.bar = 0;
  c.cooldown = SAIDEIRA_COOLDOWN_S;
  c.t = 0;
  for (const q of world.players) q.invuln = Math.max(q.invuln, SAIDEIRA_INVULN_S);
  const fala = SAIDEIRA_LINES[world.rng.int(0, SAIDEIRA_LINES.length - 1)]!;
  pushMessage(world, p.characterId[0]!.toUpperCase() + p.characterId.slice(1), fala, 3.5);
  spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 34, life: 2, color: '#ffe9a8', text: 'SAIDEIRA!' });
  onUltimateUsed(world, p);
}

/**
 * Tenta usar a Ultimate: primeiro a Saideira (se os cinco estão prontos), depois a melhor dupla do jogador.
 * Devolve se algo foi ativado.
 */
export function tryActivateUltimate(world: World, p: Player): boolean {
  if (p.hp <= 0 || world.status !== 'playing') return false;

  if (saideiraPronta(world)) {
    world.stats.saideirasUsed++;
    iniciarSaideira(world, p);
    return true;
  }

  const d = ultimateDisponivel(world, p);
  if (!d) return false;
  d.par.bar = 0;
  d.par.cooldown = ULTIMATE_COOLDOWN_S;
  const u: ActiveUltimate = {
    id: d.dupla.id,
    a: d.par.a,
    b: d.par.b,
    t: 0,
    duration: ULTIMATE_DURATION_S,
    acc: 0,
    angle: 0,
    list: [],
    visited: [],
  };
  world.stats.ultimatesUsed++;
  world.synergy.active.push(u);
  iniciarUltimate(world, u);
  pushMessage(world, '', d.dupla.name, 2.5);
  // Cada Ultimate de dupla usada dá +10% na barra do Comitê.
  if (world.players.length === 5) {
    const c = world.synergy.committee;
    c.bar = Math.min(SYNERGY_MAX, c.bar + COMMITTEE_PER_PAIR_ULT);
  }
  onUltimateUsed(world, p);
  return true;
}

/** Saideira em andamento: 3 s de invulnerabilidade, luzes subindo e, no fim, o pulso de brinde. */
function atualizarSaideira(world: World): void {
  const c = world.synergy.committee;
  if (c.t < 0) return;
  c.t += STEP_S;
  if (c.t < SAIDEIRA_INVULN_S) {
    for (const q of world.players) if (q.hp > 0) q.invuln = Math.max(q.invuln, 0.15);
  }
  if (c.t < SAIDEIRA_DURATION_S) return;

  // Pulso de brinde (luz e som de copos): empurra e causa dano a todos os inimigos da tela e cura 25% do HP.
  c.t = -1;
  const vivos = world.players.filter((q) => q.hp > 0);
  const cx = vivos.reduce((s, q) => s + q.x, 0) / Math.max(1, vivos.length);
  const cy = vivos.reduce((s, q) => s + q.y, 0) / Math.max(1, vivos.length);
  const r = SAIDEIRA_PULSE_RADIUS;
  const credito = vivos[0];
  for (const e of world.enemies.active) {
    if (!e.alive || e.untargetable) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy > (r + e.def.radius) ** 2) continue;
    const d = Math.hypot(dx, dy) || 1;
    knockEnemy(e, dx / d, dy / d, SAIDEIRA_PULSE_KNOCK, credito?.slot ?? 0);
    damageEnemy(world, e, SAIDEIRA_PULSE_DAMAGE, credito);
  }
  for (const q of vivos) healPlayer(q, q.maxHp * SAIDEIRA_HEAL_FRACTION);
  spawnEffect(world, { kind: 'ring', x: cx, y: cy, radius: r, life: 0.7, color: '#ffe9a8' });
  spawnEffect(world, { kind: 'ring', x: cx, y: cy, radius: r * 0.6, life: 0.5, color: '#ffffff' });
  spawnEffect(world, { kind: 'text', x: cx, y: cy - 20, life: 1.5, color: '#ffffff', text: 'Tim-tim!' });
}

/** Passo da sinergia: carga por tempo, recargas, Ultimates em andamento, Saideira, câmera lenta e provocação. */
export function updateSynergy(world: World): void {
  const s = world.synergy;
  carregarPorTempo(world, STEP_S);
  for (const par of s.pairs) if (par.cooldown > 0) par.cooldown = Math.max(0, par.cooldown - STEP_S);
  if (s.committee.cooldown > 0) s.committee.cooldown = Math.max(0, s.committee.cooldown - STEP_S);

  for (let i = s.active.length - 1; i >= 0; i--) {
    const u = s.active[i]!;
    u.t += STEP_S;
    tickUltimate(world, u);
    if (u.t >= u.duration) {
      encerrarUltimate(world, u);
      s.active.splice(i, 1);
    }
  }
  atualizarSaideira(world);

  // Efeitos globais das Ultimates ativas.
  world.enemySpeedMul = s.active.some((u) => u.id === 'pausa') ? ULT.pausa.slow : 1;
  world.decoys.length = 0;
  for (const u of s.active) {
    if (u.id === 'sobremesa') for (const c of u.list) world.decoys.push({ x: c.x, y: c.y, t: ULT.sobremesa.taunt });
  }
}

/** Barra do par entre dois slots (para o HUD). */
export { parDe };
