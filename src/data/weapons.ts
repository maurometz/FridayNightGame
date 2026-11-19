// Armas. Fase 1: só o Violão do Felipe, sem munição (a rotação de instrumentos entra na Fase 2).

export type WeaponId = 'violao';

export interface WeaponDef {
  readonly id: WeaponId;
  readonly name: string;
  /** Segundos entre disparos. */
  readonly cooldown: number;
  readonly damage: number;
  /** Pixels por segundo. */
  readonly speed: number;
  /** Segundos de vida do projétil. */
  readonly lifetime: number;
  /** Projéteis por disparo (leque). */
  readonly count: number;
  /** Abertura total do leque, em radianos. */
  readonly spread: number;
  /** Inimigos extras que o projétil atravessa (0 = some no primeiro acerto). */
  readonly pierce: number;
  readonly radius: number;
  /** Só dispara se houver inimigo a até esta distância (pixels). */
  readonly range: number;
}

export const WEAPONS: Readonly<Record<WeaponId, WeaponDef>> = {
  violao: {
    id: 'violao',
    name: 'Violão Acústico Frenético',
    cooldown: 0.8,
    damage: 3,
    speed: 200,
    lifetime: 0.9,
    count: 5,
    spread: (50 * Math.PI) / 180,
    pierce: 0,
    radius: 3,
    range: 190,
  },
};
