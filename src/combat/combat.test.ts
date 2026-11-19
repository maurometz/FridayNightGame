import { describe, expect, it } from 'vitest';
import { MAX_ENEMIES, MAX_LEVEL } from '../data/balance';
import { COMUNS } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { NO_INPUT } from '../engine/input';
import { Pool, type Poolable } from '../engine/pool';
import { SpatialHash } from '../engine/spatialHash';
import { createWorld, stepWorld } from '../engine/world';
import { totalXpToMaxLevel, xpToNext } from '../engine/xp';
import { chooseCard, grantXp } from './leveling';
import { playerScale, spawnEnemy, spawnRate } from './spawner';
import { spawnGem } from './gems';

interface Item extends Poolable {
  id: number;
}

describe('Pool', () => {
  it('reaproveita objetos liberados', () => {
    let created = 0;
    const pool = new Pool<Item>(() => ({ poolIndex: 0, id: ++created }), 10);
    const a = pool.acquire()!;
    pool.release(a);
    const b = pool.acquire()!;
    expect(b).toBe(a);
    expect(created).toBe(1);
  });

  it('respeita a capacidade', () => {
    const pool = new Pool<Item>(() => ({ poolIndex: 0, id: 0 }), 2);
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).toBeNull();
  });

  it('mantém os índices coerentes após liberar do meio', () => {
    const pool = new Pool<Item>(() => ({ poolIndex: 0, id: 0 }), 10);
    const items = [pool.acquire()!, pool.acquire()!, pool.acquire()!, pool.acquire()!];
    pool.release(items[1]!);
    expect(pool.size).toBe(3);
    pool.active.forEach((it, i) => expect(it.poolIndex).toBe(i));
  });

  it('ignora liberar duas vezes', () => {
    const pool = new Pool<Item>(() => ({ poolIndex: 0, id: 0 }), 10);
    const a = pool.acquire()!;
    pool.acquire();
    pool.release(a);
    pool.release(a);
    expect(pool.size).toBe(1);
  });
});

describe('SpatialHash', () => {
  it('devolve o mesmo que a busca bruta, inclusive com coordenadas negativas', () => {
    const hash = new SpatialHash<{ x: number; y: number }>(32);
    let seed = 12345;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pts = Array.from({ length: 400 }, () => ({ x: (rand() - 0.5) * 800, y: (rand() - 0.5) * 800 }));
    for (const p of pts) hash.insert(p);

    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < 25; i++) {
      const qx = (rand() - 0.5) * 800;
      const qy = (rand() - 0.5) * 800;
      const r = 20 + rand() * 60;
      const expected = pts.filter((p) => (p.x - qx) ** 2 + (p.y - qy) ** 2 <= r * r);
      const got = hash.query(qx, qy, r, out);
      expect(new Set(got)).toEqual(new Set(expected));
    }
  });

  it('clear esvazia a grade', () => {
    const hash = new SpatialHash<{ x: number; y: number }>(32);
    hash.insert({ x: 1, y: 1 });
    hash.clear();
    expect(hash.query(1, 1, 50, [])).toHaveLength(0);
  });
});

describe('curva de XP', () => {
  it('cresce a cada nível', () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('o total até o nível máximo é a soma das etapas', () => {
    let sum = 0;
    for (let l = 1; l < MAX_LEVEL; l++) sum += xpToNext(l);
    expect(totalXpToMaxLevel()).toBe(sum);
  });
});

describe('subida de nível e cartas', () => {
  it('a escolha inicial do nível 1 pausa a simulação até uma carta ser escolhida', () => {
    const w = createWorld(['felipe']);
    expect(w.choices).toHaveLength(1);
    expect(w.choices[0]!.cards).toHaveLength(3);
    expect(new Set(w.choices[0]!.cards.map((c) => c.id)).size).toBe(3);
    stepWorld(w, [NO_INPUT]);
    expect(w.tick).toBe(0);
    expect(chooseCard(w, 0, 1)).toBe(true);
    stepWorld(w, [NO_INPUT]);
    expect(w.tick).toBe(1);
  });

  it('XP suficiente sobe de nível e abre uma escolha', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    const p = w.players[0]!;
    grantXp(w, p, xpToNext(1));
    expect(p.level).toBe(2);
    expect(w.choices).toHaveLength(1);
    expect(w.choices[0]!.level).toBe(2);
  });

  it('XP grande sobe vários níveis de uma vez', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    const p = w.players[0]!;
    grantXp(w, p, xpToNext(1) + xpToNext(2) + 1);
    expect(p.level).toBe(3);
    expect(w.choices).toHaveLength(2);
  });

  it('nunca passa do nível máximo e o excesso vira Salgadinhos', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    const p = w.players[0]!;
    grantXp(w, p, totalXpToMaxLevel() + 5);
    expect(p.level).toBe(MAX_LEVEL);
    expect(w.choices).toHaveLength(MAX_LEVEL - 1);
    expect(p.salgadinhos).toBe(5);
    grantXp(w, p, 10);
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.salgadinhos).toBe(15);
    expect(w.choices).toHaveLength(MAX_LEVEL - 1);
  });

  it('só aceita a escolha do jogador certo e um índice válido', () => {
    const w = createWorld(['felipe', 'thaisa'], { initialChoice: false });
    grantXp(w, w.players[1]!, xpToNext(1));
    expect(chooseCard(w, 0, 0)).toBe(false);
    expect(chooseCard(w, 1, 5)).toBe(false);
    expect(chooseCard(w, 1, 0)).toBe(true);
    expect(w.choices).toHaveLength(0);
  });
});

describe('combate', () => {
  it('o Violão atira em leque de 5 notas no inimigo mais próximo', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    spawnEnemy(w, COMUNS[0]!, 100, 0);
    stepWorld(w, [NO_INPUT]);
    expect(w.projectiles.size).toBe(WEAPONS.violao.count);
  });

  it('não atira sem inimigos no alcance', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    spawnEnemy(w, COMUNS[0]!, 1000, 0);
    stepWorld(w, [NO_INPUT]);
    expect(w.projectiles.size).toBe(0);
  });

  it('um inimigo morto solta gema, conta o abate e a gema dá XP', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    const p = w.players[0]!;
    // Barata (6 de HP) bem perto: um leque de 5 notas a derruba.
    spawnEnemy(w, COMUNS[1]!, 40, -8);
    w.enemies.active[0]!.hp = 1;
    for (let i = 0; i < 90 && p.kills === 0; i++) stepWorld(w, [NO_INPUT]);
    expect(p.kills).toBe(1);
    expect(w.enemies.size).toBe(0);
    for (let i = 0; i < 240 && p.xp === 0; i++) stepWorld(w, [NO_INPUT]);
    expect(p.xp).toBeGreaterThan(0);
  });

  it('contato com inimigo causa dano e dá invulnerabilidade curta', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    const p = w.players[0]!;
    spawnEnemy(w, COMUNS[2]!, 1, 0);
    stepWorld(w, [NO_INPUT]);
    expect(p.hp).toBeLessThan(p.maxHp);
    const afterFirst = p.hp;
    stepWorld(w, [NO_INPUT]);
    expect(p.hp).toBe(afterFirst);
  });

  it('o jogo termina quando todos os jogadores caem', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    w.players[0]!.hp = 0;
    stepWorld(w, [NO_INPUT]);
    expect(w.status).toBe('gameover');
  });

  it('gemas além da capacidade do pool não perdem o XP', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    while (spawnGem(w, 500, 500, 1)) {
      /* enche o pool */
    }
    expect(spawnGem(w, 0, 0, 1)).toBe(false);
  });
});

describe('spawn', () => {
  it('a taxa cresce com o tempo e com jogadores extras', () => {
    expect(spawnRate(0, 100, 1)).toBeGreaterThan(spawnRate(0, 0, 1));
    expect(spawnRate(0, 0, 5)).toBeGreaterThan(spawnRate(0, 0, 1));
    expect(playerScale(1)).toBe(1);
    expect(playerScale(3)).toBe(2);
  });

  it('nunca passa de 300 inimigos ativos', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    for (let i = 0; i < MAX_ENEMIES + 50; i++) spawnEnemy(w, COMUNS[0]!, 200, 200);
    expect(w.enemies.size).toBe(MAX_ENEMIES);
    for (let i = 0; i < 120; i++) stepWorld(w, [NO_INPUT]);
    expect(w.enemies.size).toBeLessThanOrEqual(MAX_ENEMIES);
  });

  it('é determinístico para a mesma seed', () => {
    const run = (): string => {
      const w = createWorld(['felipe'], { initialChoice: false, seed: 99 });
      for (let i = 0; i < 600; i++) stepWorld(w, [NO_INPUT]);
      return JSON.stringify([w.enemies.size, w.players[0]!.kills, Math.round(w.players[0]!.hp)]);
    };
    expect(run()).toBe(run());
  });
});

describe('desempenho', () => {
  it('300 inimigos e 5 jogadores: o passo de simulação cabe com folga em 16,6 ms', () => {
    const w = createWorld(['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'], {
      initialChoice: false,
      stress: MAX_ENEMIES,
      seed: 7,
    });
    const inputs = w.players.map(() => NO_INPUT);
    for (let i = 0; i < 180; i++) stepWorld(w, inputs); // aquecimento: enche a tela de inimigos

    const steps = 600;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) stepWorld(w, inputs);
    const avg = (performance.now() - t0) / steps;

    // No fim de cada passo alguns inimigos morreram e serão repostos no próximo (até 30 por passo).
    expect(w.enemies.size).toBeGreaterThanOrEqual(MAX_ENEMIES - 30);
    // O orçamento total do quadro é 16,6 ms, dividido com a renderização. Exigimos menos de 5 ms.
    expect(avg).toBeLessThan(5);
  });
});
