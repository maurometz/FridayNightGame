// Sinergia: Ultimates de dupla e Saideira (GDD A.6). Valores iniciais, ajustáveis nos playtests.

import type { CharacterId } from './characters';

const TILE = 16;

// ---- Barra de Sinergia (uma por par de jogadores) ----
/** A barra carrega 1% por segundo quando os dois estão a até 6 tiles. */
export const SYNERGY_NEAR_PX = 6 * TILE;
export const SYNERGY_CHARGE_PER_S = 1;
/**
 * +0,2% por dano causado. O GDD não diz a unidade; adotei +0,2% a cada 10 de dano
 * (com +0,2% por ponto, a barra encheria em segundos).
 */
export const SYNERGY_CHARGE_PER_DAMAGE = 0.2 / 10;
export const SYNERGY_MAX = 100;
/** Para ativar, os dois precisam estar a até 8 tiles. */
export const SYNERGY_ACTIVATE_PX = 8 * TILE;
export const ULTIMATE_DURATION_S = 6;
export const ULTIMATE_COOLDOWN_S = 60;

// ---- Saideira (Ultimate do Comitê) ----
/** Os cinco, com no máximo 10 tiles entre quaisquer dois. */
export const COMMITTEE_NEAR_PX = 10 * TILE;
export const COMMITTEE_CHARGE_PER_S = 0.5;
export const COMMITTEE_PER_PAIR_ULT = 10;
export const COMMITTEE_PER_KILL = 0.1;
export const SAIDEIRA_DURATION_S = 8;
export const SAIDEIRA_COOLDOWN_S = 120;
export const SAIDEIRA_INVULN_S = 3;
export const SAIDEIRA_HEAL_FRACTION = 0.25;
export const SAIDEIRA_PULSE_DAMAGE = 60;
export const SAIDEIRA_PULSE_KNOCK = 320;
/** Raio do pulso de brinde: "todos os inimigos da tela". */
export const SAIDEIRA_PULSE_RADIUS = 290;
export const SAIDEIRA_LINES: readonly string[] = ['Um brinde pra sexta!', 'Saideira!', 'Mais uma, e a gente vai!'];

export type UltimateId =
  | 'setlist'
  | 'danca'
  | 'rodeio'
  | 'pista'
  | 'pausa'
  | 'estante'
  | 'constelacao'
  | 'lancamento'
  | 'prisma'
  | 'sobremesa';

export interface DuplaDef {
  /** Os dois personagens, em ordem alfabética do id. */
  readonly a: CharacterId;
  readonly b: CharacterId;
  readonly id: UltimateId;
  readonly name: string;
  readonly description: string;
}

/** As 10 duplas (GDD A.6). */
export const DUPLAS: readonly DuplaDef[] = [
  { a: 'felipe', b: 'mauro', id: 'setlist', name: 'Setlist Anotada', description: 'Discos de vinil orbitantes disparam notas elétricas em cadeia.' },
  { a: 'felipe', b: 'melissa', id: 'danca', name: 'Dança do Refrão', description: 'Cortes com dash deixam notas explosivas e holofotes cegantes.' },
  { a: 'felipe', b: 'thaisa', id: 'rodeio', name: 'Rodeio Sonoro', description: 'Anel de choque puxa os inimigos para o centro e os esmaga no ritmo.' },
  { a: 'felipe', b: 'thayssa', id: 'pista', name: 'Pista Aberta', description: 'Pista de dança: aliados invulneráveis por 1 s, inimigos dançam e sofrem dano contínuo.' },
  { a: 'mauro', b: 'melissa', id: 'pausa', name: 'Pausa Dramática', description: 'Câmera lenta nos inimigos. A Melissa acerta todos os Holofotes visíveis.' },
  { a: 'mauro', b: 'thaisa', id: 'estante', name: 'Estante em Queda', description: 'Estantes espectrais caem na tela inteira, atordoando.' },
  { a: 'mauro', b: 'thayssa', id: 'constelacao', name: 'Constelação Afetiva', description: 'Gemas de XP viram mísseis teleguiados que curam ao acertar.' },
  { a: 'melissa', b: 'thaisa', id: 'lancamento', name: 'Lançamento Olímpico', description: 'A Thaisa arremessa a Melissa em giro, ricocheteando entre inimigos.' },
  { a: 'melissa', b: 'thayssa', id: 'prisma', name: 'Prisma de Melhores Amigas', description: 'Laser prismático duplo entre as duas, cortando tudo no caminho.' },
  { a: 'thaisa', b: 'thayssa', id: 'sobremesa', name: 'Sobremesa Espectral', description: 'Clones espectrais provocam os inimigos, comem a comida do chão para fortalecer o time e explodem.' },
];

/** A dupla de dois personagens (em qualquer ordem), se existir. */
export function duplaDe(c1: CharacterId, c2: CharacterId): DuplaDef | undefined {
  return DUPLAS.find((d) => (d.a === c1 && d.b === c2) || (d.a === c2 && d.b === c1));
}

// ---- Parâmetros de cada Ultimate ----
export const ULT = {
  setlist: { discs: 3, radius: 38, spin: 3, every: 0.35, range: 140, hops: 4, hopRange: 70, damage: 9 },
  danca: { every: 0.8, range: 200, dashSpeed: 400, dashTime: 0.14, hitRadius: 18, damage: 14, noteDelay: 1, noteRadius: 30, noteDamage: 14, blindRadius: 45, blindS: 2 },
  rodeio: { radius: 120, every: 0.5, pull: 160, damage: 8 },
  pista: { radius: 100, every: 0.25, damage: 1.5, invuln: 1, dance: 0.3 },
  pausa: { slow: 0.25, range: 260, spotS: 3 },
  estante: { every: 0.9, shelves: 6, radius: 34, damage: 16, stun: 1.5, spreadX: 200, spreadY: 120 },
  constelacao: { every: 0.4, perWave: 8, radius: 200, damage: 9, speed: 150, homing: 6, heal: 4 },
  lancamento: { every: 0.28, range: 180, dashTime: 0.12, radius: 26, damage: 20 },
  prisma: { every: 0.2, width: 10, extend: 30, damage: 8 },
  sobremesa: { offset: 26, taunt: 220, eat: 22, explodeRadius: 60, explodeDamage: 30, buffAttack: 1.1, buffS: 6 },
} as const;
