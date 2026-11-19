// Desenho dos menus (lógica em menu.ts), no estilo "Neon de boteco / VHS" (ver ui/theme.ts).
// Tudo em canvas, na resolução lógica dinâmica. O layout de referência é 480x270 e se adapta a telas menores e mais largas.

import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../data/balance';
import { CHARACTERS, type CharacterId } from '../data/characters';
import type { SpriteManager } from '../graphics/spriteManager';
import { formatDuration } from '../game/meta';
import { KEY_ACTIONS } from '../game/settings';
import { RARITY_LABEL } from '../data/cards';
import { COLLECTIBLES } from '../data/gallery';
import { CODEX, CODEX_ORDER } from '../data/codex';
import { CHARACTER_ORDER, Menu, soonText } from './menu';
import { drawRarityIcon, RARITY_COLOR, wrapText } from './hud';
import {
  botao,
  cardapio,
  COLOR,
  FONT_LABEL,
  FONT_LOGO,
  FONT_SMALL_TITLE,
  FONT_UI,
  icone,
  linhaDeMenu,
  PAL,
  placa,
  pontilhado,
  rect,
  scanlines,
  setPalette,
  texto,
  usarFonte,
} from './theme';

const BLURB: Record<CharacterId, string[]> = {
  felipe: ['Troca entre violão, bateria, flauta e kazoo.', 'Cada instrumento gasta munição própria.'],
  mauro: ['Livros em órbita, Foco e marcações.', 'Pouca vida, muito XP.'],
  melissa: ['Florete rápido. Golpe pelas costas é crítico.', 'Rápida, frágil, adora uma entrada.'],
  thaisa: ['Violoncelo pesado e muita vida.', 'Comida dá Pico de Glicose.'],
  thayssa: ['Megafone, auras de Euforia e Sobrecarga.', 'Apoia quem está por perto.'],
};

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- peças comuns

/** Fundo dos menus: azul-noite com a faixa de céu em xadrez e o chão no fim. */
function fundo(ctx: Ctx): void {
  const W = LOGICAL_WIDTH;
  const H = LOGICAL_HEIGHT;
  rect(ctx, 0, 0, W, H, PAL.bg);
  pontilhado(ctx, 0, 0, W, Math.round((H * 120) / 270), '#0E1540');
  const chao = Math.round((H * 206) / 270);
  rect(ctx, 0, chao, W, H - chao, '#070A22');
  ctx.globalAlpha = 0.35;
  rect(ctx, 0, chao, W, 1, PAL.neon2);
  ctx.globalAlpha = 1;
}

/** Rodapé de dicas de controle (a única parte do texto de menu que fica em minúsculas). */
function rodape(ctx: Ctx, t: string): void {
  usarFonte(ctx, FONT_UI, 'center');
  texto(ctx, t, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 14, COLOR.hint);
  ctx.textAlign = 'left';
}

/** Painel de cardápio centralizado, com o cabeçalho "— TÍTULO —". Devolve a área útil. */
function painel(ctx: Ctx, w: number, h: number, titulo: string, top?: number): { x: number; y: number; w: number; h: number } {
  const x = Math.round((LOGICAL_WIDTH - w) / 2);
  const y = top ?? Math.max(8, Math.round((LOGICAL_HEIGHT - h) / 2) - 6);
  cardapio(ctx, x, y, w, h);
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, `— ${titulo.toUpperCase()} —`, x + w / 2, y + 5, PAL.accent);
  ctx.textAlign = 'left';
  return { x, y, w, h };
}

/** Lista de itens do menu dentro de um painel. Registra as áreas clicáveis. */
function listaNoPainel(ctx: Ctx, menu: Menu, p: { x: number; y: number; w: number }, rowH: number): void {
  const itens = menu.items();
  const x = p.x + 6;
  const w = p.w - 12;
  itens.forEach((it, i) => {
    const y = p.y + 16 + i * (rowH + 1);
    linhaDeMenu(ctx, x, y, w, rowH, it.label, it.value, { foco: i === menu.cursor, desabilitada: it.disabled });
    menu.hits.push({ x, y, w, h: rowH, index: i });
  });
}

/** Altura de linha que cabe: até `max`, no mínimo 9. */
function alturaDaLinha(n: number, area: number, max = 15): number {
  return Math.max(9, Math.min(max, Math.floor(area / Math.max(1, n)) - 1));
}

// ---------------------------------------------------------------- tela de título

/** Cenário da sala: janela com a cidade, sofá com o Comitê e a silhueta do Lucas. `ox`/`oy`: origem da cena de 480x270. */
function cenario(ctx: Ctx, sprites: SpriteManager, ox: number, oy: number, tick: number): void {
  const x = (v: number): number => ox + v;
  const y = (v: number): number => oy + v;
  // Janela.
  rect(ctx, x(272), y(22), 124, 104, COLOR.outline);
  rect(ctx, x(274), y(24), 120, 100, PAL.bg2);
  rect(ctx, x(350), y(38), 10, 10, '#DFE8FF');
  const predios: [number, number, number, number][] = [
    [278, 80, 22, 44],
    [304, 64, 18, 60],
    [338, 72, 24, 52],
    [366, 86, 22, 38],
  ];
  const luz = ['#FFB43C', '#3FF0FF', '#FF4FA3'];
  predios.forEach(([bx, by, bw, bh], i) => {
    rect(ctx, x(bx), y(by), bw, bh, PAL.bg);
    for (let jy = by + 6; jy < by + bh - 4; jy += 9) {
      for (let jx = bx + 3; jx < bx + bw - 3; jx += 7) {
        if ((jx + jy + i) % 3 === 0) rect(ctx, x(jx), y(jy), 3, 3, luz[(jx + jy) % 3]!);
      }
    }
  });
  rect(ctx, x(333), y(24), 2, 100, COLOR.outline); // montante
  // Sofá.
  rect(ctx, x(254), y(170), 210, 24, '#2A1F4A');
  rect(ctx, x(254), y(194), 210, 12, '#1D1538');
  // Comitê sentado.
  const sentados: [CharacterId, number][] = [
    ['felipe', 282],
    ['mauro', 310],
    ['melissa', 336],
    ['thaisa', 366],
    ['thayssa', 396],
  ];
  sentados.forEach(([id, cx], i) => {
    const frame = Math.floor(tick / 40 + i) % 2 === 0 ? 'idle0' : 'idle1';
    sprites.desenhar(ctx, id, frame, x(cx), y(200), 1);
  });
  rect(ctx, x(246), y(160), 10, 46, '#33265A');
  rect(ctx, x(462), y(160), 10, 46, '#33265A');
  // Lucas: silhueta com o cajado brilhando.
  pontilhado(ctx, x(430), y(116), 36, 36, '#1F6B3A');
  rect(ctx, x(426), y(140), 10, 10, '#04050F');
  rect(ctx, x(422), y(150), 18, 50, '#04050F');
  rect(ctx, x(444), y(130), 2, 70, '#6A4A2A');
  rect(ctx, x(441), y(125), 8, 8, '#1F6B3A');
  rect(ctx, x(442), y(126), 6, 6, PAL.xp);
  rect(ctx, x(443), y(127), 4, 4, '#EAFFD0');
}

function drawTitle(ctx: Ctx, menu: Menu, sprites: SpriteManager, tick: number): void {
  const W = LOGICAL_WIDTH;
  const H = LOGICAL_HEIGHT;
  fundo(ctx);
  // A composição de referência tem 480 px de largura: em telas largas fica centralizada, em estreitas o cenário vai para a direita.
  const ux = W >= 480 ? Math.round((W - 480) / 2) : 0;
  const sx = W >= 480 ? ux : W - 480;
  const completo = H >= 250;
  const medio = H >= 200;
  const oy = H - 270;
  if (W >= 440) cenario(ctx, sprites, sx, oy, tick);
  else {
    ctx.globalAlpha = 0.45;
    cenario(ctx, sprites, sx, oy, tick);
    ctx.globalAlpha = 1;
  }

  // HUD de fita: ▶ PLAY e a data.
  usarFonte(ctx, FONT_LABEL);
  ctx.fillStyle = PAL.neon1;
  ctx.fillRect(ux + 14, 14, 1, 7);
  ctx.fillRect(ux + 15, 15, 1, 5);
  ctx.fillRect(ux + 16, 16, 1, 3);
  texto(ctx, 'PLAY', ux + 21, 14, PAL.neon1);
  ctx.textAlign = 'right';
  texto(ctx, 'SEX 23:47', ux + 480 - 14, 14, '#DFE8FF');
  ctx.textAlign = 'left';

  // Logo: sobretítulo ciano e "SEXTA-FEIRA" em tubo de neon rosa.
  const yTop = completo ? 30 : medio ? 28 : 28;
  usarFonte(ctx, medio ? FONT_SMALL_TITLE : FONT_LABEL);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) texto(ctx, 'A PROFECIA DE', ux + 20 + dx, yTop + dy, COLOR.neonCyanDark);
  texto(ctx, 'A PROFECIA DE', ux + 20, yTop, PAL.neon2);

  const logoY = yTop + (medio ? 14 : 10);
  ctx.font = medio ? FONT_LOGO : '28px "Jersey 10", monospace';
  ctx.textBaseline = 'top';
  for (let r = 2; r >= 1; r--) {
    ctx.fillStyle = r === 2 ? COLOR.logoTube : PAL.neon1;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ctx.fillText('SEXTA-FEIRA', ux + 16 + dx, logoY + dy);
      }
    }
  }
  texto(ctx, 'SEXTA-FEIRA', ux + 16, logoY, COLOR.logoFill);
  const logoH = medio ? 46 : 28;
  if (completo) {
    usarFonte(ctx, FONT_LABEL);
    texto(ctx, '★ O COMITÊ EM: ABERTO ATÉ A SAIDEIRA ★', ux + 20, logoY + logoH + 4, PAL.accent);
  }

  // Painel "Cardápio" com as sete entradas.
  const itens = menu.items();
  const topo = completo ? 108 : logoY + logoH + 6;
  const area = H - topo - 30;
  const rowH = alturaDaLinha(itens.length, area - 20);
  const h = 16 + itens.length * (rowH + 1) + 4;
  const p = { x: ux + 20, y: topo, w: 168, h };
  cardapio(ctx, p.x, p.y, p.w, p.h);
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, '— CARDÁPIO —', p.x + p.w / 2, p.y + 5, PAL.accent);
  ctx.textAlign = 'left';
  listaNoPainel(ctx, menu, p, rowH);
  // Na linha "SOLO" o rótulo "1P" fica à direita (como na referência).
  if (menu.cursor === 0 && itens[0]?.value === undefined) {
    usarFonte(ctx, FONT_UI, 'right');
    texto(ctx, '1P', p.x + p.w - 10, p.y + 16 + Math.round((rowH - 9) / 2) - 1, PAL.bg);
    ctx.textAlign = 'left';
  }
  rodape(ctx, '↑↓ escolher · Enter confirmar · Esc voltar');

  // Jitter de fita: de vez em quando, uma faixa de 3 linhas treme 1 px por 2 quadros.
  const ciclo = tick % 420;
  if (ciclo < 2) {
    const faixa = (Math.floor(tick / 420) * 53) % Math.max(10, H - 10);
    ctx.drawImage(ctx.canvas, 0, faixa, W, 3, 1, faixa, W, 3);
  }
}

// ---------------------------------------------------------------- demais telas

export function drawMenu(ctx: Ctx, menu: Menu, sprites: SpriteManager, tick: number): void {
  menu.hits = [];
  ctx.imageSmoothingEnabled = false;
  setPalette('respiro');

  switch (menu.screen) {
    case 'title':
      drawTitle(ctx, menu, sprites, tick);
      break;
    case 'pause': {
      rect(ctx, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 'rgba(7,9,20,0.72)');
      const itens = menu.items();
      const rowH = alturaDaLinha(itens.length, LOGICAL_HEIGHT - 80, 15);
      const p = painel(ctx, 168, 16 + itens.length * (rowH + 1) + 4, 'Pausa');
      listaNoPainel(ctx, menu, p, rowH);
      rodape(ctx, 'Esc continua');
      break;
    }
    case 'options': {
      fundo(ctx);
      const itens = menu.items();
      const rowH = alturaDaLinha(itens.length, LOGICAL_HEIGHT - 56, 14);
      const p = painel(ctx, Math.min(280, LOGICAL_WIDTH - 20), 16 + itens.length * (rowH + 1) + 4, 'Opções');
      listaNoPainel(ctx, menu, p, rowH);
      rodape(ctx, '↑↓ escolher · ←→ mudar · Esc voltar');
      break;
    }
    case 'gallery':
      fundo(ctx);
      drawGallery(ctx, menu, sprites);
      break;
    case 'codex':
      fundo(ctx);
      drawCodex(ctx, menu);
      break;
    case 'dev': {
      fundo(ctx);
      const itens = menu.items();
      const rowH = alturaDaLinha(itens.length, LOGICAL_HEIGHT - 56, 14);
      const p = painel(ctx, Math.min(340, LOGICAL_WIDTH - 20), 16 + itens.length * (rowH + 1) + 4, 'Modo Dev');
      listaNoPainel(ctx, menu, p, rowH);
      rodape(ctx, '↑↓ escolher · ←→ mudar · Enter começa · Esc voltar');
      break;
    }
    case 'lobby': {
      fundo(ctx);
      const itens = menu.items();
      const rowH = alturaDaLinha(itens.length, LOGICAL_HEIGHT - 56, 12);
      const p = painel(ctx, Math.min(340, LOGICAL_WIDTH - 20), 16 + itens.length * (rowH + 1) + 4, 'Co-op Local');
      listaNoPainel(ctx, menu, p, rowH);
      rodape(ctx, '↑↓ escolher · ←→ mudar · Enter começa · Esc voltar');
      break;
    }
    case 'controls':
      fundo(ctx);
      drawControls(ctx, menu);
      break;
    case 'cards':
      drawCardsScreen(ctx, menu);
      break;
    case 'select':
      fundo(ctx);
      drawSelect(ctx, menu, sprites, tick);
      break;
    case 'upgrades':
      fundo(ctx);
      drawUpgrades(ctx, menu);
      break;
    case 'about':
      fundo(ctx);
      drawAbout(ctx);
      break;
    case 'soon': {
      fundo(ctx);
      const [t, ...rest] = soonText(menu.soon);
      const p = painel(ctx, Math.min(260, LOGICAL_WIDTH - 20), 20 + rest.length * 12 + 10, (t ?? '').toUpperCase());
      usarFonte(ctx, FONT_UI, 'center');
      rest.forEach((l, i) => texto(ctx, l, p.x + p.w / 2, p.y + 18 + i * 12, PAL.text));
      ctx.textAlign = 'left';
      rodape(ctx, 'Enter ou Esc para voltar');
      break;
    }
  }
  if (menu.screen !== 'cards') scanlines(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}

const KIND_NAME: Record<string, string> = { exclusive: 'exclusiva', team: 'equipe', weapon: 'arma', passive: 'passiva' };

/** Cartas de cada jogador (as minhas e as dos aliados): abas por jogador, lista rolável e descrição embaixo. */
function drawCardsScreen(ctx: Ctx, menu: Menu): void {
  rect(ctx, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 'rgba(7,9,20,0.94)');
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, '— CARTAS —', LOGICAL_WIDTH / 2, 6, PAL.accent);

  // Abas (uma por jogador).
  const abas = menu.cards;
  const largura = Math.min(320, LOGICAL_WIDTH - 20);
  const x0 = Math.round((LOGICAL_WIDTH - largura) / 2);
  const tabW = Math.floor(largura / Math.max(1, abas.length));
  abas.forEach((a, i) => {
    const x = x0 + i * tabW;
    botao(ctx, x, 18, tabW - 2, 14, a.label, { foco: i === menu.cardsTab });
    menu.hits.push({ x, y: 18, w: tabW - 2, h: 14, index: 100 + i });
  });

  const atual = menu.currentCards();
  if (!atual) return;
  usarFonte(ctx, FONT_UI, 'center');
  texto(ctx, atual.stats.toUpperCase(), LOGICAL_WIDTH / 2, 36, PAL.neon2);

  // Lista rolável.
  const topo = 49;
  const rowH = 11;
  const detalheH = 46;
  const visiveis = Math.max(3, Math.floor((LOGICAL_HEIGHT - topo - detalheH - 20) / rowH));
  const n = atual.entries.length;
  if (n === 0) texto(ctx, 'NENHUMA CARTA ESCOLHIDA AINDA.', LOGICAL_WIDTH / 2, topo + 20, COLOR.dim);
  const cursor = Math.min(menu.cursor, Math.max(0, n - 1));
  const inicio = Math.max(0, Math.min(n - visiveis, cursor - Math.floor(visiveis / 2)));
  for (let k = 0; k < Math.min(visiveis, n); k++) {
    const i = inicio + k;
    const c = atual.entries[i]!;
    const y = topo + k * rowH;
    const sel = i === cursor;
    if (sel) rect(ctx, x0 - 2, y, largura + 4, rowH - 1, PAL.neon2);
    drawRarityIcon(ctx, c.rarity, x0 + 7, y + rowH / 2 - 0.5);
    usarFonte(ctx, FONT_UI);
    texto(ctx, c.name.toUpperCase(), x0 + 18, y + 1, sel ? PAL.bg : PAL.text);
    ctx.textAlign = 'right';
    texto(ctx, c.maxLevel > 1 ? `NV ${c.level}/${c.maxLevel}` : (KIND_NAME[c.kind] ?? '').toUpperCase(), x0 + largura, y + 1, sel ? PAL.bg : c.maxLevel > 1 ? PAL.accent : COLOR.dim);
    ctx.textAlign = 'left';
    menu.hits.push({ x: x0 - 2, y, w: largura + 4, h: rowH - 1, index: i });
  }
  // Barra de rolagem.
  if (n > visiveis) {
    const alturaTotal = visiveis * rowH;
    const h = Math.max(6, (visiveis / n) * alturaTotal);
    const y = topo + (inicio / (n - visiveis)) * (alturaTotal - h);
    rect(ctx, x0 + largura + 5, topo, 1, alturaTotal, COLOR.slot);
    rect(ctx, x0 + largura + 4, y, 3, h, PAL.accent);
  }

  // Descrição da carta selecionada, numa placa com a moldura na cor da raridade.
  const sel = atual.entries[cursor];
  if (sel) {
    const dy = LOGICAL_HEIGHT - detalheH - 18;
    cardapio(ctx, x0, dy, largura, detalheH, RARITY_COLOR[sel.rarity]);
    usarFonte(ctx, FONT_UI);
    texto(ctx, `${sel.name} · ${RARITY_LABEL[sel.rarity]} · ${KIND_NAME[sel.kind] ?? ''}`.toUpperCase(), x0 + 8, dy + 4, RARITY_COLOR[sel.rarity]);
    wrapText(ctx, sel.description, largura - 16)
      .slice(0, 3)
      .forEach((l, i) => texto(ctx, l, x0 + 8, dy + 16 + i * 10, PAL.text));
  }
  rodape(ctx, '↑↓ cartas · ←→ jogador · Tab ou Esc voltar');
}

function drawControls(ctx: Ctx, menu: Menu): void {
  const itens = menu.items();
  const compacto = LOGICAL_HEIGHT < 230;
  const rowH = compacto ? 10 : 12;
  const colW = Math.min(150, Math.floor((LOGICAL_WIDTH - 40) / 2));
  const gap = 10;
  const larguraPainel = colW * 2 + gap + 12;
  const linhas = KEY_ACTIONS.length;
  const alturaPainel = 16 + 12 + linhas * (rowH + 1) + (compacto ? 4 : 8) + 2 * (rowH + 2) + 6;
  const p = painel(ctx, larguraPainel, alturaPainel, 'Controles', compacto ? 6 : 24);
  const x0 = p.x + 6;
  const top = p.y + 28;

  for (let c = 0; c < 2; c++) {
    const x = x0 + c * (colW + gap);
    usarFonte(ctx, FONT_LABEL);
    texto(ctx, c === 0 ? 'JOGADOR 1' : 'JOGADOR 2', x, p.y + 17, PAL.neon1);
    for (let a = 0; a < linhas; a++) {
      const i = c * linhas + a;
      const it = itens[i]!;
      const y = top + a * (rowH + 1);
      const sel = menu.cursor === i;
      const esperando = menu.capturing !== null && sel;
      linhaDeMenu(ctx, x, y, colW, rowH, it.label, esperando ? '...' : it.value, { foco: sel });
      menu.hits.push({ x, y, w: colW, h: rowH, index: i });
    }
  }
  // Botões (restaurar padrões) e avisos.
  const by = top + linhas * (rowH + 1) + (compacto ? 4 : 8);
  for (let k = linhas * 2; k < itens.length; k++) {
    const it = itens[k]!;
    const y = by + (k - linhas * 2) * (rowH + 2);
    const sel = menu.cursor === k;
    const bw = 140;
    botao(ctx, Math.round(LOGICAL_WIDTH / 2 - bw / 2), y, bw, rowH + 1, it.label, { foco: sel, desabilitada: it.disabled });
    menu.hits.push({ x: Math.round(LOGICAL_WIDTH / 2 - bw / 2), y, w: bw, h: rowH + 1, index: k });
  }
  rodape(ctx, 'Enter troca a tecla · ←→ outra coluna · Pausa: Esc');
}

function drawSelect(ctx: Ctx, menu: Menu, sprites: SpriteManager, tick: number): void {
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, '— ESCOLHA SEU PERSONAGEM —', LOGICAL_WIDTH / 2, 8, PAL.accent);
  const cell = Math.min(72, Math.floor((LOGICAL_WIDTH - 20) / 5));
  // A altura dos sprites varia (PNGs externos); a escala é a maior que ainda deixa a ficha inteira na tela.
  const hMax = Math.max(...CHARACTER_ORDER.map((id) => sprites.get(id).h));
  const escala = [3, 2, 1].find((e) => 150 + hMax * e <= LOGICAL_HEIGHT) ?? 1;
  const x0 = Math.round((LOGICAL_WIDTH - cell * 5) / 2);
  const top = 22;
  const altura = hMax * escala + 8;

  CHARACTER_ORDER.forEach((id, i) => {
    const sel = menu.character === id;
    const x = x0 + i * cell;
    const s = sprites.get(id);
    if (sel) cardapio(ctx, x + 3, top + 1, cell - 6, altura - 2);
    else placa(ctx, x + 2, top, cell - 4, altura, COLOR.slot);
    const frame = sel && Math.floor(tick / 30) % 2 === 1 ? s.frames.idle1 : s.frames.idle0;
    const w = s.w * escala;
    const h = s.h * escala;
    ctx.drawImage(frame, Math.round(x + (cell - w) / 2), top + altura - 4 - h, w, h);
    usarFonte(ctx, FONT_UI, 'center');
    if (sel) {
      const nomeW = cell - 6;
      rect(ctx, x + 3, top + altura + 5, nomeW, 11, PAL.neon2);
      texto(ctx, CHARACTERS[id].name.toUpperCase(), x + cell / 2, top + altura + 6, PAL.bg);
    } else {
      texto(ctx, CHARACTERS[id].name.toUpperCase(), x + cell / 2, top + altura + 6, COLOR.dim);
    }
    ctx.textAlign = 'left';
    menu.hits.push({ x: x + 2, y: top, w: cell - 4, h: altura + 16, index: i });
  });

  // Ficha do personagem escolhido.
  const c = CHARACTERS[menu.character];
  let y = top + altura + 22;
  usarFonte(ctx, FONT_UI, 'center');
  texto(ctx, c.title.toUpperCase(), LOGICAL_WIDTH / 2, y, PAL.accent);
  y += 11;
  texto(ctx, `VIDA ${c.maxHp}  ·  VELOCIDADE ${Math.round(c.speed * 100)}%`, LOGICAL_WIDTH / 2, y, PAL.neon2);
  y += 11;
  for (const l of BLURB[menu.character]) {
    texto(ctx, l, LOGICAL_WIDTH / 2, y, PAL.text);
    y += 10;
  }

  // Companheiro IA e botão de jogar.
  y += 6;
  const comp = menu.companion ? CHARACTERS[menu.companion].name : 'Nenhum';
  const bw = Math.min(200, LOGICAL_WIDTH - 20);
  const bx = Math.round((LOGICAL_WIDTH - bw) / 2);
  botao(ctx, bx, y, bw, 14, `Companheiro IA:  < ${comp} >`, { foco: menu.cursor === 1 });
  menu.hits.push({ x: bx, y, w: bw, h: 14, index: 5 });
  botao(ctx, bx, y + 16, bw, 14, 'Jogar', { foco: menu.cursor === 2 });
  menu.hits.push({ x: bx, y: y + 16, w: bw, h: 14, index: 6 });
  ctx.textAlign = 'left';
  rodape(ctx, '←→ trocar · ↑↓ linha · Enter jogar · Esc voltar');
}

function drawUpgrades(ctx: Ctx, menu: Menu): void {
  const m = menu.meta;
  const linhas: [string, string][] = [
    ['Partidas', String(m.runs)],
    ['Vitórias', String(m.wins)],
    ['Abates (total)', String(m.totalKills)],
    ['Mais abates numa partida', String(m.bestKills)],
    ['Maior tempo', formatDuration(m.bestTime)],
  ];
  const w = Math.min(280, LOGICAL_WIDTH - 20);
  const h = 22 + 2 * 11 + linhas.length * 11 + 8 + CHARACTER_ORDER.length * 10 + 6;
  const p = painel(ctx, w, h, 'Melhorias', 8);
  usarFonte(ctx, FONT_UI, 'center');
  texto(ctx, 'EM CONSTRUÇÃO', p.x + w / 2, p.y + 17, PAL.neon1);
  texto(ctx, 'A árvore de melhorias ainda não existe. Seu histórico:', p.x + w / 2, p.y + 28, COLOR.hint);
  ctx.textAlign = 'left';
  const x = p.x + 8;
  const largura = w - 16;
  let y = p.y + 44;
  linhas.forEach(([k, v]) => {
    texto(ctx, k.toUpperCase(), x, y, PAL.text);
    ctx.textAlign = 'right';
    texto(ctx, v.toUpperCase(), x + largura, y, PAL.accent);
    ctx.textAlign = 'left';
    y += 11;
  });
  y += 6;
  for (const id of CHARACTER_ORDER) {
    const r = m.perCharacter[id];
    texto(ctx, CHARACTERS[id].name.toUpperCase(), x, y, r ? PAL.neon2 : COLOR.dim);
    ctx.textAlign = 'right';
    texto(ctx, r ? `${r.wins}/${r.runs} vitórias · melhor ${r.bestKills}`.toUpperCase() : '—', x + largura, y, r ? PAL.text : COLOR.dim);
    ctx.textAlign = 'left';
    y += 10;
  }
  rodape(ctx, 'Enter ou Esc para voltar');
}

function drawAbout(ctx: Ctx): void {
  const linhas: [string, string][] = [
    ['A Profecia de Sexta-Feira é um jogo para os amigos do Comitê.', PAL.text],
    ['Quinze minutos, cinco pessoas, uma sexta que parece durar para sempre.', PAL.text],
    ['', ''],
    ['Feito com carinho, humor absurdo e um pouco de saudade.', PAL.neon2],
    ['Nenhum eletrodoméstico foi ferido (todos estavam possuídos).', COLOR.hint],
  ];
  const w = Math.min(380, LOGICAL_WIDTH - 16);
  const h = 22 + linhas.length * 12 + 6;
  const p = painel(ctx, w, h, 'Sobre');
  usarFonte(ctx, FONT_UI, 'center');
  linhas.forEach(([t, cor], i) => texto(ctx, wrapText(ctx, t, w - 16)[0] ?? '', p.x + w / 2, p.y + 18 + i * 12, cor || PAL.text));
  ctx.textAlign = 'left';
  usarFonte(ctx, FONT_LABEL, 'center');
  texto(ctx, 'COMITÊ — SEM DATA PARA ACABAR', LOGICAL_WIDTH / 2, p.y + h + 14, PAL.neon1);
  ctx.textAlign = 'left';
  icone(ctx, 'losango', LOGICAL_WIDTH / 2 - 3, p.y + h + 28, PAL.accent);
  rodape(ctx, 'Enter ou Esc para voltar');
}

/** Converte um ponto de tela (clique) em coordenadas lógicas do canvas. */
export function toLogical(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const e = Number(canvas.dataset.escala) || 1; // o canvas tem a resolução da tela: volta para pixels lógicos
  return { x: ((clientX - r.left) / r.width) * (canvas.width / e), y: ((clientY - r.top) / r.height) * (canvas.height / e) };
}

/** Qual área clicável está sob o ponto? (-1 se nenhuma) */
export function hitAt(menu: Menu, x: number, y: number): number {
  for (const h of menu.hits) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.index;
  return -1;
}

// ---------------------------------------------------------------- Galeria do Mauro e Códice

function drawGallery(ctx: Ctx, menu: Menu, sprites: SpriteManager): void {
  const W = LOGICAL_WIDTH;
  const H = LOGICAL_HEIGHT;
  const achados = menu.meta.gallery;
  const w = Math.min(440, W - 12);
  const h = Math.min(H - 16, 16 + COLLECTIBLES.length * 11 + 18);
  const p = painel(ctx, w, h, `Galeria do Mauro (${achados.length}/${COLLECTIBLES.length})`, 8);
  const listaW = Math.floor(w * 0.45);
  usarFonte(ctx, FONT_UI);
  COLLECTIBLES.forEach((c, i) => {
    const y = p.y + 18 + i * 11;
    const tem = achados.includes(c.id);
    const foco = i === menu.cursor;
    if (foco) rect(ctx, p.x + 4, y - 1, listaW, 11, 'rgba(122,215,255,0.25)');
    texto(ctx, `${i + 1}. ${tem ? c.name : '???'}`, p.x + 8, y, tem ? PAL.text : COLOR.dim);
    menu.hits.push({ x: p.x + 4, y: y - 1, w: listaW, h: 11, index: i });
  });
  const sel = COLLECTIBLES[menu.cursor];
  if (sel) {
    const tem = achados.includes(sel.id);
    const x = p.x + listaW + 14;
    const larg = w - listaW - 24;
    texto(ctx, (tem ? sel.name : 'Ainda não achado').toUpperCase(), x, p.y + 20, PAL.accent);
    const desc = tem ? sel.description : `Fica escondido em alguns mapas (${sel.fases.map((f) => 'fase ' + f).join(', ')}). Nunca dá para achar todos numa partida só.`;
    const linhas = wrapText(ctx, desc, larg);
    linhas.forEach((l, i) => texto(ctx, l, x, p.y + 34 + i * 10, tem ? PAL.text : COLOR.hint));
    // Ícone do colecionável em 2x (só uma silhueta apagada enquanto não foi achado).
    const icone = sprites.getGaleria(sel.id)?.quadros[0];
    if (icone) {
      const iy = p.y + 34 + linhas.length * 10 + 8;
      ctx.save();
      if (!tem) {
        ctx.globalAlpha = 0.2;
        ctx.filter = 'brightness(0) invert(1)';
      }
      ctx.drawImage(icone, Math.round(x), iy, icone.width * 2, icone.height * 2);
      ctx.restore();
    }
  }
  rodape(ctx, '↑↓ escolher · Esc voltar');
}

function drawCodex(ctx: Ctx, menu: Menu): void {
  const W = LOGICAL_WIDTH;
  const H = LOGICAL_HEIGHT;
  const w = Math.min(460, W - 12);
  const p = painel(ctx, w, H - 32, 'Códice dos Personagens', 8);
  // Abas com os cinco nomes.
  const tabW = Math.floor((w - 12) / CODEX_ORDER.length);
  CODEX_ORDER.forEach((id, i) => {
    const x = p.x + 6 + i * tabW;
    const foco = i === menu.cursor;
    rect(ctx, x, p.y + 16, tabW - 2, 11, foco ? PAL.neon2 : 'rgba(255,255,255,0.08)');
    usarFonte(ctx, FONT_UI, 'center');
    texto(ctx, CODEX[id].name.toUpperCase(), x + (tabW - 2) / 2, p.y + 17, foco ? PAL.bg : COLOR.hint);
    menu.hits.push({ x, y: p.y + 16, w: tabW - 2, h: 11, index: i });
  });
  ctx.textAlign = 'left';
  const e = CODEX[CODEX_ORDER[menu.cursor] ?? 'felipe'];
  let y = p.y + 34;
  const x = p.x + 10;
  const larg = w - 20;
  usarFonte(ctx, FONT_LABEL);
  texto(ctx, `${e.name.toUpperCase()}, ${e.title.toUpperCase()}`, x, y, PAL.accent);
  y += 12;
  usarFonte(ctx, FONT_UI);
  for (const l of wrapText(ctx, e.lore, larg)) {
    texto(ctx, l, x, y, PAL.text);
    y += 10;
  }
  y += 3;
  texto(ctx, `Papel: ${e.role}`, x, y, COLOR.hint);
  y += 10;
  texto(ctx, `Arma: ${e.weapon} · Veículo: ${e.vehicle}`, x, y, COLOR.hint);
  y += 13;
  for (const c of e.curiosities) {
    for (const l of wrapText(ctx, `• ${c}`, larg)) {
      texto(ctx, l, x, y, PAL.text);
      y += 10;
    }
  }
  y += 3;
  for (const l of wrapText(ctx, `"${e.legendary}"`, larg)) {
    texto(ctx, l, x, y, PAL.accent);
    y += 10;
  }
  rodape(ctx, '←→ trocar personagem · Esc voltar');
}
