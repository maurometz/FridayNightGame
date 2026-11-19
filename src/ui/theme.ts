// Estilo visual "Neon de boteco / VHS" (direção 1B): letreiros de neon rosa, ciano e âmbar sobre azul-noite,
// placas de cardápio com moldura dupla e scanlines nos menus. Tokens e helpers de desenho em pixel (sem blur).
// Tudo é desenhado em pixels lógicos inteiros; o texto da interface fica em CAIXA ALTA (feito na hora de desenhar).

export type PaletteMode = 'respiro' | 'queda';

export interface Palette {
  /** Fundo. */
  bg: string;
  /** Fundo 2: céu e xadrez. */
  bg2: string;
  /** Placa: fundo de painel. */
  plate: string;
  /** Moldura e números em destaque (âmbar no respiro, azul na queda). */
  accent: string;
  /** Texto. */
  text: string;
  /** Neon 1 (rosa no respiro, violeta na queda). */
  neon1: string;
  /** Neon 2 e foco (ciano). */
  neon2: string;
  /** XP (verde). */
  xp: string;
}

const RESPIRO: Palette = { bg: '#0B1030', bg2: '#151C48', plate: '#070914', accent: '#FFB43C', text: '#FFF1D6', neon1: '#FF4FA3', neon2: '#3FF0FF', xp: '#7DFF8A' };
const QUEDA: Palette = { bg: '#070A22', bg2: '#10163A', plate: '#05061A', accent: '#6F8CFF', text: '#DFE8FF', neon1: '#B76BFF', neon2: '#3FF0FF', xp: '#7DFF8A' };

/** Paleta em uso. Os módulos de UI leem daqui; trocar o modo muda a UI inteira de uma vez. */
export const PAL: Palette = { ...RESPIRO };

export function setPalette(mode: PaletteMode): void {
  Object.assign(PAL, mode === 'queda' ? QUEDA : RESPIRO);
}

/** Cores que não mudam com o humor. */
export const COLOR = {
  dim: '#6B7299',
  hint: '#8F9AD0',
  slot: '#3A4170',
  disabled: '#2A3060',
  hpTrack: '#3A0F2A',
  xpTrack: '#0D2A18',
  weaponTrackOn: '#3A2A10',
  weaponTrackOff: '#1A1F40',
  outline: '#070914',
  shield: '#9FD8FF',
  strong: '#FFB43C',
  skate: '#3FF0FF',
  tdah: '#D6A6FF',
  dmg: '#FFFFFF',
  crit: '#FFE45C',
  hurt: '#FF5A6A',
  logoFill: '#FFD6EC',
  logoTube: '#7A1A52',
  neonCyanDark: '#0A6A7A',
} as const;

// Fontes pixel do Google Fonts (carregadas no index.html). Sem elas, cai para monospace.
export const FONT_UI = '10px Tiny5, monospace';
export const FONT_LABEL = '8px Silkscreen, monospace';
export const FONT_SMALL_TITLE = '16px Silkscreen, monospace';
export const FONT_CLOCK = '16px Silkscreen, monospace';
export const FONT_CRIT = '10px Silkscreen, monospace';
export const FONT_LOGO = '46px "Jersey 10", monospace';

/** Pede as fontes ao navegador (o canvas não dispara o carregamento sozinho). Falhas são ignoradas. */
export function carregarFontes(): void {
  try {
    const f = document.fonts;
    void Promise.allSettled([f.load(FONT_UI), f.load(FONT_LABEL), f.load(FONT_LOGO), f.load('46px "Jersey 10"')]);
  } catch {
    /* sem document.fonts: segue com a fonte reserva */
  }
}

type Ctx = CanvasRenderingContext2D;

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string): void {
  ctx.fillStyle = cor;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Contorno de 1 px por dentro do retângulo. */
export function contorno(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string): void {
  rect(ctx, x, y, w, 1, cor);
  rect(ctx, x, y + h - 1, w, 1, cor);
  rect(ctx, x, y, 1, h, cor);
  rect(ctx, x + w - 1, y, 1, h, cor);
}

/** Placa: fundo escuro com contorno de 1 px. */
export function placa(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string = PAL.accent): void {
  rect(ctx, x, y, w, h, PAL.plate);
  contorno(ctx, x, y, w, h, cor);
}

/**
 * Moldura dupla de cardápio: 1 px âmbar, 1 px de placa e mais 1 px âmbar, por FORA do painel (3 px no total),
 * com "pregos" de 2x2 nos dois cantos de cima. O painel em si é pintado por dentro.
 */
export function cardapio(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string = PAL.accent): void {
  rect(ctx, x - 3, y - 3, w + 6, h + 6, cor);
  rect(ctx, x - 2, y - 2, w + 4, h + 4, PAL.plate);
  rect(ctx, x - 1, y - 1, w + 2, h + 2, cor);
  rect(ctx, x, y, w, h, PAL.plate);
  rect(ctx, x + 2, y + 2, 2, 2, cor);
  rect(ctx, x + w - 4, y + 2, 2, 2, cor);
}

/** Retângulo com meio-tom em xadrez 2x2 (a cor aparece em metade dos blocos). */
export function pontilhado(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string): void {
  ctx.fillStyle = cor;
  for (let j = 0; j < h; j += 2) {
    for (let i = 0; i < w; i += 2) {
      if (((i / 2 + j / 2) & 1) === 0) ctx.fillRect(Math.round(x + i), Math.round(y + j), Math.min(2, w - i), Math.min(2, h - j));
    }
  }
}

const DIRS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Texto com contorno de 1 px nas 4 direções (sem diagonais). Alinhamento pelo `textAlign` atual. */
export function textoContornado(ctx: Ctx, texto: string, x: number, y: number, cor: string, contornoCor: string = COLOR.outline): void {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = contornoCor;
  for (const [dx, dy] of DIRS) ctx.fillText(texto, px + dx, py + dy);
  ctx.fillStyle = cor;
  ctx.fillText(texto, px, py);
}

/** Texto simples, alinhado em pixel inteiro. */
export function texto(ctx: Ctx, t: string, x: number, y: number, cor: string): void {
  ctx.fillStyle = cor;
  ctx.fillText(t, Math.round(x), Math.round(y));
}

/** Prepara o contexto para desenhar texto de UI (alinhamento e linha de base fixos). */
export function usarFonte(ctx: Ctx, fonte: string, align: CanvasTextAlign = 'left'): void {
  ctx.font = fonte;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
}

/** Barra com trilha e contorno de 1 px. `contornoCor` vazio = sem contorno. */
export function medidor(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  cor: string,
  trilha: string,
  contornoCor: string | null = cor,
): void {
  rect(ctx, x, y, w, h, trilha);
  const f = Math.min(1, Math.max(0, frac));
  const dentro = contornoCor ? w - 2 : w;
  const off = contornoCor ? 1 : 0;
  rect(ctx, x + off, y + off, Math.round(dentro * f), h - off * 2, cor);
  if (contornoCor) contorno(ctx, x, y, w, h, contornoCor);
}

/** Ícone de 5x5 para as etiquetas de status (desenhado por código, sem depender de glifos da fonte). */
export function icone(ctx: Ctx, tipo: 'losango' | 'triangulo' | 'bola' | 'xis', x: number, y: number, cor: string): void {
  ctx.fillStyle = cor;
  const px = Math.round(x);
  const py = Math.round(y);
  switch (tipo) {
    case 'losango':
      ctx.fillRect(px + 2, py, 1, 5);
      ctx.fillRect(px + 1, py + 1, 3, 3);
      ctx.fillRect(px, py + 2, 5, 1);
      break;
    case 'triangulo':
      ctx.fillRect(px + 2, py, 1, 1);
      ctx.fillRect(px + 1, py + 1, 3, 1);
      ctx.fillRect(px, py + 2, 5, 1);
      ctx.fillRect(px, py + 3, 5, 2);
      break;
    case 'bola':
      ctx.fillRect(px + 1, py, 3, 5);
      ctx.fillRect(px, py + 1, 5, 3);
      break;
    case 'xis':
      ctx.fillRect(px, py, 1, 1);
      ctx.fillRect(px + 4, py, 1, 1);
      ctx.fillRect(px + 1, py + 1, 1, 1);
      ctx.fillRect(px + 3, py + 1, 1, 1);
      ctx.fillRect(px + 2, py + 2, 1, 1);
      ctx.fillRect(px + 1, py + 3, 1, 1);
      ctx.fillRect(px + 3, py + 3, 1, 1);
      ctx.fillRect(px, py + 4, 1, 1);
      ctx.fillRect(px + 4, py + 4, 1, 1);
      break;
  }
}

/** Etiqueta (chip) de status: placa com contorno e texto na cor do buff. Devolve a largura usada. */
export function etiqueta(ctx: Ctx, x: number, y: number, t: string, cor: string, tipo?: 'losango' | 'triangulo' | 'bola' | 'xis'): number {
  usarFonte(ctx, FONT_UI);
  const texto_ = t.toUpperCase();
  const larguraTexto = Math.ceil(ctx.measureText(texto_).width);
  const w = larguraTexto + 4 + (tipo ? 8 : 0);
  placa(ctx, x, y, w, 11, cor);
  if (tipo) icone(ctx, tipo, x + 3, y + 3, cor);
  texto(ctx, texto_, x + 2 + (tipo ? 8 : 0), y + 1, cor);
  return w;
}

/** Scanlines: linhas horizontais alternadas de 1 px, só nos menus (nunca no jogo). */
export function scanlines(ctx: Ctx, largura: number, altura: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 1; y < altura; y += 2) ctx.fillRect(0, y, largura, 1);
}

/** Linha de menu: foco = fundo ciano com "►"; normal = texto claro; desabilitada = apagada. */
export interface LinhaEstado {
  foco: boolean;
  desabilitada?: boolean;
}

export function linhaDeMenu(ctx: Ctx, x: number, y: number, w: number, h: number, rotulo: string, valor: string | undefined, st: LinhaEstado): void {
  usarFonte(ctx, FONT_UI);
  const ty = y + Math.round((h - 9) / 2) - 1;
  if (st.foco) {
    rect(ctx, x, y, w, h, PAL.neon2);
    texto(ctx, '►', x + 4, ty, PAL.bg);
  }
  const cor = st.foco ? PAL.bg : st.desabilitada ? COLOR.dim : PAL.text;
  texto(ctx, rotulo.toUpperCase(), x + 14, ty, cor);
  if (valor !== undefined && valor !== '') {
    if (valor === 'em breve') {
      ctx.textAlign = 'right';
      const larg = Math.ceil(ctx.measureText(valor).width) + 4;
      const cx = x + w - 4 - larg;
      contorno(ctx, cx, ty - 1, larg, 11, PAL.neon1);
      texto(ctx, valor, x + w - 6, ty, PAL.neon1);
      ctx.textAlign = 'left';
    } else {
      ctx.textAlign = 'right';
      texto(ctx, valor.toUpperCase(), x + w - 4, ty, st.foco ? PAL.bg : PAL.accent);
      ctx.textAlign = 'left';
    }
  }
}

/** Botão de 80x14 (ou da largura pedida): foco ciano, normal com moldura âmbar, desabilitado apagado. */
export function botao(ctx: Ctx, x: number, y: number, w: number, h: number, rotulo: string, st: LinhaEstado): void {
  usarFonte(ctx, FONT_UI);
  const ty = y + Math.round((h - 9) / 2) - 1;
  if (st.foco) {
    rect(ctx, x, y, w, h, PAL.neon2);
    texto(ctx, `► ${rotulo.toUpperCase()}`, x + 4, ty, PAL.bg);
  } else if (st.desabilitada) {
    placa(ctx, x, y, w, h, COLOR.disabled);
    texto(ctx, rotulo.toUpperCase(), x + 10, ty, COLOR.dim);
  } else {
    placa(ctx, x, y, w, h, PAL.accent);
    texto(ctx, rotulo.toUpperCase(), x + 10, ty, PAL.text);
  }
}
