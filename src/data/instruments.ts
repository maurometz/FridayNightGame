// Instrumentos do Felipe (GDD A.4). Valores iniciais, ajustáveis nos playtests.

export type InstrumentId = 'violao' | 'bateria' | 'flauta' | 'kazoo' | 'viola';

export type AttackKind = 'fan' | 'shockwave' | 'beam' | 'ricochet' | 'canto';

export interface InstrumentDef {
  readonly id: InstrumentId;
  readonly name: string;
  readonly attack: AttackKind;
  /** Munição ("Inspiração") máxima e inicial. */
  readonly maxAmmo: number;
  /**
   * Munição recuperada por segundo enquanto o instrumento está guardado.
   * O GDD não define como a munição volta; esta é a regra adotada (ver docs/DECISOES.md).
   */
  readonly rechargePerS: number;
  /** Segundos entre ataques. */
  readonly cooldown: number;
  readonly damage: number;
  /** Alcance para escolher alvo (pixels). Na bateria, é o raio de ativação. */
  readonly range: number;
  // ---- leque e ricochete ----
  readonly count?: number;
  readonly spread?: number;
  readonly speed?: number;
  readonly lifetime?: number;
  readonly radius?: number;
  readonly pierce?: number;
  // ---- ricochete ----
  readonly bounces?: number;
  readonly bounceRange?: number;
  // ---- onda de choque e feixe ----
  readonly area?: number;
  readonly width?: number;
}

const deg = (d: number): number => (d * Math.PI) / 180;

export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentDef>> = {
  violao: {
    id: 'violao',
    name: 'Violão Acústico Frenético',
    attack: 'fan',
    maxAmmo: 40,
    rechargePerS: 4,
    cooldown: 0.45,
    damage: 3,
    range: 190,
    count: 5,
    spread: deg(50),
    speed: 200,
    lifetime: 0.9,
    radius: 3,
    pierce: 0,
  },
  bateria: {
    id: 'bateria',
    name: 'Bateria de Garagem',
    attack: 'shockwave',
    maxAmmo: 12,
    rechargePerS: 0.8,
    cooldown: 0.9,
    damage: 6,
    range: 60,
    area: 56,
  },
  // A Flauta nao e uma arma de dano: a melodia cura quem esta perto (o Felipe tambem) e da bonus de dano
  // por alguns segundos. O dano nos inimigos em volta e so um empurraozinho.
  flauta: {
    id: 'flauta',
    name: 'Flauta da Madrugada',
    attack: 'canto',
    maxAmmo: 20,
    rechargePerS: 2,
    cooldown: 1.3,
    damage: 3,
    range: 120,
    area: 84,
  },
  kazoo: {
    id: 'kazoo',
    name: 'Kazoo de R$ 1,99',
    attack: 'ricochet',
    maxAmmo: 60,
    rechargePerS: 6,
    cooldown: 0.22,
    damage: 2,
    range: 170,
    speed: 170,
    lifetime: 1.2,
    radius: 3,
    pierce: 0,
    bounces: 3,
    bounceRange: 90,
    spread: deg(70), // dispersão total: baixa precisão
  },
  viola: {
    id: 'viola',
    name: 'Viola',
    attack: 'fan',
    maxAmmo: 30,
    rechargePerS: 3,
    cooldown: 0.5,
    damage: 4,
    range: 190,
    count: 3,
    spread: deg(20),
    speed: 230,
    lifetime: 0.9,
    radius: 3,
    pierce: 1,
  },
};

/** Ordem de rotação dos instrumentos. */
export const INSTRUMENT_ORDER: readonly InstrumentId[] = ['violao', 'bateria', 'flauta', 'kazoo', 'viola'];
