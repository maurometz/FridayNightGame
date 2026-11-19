import { describe, expect, it } from 'vitest';
import { LEVEL10_LEGENDARIES, RARITY_WEIGHTS, MAX_CARD_LEVEL, RUN_BANS, RUN_REROLLS } from '../data/cards';
import { MAX_LEVEL } from '../data/balance';
import type { CharacterId } from '../data/characters';
import { createWorld, type World } from '../engine/world';
import { totalXpToMaxLevel } from '../engine/xp';
import { ALL_CARDS, buildOffer, cardLevelOf, drawWeighted, eligibleCards, getCard, maxLevelOf } from './cardPool';
import { kindOf } from './cardTypes';
import { banCard, chooseCard, grantXp, pushChoice, rerollChoice, rerollsRestantes } from './leveling';

const CHARS: CharacterId[] = ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'];

function setup(char: CharacterId, seed = 1): { w: World } {
  return { w: createWorld([char], { initialChoice: false, seed, noSpawn: true }) };
}

function offerAt(char: CharacterId, level: number, seed: number): ReturnType<typeof buildOffer> {
  const { w } = setup(char, seed);
  return buildOffer(w, w.players[0]!, level);
}

describe('Pool de cartas', () => {
  it('tem 137 cartas: 81 exclusivas, 25 de equipe, 9 armas e 22 passivas', () => {
    const count = (k: string): number => ALL_CARDS.filter((c) => kindOf(c) === k).length;
    expect(ALL_CARDS).toHaveLength(137);
    expect(count('exclusive')).toBe(81);
    expect(count('team')).toBe(25);
    expect(count('weapon')).toBe(9);
    expect(count('passive')).toBe(22);
  });

  it('cada personagem tem 16 exclusivas (17 o Felipe, com o Réquiem) e 5 de equipe', () => {
    for (const c of CHARS) {
      expect(ALL_CARDS.filter((x) => x.character === c && kindOf(x) === 'exclusive')).toHaveLength(c === 'felipe' ? 17 : 16);
      expect(ALL_CARDS.filter((x) => x.character === c && kindOf(x) === 'team')).toHaveLength(5);
    }
  });

  it('os ids são únicos e todo "requires" aponta para uma carta que existe', () => {
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(ALL_CARDS.length);
    for (const c of ALL_CARDS) if (c.requires) expect(getCard(c.requires)).toBeDefined();
  });

  it('as Lendárias garantidas no nível 10 existem e são exclusivas do personagem', () => {
    for (const c of CHARS) {
      for (const id of LEVEL10_LEGENDARIES[c]) {
        const card = getCard(id);
        expect(card?.rarity).toBe('lendaria');
        expect(card?.character).toBe(c);
        expect(kindOf(card!)).toBe('exclusive');
      }
    }
  });

  it('o nível máximo de uma carta é 3', () => {
    expect(MAX_CARD_LEVEL).toBe(3);
    for (const c of ALL_CARDS) expect(maxLevelOf(c)).toBeLessThanOrEqual(MAX_CARD_LEVEL);
  });
});

describe('Pesos de raridade', () => {
  it('os pesos padrão são 60/28/9/3', () => {
    expect(RARITY_WEIGHTS).toEqual({ comum: 60, rara: 28, epica: 9, lendaria: 3 });
  });

  it('o sorteio respeita os pesos (amostra grande)', () => {
    const { w } = setup('felipe', 42);
    const n = 40000;
    const counts: Record<string, number> = { comum: 0, rara: 0, epica: 0, lendaria: 0 };
    for (let i = 0; i < n; i++) counts[drawWeighted(w, ALL_CARDS)!.rarity]!++;
    expect(counts.comum! / n).toBeCloseTo(0.6, 1);
    expect(counts.rara! / n).toBeCloseTo(0.28, 1);
    expect(counts.epica! / n).toBeCloseTo(0.09, 1);
    expect(counts.lendaria! / n).toBeCloseTo(0.03, 1);
    // Tolerância mais apertada que o toBeCloseTo(.., 1).
    expect(Math.abs(counts.comum! / n - 0.6)).toBeLessThan(0.015);
    expect(Math.abs(counts.lendaria! / n - 0.03)).toBeLessThan(0.008);
  });

  it('se uma raridade não tem candidatas, os pesos são redistribuídos', () => {
    const { w } = setup('felipe');
    const soComuns = ALL_CARDS.filter((c) => c.rarity === 'comum');
    for (let i = 0; i < 50; i++) expect(drawWeighted(w, soComuns)!.rarity).toBe('comum');
    expect(drawWeighted(w, [])).toBeUndefined();
  });

  it('dentro de uma raridade, todas as cartas têm a mesma chance', () => {
    const { w } = setup('felipe', 9);
    const epicas = ALL_CARDS.filter((c) => c.rarity === 'epica').slice(0, 4);
    const counts = new Map<string, number>();
    for (let i = 0; i < 8000; i++) {
      const c = drawWeighted(w, epicas)!;
      counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    }
    for (const c of epicas) expect(counts.get(c.id)! / 8000).toBeCloseTo(0.25, 1);
  });
});

describe('Escolha de cartas', () => {
  it('toda escolha tem 3 cartas distintas e pelo menos 1 exclusiva do personagem', () => {
    for (const ch of CHARS) {
      for (let level = 1; level <= MAX_LEVEL; level++) {
        for (let seed = 1; seed <= 25; seed++) {
          const o = offerAt(ch, level, seed);
          expect(o.cards).toHaveLength(3);
          expect(new Set(o.cards.map((c) => c.id)).size).toBe(3);
          expect(o.cards.some((c) => kindOf(c) === 'exclusive' && c.character === ch)).toBe(true);
          for (const c of o.cards) expect(c.character === undefined || c.character === ch).toBe(true);
        }
      }
    }
  });

  it('o nível 1 só oferece Comuns e Raras', () => {
    for (const ch of CHARS) {
      for (let seed = 1; seed <= 60; seed++) {
        for (const c of offerAt(ch, 1, seed).cards) expect(['comum', 'rara']).toContain(c.rarity);
      }
    }
  });

  it('marco do nível 5: sempre uma Épica ou Lendária', () => {
    for (const ch of CHARS) {
      for (let seed = 1; seed <= 60; seed++) {
        const o = offerAt(ch, 5, seed);
        expect(o.cards.some((c) => c.rarity === 'epica' || c.rarity === 'lendaria')).toBe(true);
        // Prefere uma Épica exclusiva do personagem.
        expect(o.cards.some((c) => c.rarity === 'epica' && kindOf(c) === 'exclusive')).toBe(true);
      }
    }
  });

  it('marco do nível 10: uma das duas Lendárias exclusivas, e as duas aparecem em algum momento', () => {
    for (const ch of CHARS) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 80; seed++) {
        const o = offerAt(ch, 10, seed);
        const garantidas = o.cards.filter((c) => (LEVEL10_LEGENDARIES[ch] as readonly string[]).includes(c.id));
        expect(garantidas.length).toBeGreaterThanOrEqual(1);
        for (const g of garantidas) seen.add(g.id);
      }
      expect(seen.size).toBe(2);
    }
  });

  it('marcos 15 e 25 (Épica) e 20 e 30 (Lendária) também valem', () => {
    for (const ch of CHARS) {
      for (let seed = 1; seed <= 40; seed++) {
        for (const lv of [15, 25]) {
          expect(offerAt(ch, lv, seed).cards.some((c) => c.rarity === 'epica' || c.rarity === 'lendaria'), `${ch} nv${lv}`).toBe(true);
        }
        for (const lv of [20, 30]) {
          expect(offerAt(ch, lv, seed).cards.some((c) => c.rarity === 'lendaria'), `${ch} nv${lv}`).toBe(true);
        }
      }
    }
  });

  it('nível 20: com a primeira Lendária do nível 10 já escolhida, vem a segunda da dupla', () => {
    const { w } = setup('thayssa');
    const p = w.players[0]!;
    const [a, b] = LEVEL10_LEGENDARIES.thayssa;
    p.cardLevels[a] = 1;
    p.cardsTaken.push(a);
    for (let i = 0; i < 20; i++) {
      const o = buildOffer(w, p, 20);
      expect(o.cards.some((c) => c.id === b)).toBe(true);
      expect(o.cards.some((c) => c.id === a)).toBe(false);
    }
  });

  it('ao longo de 30 níveis nunca falta carta: toda escolha tem 3 (escolhendo ao acaso, 20 partidas por personagem)', () => {
    for (const ch of CHARS) {
      for (let seed = 1; seed <= 20; seed++) {
        const w = createWorld([ch], { seed, initialChoice: false, noSpawn: true });
        const p = w.players[0]!;
        for (let lv = 2; lv <= MAX_LEVEL; lv++) {
          p.level = lv;
          const o = buildOffer(w, p, lv);
          expect(o.cards.length, `${ch} seed ${seed} nv${lv}`).toBe(3);
          const i = w.rng.int(0, 2);
          o.cards[i]!.apply(p, o.levels[i]);
          p.cardLevels[o.cards[i]!.id] = o.levels[i]!;
          if (!p.cardsTaken.includes(o.cards[i]!.id)) p.cardsTaken.push(o.cards[i]!.id);
        }
      }
    }
  });

  it('nos marcos, a Épica/Lendária aparece em 100% das escolhas (peso 100%)', () => {
    let faltou = 0;
    for (const ch of CHARS) {
      for (let seed = 1; seed <= 100; seed++) {
        if (!offerAt(ch, 5, seed).cards.some((c) => c.rarity !== 'comum' && c.rarity !== 'rara')) faltou++;
        if (!offerAt(ch, 10, seed).cards.some((c) => c.rarity === 'lendaria')) faltou++;
      }
    }
    expect(faltou).toBe(0);
  });

  it('uma Lendária já escolhida no nível 10 não é oferecida de novo; a outra da dupla entra', () => {
    const { w } = setup('felipe');
    const p = w.players[0]!;
    p.cardLevels['felipe-turne'] = 1;
    p.cardsTaken.push('felipe-turne');
    for (let i = 0; i < 20; i++) {
      const o = buildOffer(w, p, 10);
      expect(o.cards.some((c) => c.id === 'felipe-turne')).toBe(false);
      expect(o.cards.some((c) => c.id === 'felipe-encore')).toBe(true);
    }
  });

  it('cartas de efeito único não repetem; cartas "requires" só depois da exigida', () => {
    const { w } = setup('melissa');
    const p = w.players[0]!;
    expect(eligibleCards(p, 4).some((c) => c.id === 'melissa-passo')).toBe(false);
    expect(eligibleCards(p, 4).some((c) => c.id === 'team-melissa-entrada')).toBe(false);
    p.cardLevels['melissa-investida'] = 1;
    expect(eligibleCards(p, 4).some((c) => c.id === 'melissa-passo')).toBe(true);
    expect(eligibleCards(p, 4).some((c) => c.id === 'team-melissa-entrada')).toBe(true);
    expect(eligibleCards(p, 4).some((c) => c.id === 'melissa-investida')).toBe(false);
  });
});

describe('Cartas repetidas sobem de nível', () => {
  it('a carta repetida é oferecida como nível seguinte, até o 3, e depois some', () => {
    const { w } = setup('felipe', 5);
    const p = w.players[0]!;
    const pizza = getCard('shared-pizza')!;

    // Nível 1 (nova).
    w.choices.push({ slot: 0, level: 2, cards: [pizza, ALL_CARDS[0]!, ALL_CARDS[1]!], levels: [1, 1, 1] });
    expect(chooseCard(w, 0, 0)).toBe(true);
    expect(cardLevelOf(p, 'shared-pizza')).toBe(1);
    expect(p.extraWeapons[0]!.level).toBe(1);

    // A oferta seguinte mostra a pizza como nível 2.
    const o2 = buildOffer(w, p, 3);
    // Pode ou não sortear a pizza, então forçamos pelo elegível.
    expect(eligibleCards(p, 3).some((c) => c.id === 'shared-pizza')).toBe(true);
    void o2;
    w.choices.push({ slot: 0, level: 3, cards: [pizza, ALL_CARDS[0]!, ALL_CARDS[1]!], levels: [cardLevelOf(p, 'shared-pizza') + 1, 1, 1] });
    expect(w.choices[0]!.levels[0]).toBe(2);
    expect(chooseCard(w, 0, 0)).toBe(true);
    expect(cardLevelOf(p, 'shared-pizza')).toBe(2);
    expect(p.extraWeapons).toHaveLength(1);
    expect(p.extraWeapons[0]!.level).toBe(2);

    w.choices.push({ slot: 0, level: 4, cards: [pizza, ALL_CARDS[0]!, ALL_CARDS[1]!], levels: [3, 1, 1] });
    expect(chooseCard(w, 0, 0)).toBe(true);
    expect(cardLevelOf(p, 'shared-pizza')).toBe(3);
    expect(p.extraWeapons[0]!.level).toBe(3);

    // No nível máximo da carta, ela não aparece mais.
    expect(eligibleCards(p, 5).some((c) => c.id === 'shared-pizza')).toBe(false);
    for (let seed = 1; seed <= 40; seed++) {
      const o = buildOffer(createWorld(['felipe'], { initialChoice: false, seed, noSpawn: true }), p, 5);
      expect(o.cards.some((c) => c.id === 'shared-pizza')).toBe(false);
    }
  });

  it('nunca aparece duplicada na mesma escolha, e o nível mostrado é o seguinte', () => {
    const { w } = setup('thaisa', 3);
    const p = w.players[0]!;
    p.cardLevels['shared-garrafa'] = 2;
    p.cardsTaken.push('shared-garrafa');
    for (let i = 0; i < 300; i++) {
      const o = buildOffer(w, p, 3);
      expect(new Set(o.cards.map((c) => c.id)).size).toBe(o.cards.length);
      const idx = o.cards.findIndex((c) => c.id === 'shared-garrafa');
      if (idx >= 0) expect(o.levels[idx]).toBe(3);
    }
  });

  it('os efeitos acumulam a cada nível (Garrafa Térmica: +0,5 HP/s por nível)', () => {
    const { w } = setup('felipe');
    const p = w.players[0]!;
    const garrafa = getCard('shared-garrafa')!;
    for (let lv = 1; lv <= 3; lv++) {
      w.choices.push({ slot: 0, level: lv + 1, cards: [garrafa], levels: [lv] });
      chooseCard(w, 0, 0);
    }
    expect(p.regenPerS).toBeCloseTo(1.5, 10);
    expect(p.cardLevels['shared-garrafa']).toBe(3);
  });

  it('Corda Extra (exclusiva numérica) também sobe de nível', () => {
    const { w } = setup('felipe');
    const p = w.players[0]!;
    const corda = getCard('felipe-corda')!;
    expect(maxLevelOf(corda)).toBe(3);
    const k = p.kit as { maxAmmo: { violao: number } };
    const base = k.maxAmmo.violao;
    for (let lv = 1; lv <= 3; lv++) {
      w.choices.push({ slot: 0, level: lv + 1, cards: [corda], levels: [lv] });
      chooseCard(w, 0, 0);
    }
    expect(k.maxAmmo.violao).toBe(base + 30);
  });
});

describe('Nível máximo e número de escolhas', () => {
  it('são 30 escolhas por partida: a inicial e os níveis 2 a 30', () => {
    const w = createWorld(['felipe'], { seed: 1, noSpawn: true }); // com escolha inicial
    const p = w.players[0]!;
    expect(w.choices).toHaveLength(1);
    expect(w.choices[0]!.level).toBe(1);
    grantXp(w, p, totalXpToMaxLevel() * 3);
    expect(p.level).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(30);
    expect(w.choices).toHaveLength(30);
    expect(w.choices.map((c) => c.level)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('depois do nível máximo o XP vira Salgadinhos e não abre mais escolhas', () => {
    const { w } = setup('mauro');
    const p = w.players[0]!;
    grantXp(w, p, totalXpToMaxLevel() * 2);
    const escolhas = w.choices.length;
    const sal = p.salgadinhos;
    grantXp(w, p, 100);
    expect(w.choices).toHaveLength(escolhas);
    expect(p.salgadinhos).toBeGreaterThan(sal);
    expect(p.level).toBe(MAX_LEVEL);
  });

  it('escolher todas as cartas de uma partida respeita o limite de nível de cada carta', () => {
    for (const ch of CHARS) {
      const w = createWorld([ch], { seed: 7, noSpawn: true });
      const p = w.players[0]!;
      grantXp(w, p, totalXpToMaxLevel() * 3);
      while (w.choices.length > 0) chooseCard(w, 0, 0);
      for (const [id, lv] of Object.entries(p.cardLevels)) {
        expect(lv).toBeLessThanOrEqual(maxLevelOf(getCard(id)!));
        expect(lv).toBeLessThanOrEqual(MAX_CARD_LEVEL);
      }
      expect(p.cardsTaken.length).toBeGreaterThan(0);
    }
  });
});

describe('Reroll', () => {
  it('troca as 3 cartas por outras e gasta um reroll (2 por partida)', () => {
    const w = createWorld(['felipe'], { seed: 3, noSpawn: true });
    const p = w.players[0]!;
    expect(p.rerolls).toBe(RUN_REROLLS);
    const antes = w.choices[0]!.cards.map((c) => c.id);
    expect(rerollChoice(w, 0)).toBe(true);
    expect(p.rerolls).toBe(1);
    const depois = w.choices[0]!.cards.map((c) => c.id);
    expect(depois.some((id) => !antes.includes(id))).toBe(true);
    expect(w.choices[0]!.cards).toHaveLength(3);
  });

  it('não rerola sem rerolls restantes', () => {
    const w = createWorld(['felipe'], { seed: 3, noSpawn: true });
    expect(rerollChoice(w, 0)).toBe(true);
    expect(rerollChoice(w, 0)).toBe(true);
    expect(rerollChoice(w, 0)).toBe(false);
    expect(w.players[0]!.rerolls).toBe(0);
  });

  it('o reroll do nível 1 continua sem Épicas e Lendárias', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = createWorld(['thaisa'], { seed, noSpawn: true });
      rerollChoice(w, 0);
      for (const c of w.choices[0]!.cards) expect(['comum', 'rara']).toContain(c.rarity);
    }
  });

  it('o reroll mantém as garantias de marco', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = createWorld(['mauro'], { initialChoice: false, seed, noSpawn: true });
      const p = w.players[0]!;
      p.level = 10;
      pushChoice(w, p);
      rerollChoice(w, 0);
      expect(w.choices[0]!.cards.some((c) => c.rarity === 'lendaria')).toBe(true);
    }
  });

  it('Mauro usa antes os rerolls grátis da Memória Fotográfica', () => {
    const w = createWorld(['mauro'], { seed: 2, noSpawn: true });
    const p = w.players[0]!;
    (p.kit as { freeRerolls: number }).freeRerolls = 2;
    expect(rerollsRestantes(p)).toBe(4);
    rerollChoice(w, 0);
    expect(p.rerolls).toBe(2);
    expect((p.kit as { freeRerolls: number }).freeRerolls).toBe(1);
  });
});

describe('Banir', () => {
  it('a carta banida nunca mais aparece e o banimento é gasto (2 por partida)', () => {
    const w = createWorld(['felipe'], { seed: 11, noSpawn: true });
    const p = w.players[0]!;
    expect(p.bans).toBe(RUN_BANS);
    const alvo = w.choices[0]!.cards[0]!;
    expect(banCard(w, 0, 0)).toBe(true);
    expect(p.bans).toBe(1);
    expect(p.banned).toContain(alvo.id);
    expect(w.choices[0]!.cards.some((c) => c.id === alvo.id)).toBe(false);
    expect(w.choices[0]!.cards).toHaveLength(3);
    for (let seed = 1; seed <= 60; seed++) {
      const o = buildOffer(createWorld(['felipe'], { initialChoice: false, seed, noSpawn: true }), p, 3);
      expect(o.cards.some((c) => c.id === alvo.id)).toBe(false);
    }
  });

  it('as outras duas cartas ficam e só a banida é trocada', () => {
    const w = createWorld(['felipe'], { seed: 12, noSpawn: true });
    const antes = w.choices[0]!.cards.map((c) => c.id);
    banCard(w, 0, 1);
    const depois = w.choices[0]!.cards.map((c) => c.id);
    expect(depois).toContain(antes[0]);
    expect(depois).toContain(antes[2]);
    expect(depois).not.toContain(antes[1]);
  });

  it('não bane sem banimentos restantes', () => {
    const w = createWorld(['felipe'], { seed: 4, noSpawn: true });
    expect(banCard(w, 0, 0)).toBe(true);
    expect(banCard(w, 0, 0)).toBe(true);
    expect(banCard(w, 0, 0)).toBe(false);
    expect(w.players[0]!.bans).toBe(0);
    expect(w.players[0]!.banned).toHaveLength(2);
  });

  it('banir a Lendária garantida do nível 10 traz a outra da dupla', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const w = createWorld(['thayssa'], { initialChoice: false, seed, noSpawn: true });
      const p = w.players[0]!;
      p.level = 10;
      pushChoice(w, p);
      const idx = w.choices[0]!.cards.findIndex((c) => (LEVEL10_LEGENDARIES.thayssa as readonly string[]).includes(c.id));
      expect(idx).toBeGreaterThanOrEqual(0);
      banCard(w, 0, idx);
      const outra = w.choices[0]!.cards.find((c) => (LEVEL10_LEGENDARIES.thayssa as readonly string[]).includes(c.id));
      expect(outra).toBeDefined();
    }
  });

  it('banir a única exclusiva da escolha ainda deixa uma exclusiva', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = createWorld(['melissa'], { seed, noSpawn: true });
      const idx = w.choices[0]!.cards.findIndex((c) => kindOf(c) === 'exclusive');
      banCard(w, 0, idx);
      expect(w.choices[0]!.cards.some((c) => kindOf(c) === 'exclusive')).toBe(true);
    }
  });
});
