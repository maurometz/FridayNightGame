import { describe, expect, it } from 'vitest';
import { getCard } from '../combat/cardPool';
import { createWorld } from '../engine/world';
import { collectCards } from './cardsInfo';

describe('resumo das cartas de cada jogador', () => {
  it('lista as cartas de todos, na ordem em que foram escolhidas, com nível e raridade', () => {
    const w = createWorld(['felipe', 'mauro'], { noSpawn: true, initialChoice: false });
    const a = w.players[0]!;
    const b = w.players[1]!;
    for (const id of ['felipe-pedal', 'shared-cafeina']) {
      getCard(id)!.apply(a, 1);
      a.cardsTaken.push(id);
      a.cardLevels[id] = 1;
    }
    getCard('shared-cafeina')!.apply(a, 2);
    a.cardLevels['shared-cafeina'] = 2;
    getCard('mauro-postit')!.apply(b, 1);
    b.cardsTaken.push('mauro-postit');

    const r = collectCards(w, [1]);
    expect(r).toHaveLength(2);
    expect(r[0]!.label).toBe('Felipe');
    expect(r[1]!.label).toBe('Mauro (IA)');
    expect(r[0]!.entries.map((e) => e.name)).toEqual(['Pedal de Distorção', 'Cafeína Pura']);
    expect(r[0]!.entries[1]).toMatchObject({ level: 2, maxLevel: 3, rarity: 'comum', kind: 'passive' });
    expect(r[0]!.entries[0]).toMatchObject({ rarity: 'rara', kind: 'exclusive' });
    expect(r[1]!.entries.map((e) => e.id)).toEqual(['mauro-postit']);
    expect(r[0]!.stats).toContain('Dano +21%');
  });

  it('jogador sem cartas aparece com lista vazia', () => {
    const w = createWorld(['thaisa'], { noSpawn: true, initialChoice: false });
    expect(collectCards(w)[0]!.entries).toEqual([]);
  });

  it('ignora ids de cartas que não existem mais', () => {
    const w = createWorld(['thaisa'], { noSpawn: true, initialChoice: false });
    w.players[0]!.cardsTaken.push('carta-removida');
    expect(collectCards(w)[0]!.entries).toEqual([]);
  });
});
