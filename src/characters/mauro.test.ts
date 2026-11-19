import { describe, expect, it } from 'vitest';
import { MAURO_CARDS } from '../combat/mauroCards';
import { chooseCard, grantXp, pushChoice } from '../combat/leveling';
import { spawnEnemy } from '../combat/spawner';
import { COMUNS } from '../data/enemies';
import { JUMPS_MAX, NOTA_COST, NOTA_COST_PE_DE_PAGINA, FOCO_MAX } from '../data/mauro';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { xpToNext } from '../engine/xp';
import { onKillHook, onLevelUp, onPlayerHit, onProjectileHit, xpMultiplier } from './kitHooks';
import {
  conhecimentoBonus,
  custoDaNota,
  danoDaNota,
  recordacaoPerfeita,
  regenDeFoco,
  saltosPorConhecimento,
} from './mauro';
import type { MauroState } from './mauroState';

const ROBO = COMUNS[0]!;

function setup(seed = 1): { w: World; s: MauroState } {
  const w = createWorld(['mauro'], { initialChoice: false, seed, noSpawn: true });
  return { w, s: w.players[0]!.kit as MauroState };
}

function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) stepWorld(w, [NO_INPUT]);
}

function card(id: string): (typeof MAURO_CARDS)[number] {
  return MAURO_CARDS.find((c) => c.id === id)!;
}

describe('Mauro: soft cap do Conhecimento', () => {
  it('+10% a cada 100 abates até 500', () => {
    expect(conhecimentoBonus(0)).toBe(0);
    expect(conhecimentoBonus(99)).toBe(0);
    expect(conhecimentoBonus(100)).toBeCloseTo(0.1, 10);
    expect(conhecimentoBonus(300)).toBeCloseTo(0.3, 10);
    expect(conhecimentoBonus(500)).toBeCloseTo(0.5, 10);
  });

  it('depois de 500 abates o ganho por degrau cai à metade', () => {
    const gainBefore = conhecimentoBonus(500) - conhecimentoBonus(400);
    const gainAfter = conhecimentoBonus(600) - conhecimentoBonus(500);
    expect(gainAfter).toBeCloseTo(gainBefore / 2, 10);
    expect(conhecimentoBonus(1000)).toBeCloseTo(0.5 + 5 * 0.05, 10);
  });

  it('nunca diminui e o ganho nunca volta a subir', () => {
    let prev = 0;
    let prevGain = Infinity;
    for (let k = 0; k <= 3000; k += 100) {
      const v = conhecimentoBonus(k);
      expect(v).toBeGreaterThanOrEqual(prev);
      const gain = v - prev;
      if (k > 0) expect(gain).toBeLessThanOrEqual(prevGain + 1e-12);
      if (k > 0) prevGain = gain;
      prev = v;
    }
  });

  it('abates negativos não geram bônus', () => {
    expect(conhecimentoBonus(-50)).toBe(0);
  });
});

describe('Mauro: saltos', () => {
  it('3 de base, +1 a cada 200 abates, máximo 8', () => {
    expect(saltosPorConhecimento(0)).toBe(3);
    expect(saltosPorConhecimento(199)).toBe(3);
    expect(saltosPorConhecimento(200)).toBe(4);
    expect(saltosPorConhecimento(1000)).toBe(8);
    expect(saltosPorConhecimento(99999)).toBe(JUMPS_MAX);
  });
});

describe('Mauro: Foco e disparo', () => {
  it('começa com Foco cheio (100) e cada Nota custa 8', () => {
    const { w, s } = setup();
    expect(s.foco).toBe(FOCO_MAX);
    spawnEnemy(w, ROBO, 100, 0);
    w.enemies.active[0]!.hp = 1000;
    step(w);
    expect(w.projectiles.size).toBe(1);
    expect(s.foco).toBeLessThan(FOCO_MAX - NOTA_COST + 0.2);
    expect(s.foco).toBeGreaterThan(FOCO_MAX - NOTA_COST - 0.2);
  });

  it('sem Foco suficiente não atira, e o Foco regenera 5/s', () => {
    const { w, s } = setup();
    s.foco = 0;
    spawnEnemy(w, ROBO, 100, 0);
    w.enemies.active[0]!.hp = 1000;
    step(w, 60); // 1 s
    expect(s.foco).toBeGreaterThan(0);
    // Em 1 s regenerou ~5; gastou 8 numa nota só se chegou a 8, o que não ocorre.
    expect(w.projectiles.size).toBe(0);
    expect(s.foco).toBeCloseTo(5, 0);
  });

  it('não ultrapassa o Foco máximo', () => {
    const { w, s } = setup();
    step(w, 120);
    expect(s.foco).toBeLessThanOrEqual(FOCO_MAX);
  });

  it('a runa salta entre inimigos próximos e atinge vários', () => {
    const { w } = setup();
    for (const x of [100, 130, 160, 190]) spawnEnemy(w, ROBO, x, -8);
    const line = [...w.enemies.active];
    for (const e of line) e.hp = 1000;
    step(w, 120);
    expect(line.filter((e) => e.hp < 1000).length).toBeGreaterThanOrEqual(3);
  });
});

describe('Mauro: passiva Memória Fotográfica', () => {
  it('+15% de XP', () => {
    const { w } = setup();
    const p = w.players[0]!;
    expect(xpMultiplier(p)).toBeCloseTo(1.15, 10);
    grantXp(w, p, 5); // abaixo do necessário para subir de nível
    expect(p.xp).toBeCloseTo(5.75, 5);
  });

  it('um reroll grátis a cada 3 níveis', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    for (let lvl = 2; lvl <= 10; lvl++) onLevelUp(p, lvl);
    expect(s.freeRerolls).toBe(3); // níveis 3, 6 e 9
  });

  it('Recordação Perfeita cresce 0,5%/s até +50% e zera ao levar dano', () => {
    expect(recordacaoPerfeita(0)).toBe(1);
    expect(recordacaoPerfeita(10)).toBeCloseTo(1.05, 10);
    expect(recordacaoPerfeita(100)).toBeCloseTo(1.5, 10);
    expect(recordacaoPerfeita(1000)).toBeCloseTo(1.5, 10);
    const { w, s } = setup();
    step(w, 600); // 10 s sem dano
    expect(s.safeTime).toBeCloseTo(10, 1);
    onPlayerHit(w.players[0]!);
    expect(s.safeTime).toBe(0);
  });

  it('o dano da Nota inclui Conhecimento e Recordação Perfeita', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    const base = danoDaNota(p, s);
    p.kills = 100;
    expect(danoDaNota(p, s)).toBeCloseTo(base * 1.1, 5);
    s.safeTime = 100;
    expect(danoDaNota(p, s)).toBeCloseTo(base * 1.1 * 1.5, 5);
  });
});

describe('Mauro: cartas exclusivas', () => {
  it('são 16 com ids únicos', () => {
    expect(MAURO_CARDS).toHaveLength(16);
    expect(new Set(MAURO_CARDS.map((c) => c.id)).size).toBe(16);
  });

  it('Nota de Pé de Página: custo cai para 6', () => {
    const { w, s } = setup();
    expect(custoDaNota(s)).toBe(NOTA_COST);
    card('mauro-pe-de-pagina').apply(w.players[0]!);
    expect(custoDaNota(s)).toBe(NOTA_COST_PE_DE_PAGINA);
  });

  it('Edição Revisada: Foco máximo +30 e regeneração +2/s', () => {
    const { w, s } = setup();
    const regen = regenDeFoco(s);
    card('mauro-edicao').apply(w.players[0]!);
    expect(regenDeFoco(s)).toBe(regen + 2);
    s.foco = 0;
    s.cd = 99999; // sem atacar, para o Foco só regenerar
    step(w, 60 * 40);
    expect(s.foco).toBeCloseTo(130, 0);
  });

  it('Sala de Leitura Silenciosa: parado por 3 s dá +20% de XP e de regeneração', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('mauro-sala').apply(p);
    expect(xpMultiplier(p)).toBeCloseTo(1.15, 10);
    step(w, 60 * 3 + 5);
    expect(s.stillTime).toBeGreaterThanOrEqual(3);
    expect(xpMultiplier(p)).toBeCloseTo(1.15 * 1.2, 10);
    expect(regenDeFoco(s)).toBeCloseTo(5 * 1.2, 10);
  });

  it('Sobrecarga Enciclopédica: +5% a cada 100 abates, teto de +25%', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('mauro-sobrecarga').apply(p);
    p.kills = 0;
    const base = danoDaNota(p, s);
    p.kills = 200;
    // Conhecimento +20% e Sobrecarga +10%, em separado.
    expect(danoDaNota(p, s)).toBeCloseTo(base * 1.2 * 1.1, 5);
    p.kills = 400;
    const at400 = danoDaNota(p, s);
    p.kills = 400;
    expect(at400).toBeCloseTo(base * 1.4 * 1.2, 5);
    p.kills = 1000;
    // Teto +25% de Sobrecarga; Conhecimento com soft cap (+75%).
    expect(danoDaNota(p, s)).toBeCloseTo(base * 1.75 * 1.25, 5);
  });

  it('Enciclopédia Viva: +1 de dano por nível', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    const base = danoDaNota(p, s);
    card('mauro-enciclopedia').apply(p);
    p.level = 5;
    expect(danoDaNota(p, s)).toBeCloseTo(base + 5, 5);
  });

  it('Bibliografia Comentada: a cada 10 abates, +1 carga de salto, gasta na próxima Nota', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('mauro-biblio').apply(p);
    for (let i = 0; i < 25; i++) onKillHook(p);
    expect(s.jumpCharges).toBe(2);
    spawnEnemy(w, ROBO, 100, 0);
    w.enemies.active[0]!.hp = 1000;
    step(w);
    expect(s.jumpCharges).toBe(0);
    expect(w.projectiles.active[0]!.bounces).toBe(3 + 2);
  });

  it('Bibliografia Comentada: saltos nunca passam do máximo', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    card('mauro-biblio').apply(p);
    p.kills = 1000; // 8 saltos de base
    s.jumpCharges = 5;
    spawnEnemy(w, ROBO, 100, 0);
    w.enemies.active[0]!.hp = 1000;
    step(w);
    expect(w.projectiles.active[0]!.bounces).toBe(JUMPS_MAX);
  });

  it('Índice Remissivo: marca inimigos, que recebem +10% de dano', () => {
    const { w, s } = setup();
    card('mauro-indice').apply(w.players[0]!);
    spawnEnemy(w, ROBO, 100, 0);
    spawnEnemy(w, ROBO, 400, 0);
    const [a, b] = w.enemies.active;
    a!.hp = 1000;
    b!.hp = 1000;
    s.cd = 99;
    onProjectileHit(w.players[0]!, { ...w.projectiles.acquire()!, kind: 'runa', damage: 5 }, a!);
    expect(a!.marked).toBe(true);
    expect(b!.marked).toBe(false);
  });

  it('Rodapé do Rodapé: cada acerto agenda um eco que bate depois de 1 s', () => {
    const { w, s } = setup();
    card('mauro-rodape').apply(w.players[0]!);
    spawnEnemy(w, ROBO, 400, 0);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    e.stun = 5; // parado, para o eco acertar o mesmo ponto
    s.cd = 999;
    onProjectileHit(w.players[0]!, { ...w.projectiles.acquire()!, kind: 'runa', damage: 5 }, e);
    expect(s.echoes).toHaveLength(1);
    step(w, 65);
    expect(s.echoes).toHaveLength(0);
    expect(e.hp).toBeLessThan(1000);
  });

  it('Revisão de Prova: acertar um chefe devolve Foco', () => {
    const { w, s } = setup();
    card('mauro-revisao').apply(w.players[0]!);
    s.foco = 10;
    const boss = { ...ROBO, boss: true };
    spawnEnemy(w, boss, 100, 0);
    const e = w.enemies.active[0]!;
    onProjectileHit(w.players[0]!, { ...w.projectiles.acquire()!, kind: 'runa', damage: 5 }, e);
    expect(s.foco).toBeGreaterThan(10);
  });

  it('Referência Cruzada: a runa se divide em duas, uma vez', () => {
    const { w } = setup();
    card('mauro-referencia').apply(w.players[0]!);
    for (const x of [100, 125, 150, 175, 200]) spawnEnemy(w, ROBO, x, -8);
    for (const e of w.enemies.active) e.hp = 1000;
    let maxProjectiles = 0;
    for (let i = 0; i < 100; i++) {
      step(w);
      maxProjectiles = Math.max(maxProjectiles, w.projectiles.size);
    }
    expect(maxProjectiles).toBeGreaterThanOrEqual(2);
    expect(maxProjectiles).toBeLessThanOrEqual(4); // uma divisão por runa, sem multiplicar sem fim
  });

  it('Mestre da Nota Longa: a cada 5 saltos a runa explode em área', () => {
    const { w } = setup();
    card('mauro-mestre').apply(w.players[0]!);
    w.players[0]!.kills = 1000; // 8 saltos
    for (let i = 0; i < 9; i++) spawnEnemy(w, ROBO, 100 + i * 25, -8);
    for (const e of w.enemies.active) e.hp = 1000;
    let sawRing = false;
    for (let i = 0; i < 200; i++) {
      step(w);
      if (w.effects.active.some((e) => e.kind === 'ring')) sawRing = true;
    }
    expect(sawRing).toBe(true);
  });

  it('Órbita de Clássicos: os livros causam dano e empurram inimigos próximos', () => {
    const { w, s } = setup();
    card('mauro-orbita').apply(w.players[0]!);
    s.cd = 999;
    spawnEnemy(w, ROBO, 36, -8);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    step(w, 120);
    expect(e.hp).toBeLessThan(1000);
  });
});

describe('Mauro: cartas na escolha de nível', () => {
  it('toda escolha tem pelo menos 1 exclusiva do Mauro', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { w } = setup(seed);
      pushChoice(w, w.players[0]!);
      const c = w.choices[0]!;
      expect(c.cards.some((x) => x.character === 'mauro')).toBe(true);
      expect(c.cards.every((x) => x.character === undefined || x.character === 'mauro')).toBe(true);
    }
  });

  it('escolher a carta a aplica e registra', () => {
    const { w } = setup();
    const p = w.players[0]!;
    grantXp(w, p, xpToNext(1));
    expect(chooseCard(w, 0, 0)).toBe(true);
    expect(p.cardsTaken).toHaveLength(1);
  });
});
