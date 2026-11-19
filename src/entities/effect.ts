import type { Poolable } from '../engine/pool';

export type EffectKind = 'ring' | 'beam' | 'text' | 'arc';

/** Efeito visual de curta duração (anel, feixe, texto flutuante). Não afeta a simulação. */
export interface Effect extends Poolable {
  kind: EffectKind;
  x: number;
  y: number;
  /** Ponto final (feixe). */
  x2: number;
  y2: number;
  /** Raio final (anel). */
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  text: string;
  /** Direção e meia-abertura (radianos) do arco. */
  angle: number;
  halfArc: number;
  /** Imagem externa do efeito (nome em projeteis/), ou vazio para o desenho por código. */
  sprite: string;
}

export function createEffect(): Effect {
  return {
    poolIndex: 0,
    kind: 'ring',
    x: 0,
    y: 0,
    x2: 0,
    y2: 0,
    radius: 0,
    life: 0,
    maxLife: 1,
    color: '#ffffff',
    text: '',
    angle: 0,
    halfArc: 0,
    sprite: '',
  };
}
