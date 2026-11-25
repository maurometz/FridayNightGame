import { STEP_S } from '../data/balance';
import { JUNINHO_CFG } from '../data/bosses';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { World } from '../engine/world';
import { BOSS_STATE } from './bossState';
import { spawnEffect } from './effects';
import { spawnHazard, spawnHostile } from './hostile';
import { pushMessage } from './messages';

// As Azuletes da luta do Juninho (fase 3). Mariana e Melina são dois corpos que seguem o Juninho e dividem a vida dele
// (como os corpos das Salsichas). A IA delas roda a partir do Juninho (ver `juninho` em bosses.ts).
//   Mariana: investidas em linha reta deixando poças de tinta; depois de algumas, fica sem fôlego (vulnerável).
//            Se tropeçar numa zona de cronograma do próprio Juninho, cansa na hora.
//   Melina:  põe um escudo no Juninho e lança ironias que dão debuff. Acertá-la com o escudo ativo o enfraquece mais rápido.
// Campos usados no Juninho: aiY = vida do escudo, aiW = tempo restante do escudo, aiDir = vida máxima do escudo, aiT2 = fase.

const C = JUNINHO_CFG;
export type FaseJuninho = 1 | 2 | 3;

/** Cor das zonas de cronograma (para a Mariana as reconhecer no chão). */
export const COR_CRONOGRAMA = '#6ea8ff';

/** Fase da luta (1 Expediente, 2 Reestruturação, 3 Prazo final) pela fração de vida restante. */
export function faseDoJuninho(frac: number): FaseJuninho {
  return frac > C.fases.reestruturacao ? 1 : frac > C.fases.prazo ? 2 : 3;
}

/** A Mariana está sem fôlego (parada, vulnerável e inofensiva)? */
export function estaExaustaAzulete(e: Enemy): boolean {
  return e.def.id === 'mariana' && e.aiState === BOSS_STATE.EXAUSTO;
}

/** O Juninho está com o escudo da Melina? */
export function escudoAtivo(lider: Enemy): boolean {
  return lider.def.id === 'juninho' && lider.aiY > 0;
}

/** As duas Azuletes vivas deste chefe. */
export function azuletesDoChefe(world: World, lider: Enemy): { mariana?: Enemy; melina?: Enemy } {
  let mariana: Enemy | undefined;
  let melina: Enemy | undefined;
  for (const f of world.enemies.active) {
    if (!f.alive || f.leader !== lider.uid) continue;
    if (f.def.id === 'mariana') mariana = f;
    else if (f.def.id === 'melina') melina = f;
  }
  return { mariana, melina };
}

function vivos(world: World): Player[] {
  return world.players.filter((p) => p.hp > 0);
}

function maisPerto(world: World, x: number, y: number): Player | undefined {
  let melhor: Player | undefined;
  let d = Infinity;
  for (const p of vivos(world)) {
    const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (dd < d) {
      d = dd;
      melhor = p;
    }
  }
  return melhor;
}

/** O escudo caiu (quebrou ou acabou o tempo). Quebrado por dano: o grupo todo cambaleia. */
function derrubarEscudo(world: World, lider: Enemy, quebrou: boolean): void {
  lider.aiY = 0;
  lider.aiW = 0;
  lider.aiDir = 0;
  spawnEffect(world, { kind: 'ring', x: lider.x, y: lider.y - 8, radius: 36, life: 0.45, color: '#9fd0ff', sprite: 'escudo_juninho' });
  if (!quebrou) return;
  lider.stun = Math.max(lider.stun, C.quebraStunS);
  for (const f of world.enemies.active) if (f.alive && f.leader === lider.uid) f.stun = Math.max(f.stun, C.quebraStunS);
  spawnEffect(world, { kind: 'text', x: lider.x, y: lider.y - 34, life: 1.2, color: '#9fd0ff', text: 'ESCUDO QUEBROU!' });
  pushMessage(world, '', 'O escudo quebrou! Aproveitem!', 2.5);
}

/** O escudo absorve o dano que iria para o Juninho. Devolve o dano que sobra (0 enquanto o escudo segura). */
export function absorverNoEscudo(world: World, lider: Enemy, amount: number): number {
  if (!escudoAtivo(lider)) return amount;
  lider.aiY -= amount;
  lider.hitFlash = 0.08;
  if (lider.aiY <= 0) derrubarEscudo(world, lider, true);
  return 0;
}

/**
 * Dano num corpo das Azuletes (chamado por damageEnemy). Devolve o multiplicador do dano que vai para a vida do Juninho:
 * a Mariana sem fôlego leva mais; a Melina, com o escudo ativo, também desgasta o escudo.
 */
export function danoNaAzulete(world: World, e: Enemy, lider: Enemy, amount: number): number {
  if (lider.def.id !== 'juninho') return 1;
  if (e.def.id === 'mariana' && estaExaustaAzulete(e)) return C.mariana.exaustaDanoMul;
  if (e.def.id === 'melina' && escudoAtivo(lider)) {
    lider.aiY -= amount * C.melina.escudoBonusNaMelina;
    if (lider.aiY <= 0) derrubarEscudo(world, lider, true);
  }
  return 1;
}

// ---------------------------------------------------------------- Mariana

/** Há uma zona de cronograma ativa em volta do ponto? */
function emZonaDeCronograma(world: World, x: number, y: number): boolean {
  for (const h of world.hazards.active) {
    if (!h.active || h.kind !== 'circle' || h.color !== COR_CRONOGRAMA || h.life <= 0) continue;
    if (Math.hypot(h.x - x, h.y - y) <= h.radius) return true;
  }
  return false;
}

function cansar(world: World, m: Enemy, fase: FaseJuninho, motivo: string): void {
  m.aiState = BOSS_STATE.EXAUSTO;
  m.aiT = C.mariana.exaustoS[fase - 1]!;
  m.aiCount = 0;
  spawnEffect(world, { kind: 'text', x: m.x, y: m.y - 22, life: 1.2, color: '#9fd0ff', text: 'ZZZ' });
  pushMessage(world, 'Mariana', motivo, 2.5);
}

/** Mira numa direção e deixa o aviso do rastro de tinta no chão, ao longo do caminho da investida. */
function prepararInvestida(world: World, m: Enemy, alvo: Player, espera = C.mariana.warnS): void {
  const t = C.mariana.trail;
  m.aiState = BOSS_STATE.PREPARANDO;
  m.aiT = espera;
  m.aiDir = Math.atan2(alvo.y - m.y, alvo.x - m.x);
  m.facing = m.aiDir;
  m.aiY = 0;
  const passos = Math.max(1, Math.round(C.mariana.dashLenPx / t.stepPx));
  for (let i = 1; i <= passos; i++) {
    spawnHazard(world, {
      x: m.x + Math.cos(m.aiDir) * i * t.stepPx,
      y: m.y + Math.sin(m.aiDir) * i * t.stepPx,
      radius: t.radius,
      delay: espera + i * 0.03,
      life: t.lifeS,
      damage: t.impact,
      dps: t.dps,
      slowFor: t.slowFor,
      color: '#2f7bff',
      sprite: 'poca_tinta',
    });
  }
}

function atualizarMariana(world: World, m: Enemy, fase: FaseJuninho): void {
  const c = C.mariana;
  const alvo = maisPerto(world, m.x, m.y);
  if (m.aiState === BOSS_STATE.EXAUSTO) {
    m.aiT -= STEP_S;
    if (m.aiT <= 0) {
      m.aiState = BOSS_STATE.LIVRE;
      m.aiCd = c.cooldownS[fase - 1]!;
    }
    return;
  }
  if (!alvo) return;
  if (m.aiState === BOSS_STATE.PREPARANDO) {
    m.aiT -= STEP_S;
    if (m.aiT <= 0) m.aiState = BOSS_STATE.CARGA;
    return;
  }
  if (m.aiState === BOSS_STATE.CARGA) {
    const passo = c.dashSpeed * STEP_S;
    m.x += Math.cos(m.aiDir) * passo;
    m.y += Math.sin(m.aiDir) * passo;
    m.aiY += passo;
    if (emZonaDeCronograma(world, m.x, m.y)) {
      cansar(world, m, fase, 'Ai! O cronograma do Juninho me pegou!');
      return;
    }
    if (m.aiY >= c.dashLenPx) {
      m.aiCount++;
      if (m.aiCount >= c.dashes[fase - 1]!) cansar(world, m, fase, 'Eu... preciso... de um café...');
      else {
        prepararInvestida(world, m, alvo, c.gapS + c.warnS);
      }
    }
    return;
  }
  // Livre: anda devagar até o jogador e, quando a recarga acaba, começa as investidas.
  const dx = alvo.x - m.x;
  const dy = alvo.y - m.y;
  const d = Math.hypot(dx, dy) || 1;
  m.facing = Math.atan2(dy, dx);
  m.x += (dx / d) * c.speed * STEP_S;
  m.y += (dy / d) * c.speed * STEP_S;
  m.aiCd -= STEP_S;
  if (m.aiCd <= 0) prepararInvestida(world, m, alvo);
}

// ---------------------------------------------------------------- Melina

function atualizarMelina(world: World, lider: Enemy, m: Enemy, fase: FaseJuninho): void {
  const c = C.melina;
  const alvo = maisPerto(world, m.x, m.y);
  // Fica do lado do Juninho que está longe dos jogadores.
  const ref = alvo ?? lider;
  const ang = Math.atan2(lider.y - ref.y, lider.x - ref.x);
  const tx = lider.x + Math.cos(ang) * c.distJuninho;
  const ty = lider.y + Math.sin(ang) * c.distJuninho;
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (d > 4) {
    m.x += (dx / d) * Math.min(d, c.speed * STEP_S);
    m.y += (dy / d) * Math.min(d, c.speed * STEP_S);
  }
  if (alvo) m.facing = Math.atan2(alvo.y - m.y, alvo.x - m.x);

  // Escudo: o tempo dele conta e, sem escudo, a recarga também.
  if (lider.aiY > 0) {
    lider.aiW -= STEP_S;
    if (lider.aiW <= 0) derrubarEscudo(world, lider, false);
  } else if (m.aiT2 > 0) {
    m.aiT2 -= STEP_S;
  }

  if (m.aiState === BOSS_STATE.PREPARANDO) {
    m.aiT -= STEP_S;
    if (m.aiT <= 0) {
      m.aiState = BOSS_STATE.LIVRE;
      const max = (lider.aiX || lider.hp) * c.escudoFrac[fase - 1]!;
      lider.aiY = max;
      lider.aiDir = max;
      lider.aiW = c.escudoS;
      m.aiT2 = c.escudoCdS[fase - 1]!;
      spawnEffect(world, { kind: 'ring', x: lider.x, y: lider.y - 8, radius: 34, life: 0.5, color: '#9fd0ff', sprite: 'escudo_juninho' });
    }
    return;
  }
  if (lider.aiY <= 0 && m.aiT2 <= 0 && vivos(world).length > 0) {
    m.aiState = BOSS_STATE.PREPARANDO;
    m.aiT = c.escudoWarnS;
    spawnEffect(world, { kind: 'text', x: m.x, y: m.y - 22, life: 1, color: '#9fd0ff', text: 'Escudo!' });
    pushMessage(world, 'Melina', 'Que fofo, vocês tentando. Escudo no chefe.', 2.5);
    return;
  }

  // Ironia: projéteis lentos que dão debuff.
  m.aiCd -= STEP_S;
  if (m.aiCd > 0 || !alvo) return;
  m.aiCd = c.ironiaEveryS[fase - 1]!;
  const n = c.ironiaCount[fase - 1]!;
  const base = Math.atan2(alvo.y - m.y, alvo.x - m.x);
  const spread = (c.ironiaSpread * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? base : base + (i - (n - 1) / 2) * (spread / (n - 1));
    spawnHostile(world, { kind: 'ironia', x: m.x, y: m.y, angle: a, speed: c.ironiaSpeed, damage: c.ironiaDamage, radius: 4, life: 3.2, homing: 0.6 });
  }
}

// ---------------------------------------------------------------- luta

/** Entrou numa fase nova: fala do Juninho e as Azuletes recomeçam o ciclo. */
function mudarDeFase(world: World, lider: Enemy, fase: FaseJuninho): void {
  lider.aiT2 = fase;
  if (fase === 1) return;
  pushMessage(world, 'Juninho', fase === 2 ? 'Reestruturação! Todo mundo na linha!' : 'Prazo final! Hora extra pra todo mundo!', 3);
  const { mariana, melina } = azuletesDoChefe(world, lider);
  if (mariana && mariana.aiState !== BOSS_STATE.EXAUSTO) {
    mariana.aiState = BOSS_STATE.LIVRE;
    mariana.aiCd = 0.8;
  }
  if (melina) melina.aiT2 = Math.min(melina.aiT2, 1);
}

/** "Hora extra" (fase 3): as Azuletes entram já em ação, sem esperar a recarga. */
export function horaExtra(world: World, lider: Enemy): void {
  const { mariana, melina } = azuletesDoChefe(world, lider);
  if (mariana && mariana.aiState === BOSS_STATE.LIVRE) mariana.aiCd = Math.min(mariana.aiCd, 0.3);
  if (melina) {
    melina.aiT2 = 0;
    melina.aiCd = Math.min(melina.aiCd, 0.5);
  }
  pushMessage(world, 'Juninho', 'Hora extra! Executem!', 2.5);
}

/** Roda uma vez por passo, a partir do Juninho. */
export function atualizarAzuletes(world: World, lider: Enemy, fase: FaseJuninho): void {
  if (!lider.alive) return;
  const { mariana, melina } = azuletesDoChefe(world, lider);
  for (const f of [mariana, melina]) if (f) f.hp = lider.hp; // os corpos mostram a vida do líder
  if (lider.aiT2 !== fase) mudarDeFase(world, lider, fase);
  if (mariana && mariana.stun <= 0) atualizarMariana(world, mariana, fase);
  if (melina && melina.stun <= 0) atualizarMelina(world, lider, melina, fase);
  else if (!melina && lider.aiY > 0) {
    // Sem a Melina o escudo some sozinho com o tempo.
    lider.aiW -= STEP_S;
    if (lider.aiW <= 0) derrubarEscudo(world, lider, false);
  }
}
