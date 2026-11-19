// Regras do sistema de cartas (GDD A.5). Valores iniciais, ajustáveis nos playtests.

import type { CharacterId } from './characters';

export type Rarity = 'comum' | 'rara' | 'epica' | 'lendaria';

/** Pesos padrão de raridade: Comum 60%, Rara 28%, Épica 9%, Lendária 3%. */
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = {
  comum: 60,
  rara: 28,
  epica: 9,
  lendaria: 3,
};

export const RARITY_LABEL: Readonly<Record<Rarity, string>> = {
  comum: 'Comum',
  rara: 'Rara',
  epica: 'Épica',
  lendaria: 'Lendária',
};

/** Cartas por escolha. */
export const CARDS_PER_CHOICE = 3;

/** Nível máximo de uma carta repetida. */
export const MAX_CARD_LEVEL = 3;

/** Rerolls e banimentos por partida. */
export const RUN_REROLLS = 2;
export const RUN_BANS = 2;

/**
 * Marcos: nos níveis 5, 15 e 25 uma das 3 cartas é sempre Épica (ou Lendária).
 * Nos níveis 10, 20 e 30 uma é sempre Lendária exclusiva do personagem.
 */
export const MILESTONE_EPIC_LEVELS: readonly number[] = [5, 15, 25];
export const MILESTONE_LEGENDARY_LEVELS: readonly number[] = [10, 20, 30];

/**
 * Nível 10: uma destas duas Lendárias exclusivas é garantida (sorteia uma). GDD A.4.
 */
export const LEVEL10_LEGENDARIES: Readonly<Record<CharacterId, readonly [string, string]>> = {
  felipe: ['felipe-turne', 'felipe-encore'],
  mauro: ['mauro-enciclopedia', 'mauro-mestre'],
  melissa: ['melissa-show', 'melissa-protagonista'],
  thaisa: ['thaisa-fortaleza', 'thaisa-bufe'],
  thayssa: ['thayssa-ressonancia', 'thayssa-ultimo'],
};
