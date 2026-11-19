// Desenho das cutscenes: o mapa fica parado e escurecido atrás, entram barras de cinema, vinheta e
// linhas de varredura, e a fala aparece numa caixa com retrato, nome e texto que "digita".
// Sem a imagem do retrato, aparece um retrato genérico (silhueta colorida com a inicial) até chegar a arte.

import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../data/balance';
import { letrasVisiveis, linhaCompleta, matizDoRetrato, type CutsceneState } from './cutscene';
import { cardapio, COLOR, FONT_LABEL, FONT_UI, PAL, rect, setPalette, texto, usarFonte } from './theme';

type Ctx = CanvasRenderingContext2D;

const BARRA_ALTO = 30;
const BARRA_BAIXO = 88;
const ENTRADA_QUADROS = 26;

export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Áreas clicáveis (em coordenadas lógicas): AUTO liga/desliga o avanço sozinho e PULAR encerra a cena. */
export function cutsceneBotoes(): { auto: Retangulo; pular: Retangulo } {
  const W = LOGICAL_WIDTH;
  return { auto: { x: W - 138, y: 8, w: 62, h: 15 }, pular: { x: W - 70, y: 8, w: 64, h: 15 } };
}

export function dentro(r: Retangulo, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function quebrar(ctx: Ctx, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  let atual = '';
  for (const palavra of text.split(' ')) {
    const t = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(t).width > maxWidth && atual) {
      out.push(atual);
      atual = palavra;
    } else atual = t;
  }
  if (atual) out.push(atual);
  return out;
}

/** Retrato genérico: silhueta de busto sobre um fundo colorido pelo id, com a inicial de quem fala. */
function retratoGenerico(ctx: Ctx, x: number, y: number, lado: number, id: string, nome: string): void {
  const h = matizDoRetrato(id);
  const g = ctx.createLinearGradient(x, y, x, y + lado);
  g.addColorStop(0, `hsl(${h}, 45%, 38%)`);
  g.addColorStop(1, `hsl(${h}, 50%, 18%)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, lado, lado);
  ctx.fillStyle = `hsl(${h}, 40%, 12%)`;
  ctx.beginPath();
  ctx.arc(x + lado / 2, y + lado * 0.4, lado * 0.2, 0, Math.PI * 2); // cabeça
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + lado / 2, y + lado * 0.98, lado * 0.38, lado * 0.34, 0, Math.PI, 0); // ombros
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.round(lado * 0.3)}px Silkscreen, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText((nome.trim()[0] ?? '?').toUpperCase(), x + lado / 2, y + lado * 0.5);
  ctx.textAlign = 'left';
}

/**
 * Desenha a cutscene por cima do jogo (que já foi desenhado, parado). `auto` mostra o estado do botão AUTO.
 */
export function drawCutscene(
  ctx: Ctx,
  cs: CutsceneState,
  nomeDe: (id: string) => string,
  retratoDe: (id: string) => HTMLCanvasElement | undefined = () => undefined,
  auto = false,
): void {
  const W = LOGICAL_WIDTH;
  const H = LOGICAL_HEIGHT;
  const linha = cs.lines[Math.min(cs.index, cs.lines.length - 1)];
  if (!linha) return;
  setPalette('respiro');
  const p = Math.min(1, (cs.open ?? 0) / ENTRADA_QUADROS);
  const topo = Math.round(BARRA_ALTO * p);
  const base = Math.round(BARRA_BAIXO * p);

  // O mundo atrás escurece e esfria; vinheta e linhas de varredura dão o ar de "cena".
  ctx.fillStyle = `rgba(6,8,26,${0.4 * p})`;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${0.35 * p})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(0,0,0,${0.03 * p})`;
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

  // Barras de cinema com um fio de neon na borda de dentro.
  rect(ctx, 0, 0, W, topo, '#05060d');
  rect(ctx, 0, H - base, W, base, '#05060d');
  ctx.globalAlpha = 0.7 * p;
  rect(ctx, 0, topo, W, 1, PAL.neon1);
  rect(ctx, 0, H - base - 1, W, 1, PAL.neon2);
  ctx.globalAlpha = 1;
  if (p < 1) return; // durante a entrada só as barras e o escurecimento

  // Faixa de cima: etiqueta de cena piscando e os botões.
  usarFonte(ctx, FONT_LABEL);
  if (Math.floor((cs.open ?? 0) / 30) % 2 === 0) rect(ctx, 10, 11, 5, 5, PAL.neon1);
  texto(ctx, 'CENA', 20, 9, PAL.neon1);
  const b = cutsceneBotoes();
  for (const [r, rotulo, ativo] of [[b.auto, auto ? 'AUTO: SIM' : 'AUTO: NÃO', auto], [b.pular, 'PULAR >>', false]] as const) {
    rect(ctx, r.x, r.y, r.w, r.h, ativo ? PAL.neon2 : 'rgba(255,255,255,0.1)');
    ctx.strokeStyle = ativo ? PAL.neon2 : COLOR.hint;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    usarFonte(ctx, FONT_LABEL, 'center');
    texto(ctx, rotulo, r.x + r.w / 2, r.y + 4, ativo ? PAL.bg : PAL.text);
  }
  ctx.textAlign = 'left';

  // Caixa de fala na faixa de baixo.
  const w = Math.min(450, W - 16);
  const x = Math.round((W - w) / 2);
  const y = H - BARRA_BAIXO + 6;
  const h = BARRA_BAIXO - 20;
  cardapio(ctx, x, y, w, h);
  const lado = 56;
  const nome = linha.who ? nomeDe(linha.who) : '';
  let recuo = 0;
  if (linha.retrato) {
    const slide = Math.max(0, 1 - (cs.t ?? 0) / 8) * 10; // o retrato entra deslizando a cada fala
    ctx.globalAlpha = Math.min(1, ((cs.t ?? 0) + 2) / 8);
    const rx = x + 8 - slide;
    const ry = y + 6;
    rect(ctx, rx - 2, ry - 2, lado + 4, lado + 4, PAL.neon2);
    const ret = retratoDe(linha.retrato);
    if (ret) {
      rect(ctx, rx, ry, lado, lado, '#14102a');
      const escala = Math.min(lado / ret.width, lado / ret.height);
      const rw = Math.max(1, Math.round(ret.width * escala));
      const rh = Math.max(1, Math.round(ret.height * escala));
      ctx.drawImage(ret, rx + Math.round((lado - rw) / 2), ry + (lado - rh), rw, rh);
    } else retratoGenerico(ctx, rx, ry, lado, linha.retrato, nome);
    ctx.globalAlpha = 1;
    recuo = lado + 14;
  }
  if (nome) {
    usarFonte(ctx, FONT_LABEL);
    rect(ctx, x + 8 + recuo, y + 4, Math.ceil(ctx.measureText(nome.toUpperCase()).width) + 8, 11, PAL.neon2);
    texto(ctx, nome.toUpperCase(), x + 12 + recuo, y + 6, PAL.bg);
  }
  usarFonte(ctx, FONT_UI);
  const linhas = quebrar(ctx, linha.text, w - 24 - recuo);
  let restante = letrasVisiveis(cs);
  let yy = y + 20;
  for (const l of linhas) {
    if (restante <= 0) break;
    texto(ctx, l.slice(0, restante), x + 12 + recuo, yy, PAL.text);
    restante -= l.length + 1;
    yy += 10;
  }
  // Seta piscando quando a fala está completa, e a posição na cena.
  usarFonte(ctx, FONT_UI, 'right');
  if (linhaCompleta(cs) && Math.floor((cs.t ?? 0) / 18) % 2 === 0) texto(ctx, 'v', x + w - 8, y + h - 14, PAL.accent);
  texto(ctx, `${Math.min(cs.index + 1, cs.lines.length)}/${cs.lines.length}`, x + w - 8, y + 4, COLOR.hint);
  usarFonte(ctx, FONT_UI, 'center');
  texto(ctx, 'Enter ou clique: avançar · A: automático · Esc: pular', W / 2, H - 12, COLOR.hint);
  ctx.textAlign = 'left';
}
