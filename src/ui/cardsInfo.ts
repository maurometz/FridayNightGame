// Resumo das cartas de cada jogador para a tela de pausa (o que eu escolhi e o que meus aliados escolheram).

import { getCard, maxLevelOf } from '../combat/cardPool';
import { kindOf, type CardKind, type Rarity } from '../combat/cardTypes';
import { CHARACTERS, type CharacterId } from '../data/characters';
import type { World } from '../engine/world';

export interface CardEntry {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  kind: CardKind;
  /** Nível atual da carta (repetir sobe de nível). */
  level: number;
  maxLevel: number;
}

export interface PlayerCards {
  slot: number;
  characterId: CharacterId;
  /** Nome para a aba: o personagem, com "(IA)" se for o companheiro. */
  label: string;
  /** Resumo de nível, vida e dano. */
  stats: string;
  entries: CardEntry[];
}

/** Junta as cartas de todos os jogadores, na ordem em que foram escolhidas. */
export function collectCards(world: World, aiSlots: readonly number[] = []): PlayerCards[] {
  return world.players.map((p) => {
    const entries: CardEntry[] = [];
    for (const id of p.cardsTaken) {
      const c = getCard(id);
      if (!c) continue;
      entries.push({
        id,
        name: c.name,
        description: c.description,
        rarity: c.rarity,
        kind: kindOf(c),
        level: p.cardLevels[id] ?? 1,
        maxLevel: maxLevelOf(c),
      });
    }
    const dano = Math.round((p.baseDamageMul - 1) * 100);
    const nome = CHARACTERS[p.characterId].name;
    return {
      slot: p.slot,
      characterId: p.characterId,
      label: aiSlots.includes(p.slot) ? `${nome} (IA)` : nome,
      stats: `Nv ${p.level} · Vida ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp} · Dano ${dano >= 0 ? '+' : ''}${dano}% · ${entries.length} cartas`,
      entries,
    };
  });
}
