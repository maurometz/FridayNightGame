import {
  CARDS_PER_CHOICE,
  LEVEL10_LEGENDARIES,
  MILESTONE_EPIC_LEVELS,
  MILESTONE_LEGENDARY_LEVELS,
  RARITY_WEIGHTS,
  type Rarity,
} from '../data/cards';
import type { Player } from '../entities/player';
import type { World } from '../engine/world';
import { kindOf, type CardDef } from './cardTypes';
import { FELIPE_CARDS } from './felipeCards';
import { MAURO_CARDS } from './mauroCards';
import { MELISSA_CARDS } from './melissaCards';
import { SHARED_CARDS } from './sharedCards';
import { TEAM_CARDS } from './teamCards';
import { THAISA_CARDS } from './thaisaCards';
import { THAYSSA_CARDS } from './thayssaCards';

/** Todas as cartas do jogo: 60 exclusivas, 25 de equipe e 15 do pool compartilhado. */
export const ALL_CARDS: readonly CardDef[] = [
  ...FELIPE_CARDS,
  ...MAURO_CARDS,
  ...MELISSA_CARDS,
  ...THAISA_CARDS,
  ...THAYSSA_CARDS,
  ...TEAM_CARDS,
  ...SHARED_CARDS,
];

const BY_ID: ReadonlyMap<string, CardDef> = new Map(ALL_CARDS.map((c) => [c.id, c]));

export function getCard(id: string): CardDef | undefined {
  return BY_ID.get(id);
}

/** Nível atual de uma carta do jogador (0 = ainda não tem). */
export function cardLevelOf(p: Player, id: string): number {
  return p.cardLevels[id] ?? (p.cardsTaken.includes(id) ? 1 : 0);
}

/** Quantas vezes a carta pode ser escolhida. Cartas de efeito único: 1. Numéricas: o `maxLevel` delas. */
export function maxLevelOf(c: CardDef): number {
  return c.maxLevel ?? 1;
}

/** Cartas que podem aparecer numa escolha do jogador. */
export function eligibleCards(p: Player, level: number): CardDef[] {
  return ALL_CARDS.filter((c) => {
    if (p.banned.includes(c.id)) return false;
    if (c.character !== undefined && c.character !== p.characterId) return false;
    if (c.onlyAtLevel !== undefined && c.onlyAtLevel !== level) return false;
    if (c.requires !== undefined && cardLevelOf(p, c.requires) === 0) return false;
    if (cardLevelOf(p, c.id) >= maxLevelOf(c)) return false;
    // No nível 1 (escolha inicial) só Comuns e Raras.
    if (level <= 1 && (c.rarity === 'epica' || c.rarity === 'lendaria')) return false;
    return true;
  });
}

const RARITIES: readonly Rarity[] = ['comum', 'rara', 'epica', 'lendaria'];

/**
 * Sorteio por raridade: primeiro escolhe a raridade pelos pesos (só entre as que têm candidatas),
 * depois uma carta daquela raridade, com a mesma chance.
 */
export function drawWeighted(world: World, pool: readonly CardDef[]): CardDef | undefined {
  const present = RARITIES.filter((r) => pool.some((c) => c.rarity === r));
  if (present.length === 0) return undefined;
  let total = 0;
  for (const r of present) total += RARITY_WEIGHTS[r];
  let roll = world.rng.next() * total;
  let chosen = present[present.length - 1]!;
  for (const r of present) {
    roll -= RARITY_WEIGHTS[r];
    if (roll < 0) {
      chosen = r;
      break;
    }
  }
  const same = pool.filter((c) => c.rarity === chosen);
  return same[world.rng.int(0, same.length - 1)];
}

export interface Offer {
  cards: CardDef[];
  /** Nível que cada carta terá se for escolhida (1 = nova, 2 e 3 = repetida sobe de nível). */
  levels: number[];
}

export interface BuildOptions {
  /** Cartas que já estão na oferta e ficam (usado ao banir uma carta). */
  keep?: readonly CardDef[];
  /** Cartas a evitar, se houver outras (usado no reroll, para vir algo novo). */
  avoid?: ReadonlySet<string>;
}

function remove(pool: CardDef[], c: CardDef): void {
  const i = pool.indexOf(c);
  if (i >= 0) pool.splice(i, 1);
}

/**
 * Monta as 3 cartas de uma escolha:
 * - níveis 10, 20 e 30: uma das Lendárias exclusivas do personagem (as 2 da dupla primeiro; sem elas, qualquer Lendária);
 * - níveis 5, 15 e 25: uma Épica (ou Lendária, se não houver Épica);
 * - sempre pelo menos 1 carta exclusiva do personagem;
 * - o resto sorteado por raridade (60/28/9/3), sem repetir carta na mesma escolha.
 */
export function buildOffer(world: World, p: Player, level: number, opts: BuildOptions = {}): Offer {
  const all = eligibleCards(p, level);
  const picked: CardDef[] = [...(opts.keep ?? [])];
  const taken = new Set(picked.map((c) => c.id));
  let pool = all.filter((c) => !taken.has(c.id));
  // Evita o que acabou de aparecer, se sobrar o bastante para completar a escolha.
  if (opts.avoid) {
    const filtered = pool.filter((c) => !opts.avoid!.has(c.id));
    if (filtered.length >= CARDS_PER_CHOICE - picked.length) pool = filtered;
  }

  // Marcos 10, 20 e 30: Lendária exclusiva garantida (a dupla do nível 10 vem primeiro).
  const parIds: readonly string[] = LEVEL10_LEGENDARIES[p.characterId];
  if (MILESTONE_LEGENDARY_LEVELS.includes(level) && !picked.some((c) => parIds.includes(c.id))) {
    const pair = parIds
      .map((id) => pool.find((c) => c.id === id))
      .filter((c): c is CardDef => c !== undefined);
    let c: CardDef | undefined = pair.length > 0 ? pair[world.rng.int(0, pair.length - 1)] : undefined;
    // Dupla esgotada (níveis 20 e 30): qualquer Lendária serve, a menos que já haja uma na oferta.
    if (!c && !picked.some((x) => x.rarity === 'lendaria')) {
      c = drawWeighted(world, pool.filter((x) => x.rarity === 'lendaria' && kindOf(x) === 'exclusive'));
      c ??= drawWeighted(world, pool.filter((x) => x.rarity === 'lendaria'));
    }
    if (c) {
      picked.push(c);
      remove(pool, c);
    }
  }

  // Marcos 5, 15 e 25: Épica garantida (prefere exclusiva; senão qualquer Épica; senão Lendária).
  if (MILESTONE_EPIC_LEVELS.includes(level) && !picked.some((c) => c.rarity === 'epica' || c.rarity === 'lendaria')) {
    const epicas = pool.filter((c) => c.rarity === 'epica');
    const exclusivas = epicas.filter((c) => kindOf(c) === 'exclusive');
    const fonte = exclusivas.length > 0 ? exclusivas : epicas.length > 0 ? epicas : pool.filter((c) => c.rarity === 'lendaria');
    const c = fonte[world.rng.int(0, Math.max(0, fonte.length - 1))];
    if (c) {
      picked.push(c);
      remove(pool, c);
    }
  }

  // Pelo menos 1 exclusiva do personagem em toda escolha.
  if (!picked.some((c) => kindOf(c) === 'exclusive')) {
    const c = drawWeighted(world, pool.filter((x) => kindOf(x) === 'exclusive'));
    if (c) {
      picked.push(c);
      remove(pool, c);
    }
  }

  while (picked.length < CARDS_PER_CHOICE) {
    const c = drawWeighted(world, pool);
    if (!c) break;
    picked.push(c);
    remove(pool, c);
  }

  // Embaralha para a carta garantida não ser sempre a primeira.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = world.rng.int(0, i);
    [picked[i], picked[j]] = [picked[j]!, picked[i]!];
  }
  return { cards: picked, levels: picked.map((c) => cardLevelOf(p, c.id) + 1) };
}
