import { damageArea, damageEnemy } from '../combat/enemies';
import { addBuff, aliadosPerto } from '../combat/teamEffects';
import {
  CITACAO_LEVEL,
  CITACAO_MUL,
  INDICE_BONUS,
  INDICE_KILLS_PER_STEP,
  INDICE_MAX,
  TRABALHO_DAMAGE,
  TRABALHO_RANGE,
  TRABALHO_S,
} from '../data/team';
import { spawnProjectile } from '../combat/projectiles';
import { nearestEnemy } from '../combat/weapons';
import { STEP_S } from '../data/balance';
import {
  ECO_RADIUS,
  EDICAO_REGEN_BONUS,
  ENCICLOPEDIA_PER_LEVEL,
  FOCO_REGEN_PER_S,
  JUMPS_BASE,
  JUMPS_MAX,
  KILLS_PER_JUMP,
  KILLS_PER_STEP,
  MESTRE_DAMAGE_MUL,
  MESTRE_EVERY_JUMPS,
  MESTRE_RADIUS,
  NOTA_BASE_DAMAGE,
  NOTA_COOLDOWN_S,
  NOTA_COST,
  NOTA_COST_PE_DE_PAGINA,
  NOTA_LIFETIME_S,
  NOTA_RADIUS,
  NOTA_RANGE,
  NOTA_SPEED,
  ORBITA_BOOKS,
  ORBITA_DAMAGE,
  ORBITA_HIT_COOLDOWN_S,
  ORBITA_HIT_RADIUS,
  ORBITA_PUSH_PX,
  ORBITA_RADIUS,
  ORBITA_SPEED,
  PERFEITA_MAX,
  PERFEITA_PER_S,
  SALA_BONUS,
  SALA_STILL_S,
  SOBRECARGA_MAX,
  SOBRECARGA_STEP,
  SOFTCAP_FACTOR,
  SOFTCAP_KILLS,
  STEP_BONUS,
} from '../data/mauro';
import { attackSpeed, type Player } from '../entities/player';
import type { World } from '../engine/world';
import { focoMax } from './kitHooks';
import type { MauroState } from './mauroState';

/**
 * Bônus de dano por Conhecimento (abates). +10% a cada 100 abates.
 * Depois de 500 abates o ganho por degrau cai à metade (soft cap).
 */
export function conhecimentoBonus(kills: number): number {
  const steps = Math.floor(Math.max(0, kills) / KILLS_PER_STEP);
  const capSteps = Math.floor(SOFTCAP_KILLS / KILLS_PER_STEP);
  const before = Math.min(steps, capSteps);
  const after = Math.max(0, steps - capSteps);
  return before * STEP_BONUS + after * STEP_BONUS * SOFTCAP_FACTOR;
}

/** Saltos base por abates: 3 + 1 a cada 200 abates, no máximo 8. */
export function saltosPorConhecimento(kills: number): number {
  return Math.min(JUMPS_MAX, JUMPS_BASE + Math.floor(Math.max(0, kills) / KILLS_PER_JUMP));
}

/** Recordação Perfeita: +0,5% por segundo sem dano, teto de +50%. */
export function recordacaoPerfeita(safeSeconds: number): number {
  return 1 + Math.min(PERFEITA_MAX, PERFEITA_PER_S * Math.max(0, safeSeconds));
}

/** Dano de uma Nota de Rodapé agora, somando todos os bônus. */
export function danoDaNota(p: Player, s: MauroState): number {
  const flat = s.mods.enciclopedia ? ENCICLOPEDIA_PER_LEVEL * p.level : 0;
  const sobrecarga = s.mods.sobrecarga ? Math.min(SOBRECARGA_MAX, SOBRECARGA_STEP * Math.floor(p.kills / KILLS_PER_STEP)) : 0;
  // Bibliografia Compartilhada: no nível 20, as Notas viram "Citação" e batem mais forte.
  const citacao = s.mods.biblioColetiva && p.level >= CITACAO_LEVEL ? CITACAO_MUL : 1;
  return (
    (NOTA_BASE_DAMAGE + flat) *
    p.damageMul *
    (1 + conhecimentoBonus(p.kills)) *
    (1 + sobrecarga) *
    recordacaoPerfeita(s.safeTime) *
    citacao
  );
}

export function custoDaNota(s: MauroState): number {
  return s.mods.peDePagina ? NOTA_COST_PE_DE_PAGINA : NOTA_COST;
}

export function regenDeFoco(s: MauroState): number {
  let r = FOCO_REGEN_PER_S + (s.mods.edicao ? EDICAO_REGEN_BONUS : 0) + (s.mods.fichamento ? 1.5 : 0);
  if (s.mods.sala && s.stillTime >= SALA_STILL_S) r *= 1 + SALA_BONUS;
  return r;
}

/** Posição de cada livro da Órbita de Clássicos. */
export function posicaoDoLivro(p: Player, s: MauroState, i: number): { x: number; y: number } {
  const a = s.orbitAngle + (i * Math.PI * 2) / ORBITA_BOOKS;
  return { x: p.x + Math.cos(a) * ORBITA_RADIUS, y: p.y - 8 + Math.sin(a) * ORBITA_RADIUS };
}

function fireNota(world: World, p: Player, s: MauroState, angle: number): void {
  // Trabalho em Grupo: uma runa por ataque pula para um aliado, que ganha +10% de dano por 3 s.
  if (s.mods.trabalho) {
    const ally = aliadosPerto(world, p, TRABALHO_RANGE)[0];
    if (ally) addBuff(ally, { id: `trabalho${p.slot}`, left: TRABALHO_S, damage: TRABALHO_DAMAGE });
  }
  const k = p.kills;
  let jumps = saltosPorConhecimento(k);
  // Bibliografia Comentada: as cargas acumuladas viram saltos extras (respeitando o máximo).
  if (s.jumpCharges > 0) {
    jumps = Math.min(JUMPS_MAX, jumps + s.jumpCharges);
    s.jumpCharges = 0;
  }
  spawnProjectile(world, {
    kind: 'runa',
    x: p.x,
    y: p.y - 8,
    angle,
    speed: NOTA_SPEED,
    damage: danoDaNota(p, s),
    radius: NOTA_RADIUS,
    life: NOTA_LIFETIME_S,
    bounces: jumps,
    split: s.mods.referencia,
    explodeEvery: s.mods.mestre ? MESTRE_EVERY_JUMPS : 0,
    explodeRadius: MESTRE_RADIUS,
    explodeMul: MESTRE_DAMAGE_MUL,
    ownerSlot: p.slot,
  });
}

export function updateMauro(world: World, p: Player): void {
  const s = p.kit;
  if (!s || s.type !== 'mauro') return;
  const dt = STEP_S;

  // Foco, parado e Recordação Perfeita.
  // Índice Coletivo: a cada 100 abates do grupo, +5% de dano para todos (teto +50%).
  if (s.mods.indiceColetivo) {
    const total = world.players.reduce((n, q) => n + q.kills, 0);
    const bonus = Math.min(INDICE_MAX, INDICE_BONUS * Math.floor(total / INDICE_KILLS_PER_STEP));
    if (bonus > 0) for (const q of world.players) addBuff(q, { id: 'indiceColetivo', left: 0.2, damage: 1 + bonus });
  }

  s.foco = Math.min(focoMax(s), s.foco + regenDeFoco(s) * dt);
  s.stillTime = p.moving ? 0 : s.stillTime + dt;
  s.safeTime += dt;
  if (s.cd > 0) s.cd -= dt;

  // Órbita de Clássicos: livros giram, causam dano e empurram.
  if (s.mods.orbita) {
    s.orbitAngle += ORBITA_SPEED * dt;
    for (let i = 0; i < ORBITA_BOOKS; i++) {
      s.bookCd[i] = Math.max(0, (s.bookCd[i] ?? 0) - dt);
      if ((s.bookCd[i] ?? 0) > 0) continue;
      const pos = posicaoDoLivro(p, s, i);
      let hit = false;
      for (const e of world.enemies.active) {
        if (!e.alive) continue;
        const dx = e.x - pos.x;
        const dy = e.y - pos.y;
        const reach = ORBITA_HIT_RADIUS + e.def.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        hit = true;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * ORBITA_PUSH_PX;
        e.y += (dy / d) * ORBITA_PUSH_PX;
        damageEnemy(world, e, ORBITA_DAMAGE * p.damageMul, p);
      }
      if (hit) s.bookCd[i] = ORBITA_HIT_COOLDOWN_S;
    }
  }

  // Ecos do Rodapé do Rodapé.
  for (let i = s.echoes.length - 1; i >= 0; i--) {
    const echo = s.echoes[i]!;
    echo.t -= dt;
    if (echo.t > 0) continue;
    damageArea(world, echo.x, echo.y, ECO_RADIUS, echo.damage, p);
    s.echoes.splice(i, 1);
  }

  // Ataque: Nota de Rodapé no inimigo mais próximo, se houver Foco.
  const cost = custoDaNota(s);
  if (s.cd > 0 || s.foco < cost) return;
  const target = nearestEnemy(world, p, NOTA_RANGE);
  if (!target) return;
  const angulo = Math.atan2(target.y - (p.y - 8), target.x - p.x);
  fireNota(world, p, s, angulo);
  // Nota Dupla: a cada 5 ataques, uma segunda runa sai um pouco aberta, sem custo de Foco.
  s.attackCount++;
  if (s.mods.notaDupla && s.attackCount % 5 === 0) fireNota(world, p, s, angulo + 0.2);
  s.foco -= cost;
  s.cd = NOTA_COOLDOWN_S / attackSpeed(p);
}
