import type { UltimateId } from '../data/synergy';

/** Barra de Sinergia de um par de jogadores (uma por par, decisão de design). */
export interface PairState {
  /** Slots dos dois jogadores, com a < b. */
  a: number;
  b: number;
  /** Carga de 0 a 100. */
  bar: number;
  /** Segundos de recarga que ainda faltam depois do último uso. */
  cooldown: number;
}

export interface Pt {
  x: number;
  y: number;
  /** Segundos restantes (notas explosivas, impactos agendados) ou, nos clones, o tipo (0 grande, 1 pequeno). */
  t: number;
}

/** Uma Ultimate de dupla em andamento. */
export interface ActiveUltimate {
  id: UltimateId;
  a: number;
  b: number;
  /** Segundos desde o início. */
  t: number;
  duration: number;
  /** Acumulador de tempo para os disparos periódicos. */
  acc: number;
  /** Ângulo de órbita (discos de vinil). */
  angle: number;
  list: Pt[];
  /** uids de inimigos já visitados (Lançamento Olímpico). */
  visited: number[];
}

/** Barra e estado da Saideira, a Ultimate do Comitê (só com os cinco juntos). */
export interface CommitteeState {
  bar: number;
  cooldown: number;
  /** Segundos desde que a Saideira começou, ou -1 se não está ativa. */
  t: number;
}

export interface SynergyState {
  pairs: PairState[];
  active: ActiveUltimate[];
  committee: CommitteeState;
}

export function createSynergy(playerCount: number): SynergyState {
  const pairs: PairState[] = [];
  for (let a = 0; a < playerCount; a++) {
    for (let b = a + 1; b < playerCount; b++) pairs.push({ a, b, bar: 0, cooldown: 0 });
  }
  return { pairs, active: [], committee: { bar: 0, cooldown: 0, t: -1 } };
}
