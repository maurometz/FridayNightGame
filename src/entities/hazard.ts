import type { Poolable } from '../engine/pool';

export type HazardKind = 'circle' | 'ring';

/**
 * Perigo no chão. Todo perigo é telegrafado: durante `delay` só mostra o aviso, e só depois causa dano.
 * - circle: depois do aviso, causa `damage` a quem está dentro do raio (uma vez) e, se `life > 0`,
 *   continua no chão causando `dps` por segundo e aplicando lentidão (poças, multas).
 * - ring: anel que se expande de 0 até `maxRadius` e machuca quem ele cruza (ondas do Golem).
 */
export interface Hazard extends Poolable {
  kind: HazardKind;
  x: number;
  y: number;
  radius: number;
  /** Segundos de aviso (circle) ou de espera antes de começar a expandir (ring). */
  delay: number;
  /** Segundos que o perigo continua no chão depois do impacto (circle). */
  life: number;
  /** Dano único do impacto. */
  damage: number;
  /** Dano por segundo enquanto o jogador está dentro (circle com life). */
  dps: number;
  /** Segundos de lentidão aplicados a quem toca. */
  slowFor: number;
  /** Anel: velocidade de expansão (px/s), raio máximo e espessura. */
  expand: number;
  maxRadius: number;
  thickness: number;
  /** Empurrão no impacto (circle): velocidade (px/s) para longe do centro, aplicada por `pushS` segundos a quem estava dentro. */
  push: number;
  pushS: number;
  color: string;
  /** Imagem animada do aviso (public/assets/sprites/projeteis/<id>.png), ou vazio para o desenho por código. */
  sprite: string;
  /** O impacto já aconteceu. */
  active: boolean;
  alive: boolean;
  /** Slots dos jogadores que já foram atingidos pelo impacto único. */
  hit: number[];
  /** Quanto durou o aviso no começo (para desenhar o preenchimento). */
  warnTotal: number;
}

export function createHazard(): Hazard {
  return {
    poolIndex: 0,
    kind: 'circle',
    x: 0,
    y: 0,
    radius: 0,
    delay: 0,
    life: 0,
    damage: 0,
    dps: 0,
    slowFor: 0,
    expand: 0,
    maxRadius: 0,
    thickness: 0,
    push: 0,
    pushS: 0,
    color: '#ff5a5a',
    sprite: '',
    active: false,
    alive: false,
    hit: [],
    warnTotal: 0,
  };
}
