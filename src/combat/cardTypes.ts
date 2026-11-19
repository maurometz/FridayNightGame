import type { Rarity } from '../data/cards';
import type { CharacterId } from '../data/characters';
import type { Player } from '../entities/player';

export { RARITY_LABEL } from '../data/cards';
export type { Rarity } from '../data/cards';

/**
 * Tipo da carta:
 * - exclusive: exclusiva de um personagem (12 por personagem)
 * - team: carta de equipe de um personagem (5 por personagem), depende de aliados
 * - weapon / passive: pool compartilhado, qualquer personagem
 */
export type CardKind = 'exclusive' | 'team' | 'weapon' | 'passive';

export interface CardDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly rarity: Rarity;
  /** Tipo da carta. Se omitido, é exclusiva (quando tem `character`) ou passiva. */
  readonly kind?: CardKind;
  /** Personagem dono (exclusivas e de equipe). */
  readonly character?: CharacterId;
  /** Se definido, a carta só aparece nesse nível. */
  readonly onlyAtLevel?: number;
  /** Se definido, só aparece depois de o jogador ter escolhido a carta com este id. */
  readonly requires?: string;
  /**
   * Quantas vezes a carta pode ser escolhida (cada repetição sobe o nível da carta).
   * Padrão: 1 para cartas de efeito único, e 3 (MAX_CARD_LEVEL) para as numéricas.
   */
  readonly maxLevel?: number;
  /** Aplica a carta. `level` é o nível que a carta acaba de atingir (1 na primeira vez, e o padrão). */
  apply(p: Player, level?: number): void;
}

export function kindOf(c: CardDef): CardKind {
  return c.kind ?? (c.character ? 'exclusive' : 'passive');
}
