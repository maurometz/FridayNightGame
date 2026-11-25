// Chão "realista" de cada fase, desenhado por código e ancorado no mundo (o mapa é infinito, então o cenário
// é feito de células que se repetem com variação determinística): cômodos na casa, ruas e quarteirões em
// Ivoti, gramado e trilhas no Parcão, e assim por diante. Só visual: não muda colisão nem jogabilidade.

import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TILE } from '../data/balance';

/** Hash determinístico 0..1 a partir de três inteiros. */
function h(a: number, b: number, s = 0): number {
  let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

interface Cena {
  /** Lado da célula, em tiles. */
  readonly n: number;
  /** Tipo da célula (cx, cy). */
  tipo(cx: number, cy: number): number;
  /** Pinta um tile. x,y = canto na tela; tc,tr = tile no mundo; lx,ly = posição dentro da célula. */
  tile(c: CanvasRenderingContext2D, x: number, y: number, tc: number, tr: number, cx: number, cy: number, lx: number, ly: number, k: number): void;
  /** Decoração por célula (x0,y0 = canto da célula na tela). */
  decor?(c: CanvasRenderingContext2D, x0: number, y0: number, cx: number, cy: number, k: number, tick: number): void;
}

function r(c: CanvasRenderingContext2D, cor: string, x: number, y: number, w: number, hh: number, a = 1): void {
  c.globalAlpha = a;
  c.fillStyle = cor;
  c.fillRect(x, y, w, hh);
  c.globalAlpha = 1;
}

function circ(c: CanvasRenderingContext2D, cor: string, x: number, y: number, rad: number): void {
  c.fillStyle = cor;
  c.beginPath();
  c.arc(x, y, rad, 0, Math.PI * 2);
  c.fill();
}

// ---------------------------------------------------------------------------------------------------
// Arte externa (public/assets/sprites/cenarios/<fase>/<nome>.png, feita por tools/build_cenarios.py).
// Carrega sozinha na primeira vez que a fase é desenhada; enquanto não chega (ou se faltar), vale o desenho por código.
// ---------------------------------------------------------------------------------------------------
const ARTE_FASE1 = [
  'casa_taco_claro', 'casa_taco_escuro', 'casa_azulejo_cozinha', 'casa_azulejo_banheiro', 'casa_carpete_quarto',
  'casa_parede_h', 'casa_parede_v', 'casa_porta_soleira', 'casa_tapete_sala', 'casa_cama', 'casa_criado_mudo',
  'casa_tapetinho_banheiro', 'casa_ralo',
] as const;
const arte = new Map<string, HTMLCanvasElement | HTMLImageElement>();
const arteIniciada = new Set<string>();

/** Suavização dos pisos por código: sat/contraste 1 = arte original; menores deixam o chão mais calmo e o jogo mais legível. */
const SUAVIZAR: Record<string, { sat: number; contraste: number }> = {
  casa_taco_claro: { sat: 0.55, contraste: 0.5 },
  casa_taco_escuro: { sat: 0.75, contraste: 0.75 },
  casa_azulejo_cozinha: { sat: 0.45, contraste: 0.5 },
  casa_azulejo_banheiro: { sat: 0.85, contraste: 0.85 },
  casa_carpete_quarto: { sat: 0.9, contraste: 0.9 },
};

function suavizada(img: HTMLImageElement, sat: number, contraste: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const x = cv.getContext('2d')!;
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, cv.width, cv.height);
  const px = d.data;
  let soma = 0;
  for (let i = 0; i < px.length; i += 4) soma += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
  const media = soma / (px.length / 4);
  for (let i = 0; i < px.length; i += 4) {
    const rr = px[i]!;
    const gg = px[i + 1]!;
    const bb = px[i + 2]!;
    const l = 0.299 * rr + 0.587 * gg + 0.114 * bb;
    const l2 = media + (l - media) * contraste; // contraste em torno da luz média
    const f = l > 0 ? l2 / l : 1;
    px[i] = Math.max(0, Math.min(255, (l + (rr - l) * sat) * f));
    px[i + 1] = Math.max(0, Math.min(255, (l + (gg - l) * sat) * f));
    px[i + 2] = Math.max(0, Math.min(255, (l + (bb - l) * sat) * f));
  }
  x.putImageData(d, 0, 0);
  return cv;
}

function carregarArte(fase: string, nomes: readonly string[]): void {
  if (arteIniciada.has(fase) || typeof Image === 'undefined') return;
  arteIniciada.add(fase);
  for (const n of nomes) {
    const im = new Image();
    im.onload = () => {
      const ajuste = SUAVIZAR[n];
      arte.set(n, ajuste ? suavizada(im, ajuste.sat, ajuste.contraste) : im);
    };
    im.src = `/assets/sprites/cenarios/${fase}/${n}.png`;
  }
}

function img(nome: string): HTMLCanvasElement | HTMLImageElement | undefined {
  return arte.get(nome);
}

/** Pinta um tile do mundo com uma textura que se repete (a textura anda junto com o mundo, sem emendas). */
function textura(c: CanvasRenderingContext2D, nome: string, x: number, y: number, tc: number, tr: number): boolean {
  const t = img(nome);
  if (!t) return false;
  const sx = mod(tc * TILE, t.width);
  const sy = mod(tr * TILE, t.height);
  c.drawImage(t, sx, sy, TILE, TILE, x, y, TILE, TILE);
  return true;
}

// ---------------------------------------------------------------------------------------------------
// Fase 1: a casa do Felipe (cômodos)
// ---------------------------------------------------------------------------------------------------
// tipos: 0 sala (tacos), 1 cozinha (azulejo), 2 quarto (carpete), 3 banheiro (azulejo azul), 4 corredor (tacos escuros)
const TEXTURA_CASA = ['casa_taco_claro', 'casa_azulejo_cozinha', 'casa_carpete_quarto', 'casa_azulejo_banheiro', 'casa_taco_escuro'] as const;
const CASA: Cena = {
  n: 12,
  tipo(cx, cy) {
    if (cx === 0 && cy === 0) return 0;
    const v = h(cx, cy, 1);
    return v < 0.3 ? 0 : v < 0.55 ? 1 : v < 0.78 ? 2 : v < 0.9 ? 3 : 4;
  },
  tile(c, x, y, tc, tr, cx, cy, lx, ly, k) {
    if (!textura(c, TEXTURA_CASA[k]!, x, y, tc, tr)) casaTileProcedural(c, x, y, tc, tr, k);
    // paredes finas nas divisas entre cômodos, com uma porta (soleira) no meio
    const dif = (a: number, b: number) => CASA.tipo(a, b) !== k;
    const porta = lx >= 5 && lx <= 6;
    const parH = img('casa_parede_h');
    const parV = img('casa_parede_v');
    if (ly === 0 && dif(cx, cy - 1) && !porta) {
      if (parH) c.drawImage(parH, x, y);
      else { r(c, '#d9d0c0', x, y, TILE, 4); r(c, '#000', x, y + 4, TILE, 2, 0.3); }
    }
    if (lx === 0 && dif(cx - 1, cy) && !(ly >= 5 && ly <= 6)) {
      if (parV) c.drawImage(parV, x, y);
      else { r(c, '#d9d0c0', x, y, 4, TILE); r(c, '#000', x + 4, y, 2, TILE, 0.3); }
    }
  },
  decor(c, x0, y0, cx, cy, k) {
    const T = TILE;
    const ai = (nome: string, x: number, y: number): boolean => {
      const t = img(nome);
      if (!t) return false;
      c.drawImage(t, Math.round(x), Math.round(y));
      return true;
    };
    // soleiras das portas (as do topo e as da esquerda, onde a parede existe)
    const soleira = img('casa_porta_soleira');
    if (soleira) {
      if (CASA.tipo(cx, cy - 1) !== k) c.drawImage(soleira, x0 + 5 * T, y0);
      if (CASA.tipo(cx - 1, cy) !== k) {
        c.save();
        c.translate(x0 + 6, y0 + 5 * T);
        c.rotate(Math.PI / 2);
        c.drawImage(soleira, 0, 0);
        c.restore();
      }
    }
    if (k === 0 || (cx === 0 && cy === 0)) {
      // tapete grande com franjas
      if (ai('casa_tapete_sala', x0 + 3.5 * T, y0 + 3.5 * T)) return;
      const col = ['#a23b3b', '#3b5fa2', '#3b8a5a', '#a2793b'][Math.floor(h(cx, cy, 21) * 4)]!;
      r(c, '#000', x0 + 3.5 * T + 2, y0 + 3.5 * T + 2, 5 * T, 5 * T, 0.2);
      r(c, col, x0 + 3.5 * T, y0 + 3.5 * T, 5 * T, 5 * T);
      r(c, '#f0e4c0', x0 + 3.5 * T + 4, y0 + 3.5 * T + 4, 5 * T - 8, 5 * T - 8, 0.85);
      r(c, col, x0 + 3.5 * T + 8, y0 + 3.5 * T + 8, 5 * T - 16, 5 * T - 16);
    } else if (k === 2) {
      // cama vista de cima + criado-mudo
      const cama = ai('casa_cama', x0 + 2.5 * T, y0 + 2 * T);
      const criado = ai('casa_criado_mudo', x0 + 6.8 * T, y0 + 2 * T);
      if (cama && criado) return;
      r(c, '#000', x0 + 2 * T + 2, y0 + 2 * T + 2, 4 * T, 5 * T, 0.2);
      r(c, '#d8d0c4', x0 + 2 * T, y0 + 2 * T, 4 * T, 5 * T);
      r(c, '#c0485a', x0 + 2 * T, y0 + 3.4 * T, 4 * T, 3.6 * T);
      r(c, '#fff', x0 + 2.3 * T, y0 + 2.2 * T, 1.5 * T, 1 * T);
      r(c, '#fff', x0 + 4.2 * T, y0 + 2.2 * T, 1.5 * T, 1 * T);
      r(c, '#6b4a2f', x0 + 6.5 * T, y0 + 2 * T, 1.3 * T, 1.3 * T);
    } else if (k === 3) {
      // tapetinho e ralo
      const tapete = ai('casa_tapetinho_banheiro', x0 + 4 * T, y0 + 7 * T);
      const ralo = ai('casa_ralo', x0 + 9 * T, y0 + 4 * T);
      if (tapete && ralo) return;
      r(c, '#f2f2f2', x0 + 4 * T, y0 + 7 * T, 3 * T, 1.6 * T);
      circ(c, '#3d6a80', x0 + 9 * T, y0 + 4 * T, 5);
    }
  },
};

/** Tile da casa por código (usado enquanto a arte não carrega). */
function casaTileProcedural(c: CanvasRenderingContext2D, x: number, y: number, tc: number, tr: number, k: number): void {
  if (k === 0 || k === 4) {
    const tabua = Math.floor((tc + mod(tr, 3) * 2) / 4);
    r(c, k === 4 ? '#5b3d27' : '#8a5e38', x, y, TILE, TILE);
    r(c, h(tabua, tr, 2) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.07);
    r(c, '#000', x, y + TILE - 1, TILE, 1, 0.28);
  } else if (k === 1) {
    r(c, (tc + tr) % 2 === 0 ? '#e8e4da' : '#8fa0a8', x, y, TILE, TILE);
  } else if (k === 2) {
    r(c, '#9aa3b8', x, y, TILE, TILE);
  } else {
    r(c, '#7fb6cf', x, y, TILE, TILE);
    r(c, '#2d6b86', x, y + 7, TILE, 1, 0.5);
    r(c, '#2d6b86', x + 7, y, 1, TILE, 0.5);
  }
}

// ---------------------------------------------------------------------------------------------------
// Fase 2: Ivoti (ruas, calçadas e quarteirões)
// ---------------------------------------------------------------------------------------------------
// célula de 14 tiles: 4 de rua + 1 de calçada de cada lado + 8 de quarteirão. tipo do quarteirão: 0 praça, 1 gramado/casa, 2 pátio da padaria
const IVOTI: Cena = {
  n: 14,
  tipo(cx, cy) {
    if (cx === 0 && cy === 0) return 0;
    const v = h(cx, cy, 5);
    return v < 0.25 ? 0 : v < 0.7 ? 1 : 2;
  },
  tile(c, x, y, tc, tr, _cx, _cy, lx, ly, k) {
    const vRua = lx < 4;
    const hRua = ly < 4;
    const vCal = lx === 4 || lx === 13;
    const hCal = ly === 4 || ly === 13;
    if (vRua || hRua) {
      r(c, '#34363d', x, y, TILE, TILE);
      r(c, h(tc, tr, 6) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.05);
      if (vRua && hRua) {
        // cruzamento: faixa de pedestres nas bordas
        if (lx === 0 || ly === 0) for (let i = 0; i < 4; i++) r(c, '#e9e9e4', x + (lx === 0 ? 3 : i * 4), y + (lx === 0 ? i * 4 : 3), lx === 0 ? 10 : 2, lx === 0 ? 2 : 10, 0.85);
        return;
      }
      if (vRua && lx === 2 && ly % 2 === 0) r(c, '#e0b93a', x - 1, y + 4, 2, 8);
      if (hRua && ly === 2 && lx % 2 === 0) r(c, '#e0b93a', x + 4, y - 1, 8, 2);
      return;
    }
    if (vCal || hCal) {
      r(c, '#b9b4a8', x, y, TILE, TILE);
      r(c, '#000', x, y + TILE - 1, TILE, 1, 0.2);
      r(c, '#000', x + (tr % 2 ? 8 : 0), y, 1, TILE, 0.15);
      return;
    }
    if (k === 0) {
      // praça de paralelepípedo
      r(c, '#a39a88', x, y, TILE, TILE);
      r(c, h(tc, tr, 7) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.07);
      r(c, '#000', x, y + 7, TILE, 1, 0.2);
      r(c, '#000', x + ((tr % 2) * 8), y, 1, TILE, 0.2);
    } else if (k === 2) {
      r(c, '#c9b48a', x, y, TILE, TILE);
      r(c, (tc + tr) % 2 === 0 ? '#000' : '#fff', x, y, TILE, TILE, 0.06);
      r(c, '#000', x, y, TILE, 1, 0.12);
    } else {
      r(c, '#5e9b4a', x, y, TILE, TILE);
      r(c, h(tc, tr, 8) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.06);
      if (h(tc, tr, 9) < 0.1) { r(c, '#fff', x + 5, y + 6, 2, 2, 0.9); r(c, '#f2d03c', x + 10, y + 10, 2, 2); }
    }
  },
  decor(c, x0, y0, cx, cy, k) {
    const T = TILE;
    const bx = x0 + 5 * T;
    const by = y0 + 5 * T;
    if (k === 0) {
      // canteiro circular com fonte
      circ(c, '#000', bx + 4 * T + 1, by + 4 * T + 2, 3 * T);
      circ(c, '#6f8f5a', bx + 4 * T, by + 4 * T, 3 * T);
      circ(c, '#7fc0d8', bx + 4 * T, by + 4 * T, 1.7 * T);
      circ(c, '#d8f0f8', bx + 4 * T, by + 4 * T, 0.7 * T);
    } else if (k === 1) {
      // quintal: casinha vista do chão (telhado) + caminho de pedras
      const cor = ['#b0553f', '#8b6b4a', '#4b6a8a', '#8a4b6a'][Math.floor(h(cx, cy, 10) * 4)]!;
      r(c, '#000', bx + 1.5 * T + 3, by + 1 * T + 3, 5 * T, 3.4 * T, 0.25);
      r(c, cor, bx + 1.5 * T, by + 1 * T, 5 * T, 3.4 * T);
      r(c, '#000', bx + 1.5 * T, by + 1 * T + 1.7 * T - 1, 5 * T, 2, 0.35);
      r(c, '#fff', bx + 1.5 * T, by + 1 * T, 5 * T, 2, 0.2);
      for (let i = 0; i < 3; i++) r(c, '#c9c2b4', bx + 3.6 * T, by + (4.7 + i * 1.1) * T, 0.9 * T, 0.6 * T);
    } else {
      // mesas e toldo da padaria
      for (let i = 0; i < 3; i++) {
        circ(c, '#000', bx + (1.6 + i * 2.4) * T + 1, by + 2 * T + 2, 0.9 * T);
        circ(c, i % 2 ? '#d94a4a' : '#f2e6c8', bx + (1.6 + i * 2.4) * T, by + 2 * T, 0.9 * T);
      }
      for (let i = 0; i < 8; i++) r(c, i % 2 ? '#f2e6c8' : '#c0392b', bx + i * T, by + 5.5 * T, T, 1.5 * T, 0.9);
    }
  },
};

// ---------------------------------------------------------------------------------------------------
// Fase 3: o Parcão (gramado, trilhas, áreas)
// ---------------------------------------------------------------------------------------------------
// tipos: 0 gramado, 1 playground (areia), 2 piquenique, 3 jardim de flores, 4 deck de madeira
const PARCAO: Cena = {
  n: 12,
  tipo(cx, cy) {
    if (cx === 0 && cy === 0) return 0;
    const v = h(cx, cy, 11);
    return v < 0.4 ? 0 : v < 0.55 ? 1 : v < 0.75 ? 2 : v < 0.9 ? 3 : 4;
  },
  tile(c, x, y, tc, tr, cx, cy, lx, ly, k) {
    const trilhaV = (lx === 5 || lx === 6) && h(cx, 0, 12) < 0.65;
    const trilhaH = (ly === 5 || ly === 6) && h(0, cy, 13) < 0.65;
    if (trilhaV || trilhaH || (cx === 0 && cy === 0 && (lx === 5 || lx === 6 || ly === 5 || ly === 6))) {
      r(c, '#cdbf9a', x, y, TILE, TILE);
      r(c, h(tc, tr, 14) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.08);
      if (h(tc, tr, 15) < 0.4) r(c, '#8e8264', x + 4, y + 5, 2, 2);
      if ((lx === 5 && trilhaV) || (ly === 5 && trilhaH)) r(c, '#5e9b4a', x, y, lx === 5 ? 2 : TILE, lx === 5 ? TILE : 2, 0.0);
      return;
    }
    if (k === 1) { r(c, '#dcc58c', x, y, TILE, TILE); r(c, h(tc, tr, 16) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.06); return; }
    if (k === 4) { r(c, '#9c6d44', x, y, TILE, TILE); r(c, '#000', x, y + TILE - 1, TILE, 1, 0.3); if (mod(tc + mod(tr, 2) * 2, 4) === 0) r(c, '#000', x, y, 1, TILE, 0.25); return; }
    // gramado com listras de corte
    r(c, mod(Math.floor(tr / 2), 2) === 0 ? '#5aa04a' : '#52944a', x, y, TILE, TILE);
    r(c, h(tc, tr, 17) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.05);
    if (h(tc, tr, 18) < 0.12) r(c, '#3f7a38', x + 3, y + 4, 2, 4);
    if (k === 3 && h(tc, tr, 19) < 0.45) {
      const flor = ['#e85d8a', '#f2d03c', '#ffffff', '#9a6be8'][Math.floor(h(tc, tr, 21) * 4)]!;
      r(c, flor, x + 3, y + 3, 3, 3);
      r(c, flor, x + 10, y + 9, 3, 3);
    }
  },
  decor(c, x0, y0, _cx, _cy, k) {
    const T = TILE;
    if (k === 1) {
      // gira-gira e balanço (sombras e círculos)
      circ(c, '#000', x0 + 4 * T + 2, y0 + 8 * T + 2, 1.3 * T);
      circ(c, '#d94a4a', x0 + 4 * T, y0 + 8 * T, 1.3 * T);
      circ(c, '#f2d03c', x0 + 4 * T, y0 + 8 * T, 0.5 * T);
      r(c, '#000', x0 + 8 * T + 2, y0 + 2 * T + 2, 2.5 * T, 0.4 * T, 0.2);
      r(c, '#4b6a8a', x0 + 8 * T, y0 + 2 * T, 2.5 * T, 0.4 * T);
    } else if (k === 2) {
      // manta de piquenique xadrez com cesta
      for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) r(c, (i + j) % 2 ? '#fff' : '#d94a4a', x0 + (3.5 + i) * T * 0.8 + 6, y0 + (3 + j) * T * 0.8 + 6, T * 0.8, T * 0.8);
      r(c, '#8b6b4a', x0 + 5.5 * T, y0 + 4.5 * T, T, 0.8 * T);
    } else if (k === 4) {
      r(c, '#000', x0 + 3 * T, y0 + 3 * T, 6 * T, 0.3 * T, 0.2);
      circ(c, '#6b4a2f', x0 + 6 * T, y0 + 6 * T, 1.1 * T); // mesa redonda do quiosque
      circ(c, '#c9a070', x0 + 6 * T, y0 + 6 * T, 0.8 * T);
    } else if (k === 0) {
      // sombra de árvore e arbustos
      circ(c, 'rgba(0,0,0,0.18)', x0 + 2.5 * T, y0 + 9.5 * T, 1.6 * T);
      circ(c, '#2f6a2f', x0 + 9.5 * T, y0 + 2.5 * T, 0.7 * T);
      circ(c, '#3f7a38', x0 + 10.2 * T, y0 + 2.8 * T, 0.5 * T);
    }
  },
};

// ---------------------------------------------------------------------------------------------------
// Fase 4: o Cinema (saguão, carpete, projeção)
// ---------------------------------------------------------------------------------------------------
// tipos: 0 saguão (mármore xadrez), 1 corredor (carpete vermelho), 2 sala escura, 3 bilheteria
const CINEMA: Cena = {
  n: 10,
  tipo(cx, cy) {
    if (cx === 0 && cy === 0) return 0;
    const v = h(cx, cy, 22);
    return v < 0.25 ? 0 : v < 0.65 ? 1 : v < 0.88 ? 2 : 3;
  },
  tile(c, x, y, tc, tr, _cx, _cy, lx, ly, k) {
    if (k === 0) {
      const par = (tc + tr) % 2 === 0;
      r(c, par ? '#2a2630' : '#d9d4c8', x, y, TILE, TILE);
      r(c, '#fff', x, y, TILE, 1, par ? 0.05 : 0.0);
    } else if (k === 1) {
      r(c, '#6b1d2a', x, y, TILE, TILE);
      // losango dourado do carpete
      const m = (tc % 2 === 0) === (tr % 2 === 0);
      if (m) { r(c, '#c9a24a', x + 6, y + 3, 4, 10, 0.55); r(c, '#c9a24a', x + 3, y + 6, 10, 4, 0.55); }
      r(c, h(tc, tr, 23) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.05);
      if (lx === 0 || lx === 9) r(c, '#e6c66a', x + (lx === 0 ? 14 : 0), y, 2, TILE, 0.55); // luz de corredor
    } else if (k === 2) {
      r(c, '#1c1a24', x, y, TILE, TILE);
      r(c, '#fff', x, y, TILE, TILE, h(tc, tr, 24) < 0.5 ? 0.02 : 0);
      if (ly % 3 === 1) r(c, '#e6c66a', x + 7, y + 7, 2, 2, 0.5); // luzinhas de degrau
    } else {
      r(c, '#3a2a2a', x, y, TILE, TILE);
      r(c, '#8a6a4a', x, y + TILE - 2, TILE, 2, 0.6);
      r(c, h(tc, tr, 25) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.05);
    }
  },
  decor(c, x0, y0, cx, cy, k) {
    const T = TILE;
    if (k === 2) {
      // fileiras de poltronas vistas de cima
      for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) { r(c, '#000', x0 + (1 + i * 1.4) * T + 1, y0 + (2 + j * 3) * T + 1, 1.1 * T, 0.9 * T, 0.3); r(c, '#a02a3a', x0 + (1 + i * 1.4) * T, y0 + (2 + j * 3) * T, 1.1 * T, 0.9 * T); r(c, '#7a1d2a', x0 + (1 + i * 1.4) * T, y0 + (2 + j * 3) * T, 1.1 * T, 0.3 * T); }
    } else if (k === 0) {
      // pipoca caída
      for (let i = 0; i < 6; i++) r(c, '#f6e7a8', x0 + h(cx, cy, 30 + i) * 9 * T, y0 + h(cx, cy, 40 + i) * 9 * T, 3, 3);
      r(c, '#000', x0 + 3 * T, y0 + 3 * T, 4 * T, 4 * T, 0.0);
    } else if (k === 3) {
      r(c, '#000', x0 + 1 * T, y0 + 2 * T + 3, 8 * T, 1.2 * T, 0.3);
      r(c, '#8a6a4a', x0 + 1 * T, y0 + 2 * T, 8 * T, 1.2 * T);
      r(c, '#c9a24a', x0 + 1 * T, y0 + 2 * T, 8 * T, 3);
    }
  },
};

// ---------------------------------------------------------------------------------------------------
// Fase 5: a Expointer (pavilhões, currais, feira)
// ---------------------------------------------------------------------------------------------------
// tipos: 0 pavilhão (concreto), 1 curral (terra e palha), 2 feira (grama e barracas), 3 pista de paralelepípedo
const EXPOINTER: Cena = {
  n: 12,
  tipo(cx, cy) {
    if (cx === 0 && cy === 0) return 0;
    const v = h(cx, cy, 31);
    return v < 0.3 ? 0 : v < 0.55 ? 1 : v < 0.8 ? 2 : 3;
  },
  tile(c, x, y, tc, tr, _cx, _cy, lx, ly, k) {
    if (k === 0) {
      r(c, '#a8a8a2', x, y, TILE, TILE);
      r(c, h(tc, tr, 32) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.05);
      if (lx === 0 || ly === 0) r(c, '#000', x + (lx === 0 ? 0 : 0), y + (lx === 0 ? 0 : 0), lx === 0 ? 1 : TILE, ly === 0 && lx !== 0 ? 1 : TILE, 0.2);
      if (ly === 6 && lx % 2 === 0) r(c, '#e0b93a', x + 2, y + 7, 12, 2); // faixa amarela de segurança
    } else if (k === 1) {
      r(c, '#8a6a46', x, y, TILE, TILE);
      r(c, h(tc, tr, 33) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.08);
      if (h(tc, tr, 34) < 0.5) { r(c, '#d9b85a', x + 2, y + 5, 7, 1); r(c, '#c9a040', x + 6, y + 11, 8, 1); }
    } else if (k === 2) {
      r(c, '#6aa14a', x, y, TILE, TILE);
      r(c, h(tc, tr, 35) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.06);
    } else {
      r(c, '#8c8d92', x, y, TILE, TILE);
      r(c, '#000', x, y + 7, TILE, 1, 0.2);
      r(c, '#000', x + (tr % 2 ? 8 : 0), y, 1, TILE, 0.2);
      r(c, h(tc, tr, 36) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.06);
    }
  },
  decor(c, x0, y0, cx, cy, k) {
    const T = TILE;
    if (k === 1) {
      // cercas dos currais (vistas de cima) e cocho
      r(c, '#000', x0 + 2 * T, y0 + 3 * T + 2, 8 * T, 3, 0.2);
      r(c, '#d8c89a', x0 + 2 * T, y0 + 3 * T, 8 * T, 3);
      r(c, '#000', x0 + 2 * T, y0 + 9 * T + 2, 8 * T, 3, 0.2);
      r(c, '#d8c89a', x0 + 2 * T, y0 + 9 * T, 8 * T, 3);
      r(c, '#5b6a8a', x0 + 8 * T, y0 + 6 * T, 2 * T, 0.7 * T);
    } else if (k === 2) {
      // barracas listradas de feira
      for (let b = 0; b < 2; b++) for (let i = 0; i < 5; i++) r(c, i % 2 ? '#fff' : (b ? '#3a7ac0' : '#d94a4a'), x0 + (2 + i * 1.4) * T, y0 + (2 + b * 6) * T, 1.4 * T, 2.4 * T, 0.95);
    } else if (k === 0) {
      r(c, '#000', x0 + 4 * T, y0 + 4 * T, 4 * T, 3 * T, 0.0);
      r(c, '#d94a4a', x0 + 3 * T, y0 + 8 * T, 6 * T, 0.5 * T, 0.8); // faixa pintada
    } else {
      for (let i = 0; i < 6; i++) circ(c, 'rgba(0,0,0,0.12)', x0 + h(cx, cy, 50 + i) * 11 * T, y0 + h(cx, cy, 60 + i) * 11 * T, 5); // manchas de óleo
    }
  },
};

// ---------------------------------------------------------------------------------------------------
// Fase 6: o Sítio da Dona Marlene (campo, horta, quadra, varanda)
// ---------------------------------------------------------------------------------------------------
// tipos: 0 campo, 1 horta, 2 quadra de vôlei (areia), 3 varanda, 4 trilha de terra
const SITIO: Cena = {
  n: 12,
  tipo(cx, cy) {
    if (cx === 0 && cy === 0) return 0;
    const v = h(cx, cy, 41);
    return v < 0.35 ? 0 : v < 0.55 ? 1 : v < 0.75 ? 2 : v < 0.88 ? 3 : 4;
  },
  tile(c, x, y, tc, tr, cx, cy, lx, ly, k) {
    const trilha = (cx === 0 && cy === 0 && (lx === 5 || lx === 6)) || (k === 4 && (ly === 5 || ly === 6 || lx === 5 || lx === 6));
    if (trilha) { r(c, '#a8845a', x, y, TILE, TILE); r(c, h(tc, tr, 42) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.08); if (h(tc, tr, 43) < 0.3) r(c, '#7a5e3c', x + 4, y + 6, 3, 2); return; }
    if (k === 1) {
      r(c, '#7a5a3a', x, y, TILE, TILE);
      if (ly % 2 === 1) { r(c, '#5a3f28', x, y + 3, TILE, 4); }
      else if (h(tc, tr, 44) < 0.7) { r(c, '#4aa04a', x + 3, y + 6, 4, 5); r(c, '#6ac060', x + 9, y + 6, 3, 4); }
    } else if (k === 2) {
      r(c, '#e0c98c', x, y, TILE, TILE);
      r(c, h(tc, tr, 45) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.06);
      // linhas da quadra
      if (lx === 2 || lx === 9) r(c, '#fff', x + 7, y, 2, TILE, 0.9);
      if (ly === 3 || ly === 8) r(c, '#fff', x, y + 7, TILE, 2, 0.9);
      if (ly === 5 || ly === 6) { if (lx > 1 && lx < 10) r(c, '#fff', x, y + (ly === 5 ? 14 : 0), TILE, 2, 0.0); }
    } else if (k === 3) {
      r(c, '#a8764a', x, y, TILE, TILE);
      r(c, '#000', x, y + TILE - 1, TILE, 1, 0.3);
      if (mod(tc + mod(tr, 2) * 2, 4) === 0) r(c, '#000', x, y, 1, TILE, 0.25);
      r(c, h(tc, tr, 46) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.06);
    } else {
      r(c, mod(Math.floor(tr / 3), 2) === 0 ? '#6fae4a' : '#68a644', x, y, TILE, TILE);
      r(c, h(tc, tr, 47) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.06);
      if (h(tc, tr, 48) < 0.12) r(c, '#3f7a38', x + 4, y + 5, 2, 5);
      if (h(tc, tr, 49) < 0.05) r(c, '#f2d03c', x + 6, y + 6, 3, 3);
    }
  },
  decor(c, x0, y0, cx, cy, k) {
    const T = TILE;
    if (k === 2) {
      // rede de vôlei
      r(c, '#000', x0 + 1 * T, y0 + 5.5 * T + 2, 10 * T, 3, 0.25);
      r(c, '#f0f0f0', x0 + 1 * T, y0 + 5.5 * T, 10 * T, 3, 0.9);
      r(c, '#2d2d2d', x0 + 1 * T - 2, y0 + 5.2 * T, 3, 0.8 * T);
      r(c, '#2d2d2d', x0 + 11 * T - 2, y0 + 5.2 * T, 3, 0.8 * T);
    } else if (k === 3) {
      r(c, '#000', x0 + 2 * T, y0 + 2 * T + 3, 3 * T, 1.5 * T, 0.2);
      r(c, '#7a1f2a', x0 + 2 * T, y0 + 2 * T, 3 * T, 1.5 * T); // rede de descanso/tapete
      r(c, '#d9b85a', x0 + 2.2 * T, y0 + 2.2 * T, 2.6 * T, 1.1 * T);
    } else if (k === 0) {
      circ(c, 'rgba(0,0,0,0.16)', x0 + 9 * T, y0 + 3 * T, 1.5 * T); // sombra de árvore
      for (let i = 0; i < 4; i++) { const px = x0 + h(cx, cy, 70 + i) * 10 * T + T, py = y0 + h(cx, cy, 80 + i) * 10 * T + T; r(c, '#fff', px, py, 2, 2); r(c, '#e8e83c', px + 1, py + 1, 1, 1); }
    }
  },
};

// ---------------------------------------------------------------------------------------------------
// Fase 7: a Igreja Unidos (nave, salão, pátio)
// ---------------------------------------------------------------------------------------------------
// tipos: 0 nave (mármore + tapete), 1 salão (parquet), 2 pátio (lajotas), 3 coral (tablado)
const IGREJA_CENA: Cena = {
  n: 12,
  tipo(cx, cy) {
    if (cx === 0 && cy === 0) return 0;
    const v = h(cx, cy, 51);
    return v < 0.35 ? 0 : v < 0.6 ? 1 : v < 0.85 ? 2 : 3;
  },
  tile(c, x, y, tc, tr, _cx, _cy, lx, _ly, k) {
    if (k === 0) {
      const par = (tc + tr) % 2 === 0;
      r(c, par ? '#d8d2c4' : '#8c8a90', x, y, TILE, TILE);
      r(c, '#000', x, y, TILE, 1, 0.1);
      r(c, '#000', x, y, 1, TILE, 0.1);
      if (lx === 5 || lx === 6) { r(c, '#7a1f2a', x, y, TILE, TILE); if (lx === 5) r(c, '#e6c66a', x, y, 2, TILE, 0.8); else r(c, '#e6c66a', x + 14, y, 2, TILE, 0.8); }
    } else if (k === 1) {
      const dir = (Math.floor(tc / 2) + Math.floor(tr / 2)) % 2 === 0;
      r(c, '#9c7048', x, y, TILE, TILE);
      r(c, '#000', x, y, TILE, TILE, dir ? 0.05 : 0.12);
      for (let i = 0; i < 4; i++) r(c, '#000', dir ? x + i * 4 : x, dir ? y : y + i * 4, dir ? 1 : TILE, dir ? TILE : 1, 0.22);
    } else if (k === 2) {
      r(c, '#8f8c88', x, y, TILE, TILE);
      r(c, h(tc, tr, 52) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.07);
      r(c, '#000', x, y, TILE, 1, 0.25);
      r(c, '#000', x, y, 1, TILE, 0.25);
      if (h(tc, tr, 53) < 0.08) r(c, '#5e8a4a', x + 4, y + 4, 3, 3, 0.8); // musgo
    } else {
      r(c, '#5b3d27', x, y, TILE, TILE);
      r(c, '#000', x, y + TILE - 1, TILE, 1, 0.3);
      r(c, h(tc, tr, 54) < 0.5 ? '#000' : '#fff', x, y, TILE, TILE, 0.06);
    }
  },
  decor(c, x0, y0, cx, cy, k, tick) {
    const T = TILE;
    if (k === 0 || k === 3) {
      // luz colorida dos vitrais no chão (paralelogramos translúveis)
      const cores = ['#e0453a', '#3a6ae0', '#e0c53a', '#3ae07a'];
      for (let i = 0; i < 3; i++) {
        const col = cores[Math.floor(h(cx, cy, 90 + i) * 4)]!;
        const px = x0 + (1 + i * 3.5) * T;
        const py = y0 + (1.5 + h(cx, cy, 95 + i) * 7) * T;
        c.globalAlpha = 0.13 + 0.03 * Math.sin(tick / 40 + i);
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(px, py); c.lineTo(px + 1.6 * T, py); c.lineTo(px + 2.4 * T, py + 2.6 * T); c.lineTo(px + 0.8 * T, py + 2.6 * T);
        c.closePath();
        c.fill();
        c.globalAlpha = 1;
      }
    }
    if (k === 1) {
      // mesa comprida de salão com toalha
      r(c, '#000', x0 + 2 * T, y0 + 4 * T + 3, 8 * T, 2 * T, 0.2);
      r(c, '#f2eee0', x0 + 2 * T, y0 + 4 * T, 8 * T, 2 * T);
      r(c, '#c0485a', x0 + 2 * T, y0 + 4.8 * T, 8 * T, 0.4 * T, 0.8);
    }
  },
};

const CENAS: readonly Cena[] = [CASA, IVOTI, PARCAO, CINEMA, EXPOINTER, SITIO, IGREJA_CENA];

/** Há cenário procedural para a fase (índice 0 a 6)? A Arena do Tempo mantém o piso antigo. */
export function temCenario(act: number): boolean {
  return act >= 0 && act < CENAS.length;
}

/** Desenha o chão da fase (índice 0 a 6) para a janela da câmera. */
export function desenharChao(ctx: CanvasRenderingContext2D, act: number, camX: number, camY: number, tick: number): void {
  const cena = CENAS[act];
  if (!cena) return;
  if (act === 0) carregarArte('fase1', ARTE_FASE1);
  const n = cena.n;
  const meia = Math.floor(n / 2);
  const tc0 = Math.floor(camX / TILE);
  const tr0 = Math.floor(camY / TILE);
  const cols = Math.ceil(LOGICAL_WIDTH / TILE) + 1;
  const rows = Math.ceil(LOGICAL_HEIGHT / TILE) + 1;
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      const tc = tc0 + cc;
      const tr = tr0 + rr;
      const u = tc + meia;
      const v = tr + meia;
      const cx = Math.floor(u / n);
      const cy = Math.floor(v / n);
      cena.tile(ctx, tc * TILE - camX, tr * TILE - camY, tc, tr, cx, cy, mod(u, n), mod(v, n), cena.tipo(cx, cy));
    }
  }
  if (!cena.decor) return;
  const cx0 = Math.floor((tc0 + meia) / n) - 0;
  const cy0 = Math.floor((tr0 + meia) / n) - 0;
  const cx1 = Math.floor((tc0 + cols + meia) / n);
  const cy1 = Math.floor((tr0 + rows + meia) / n);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      cena.decor(ctx, (cx * n - meia) * TILE - camX, (cy * n - meia) * TILE - camY, cx, cy, cena.tipo(cx, cy), tick);
    }
  }
}
