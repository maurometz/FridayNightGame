// Formato dos sprites (GDD C.2): cada sprite é uma grade de caracteres com paleta.
// Um caractere por pixel. "." é transparente. Os quadros são montados a partir de três partes
// (cabeça, tronco e pernas), então um personagem só precisa de um desenho de cada e as animações
// de parado, caminhada, ataque e dano saem dele.

import type { CharacterId } from '../data/characters';

export type SpriteId = CharacterId | 'lucas';

/** Largura de todos os quadros, em pixels. */
export const SPRITE_W = 20;

/** Ordem dos quadros na folha PNG externa (uma linha, oito colunas). */
export const FRAME_ORDER = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'attack', 'hurt'] as const;
export type FrameName = (typeof FRAME_ORDER)[number];

export interface SpriteDef {
  readonly id: SpriteId;
  /** Cor de cada caractere. */
  readonly palette: Readonly<Record<string, string>>;
  /** Cabeça, do topo ao queixo. */
  readonly head: readonly string[];
  /** Tronco e braços. */
  readonly torso: readonly string[];
  /** Pernas em pé (parado). A caminhada é derivada delas. */
  readonly legs: readonly string[];
}

/** Centraliza o desenho visível numa linha de SPRITE_W colunas. Facilita escrever grades sem contar pontos. */
export function c(visivel: string): string {
  const total = SPRITE_W - visivel.length;
  const esq = Math.floor(total / 2);
  return '.'.repeat(esq) + visivel + '.'.repeat(total - esq);
}

/**
 * Pernas em pé: quadril, pernas e sapatos. Usa os caracteres n e N (calça) e k e K (sapato) da paleta.
 * `linhas` é a altura total das pernas (mínimo 5).
 */
export function pernas(linhas: number): string[] {
  const out = [c('nnnnnnnnnnnn'), c('nnnNnnnnNnnn')];
  const meio = linhas - 4;
  for (let i = 0; i < meio; i++) out.push(i % 3 === 1 ? c('nNnn....nnNn') : c('nnnn....nnnn'));
  out.push(c('kkkkk....kkkkk'));
  out.push(c('kKKkk....kkKKk'));
  return out;
}

/**
 * Pernas de um quadro de caminhada. Em cada fase uma perna sobe um pixel (o pé levantado), alternando.
 * Fases: 0 perna esquerda levantada, 1 passando, 2 perna direita levantada, 3 passando.
 */
export function pernasAndando(legs: readonly string[], fase: number): string[] {
  const esquerda = fase === 0;
  const direita = fase === 2;
  if (!esquerda && !direita) return [...legs];
  const meio = SPRITE_W / 2;
  const out = legs.map((l) => l.split(''));
  const sobe = (de: number, ate: number): void => {
    // Sobe o trecho [de, ate) da perna um pixel (do quadril ao pé), a partir da terceira linha.
    for (let y = 2; y < out.length; y++) {
      for (let x = de; x < ate; x++) {
        const abaixo = out[y]![x]!;
        const acima = out[y - 1]![x]!;
        if (y === 2 && acima !== '.') continue; // não apaga o quadril
        out[y - 1]![x] = abaixo === '.' && y - 1 > 1 ? acima : abaixo;
      }
    }
    for (let x = de; x < ate; x++) out[out.length - 1]![x] = '.';
  };
  if (esquerda) sobe(0, meio);
  if (direita) sobe(meio, SPRITE_W);
  return out.map((l) => l.join(''));
}

/** Um quadro montado: linhas de SPRITE_W caracteres. */
export type Grade = string[];

/** Altura total de um quadro do sprite (1 linha de folga no topo para o balanço). */
export function alturaDoQuadro(def: SpriteDef): number {
  return 1 + def.head.length + def.torso.length + def.legs.length;
}

/** Monta o quadro `frame` do sprite. Ataque e dano usam a pose parada (o flash é aplicado ao desenhar). */
export function montarQuadro(def: SpriteDef, frame: FrameName): Grade {
  const corpo = [...def.head, ...def.torso];
  const h = alturaDoQuadro(def);
  const grade: Grade = Array.from({ length: h }, () => '.'.repeat(SPRITE_W));

  let bob = 0;
  let pernasDoQuadro: readonly string[] = def.legs;
  switch (frame) {
    case 'idle1':
      bob = 1; // respiração: o corpo desce um pixel
      break;
    case 'walk0':
    case 'walk1':
    case 'walk2':
    case 'walk3': {
      const fase = Number(frame.slice(4));
      pernasDoQuadro = pernasAndando(def.legs, fase);
      bob = fase % 2 === 0 ? 1 : 0;
      break;
    }
    default:
      break;
  }

  const pintar = (linhas: readonly string[], y0: number): void => {
    linhas.forEach((linha, i) => {
      const y = y0 + i;
      if (y < 0 || y >= h) return;
      const atual = grade[y]!.split('');
      for (let x = 0; x < SPRITE_W; x++) {
        const ch = linha[x] ?? '.';
        if (ch !== '.') atual[x] = ch;
      }
      grade[y] = atual.join('');
    });
  };

  // As pernas primeiro; o corpo por cima (a barra do tronco cobre o quadril).
  pintar(pernasDoQuadro, 1 + corpo.length);
  pintar(corpo, 1 + bob);
  return grade;
}

/** Problemas encontrados no sprite (vazio = tudo certo). */
export function validarSprite(def: SpriteDef): string[] {
  const erros: string[] = [];
  const partes: [string, readonly string[]][] = [
    ['head', def.head],
    ['torso', def.torso],
    ['legs', def.legs],
  ];
  for (const [nome, linhas] of partes) {
    linhas.forEach((l, i) => {
      if (l.length !== SPRITE_W) erros.push(`${def.id}.${nome}[${i}] tem ${l.length} colunas (esperado ${SPRITE_W}): "${l}"`);
      for (const ch of l) {
        if (ch !== '.' && !(ch in def.palette)) erros.push(`${def.id}.${nome}[${i}] usa "${ch}", que não está na paleta`);
      }
    });
  }
  return erros;
}
