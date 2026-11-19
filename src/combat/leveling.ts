import { onLevelUp, xpMultiplier } from '../characters/kitHooks';
import { MAX_LEVEL } from '../data/balance';
import { PARES_XP } from '../data/team';
import type { Player } from '../entities/player';
import { xpToNext } from '../engine/xp';
import type { World } from '../engine/world';
import { buildOffer } from './cardPool';
import type { CardDef } from './cardTypes';

export interface PendingChoice {
  readonly slot: number;
  /** Nível que o jogador acabou de atingir (1 = escolha inicial). */
  readonly level: number;
  /** Cartas oferecidas. Mudam ao rerolar ou banir. */
  cards: CardDef[];
  /** Nível que cada carta terá se for escolhida (1 = nova; 2 e 3 = repetida sobe de nível). */
  levels: number[];
}

/** Sorteia as 3 cartas do nível atual do jogador e enfileira a escolha. */
export function pushChoice(world: World, player: Player): void {
  const offer = buildOffer(world, player, player.level);
  // Sem nenhuma carta elegível (pool esgotado): não abre escolha, para não travar a partida.
  if (offer.cards.length === 0) return;
  world.choices.push({ slot: player.slot, level: player.level, cards: offer.cards, levels: offer.levels });
}

/** Aplica a carta escolhida à primeira escolha pendente. Devolve false se não for válida. */
export function chooseCard(world: World, slot: number, index: number): boolean {
  const choice = world.choices[0];
  if (!choice || choice.slot !== slot) return false;
  const card = choice.cards[index];
  const level = choice.levels[index];
  const player = world.players[slot];
  if (!card || level === undefined || !player) return false;
  card.apply(player, level);
  player.cardLevels[card.id] = level;
  if (!player.cardsTaken.includes(card.id)) player.cardsTaken.push(card.id);
  world.choices.shift();
  return true;
}

/**
 * Rerola a escolha atual: 3 cartas novas. Gasta um reroll (o Mauro usa antes os grátis da Memória Fotográfica).
 */
export function rerollChoice(world: World, slot: number): boolean {
  const choice = world.choices[0];
  const player = world.players[slot];
  if (!choice || choice.slot !== slot || !player) return false;
  const k = player.kit;
  if (k?.type === 'mauro' && k.freeRerolls > 0) k.freeRerolls--;
  else if (player.rerolls > 0) player.rerolls--;
  else return false;
  const offer = buildOffer(world, player, choice.level, { avoid: new Set(choice.cards.map((c) => c.id)) });
  choice.cards = offer.cards;
  choice.levels = offer.levels;
  return true;
}

/**
 * Bane a carta: ela nunca mais aparece nesta partida, e outra ocupa o lugar dela
 * (mantendo as garantias de marco e de exclusiva).
 */
export function banCard(world: World, slot: number, index: number): boolean {
  const choice = world.choices[0];
  const player = world.players[slot];
  if (!choice || choice.slot !== slot || !player || player.bans <= 0) return false;
  const card = choice.cards[index];
  if (!card) return false;
  player.bans--;
  player.banned.push(card.id);
  const keep = choice.cards.filter((_, i) => i !== index);
  const offer = buildOffer(world, player, choice.level, { keep, avoid: new Set(choice.cards.map((c) => c.id)) });
  choice.cards = offer.cards;
  choice.levels = offer.levels;
  return true;
}

/** Quantos rerolls o jogador ainda tem, contando os grátis do Mauro. */
export function rerollsRestantes(player: Player): number {
  const k = player.kit;
  return player.rerolls + (k?.type === 'mauro' ? k.freeRerolls : 0);
}

/**
 * Concede XP. Cada nível (2 a MAX_LEVEL) abre uma escolha de carta.
 * Depois do nível máximo, o XP vira Salgadinhos (GDD A.5).
 */
export function grantXp(world: World, player: Player, rawAmount: number): void {
  const amount = rawAmount * xpMultiplier(player);
  if (player.level >= MAX_LEVEL) {
    player.salgadinhos += amount;
    return;
  }
  player.xp += amount;
  while (player.level < MAX_LEVEL && player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level++;
    onLevelUp(player, player.level);
    // Revisão por Pares: quando um aliado sobe de nível, o Mauro ganha 50 de XP.
    for (const m of world.players) {
      if (m !== player && m.hp > 0 && m.kit?.type === 'mauro' && m.kit.mods.pares) grantXp(world, m, PARES_XP);
    }
    pushChoice(world, player);
  }
  if (player.level >= MAX_LEVEL) {
    player.salgadinhos += player.xp;
    player.xp = 0;
  }
}
