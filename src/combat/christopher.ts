import { STEP_S } from '../data/balance';
import { CHRISTOPHER_CFG } from '../data/bosses';
import { CHRISTOPHER_COPIA } from '../data/enemies';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import { clamp } from '../engine/math';
import type { World } from '../engine/world';
import { BOSS_STATE } from './bossState';
import { spawnEffect } from './effects';
import { spawnHazard } from './hostile';
import { pushMessage } from './messages';
import { damagePlayer } from './playerStats';
import { spawnEnemy } from './spawner';
import { addBuff } from './teamEffects';

// A luta do Christopher (fase 5): uma luta de brincadeiras de criança.
//   Atenção: barra que sobe com alguém por perto e desce com todos longe. Zerada = birra (anéis com vãos, depois ele chora exausto).
//   Brincadeiras: pique-pega (a marca passa por toque), esconde-esconde (cópias), chuva de brinquedos (bolas rolando).
//   Regras da arena: o chão é lava (tapetes seguros), pés pesados e tudo ao contrário.
// Campos usados no Christopher: aiX = vida máxima, aiW = atenção, aiT2 = fase, aiDir = regra atual, aiY = tempo da regra,
// aiU = jogador marcado (pique-pega), aiV = tempo da marca, aiS = recarga de passar a marca (ou, no esconde, o índice do verdadeiro),
// aiR = tempo restante do esconde-esconde.

const C = CHRISTOPHER_CFG;
export type FaseChristopher = 1 | 2 | 3;

/** Cor dos tapetes seguros da regra "o chão é lava". */
export const COR_TAPETE = '#7be37b';
export const REGRA = { NENHUMA: 0, LAVA: 1, PESADOS: 2, REVERSO: 3 } as const;
export const NOME_REGRA: Readonly<Record<number, string>> = { 1: 'O CHÃO É LAVA!', 2: 'PÉS PESADOS!', 3: 'TUDO AO CONTRÁRIO!' };

export function duracaoDaRegra(id: number): number {
  return id === REGRA.LAVA ? C.regras.lava.duracaoS : id === REGRA.PESADOS ? C.regras.pesados.duracaoS : C.regras.reverso.duracaoS;
}

/** A regra já vale (passou o aviso)? */
export function regraAtiva(e: Enemy): boolean {
  return e.def.id === 'christopher' && e.aiDir !== REGRA.NENHUMA && e.aiY <= duracaoDaRegra(e.aiDir);
}

export function faseDoChristopher(frac: number): FaseChristopher {
  return frac > C.fases.doce ? 1 : frac > C.fases.birraTotal ? 2 : 3;
}

/** Ele está chorando exausto depois da birra (parado, inofensivo e vulnerável)? */
export function estaExaustoChris(e: Enemy): boolean {
  return e.def.id === 'christopher' && e.aiState === BOSS_STATE.EXAUSTO;
}

/** Ele está escondido entre as cópias (não machuca por contato, para não se denunciar)? */
export function estaEscondido(e: Enemy): boolean {
  return (e.def.id === 'christopher' && e.aiR > 0) || e.def.id === 'christopherCopia';
}

/** Está tão animado (atenção alta) que ataca mais depressa? */
export function estaAnimado(e: Enemy): boolean {
  return e.aiW >= C.atencao.animadoAcima;
}

function vivos(world: World): Player[] {
  return world.players.filter((p) => p.hp > 0);
}

function pertoDeJogador(world: World, espalhar: number): { x: number; y: number } {
  const v = vivos(world);
  const p = v[world.rng.int(0, Math.max(0, v.length - 1))];
  return { x: (p?.x ?? 0) + (world.rng.next() - 0.5) * 2 * espalhar, y: (p?.y ?? 0) + (world.rng.next() - 0.5) * 2 * espalhar };
}

// ---------------------------------------------------------------- atenção

/** A atenção sobe com alguém perto e desce sem ninguém. */
export function atualizarAtencao(world: World, e: Enemy): void {
  const perto = world.players.some((p) => p.hp > 0 && Math.hypot(p.x - e.x, p.y - e.y) < C.atencao.perto);
  e.aiW = clamp(e.aiW + (perto ? C.atencao.sobePorS : -C.atencao.descePorS) * STEP_S, 0, C.atencao.max);
}

// ---------------------------------------------------------------- birra

/** Birra: grito, anéis com vãos e, no fim, ele chora exausto. */
export function iniciarBirra(world: World, e: Enemy, fase: FaseChristopher): void {
  const b = C.birra;
  const n = b.rings[fase - 1]!;
  e.aiState = BOSS_STATE.AQUECENDO;
  pushMessage(world, 'Christopher', 'NINGUÉM ME OLHA!', 2.5);
  spawnHazard(world, { x: e.x, y: e.y, radius: 30, delay: b.warnS, damage: 0, color: '#ff8fb0' });
  for (let i = 0; i < n; i++) {
    spawnHazard(world, {
      kind: 'ring',
      x: e.x,
      y: e.y,
      radius: 0,
      delay: b.warnS + i * b.gap,
      expand: b.speed,
      maxRadius: b.maxRadius,
      thickness: b.thickness,
      damage: b.damage,
      color: '#ff8fb0',
      gapAngle: world.rng.next() * Math.PI * 2,
      gapHalf: b.vaoHalf[fase - 1]!,
    });
  }
  e.aiT = b.warnS + n * b.gap + b.maxRadius / b.speed;
}

/** Cuida do tempo da birra e do choro. Devolve true enquanto ele está nessa fase (sem atacar). */
export function atualizarBirra(world: World, e: Enemy): boolean {
  if (e.aiState === BOSS_STATE.AQUECENDO) {
    e.aiT -= STEP_S;
    if (e.aiT <= 0) {
      e.aiState = BOSS_STATE.EXAUSTO;
      e.aiT = C.birra.exaustoS;
      spawnEffect(world, { kind: 'text', x: e.x, y: e.y - 34, life: 1.4, color: '#ffb3c7', text: 'buááá...' });
      pushMessage(world, 'Christopher', '(chorando) Ninguém... brinca comigo...', 2.5);
    }
    return true;
  }
  if (e.aiState === BOSS_STATE.EXAUSTO) {
    e.aiT -= STEP_S;
    if (e.aiT <= 0) {
      e.aiState = BOSS_STATE.LIVRE;
      e.aiCd = C.cooldownFase[Math.max(0, e.aiT2 - 1)]!;
      e.aiW = C.atencao.aposBirra;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- chuva de brinquedos

/** Bolas que rolam por uma linha passando por um jogador: cada passo avisa e estoura em sequência. */
export function brinquedos(world: World, fase: FaseChristopher): void {
  const c = C.brinquedos;
  const n = c.bolas + (fase === 3 ? 1 : 0);
  for (let b = 0; b < n; b++) {
    const p = pertoDeJogador(world, 40);
    const a = world.rng.next() * Math.PI * 2;
    const sx = p.x + Math.cos(a) * c.distInicio;
    const sy = p.y + Math.sin(a) * c.distInicio;
    const dx = Math.cos(a + Math.PI);
    const dy = Math.sin(a + Math.PI);
    for (let i = 0; i < c.passos; i++) {
      spawnHazard(world, {
        x: sx + dx * i * c.passoPx,
        y: sy + dy * i * c.passoPx,
        radius: c.radius,
        delay: c.warnS + i * c.passoDelayS,
        damage: c.damage,
        color: '#ffd166',
        sprite: 'brinquedo',
      });
    }
  }
}

// ---------------------------------------------------------------- pique-pega

/** Marca um jogador. Devolve false se não há aliados para passar a marca (partida solo). */
export function piqueIniciar(world: World, e: Enemy): boolean {
  const v = vivos(world);
  if (v.length < 2) return false;
  const alvo = v[world.rng.int(0, v.length - 1)]!;
  e.aiU = alvo.slot;
  e.aiV = C.pique.timeS;
  e.aiS = 0;
  pushMessage(world, 'Christopher', 'Pique-pega! Tá com você! Passa pra alguém!', 3);
  spawnEffect(world, { kind: 'text', x: alvo.x, y: alvo.y - 30, life: 1.2, color: '#ffd166', text: 'É VOCÊ!' });
  return true;
}

/** O jogador marcado no pique-pega, se houver. */
export function marcadoDoPique(world: World, e: Enemy): Player | undefined {
  if (e.def.id !== 'christopher' || e.aiU < 0) return undefined;
  return world.players.find((p) => p.slot === e.aiU && p.hp > 0);
}

export function atualizarPique(world: World, e: Enemy): void {
  if (e.aiU < 0) return;
  const marcado = marcadoDoPique(world, e);
  if (!marcado) {
    e.aiU = -1;
    return;
  }
  e.aiV -= STEP_S;
  if (e.aiS > 0) e.aiS = Math.max(0, e.aiS - STEP_S);
  if (e.aiS <= 0) {
    for (const p of world.players) {
      if (p === marcado || p.hp <= 0) continue;
      if (Math.hypot(p.x - marcado.x, p.y - marcado.y) > C.pique.passaPx) continue;
      e.aiU = p.slot;
      e.aiS = C.pique.passaCdS;
      e.aiV = C.pique.timeS;
      e.aiW = Math.min(C.atencao.max, e.aiW + C.atencao.ganhoDivertido); // ele adora quando brincam
      spawnEffect(world, { kind: 'text', x: p.x, y: p.y - 30, life: 1, color: '#ffd166', text: 'Passou!' });
      return;
    }
  }
  if (e.aiV <= 0) {
    const x = marcado.x;
    const y = marcado.y;
    const x2 = C.pique.explosao;
    spawnHazard(world, { x, y, radius: x2.radius, delay: x2.warnS, damage: x2.damage, color: '#ffd166', sprite: 'explosao_pique' });
    pushMessage(world, 'Christopher', 'Perdeu! Hihi!', 2);
    e.aiU = -1;
  }
}

// ---------------------------------------------------------------- regras da arena

/** Começa uma regra nova (com aviso). */
export function iniciarRegra(world: World, e: Enemy): void {
  const r = C.regras;
  const id = world.rng.int(1, 3);
  e.aiDir = id;
  e.aiY = r.avisoS + duracaoDaRegra(id);
  pushMessage(world, 'Christopher', `Mudei as regras! ${NOME_REGRA[id]}`, 3);
  if (id === REGRA.LAVA) {
    const n = Math.max(r.lava.tapetes, vivos(world).length);
    for (let i = 0; i < n; i++) {
      const p = pertoDeJogador(world, r.lava.scatter);
      spawnHazard(world, { x: p.x, y: p.y, radius: r.lava.raio, delay: r.avisoS, life: r.lava.duracaoS, damage: 0, color: COR_TAPETE, sprite: 'tapete_seguro' });
    }
  }
}

/** Há um tapete seguro ativo embaixo do ponto? */
function sobreTapete(world: World, x: number, y: number): boolean {
  for (const h of world.hazards.active) {
    if (!h.active || h.color !== COR_TAPETE || h.life <= 0) continue;
    if (Math.hypot(h.x - x, h.y - y) <= h.radius) return true;
  }
  return false;
}

/** Aplica o efeito da regra em vigor a cada passo. */
export function atualizarRegra(world: World, e: Enemy): void {
  if (e.aiDir === REGRA.NENHUMA) return;
  e.aiY -= STEP_S;
  if (e.aiY <= 0) {
    e.aiDir = REGRA.NENHUMA;
    return;
  }
  if (!regraAtiva(e)) return; // ainda no aviso
  for (const p of vivos(world)) {
    if (e.aiDir === REGRA.LAVA) {
      if (!sobreTapete(world, p.x, p.y)) damagePlayer(p, C.regras.lava.dps * STEP_S, world);
    } else if (e.aiDir === REGRA.PESADOS) {
      p.slowLeft = Math.max(p.slowLeft, 0.2);
      addBuff(p, { id: 'pesados', left: 0.2, damage: C.regras.pesados.dano });
    } else {
      p.confusedLeft = Math.max(p.confusedLeft, 0.2);
    }
  }
}

// ---------------------------------------------------------------- esconde-esconde

function copiasDoChristopher(world: World, e: Enemy): Enemy[] {
  return world.enemies.active.filter((f) => f.alive && f.def.id === 'christopherCopia' && f.leader === e.uid);
}

/** Cria as cópias e esconde o verdadeiro entre elas. Devolve false se não há jogadores. */
export function esconderIniciar(world: World, e: Enemy): boolean {
  const v = vivos(world);
  if (v.length === 0) return false;
  const cx = v.reduce((s, p) => s + p.x, 0) / v.length;
  const cy = v.reduce((s, p) => s + p.y, 0) / v.length;
  e.homeX = cx;
  e.homeY = cy;
  e.aiR = C.esconde.duracaoS;
  e.aiS = world.rng.int(0, C.esconde.copias); // índice (0 a 3) do verdadeiro no carrossel
  e.aiState = BOSS_STATE.DESCANSANDO;
  e.aiT = 0;
  let idx = 0;
  for (let k = 0; k < C.esconde.copias; k++) {
    if (idx === e.aiS) idx++;
    if (!spawnEnemy(world, CHRISTOPHER_COPIA, cx, cy)) continue;
    const f = world.enemies.active[world.enemies.active.length - 1]!;
    f.leader = e.uid;
    f.aiDir = idx;
    f.aiState = BOSS_STATE.DESCANSANDO;
    idx++;
  }
  pushMessage(world, 'Christopher', 'Esconde-esconde! Me acha!', 3);
  return true;
}

function fimDoEsconde(world: World, e: Enemy, achado: boolean): void {
  for (const f of copiasDoChristopher(world, e)) f.alive = false;
  e.aiR = 0;
  e.aiS = 0;
  e.aiState = BOSS_STATE.DESCANSANDO;
  e.aiT = 1;
  if (!achado) {
    pushMessage(world, 'Christopher', 'Hihi! Não me acharam!', 2.5);
    e.aiW = Math.min(C.atencao.max, e.aiW + C.atencao.ganhoDivertido);
  }
}

/** Movimento do carrossel. Devolve true enquanto o esconde-esconde está rolando (o resto da IA espera). */
export function atualizarEsconde(world: World, e: Enemy): boolean {
  if (e.aiR <= 0) return false;
  const c = C.esconde;
  e.aiR -= STEP_S;
  const t = c.duracaoS - e.aiR;
  const corpos: { corpo: Enemy; idx: number }[] = [{ corpo: e, idx: e.aiS }];
  for (const f of copiasDoChristopher(world, e)) corpos.push({ corpo: f, idx: f.aiDir });
  for (const { corpo, idx } of corpos) {
    const ang = (idx * Math.PI) / 2 + t * c.omega;
    corpo.x = e.homeX + Math.cos(ang) * c.raio;
    corpo.y = e.homeY + Math.sin(ang) * c.raio;
    corpo.facing = ang + Math.PI / 2;
  }
  // Pista: só o verdadeiro dá risadinha.
  if (t % c.hihiEveryS < STEP_S) spawnEffect(world, { kind: 'text', x: e.x, y: e.y - 32, life: 0.8, color: '#ffe9a8', text: 'hihi' });
  if (e.aiR <= 0) fimDoEsconde(world, e, false);
  return true;
}

/** Acertaram uma cópia: ela some e dá um susto. */
export function copiaAtingida(world: World, copia: Enemy): void {
  copia.alive = false;
  const c = C.esconde;
  spawnHazard(world, { x: copia.x, y: copia.y, radius: c.sustoRadius, delay: 0.3, damage: c.sustoDamage, color: '#ffd166', sprite: 'susto_copia' });
  spawnEffect(world, { kind: 'text', x: copia.x, y: copia.y - 20, life: 0.8, color: '#ffffff', text: 'BU!' });
}

/** Dano no Christopher verdadeiro: exausto leva mais; achado no esconde-esconde fica atordoado e leva mais. */
export function danoNoChristopher(world: World, e: Enemy, amount: number): number {
  if (e.aiR > 0) {
    fimDoEsconde(world, e, true);
    e.stun = Math.max(e.stun, C.esconde.achouStunS);
    pushMessage(world, 'Christopher', 'ACHARAM! Não vale!', 2.5);
    return amount * C.esconde.achouDanoMul;
  }
  if (estaExaustoChris(e)) return amount * C.birra.exaustoDanoMul;
  return amount;
}
