// HUD e telas modais do jogo, no estilo "Neon de boteco / VHS" (ver ui/theme.ts).
// No jogo a UI usa só contornos finos e números em âmbar; sem scanlines (elas ficam só nos menus).

import { VEHICLES } from '../data/vehicles';
import { REVIVE_TIME_S } from '../data/revive';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, MAX_LEVEL } from '../data/balance';
import { CHARACTERS } from '../data/characters';
import { cartasDoDispositivo, type DeviceId, type KeyMap } from '../data/controls';
import { keyLabel } from '../game/settings';
import type { FelipeState } from '../characters/felipeState';
import { conhecimentoBonus, recordacaoPerfeita, saltosPorConhecimento } from '../characters/mauro';
import { focoMax } from '../characters/kitHooks';
import type { MauroState } from '../characters/mauroState';
import type { MelissaState } from '../characters/melissaState';
import { bonusDoPico, picoMax, type ThaisaState } from '../characters/thaisaState';
import { PICO_STACK_DURATION_S } from '../data/thaisa';
import { COR_EUFORIA, COR_SOBRECARGA } from '../characters/thayssa';
import { duracaoDaTransicao, type ThayssaState } from '../characters/thayssaState';
import { INVESTIDA_COOLDOWN_S, REACAO_COOLDOWN_S } from '../data/melissa';
import type { Player } from '../entities/player';
import { rerollsRestantes, type PendingChoice } from '../combat/leveling';
import { SYNERGY_MAX, SYNERGY_NEAR_PX } from '../data/synergy';
import { nomeDaDupla } from '../synergy';
import { RARITY_LABEL, kindOf, type Rarity } from '../combat/cardTypes';
import { tempoRestante } from '../combat/run';
import type { World } from '../engine/world';
import { xpToNext } from '../engine/xp';
import {
  cardapio,
  COLOR,
  contorno,
  etiqueta,
  FONT_CLOCK,
  FONT_LABEL,
  FONT_UI,
  medidor,
  PAL,
  placa,
  rect,
  setPalette,
  texto,
  textoContornado,
  usarFonte,
} from './theme';

export interface DebugInfo {
  fps: number;
  simMs: number;
}

type Ctx = CanvasRenderingContext2D;

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Quebra o texto em linhas que cabem em `maxWidth` (usa a fonte atual do contexto). */
export function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

const NOMES_DAS_ARMAS: Record<string, string> = {
  pizza: 'Pizza',
  roteador: 'Wi-Fi',
  chinelo: 'Chinelo',
  chicote: 'Chicote',
  ventilador: 'Ventilador',
  panela: 'Panela',
  controle: 'Controle',
  mangueira: 'Mangueira',
  fogos: 'Fogos',
  emprestado: 'Violão emprestado',
};

/** Bloco do kit do personagem (instrumentos, foco, aura...), no canto inferior esquerdo. */
function drawKitHud(ctx: Ctx, p: Player): void {
  if (p.kit?.type === 'felipe') drawFelipeHud(ctx, p.kit);
  else if (p.kit?.type === 'mauro') drawMauroHud(ctx, p, p.kit);
  else if (p.kit?.type === 'melissa') drawMelissaHud(ctx, p.kit);
  else if (p.kit?.type === 'thaisa') drawThaisaHud(ctx, p, p.kit);
  else if (p.kit?.type === 'thayssa') drawThayssaHud(ctx, p.kit);
}

/** Cor da etiqueta de cada jogador do co-op local (P1 a P5). */
const COR_JOGADOR = [PAL.neon2, PAL.neon1, PAL.accent, PAL.xp, PAL.text];

/** Co-op local: cartão dos jogadores 2 a 5 no canto superior direito, empilhados (nome, vida, escudo e veículo). */
function drawCoopCard(ctx: Ctx, world: World, q: Player, indice: number, doSlot: number): void {
  const W = LOGICAL_WIDTH;
  const cardW = 132;
  const x0 = W - 4 - cardW;
  // Abaixo das barras de sinergia do jogador 1 (uma por dupla, mais a da Saideira com 5 jogadores), no canto superior direito.
  const sinergia = world.synergy.pairs.filter((par) => par.a === doSlot || par.b === doSlot).length + (world.players.length === 5 ? 1 : 0);
  const y0 = 30 + 19 * sinergia + indice * 27;
  placa(ctx, x0, y0, cardW, 23, COR_JOGADOR[q.slot] ?? PAL.neon1);
  usarFonte(ctx, FONT_UI);
  const rotuloJ = `P${q.slot + 1} · `;
  texto(ctx, rotuloJ, x0 + 3, y0 + 2, PAL.text);
  const wP = Math.ceil(ctx.measureText(rotuloJ).width);
  texto(ctx, CHARACTERS[q.characterId].name.toUpperCase(), x0 + 3 + wP, y0 + 2, PAL.accent);
  const vivo = q.hp > 0;
  const rev = !vivo && q.reviveProgress > 0 ? ` ${Math.round((q.reviveProgress / REVIVE_TIME_S) * 100)}%` : '';
  medidor(ctx, x0 + 3, y0 + 14, 82, 6, vivo ? q.hp / q.maxHp : q.reviveProgress / REVIVE_TIME_S, vivo ? PAL.neon1 : PAL.xp, COLOR.hpTrack);
  texto(ctx, vivo ? `${Math.max(0, Math.ceil(q.hp))}/${q.maxHp}` : `caiu${rev}`, x0 + 90, y0 + 12, vivo ? PAL.text : COLOR.dim);
  if (q.shield > 0) etiqueta(ctx, x0 - 70, y0 + 3, `Escudo ${Math.ceil(q.shield)}`, COLOR.shield, 'losango');
  else if (q.vehicle) etiqueta(ctx, x0 - 70, y0 + 3, `${VEHICLES[q.vehicle.id].name} ${Math.ceil(q.vehicle.left)}s`, COLOR.skate, 'bola');
}

/** `viewSlot`: de quem é a tela (0 no solo e no co-op local; no online, o slot deste navegador). */
export function drawHud(ctx: Ctx, world: World, debug: DebugInfo | null, coop = false, viewSlot = 0): void {
  const p = world.players[viewSlot] ?? world.players[0];
  if (!p) return;
  // A paleta da UI troca inteira (respiro <-> queda) junto com o humor da partida.
  setPalette(world.moodBlend >= 0.5 ? 'queda' : 'respiro');
  const W = LOGICAL_WIDTH;
  const H = LOGICAL_HEIGHT;

  // Cartão do jogador: nome e vida.
  const cardW = 132;
  placa(ctx, 4, 4, cardW, 23, PAL.neon2);
  usarFonte(ctx, FONT_UI);
  const rotulo = coop ? `P${p.slot + 1} · ` : 'COMITÊ · ';
  texto(ctx, rotulo, 7, 6, PAL.text);
  const w1 = Math.ceil(ctx.measureText(rotulo).width);
  texto(ctx, CHARACTERS[p.characterId].name.toUpperCase(), 7 + w1, 6, PAL.accent);
  medidor(ctx, 7, 18, 82, 6, p.hp / p.maxHp, PAL.neon1, COLOR.hpTrack);
  texto(ctx, `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`, 94, 16, PAL.text);

  // Etiquetas de status: escudo, comida, veículo, debuff e armas extras.
  const chips: { t: string; cor: string; ic?: 'losango' | 'triangulo' | 'bola' | 'xis' }[] = [];
  if (p.shield > 0) chips.push({ t: `Escudo ${Math.ceil(p.shield)}`, cor: COLOR.shield, ic: 'losango' });
  if (p.foodBuff) {
    const nome = p.foodBuff.kind === 'velocidade' ? 'Veloz' : p.foodBuff.kind === 'dano' ? 'Forte' : 'Regenerando';
    chips.push({ t: `${nome} ${Math.ceil(p.foodBuff.left)}s`, cor: COLOR.strong, ic: 'triangulo' });
  }
  if (p.vehicle) chips.push({ t: `${VEHICLES[p.vehicle.id].name} ${Math.ceil(p.vehicle.left)}s`, cor: COLOR.skate, ic: 'bola' });
  else if (world.vehiclePickups.some((v) => v.slot === p.slot) && Math.floor(world.tick / 20) % 2 === 0) {
    chips.push({ t: 'Veículo no chão!', cor: PAL.accent, ic: 'bola' });
  }
  if (p.tdahLeft > 0) chips.push({ t: `TDAH ${Math.ceil(p.tdahLeft)}s`, cor: p.distractedLeft > 0 ? PAL.neon1 : COLOR.tdah, ic: 'xis' });
  for (const w of p.extraWeapons) {
    chips.push({ t: `${NOMES_DAS_ARMAS[w.id] ?? w.id}${w.id === 'emprestado' ? '' : ` ${w.level}`}`, cor: PAL.accent });
  }
  let cx = 4;
  let cy = 30;
  for (const c of chips) {
    usarFonte(ctx, FONT_UI);
    const largura = Math.ceil(ctx.measureText(c.t.toUpperCase()).width) + 4 + (c.ic ? 8 : 0);
    if (cx + largura > 170 && cx > 4) {
      cx = 4;
      cy += 13;
    }
    cx += etiqueta(ctx, cx, cy, c.t, c.cor, c.ic) + 3;
  }
  const chipsFim = chips.length > 0 ? cy + 13 : 30;

  // Relógio: ponto REC piscando e o tempo que falta para o chefe da fase.
  const remaining = tempoRestante(world);
  const finalFight = world.bossFight;
  const clockW = finalFight ? 84 : 64;
  const clockX = Math.round((W - clockW) / 2);
  placa(ctx, clockX, 4, clockW, 16, PAL.accent);
  if (Math.floor(world.tick / 30) % 2 === 0) rect(ctx, clockX + 5, 10, 5, 5, PAL.neon1);
  if (finalFight) {
    usarFonte(ctx, FONT_LABEL, 'center');
    texto(ctx, 'CHEFE', clockX + clockW / 2 + 5, 8, PAL.neon1);
  } else {
    usarFonte(ctx, FONT_CLOCK, 'center');
    texto(ctx, formatTime(remaining), clockX + clockW / 2 + 5, 4, PAL.accent);
  }
  ctx.textAlign = 'left';
  drawBossBar(ctx, world);
  drawMessage(ctx, world);

  // Abates (e salgadinhos, depois do nível máximo) no canto superior direito.
  usarFonte(ctx, FONT_UI, 'right');
  const abates = `${coop ? world.players.reduce((n, q) => n + q.kills, 0) : p.kills}`;
  textoContornado(ctx, abates, W - 4, 4, PAL.neon2);
  const wA = Math.ceil(ctx.measureText(abates).width);
  textoContornado(ctx, 'ABATES: ', W - 4 - wA, 4, PAL.text);
  if (p.level >= MAX_LEVEL) textoContornado(ctx, `SALGADINHOS: ${Math.floor(p.salgadinhos)}`, W - 4, 14, PAL.accent);
  ctx.textAlign = 'left';

  // Barra de XP na base: "NV 12" e uma barra que enche da esquerda para a direita. No co-op, uma faixa para cada jogador.
  const humanos = coop ? [p, ...world.players.filter((q) => q !== p)] : [p];
  const barraXp = (q: Player, x0: number, largura: number): void => {
    const frac = q.level >= MAX_LEVEL ? 1 : q.xp / xpToNext(q.level);
    usarFonte(ctx, FONT_UI);
    const nv = q.level >= MAX_LEVEL ? 'NV MÁX' : `NV ${q.level}`;
    textoContornado(ctx, nv, x0, H - 17, humanos.length > 1 ? (COR_JOGADOR[q.slot] ?? PAL.xp) : PAL.xp);
    const nvW = Math.ceil(ctx.measureText(nv).width);
    medidor(ctx, x0 + nvW + 4, H - 14, largura - nvW - 4, 5, frac, PAL.xp, COLOR.xpTrack);
  };
  const faixa = Math.floor((W - 4 - 4 * humanos.length) / humanos.length);
  humanos.forEach((q, i) => barraXp(q, 4 + i * (faixa + 4), faixa));

  // Blocos do kit empilhados (os blocos são largos demais para ficar lado a lado): jogadores 1 a 3.
  humanos.slice(0, 3).forEach((q, i) => {
    ctx.save();
    ctx.translate(0, -34 * i);
    drawKitHud(ctx, q);
    ctx.restore();
  });
  if (coop) humanos.slice(1).forEach((q, i) => drawCoopCard(ctx, world, q, i, p.slot));

  drawSynergyHud(ctx, world, p);

  // Aliados (companheiro IA ou co-op): nome e barra de vida, à esquerda sob as etiquetas.
  usarFonte(ctx, FONT_UI);
  (coop ? [] : world.players.filter((q) => q !== p)).forEach((q, i) => {
    const y = chipsFim + 6 + i * 18;
    const vivo = q.hp > 0;
    const rev = !vivo && q.reviveProgress > 0 ? ` ${Math.round((q.reviveProgress / REVIVE_TIME_S) * 100)}%` : '';
    texto(ctx, (vivo ? CHARACTERS[q.characterId].name : `${CHARACTERS[q.characterId].name} (caiu)${rev}`).toUpperCase(), 4, y, vivo ? PAL.text : COLOR.dim);
    medidor(ctx, 4, y + 10, 50, 4, vivo ? q.hp / q.maxHp : q.reviveProgress / REVIVE_TIME_S, PAL.xp, COLOR.xpTrack, vivo ? PAL.xp : COLOR.slot);
  });

  // Caído com aliado vivo: avisa que o aliado precisa chegar perto (no co-op, um aviso por jogador caído).
  humanos.forEach((h, i) => {
    if (h.hp > 0 || !world.players.some((q) => q !== h && q.hp > 0)) return;
    usarFonte(ctx, FONT_UI, 'center');
    const pct = h.reviveProgress > 0 ? ` ${Math.round((h.reviveProgress / REVIVE_TIME_S) * 100)}%` : '';
    const quem = coop ? `P${h.slot + 1} CAIU` : 'VOCÊ CAIU';
    textoContornado(ctx, `${quem}: UM ALIADO PRECISA CHEGAR PERTO${pct}`, W / 2, H - (coop ? 100 : 62) - i * 11, PAL.xp);
    ctx.textAlign = 'left';
  });

  // Conversa em andamento: lembrete de como pular.
  if (world.interactions.dialogue) {
    usarFonte(ctx, FONT_UI, 'center');
    textoContornado(ctx, 'Enter: pular conversa', W / 2, 24, COLOR.hint);
    ctx.textAlign = 'left';
  }

  if (debug) {
    usarFonte(ctx, FONT_UI);
    textoContornado(
      ctx,
      `${debug.fps.toFixed(0)} FPS · passo ${debug.simMs.toFixed(2)} ms · inimigos ${world.enemies.size} · proj. ${world.projectiles.size}`,
      4,
      chipsFim + 40,
      PAL.xp,
    );
  }
}

// ---------------------------------------------------------------- blocos de cada personagem (base à esquerda)

const INSTRUMENT_LABEL: Record<string, string> = {
  violao: 'VIOL',
  bateria: 'BAT',
  flauta: 'FLA',
  kazoo: 'KAZ',
  viola: 'VIOLA',
};

/** Instrumentos do Felipe: um slot de 28x22 por instrumento, com a barra de Inspiração (munição). O ativo tem moldura dupla. */
function drawFelipeHud(ctx: Ctx, s: FelipeState): void {
  const boxW = 28;
  const boxH = 22;
  const y = LOGICAL_HEIGHT - 44;
  s.owned.forEach((id, i) => {
    const x = 6 + i * (boxW + 7);
    const ativo = id === s.active;
    if (ativo) cardapio(ctx, x, y, boxW, boxH, s.tuneLeft > 0 ? COLOR.hint : PAL.accent);
    else placa(ctx, x, y, boxW, boxH, COLOR.slot);
    usarFonte(ctx, FONT_UI);
    texto(ctx, INSTRUMENT_LABEL[id] ?? id.toUpperCase(), x + 3, y + 2, ativo ? PAL.accent : COLOR.hint);
    medidor(ctx, x + 3, y + 16, 22, 3, s.ammo[id] / s.maxAmmo[id], ativo ? PAL.accent : COLOR.hint, ativo ? COLOR.weaponTrackOn : COLOR.weaponTrackOff, null);
  });
  if (s.tuneLeft > 0) {
    usarFonte(ctx, FONT_UI);
    textoContornado(ctx, 'AFINANDO...', 6, y - 12, COLOR.hint);
  }
}

/** Modo da aura (com nome e ícone próprios, não só cor), transição e efeitos ativos. */
function drawThayssaHud(ctx: Ctx, s: ThayssaState): void {
  const y = LOGICAL_HEIGHT - 44;
  const euforia = s.mode === 'euforia';
  const cor = euforia ? COR_EUFORIA : COR_SOBRECARGA;
  usarFonte(ctx, FONT_UI);
  // Ícones diferentes por modo: sol (Euforia) e losango (Sobrecarga).
  textoContornado(ctx, euforia ? '☀ EUFORIA' : '◆ SOBRECARGA', 6, y, cor);
  if (s.transitionLeft > 0) {
    textoContornado(ctx, 'TROCANDO...', 84, y, COLOR.hint);
    medidor(ctx, 6, y + 12, 90, 5, 1 - s.transitionLeft / duracaoDaTransicao(s), cor, COLOR.weaponTrackOff);
  } else {
    medidor(ctx, 6, y + 12, 90, 5, 1, cor, COLOR.weaponTrackOff);
  }
  const efeito = euforia ? '+20% mov. e ataque no anel' : '-25% dano recebido, +1 HP/s no anel';
  textoContornado(ctx, s.resonanceLeft > 0 ? `RESSONÂNCIA ${Math.ceil(s.resonanceLeft)}s: as duas auras` : `${efeito} · [F] troca`, 102, y + 11, PAL.text);
}

/** Pico de Glicose: um quadrado por acúmulo possível, cheio quando ativo. */
function drawThaisaHud(ctx: Ctx, p: Player, s: ThaisaState): void {
  const max = picoMax(s);
  const y = LOGICAL_HEIGHT - 44;
  usarFonte(ctx, FONT_UI);
  textoContornado(ctx, `PICO DE GLICOSE ${s.stacks.length}/${max}`, 6, y, PAL.accent);
  for (let i = 0; i < max; i++) {
    const x = 6 + i * 11;
    placa(ctx, x, y + 12, 9, 9, COLOR.slot);
    const t = s.stacks[i];
    if (t !== undefined) {
      // Quanto mais perto de sumir, mais baixo o preenchimento.
      const cheio = Math.min(1, t / PICO_STACK_DURATION_S);
      const alt = Math.max(1, Math.round(7 * cheio));
      rect(ctx, x + 1, y + 13 + (7 - alt), 7, alt, t < 1 ? COLOR.weaponTrackOn : PAL.accent);
    }
  }
  const b = bonusDoPico(s);
  textoContornado(
    ctx,
    `ATAQUE +${Math.round((b.attack - 1) * 100)}% · ARCO +${Math.round((b.arc - 1) * 100)}% · DANO +${Math.round((b.damage - 1) * 100)}%`,
    6 + max * 11 + 6,
    y + 12,
    PAL.text,
  );
  void p;
}

/** Recargas da Reação Exagerada e da Investida, Holofotes acertados e explosão de velocidade. */
function drawMelissaHud(ctx: Ctx, s: MelissaState): void {
  const y = LOGICAL_HEIGHT - 44;
  const reacaoReady = s.reacaoCd <= 0;
  usarFonte(ctx, FONT_UI);
  textoContornado(ctx, reacaoReady ? 'REAÇÃO: PRONTA' : `REAÇÃO: ${Math.ceil(s.reacaoCd)}s`, 6, y, reacaoReady ? PAL.neon1 : COLOR.hint);
  medidor(ctx, 6, y + 12, 70, 5, reacaoReady ? 1 : 1 - s.reacaoCd / REACAO_COOLDOWN_S, PAL.neon1, COLOR.hpTrack);
  if (s.mods.investida) {
    const dashReady = s.dashCd <= 0 || s.bisReady;
    textoContornado(ctx, dashReady ? 'INVESTIDA [F]' : `INVESTIDA ${Math.ceil(s.dashCd)}s`, 86, y, dashReady ? PAL.neon2 : COLOR.hint);
    medidor(ctx, 86, y + 12, 70, 5, dashReady ? 1 : 1 - s.dashCd / INVESTIDA_COOLDOWN_S, PAL.neon2, COLOR.weaponTrackOff);
  }
  textoContornado(ctx, `HOLOFOTES ACERTADOS: ${s.spotHits}${s.burstLeft > 0 ? ' · VELOZ!' : ''}`, 166, y + 11, PAL.text);
}

/** Foco, Conhecimento (bônus por abates), saltos e Recordação Perfeita do Mauro. */
function drawMauroHud(ctx: Ctx, p: Player, s: MauroState): void {
  const max = focoMax(s);
  const y = LOGICAL_HEIGHT - 44;
  usarFonte(ctx, FONT_UI);
  textoContornado(ctx, `FOCO ${Math.floor(s.foco)}/${max}`, 6, y, PAL.neon2);
  medidor(ctx, 6, y + 12, 90, 6, s.foco / max, PAL.neon2, COLOR.weaponTrackOff);
  const bonus = Math.round(conhecimentoBonus(p.kills) * 100);
  const perfeita = Math.round((recordacaoPerfeita(s.safeTime) - 1) * 100);
  textoContornado(ctx, `CONHECIMENTO +${bonus}% · SALTOS ${saltosPorConhecimento(p.kills)} · RECORDAÇÃO +${perfeita}%`, 102, y + 11, PAL.text);
}

export const RARITY_COLOR: Record<Rarity, string> = {
  comum: '#B8C0E0',
  rara: '#4DA3FF',
  epica: '#B76BFF',
  lendaria: '#FFB43C',
};

/** Ícone por raridade com formas diferentes (acessibilidade: não depende só da cor). */
export function drawRarityIcon(ctx: Ctx, rarity: Rarity, cx: number, cy: number): void {
  ctx.fillStyle = RARITY_COLOR[rarity];
  ctx.beginPath();
  switch (rarity) {
    case 'comum': // círculo
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      break;
    case 'rara': // losango
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx + 5, cy);
      ctx.lineTo(cx, cy + 5);
      ctx.lineTo(cx - 5, cy);
      break;
    case 'epica': // triângulo
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx + 5, cy + 4);
      ctx.lineTo(cx - 5, cy + 4);
      break;
    case 'lendaria': // estrela de 5 pontas
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 6 : 2.6;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      break;
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Barras de Sinergia do jogador (uma por parceiro, com o nome da dupla), a Ultimate em andamento
 * e, só no co-op com os cinco, a barra do Comitê. Ficam no canto direito, abaixo dos abates.
 */
function drawSynergyHud(ctx: Ctx, world: World, p: Player): void {
  const x = LOGICAL_WIDTH - 4;
  let y = 28;
  usarFonte(ctx, FONT_UI, 'right');
  for (const par of world.synergy.pairs) {
    if (par.a !== p.slot && par.b !== p.slot) continue;
    const parceiro = world.players[par.a === p.slot ? par.b : par.a];
    if (!parceiro) continue;
    const nome = nomeDaDupla(world, par).toUpperCase();
    const emUso = world.synergy.active.find((u) => u.a === par.a && u.b === par.b);
    const pronta = par.bar >= SYNERGY_MAX && par.cooldown <= 0;
    const perto = Math.hypot(p.x - parceiro.x, p.y - parceiro.y) <= SYNERGY_NEAR_PX;
    if (emUso) textoContornado(ctx, `${nome} ${Math.ceil(emUso.duration - emUso.t)}s`, x, y, PAL.accent);
    else if (pronta) textoContornado(ctx, `[G] ${nome}`, x, y, PAL.xp);
    else {
      const rec = par.cooldown > 0 ? ` (${Math.ceil(par.cooldown)}s)` : '';
      textoContornado(ctx, `${nome} ${Math.floor(par.bar)}%${rec}`, x, y, perto ? PAL.text : COLOR.dim);
    }
    medidor(ctx, x - 70, y + 11, 70, 4, par.bar / SYNERGY_MAX, pronta ? PAL.xp : PAL.neon1, COLOR.weaponTrackOff);
    y += 19;
  }
  const c = world.synergy.committee;
  if (world.players.length === 5) {
    const pronta = c.bar >= SYNERGY_MAX && c.cooldown <= 0;
    textoContornado(
      ctx,
      c.t >= 0 ? 'SAIDEIRA!' : pronta ? '[G] SAIDEIRA (COMITÊ)' : `COMITÊ ${Math.floor(c.bar)}%${c.cooldown > 0 ? ` (${Math.ceil(c.cooldown)}s)` : ''}`,
      x,
      y,
      c.t >= 0 ? PAL.accent : pronta ? PAL.xp : PAL.text,
    );
    medidor(ctx, x - 70, y + 11, 70, 4, c.bar / SYNERGY_MAX, PAL.accent, COLOR.weaponTrackOn);
  }
  ctx.textAlign = 'left';
}

/** Barra de vida do chefe, no topo, abaixo do relógio. */
function drawBossBar(ctx: Ctx, world: World): void {
  const chefe = world.enemies.active.find((e) => e.alive && e.def.boss && e.leader === 0);
  if (!chefe) return;
  const frac = chefe.hp / (chefe.aiX || chefe.hp);
  const w = 200;
  const x = Math.round((LOGICAL_WIDTH - w) / 2);
  usarFonte(ctx, FONT_UI, 'center');
  textoContornado(ctx, chefe.def.name.toUpperCase(), LOGICAL_WIDTH / 2, 24, PAL.neon1);
  medidor(ctx, x, 36, w, 7, frac, PAL.neon1, COLOR.hpTrack, PAL.accent);
  ctx.textAlign = 'left';
}

/** Balão de fala/aviso na parte de baixo da tela. Mostra a primeira mensagem da fila. */
function drawMessage(ctx: Ctx, world: World): void {
  const m = world.messages[0];
  if (!m) return;
  const t = m.speaker ? `${m.speaker}: ${m.text}` : m.text;
  usarFonte(ctx, FONT_UI, 'center');
  const linhas = wrapText(ctx, t, 300);
  const h = linhas.length * 10 + 10;
  const w = 320;
  const x = Math.round((LOGICAL_WIDTH - w) / 2);
  const y = LOGICAL_HEIGHT - 70 - h;
  if (m.speaker) {
    // Fala de personagem: balão claro com contorno ciano.
    rect(ctx, x, y, w, h, PAL.text);
    contorno(ctx, x, y, w, h, PAL.neon2);
    linhas.forEach((l, i) => texto(ctx, l, LOGICAL_WIDTH / 2, y + 5 + i * 10, PAL.plate));
  } else {
    cardapio(ctx, x, y, w, h);
    linhas.forEach((l, i) => texto(ctx, l, LOGICAL_WIDTH / 2, y + 5 + i * 10, PAL.text));
  }
  ctx.textAlign = 'left';
}

/** Pano escuro de fundo dos painéis modais. */
function escurecer(ctx: Ctx, alfa = 0.62): void {
  rect(ctx, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, `rgba(7,9,20,${alfa})`);
}

/** Os três conselhos do Lucas. O jogo fica pausado até alguém escolher (teclas 1, 2 ou 3). */
export function drawAdvice(ctx: Ctx, options: readonly { text: string }[]): void {
  setPalette('respiro');
  escurecer(ctx);
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, '— LUCAS OFERECE TRÊS CONSELHOS —', LOGICAL_WIDTH / 2, 40, PAL.accent);
  usarFonte(ctx, FONT_UI);
  const larg = LOGICAL_WIDTH - 140;
  options.forEach((o, i) => {
    const y = 62 + i * 44;
    cardapio(ctx, 70, y, larg, 34);
    rect(ctx, 76, y + 8, 18, 18, PAL.neon2);
    usarFonte(ctx, FONT_LABEL, 'center');
    texto(ctx, String(i + 1), 85, y + 13, PAL.bg);
    usarFonte(ctx, FONT_UI);
    ctx.textAlign = 'left';
    wrapText(ctx, o.text, larg - 44).forEach((l, li) => texto(ctx, l, 102, y + 8 + li * 10, PAL.text));
  });
  usarFonte(ctx, FONT_UI, 'center');
  texto(ctx, 'Pressione 1, 2 ou 3', LOGICAL_WIDTH / 2, 62 + options.length * 44 + 4, COLOR.hint);
  ctx.textAlign = 'left';
}

/** Painel central de fim de partida (derrota e vitória). */
function painelFinal(ctx: Ctx, titulo: string, corTitulo: string, linhas: [string, string][]): void {
  escurecer(ctx);
  const w = Math.min(280, LOGICAL_WIDTH - 20);
  const h = 30 + linhas.length * 12 + 18;
  const x = Math.round((LOGICAL_WIDTH - w) / 2);
  const y = Math.round((LOGICAL_HEIGHT - h) / 2);
  cardapio(ctx, x, y, w, h);
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, `— ${titulo} —`, x + w / 2, y + 7, corTitulo);
  usarFonte(ctx, FONT_UI, 'center');
  linhas.forEach(([t, cor], i) => texto(ctx, t, x + w / 2, y + 24 + i * 12, cor));
  texto(ctx, 'R recomeçar · Esc menu', x + w / 2, y + h - 14, COLOR.hint);
  ctx.textAlign = 'left';
}

/** Vitória provisória. O epílogo completo (A.11) entra na Fase 11. */
export function drawVictory(ctx: Ctx): void {
  painelFinal(ctx, 'ÚLTIMA SEXTA DO ANO', PAL.accent, [
    ['O Burocrata foi derrotado.', PAL.text],
    ['O epílogo chega na Fase 11.', COLOR.hint],
  ]);
}

const KIND_LABEL: Record<string, string> = {
  exclusive: 'exclusiva',
  team: 'equipe',
  weapon: 'arma',
  passive: 'passiva',
};

export function drawChoice(ctx: Ctx, choice: PendingChoice, player: Player | undefined, coop = false, device: DeviceId = 'teclado1', keymaps: readonly KeyMap[] = [], aguardando = false): void {
  setPalette('respiro');
  escurecer(ctx, 0.66);

  const compacto = LOGICAL_HEIGHT < 250; // texto "Maior" e janelas baixas: menos folga em volta das cartas
  const quem = coop ? `P${choice.slot + 1} · ` : '';
  const teclas = cartasDoDispositivo(device, keymaps);
  const nomes = teclas.escolher.map(keyLabel);
  const dica = teclas.rerolar === null ? 'Escolher: botões A, B ou X' : `Escolher: ${nomes.join(', ')}`;
  const rerolarTxt = teclas.rerolar === null ? 'Y' : keyLabel(teclas.rerolar).toUpperCase();
  const banirTxt = teclas.rerolar === null ? null : `SHIFT+${nomes.join('/')}`.toUpperCase();
  const title = quem + (choice.level <= 1 ? 'Início da partida: escolha uma carta' : `Nível ${choice.level}: escolha uma carta`);
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, `— ${title.toUpperCase()} —`, LOGICAL_WIDTH / 2, compacto ? 8 : 28, PAL.accent);

  const gap = 12;
  const cardW = Math.min(140, Math.floor((LOGICAL_WIDTH - 12 - gap * 2) / 3));
  const y = compacto ? 24 : 48;
  const cardH = Math.min(140, LOGICAL_HEIGHT - y - 44);
  const total = choice.cards.length * cardW + (choice.cards.length - 1) * gap;
  const startX = Math.round((LOGICAL_WIDTH - total) / 2);

  choice.cards.forEach((card, i) => {
    const x = startX + i * (cardW + gap);
    const nivel = choice.levels[i] ?? 1;
    const cor = RARITY_COLOR[card.rarity];
    cardapio(ctx, x, y, cardW, cardH, cor);

    // Número da tecla e raridade (com o ícone próprio).
    rect(ctx, x + 6, y + 6, 12, 12, PAL.neon2);
    usarFonte(ctx, FONT_LABEL, 'center');
    texto(ctx, String(i + 1), x + 12, y + 8, PAL.bg);
    drawRarityIcon(ctx, card.rarity, x + 28, y + 12);
    usarFonte(ctx, FONT_UI);
    texto(ctx, RARITY_LABEL[card.rarity].toUpperCase(), x + 37, y + 8, cor);

    usarFonte(ctx, FONT_UI, 'center');
    const nameLines = wrapText(ctx, card.name.toUpperCase(), cardW - 12);
    nameLines.forEach((line, li) => texto(ctx, line, x + cardW / 2, y + 26 + li * 10, PAL.text));
    wrapText(ctx, card.description, cardW - 16).forEach((line, li) => {
      texto(ctx, line, x + cardW / 2, y + 26 + nameLines.length * 10 + 8 + li * 10, COLOR.hint);
    });
    // Rodapé: tipo da carta e, se for repetida, o nível que ela vai atingir.
    usarFonte(ctx, FONT_UI, 'center');
    texto(ctx, (KIND_LABEL[kindOf(card)] ?? '').toUpperCase(), x + cardW / 2 - (nivel > 1 ? 24 : 0), y + cardH - 13, COLOR.dim);
    if (nivel > 1) texto(ctx, `SOBE P/ NV ${nivel}`, x + cardW / 2 + 26, y + cardH - 13, PAL.accent);
  });

  const rerolls = player ? rerollsRestantes(player) : 0;
  const bans = player?.bans ?? 0;
  usarFonte(ctx, FONT_UI, 'center');
  if (aguardando) {
    // Online: a carta é de outro jogador; os demais só esperam (e veem o que foi oferecido).
    texto(ctx, `AGUARDANDO P${choice.slot + 1} ESCOLHER...`, LOGICAL_WIDTH / 2, y + cardH + 14, PAL.accent);
    ctx.textAlign = 'left';
    return;
  }
  texto(ctx, coop ? `${dica}  ·  controle: A, B ou X` : dica, LOGICAL_WIDTH / 2, y + cardH + 8, COLOR.hint);
  texto(ctx, `[${rerolarTxt}] REROLAR (${rerolls})`, LOGICAL_WIDTH / 2 - 70, y + cardH + 22, rerolls > 0 ? PAL.neon2 : COLOR.dim);
  if (banirTxt) texto(ctx, `[${banirTxt}] BANIR (${bans})`, LOGICAL_WIDTH / 2 + 60, y + cardH + 22, bans > 0 ? PAL.neon1 : COLOR.dim);
  ctx.textAlign = 'left';
}

export function drawGameOver(ctx: Ctx, world: World): void {
  setPalette('queda');
  const kills = world.players.reduce((s, p) => s + p.kills, 0);
  painelFinal(ctx, 'FIM DE JOGO', PAL.neon1, [
    [`Abates: ${kills}`, PAL.text],
  ]);
}
