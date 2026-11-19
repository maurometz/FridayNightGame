/** Armas do pool compartilhado (GDD A.5) e a arma emprestada pelo Felipe (Passa a Vez). */
export type SharedWeaponId =
  | 'pizza'
  | 'roteador'
  | 'chinelo'
  | 'chicote'
  | 'ventilador'
  | 'panela'
  | 'controle'
  | 'mangueira'
  | 'fogos';

export type ExtraWeaponId = SharedWeaponId | 'emprestado';

/** Estado de uma arma equipada. Cada arma usa só os campos de que precisa. */
export interface ExtraWeapon {
  id: ExtraWeaponId;
  /** Nível da arma, de 1 a 3. */
  level: number;
  /** Segundos até o próximo uso. */
  cd: number;
  /** Segundos restantes de vida (armas emprestadas). Infinity = permanente. */
  life: number;
  /** Ângulo de órbita (Fatias de Pizza). */
  angle: number;
  /** Recarga de dano por fatia (Fatias de Pizza). */
  sliceCd: number[];
  /** Nós acumulados do Chicote. */
  knots: number;
  /** Direção da frente usada pelo Ventilador. */
  aim: number;
  /** Explosões agendadas (Panela de Pressão e Fogos de Fim de Ano). */
  pending: { x: number; y: number; t: number; radius: number; damage: number }[];
  /** Poças da Mangueira e Roteadores no chão. */
  zones: { x: number; y: number; t: number; radius: number; pulseCd: number }[];
  /** Quem emprestou (arma emprestada), para creditar. -1 = ninguém. */
  lender: number;
}

export function createExtraWeapon(id: ExtraWeaponId, level = 1, life = Infinity, lender = -1): ExtraWeapon {
  return { id, level, cd: 0, life, angle: 0, sliceCd: [], knots: 0, aim: 0, pending: [], zones: [], lender };
}
