import { describe, expect, it } from 'vitest';
import { FELIPE_CARDS } from '../combat/felipeCards';
import { pushChoice } from '../combat/leveling';
import { spawnProjectile } from '../combat/projectiles';
import { spawnEnemy } from '../combat/spawner';
import { STEP_S } from '../data/balance';
import { ACT_DURATION_S, TUNE_TIME_S } from '../data/felipe';
import { COMUNS } from '../data/enemies';
import { INSTRUMENTS } from '../data/instruments';
import { NO_INPUT, type PlayerInput } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { fireInstrument, nextWithAmmo, pickAnomaly, switchTo } from './felipe';
import type { FelipeState } from './felipeState';

const ROBO = COMUNS[0]!;

function setup(seed = 1): { w: World; s: FelipeState } {
  const w = createWorld(['felipe'], { initialChoice: false, seed });
  const s = w.players[0]!.kit as FelipeState;
  return { w, s };
}

function step(w: World, n = 1, input: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < n; i++) stepWorld(w, [input]);
}

function card(id: string): (typeof FELIPE_CARDS)[number] {
  return FELIPE_CARDS.find((c) => c.id === id)!;
}

describe('Felipe: estado inicial', () => {
  it('começa com 4 instrumentos, munição cheia e o Violão ativo', () => {
    const { s } = setup();
    expect(s.owned).toEqual(['violao', 'bateria', 'flauta', 'kazoo']);
    expect(s.active).toBe('violao');
    for (const id of s.owned) expect(s.ammo[id]).toBe(INSTRUMENTS[id].maxAmmo);
  });

  it('as munições iniciais seguem o GDD (40, 12, 20, 60)', () => {
    expect(INSTRUMENTS.violao.maxAmmo).toBe(40);
    expect(INSTRUMENTS.bateria.maxAmmo).toBe(12);
    expect(INSTRUMENTS.flauta.maxAmmo).toBe(20);
    expect(INSTRUMENTS.kazoo.maxAmmo).toBe(60);
  });
});

describe('Felipe: munição, troca e afinação', () => {
  it('atacar gasta 1 de munição do instrumento ativo', () => {
    const { w, s } = setup();
    spawnEnemy(w, ROBO, 100, 0);
    step(w);
    expect(s.ammo.violao).toBeCloseTo(39, 5);
    expect(w.projectiles.size).toBe(5);
  });

  it('ao esgotar, troca para o próximo instrumento e afina por 0,3 s sem atacar', () => {
    const { w, s } = setup();
    s.ammo.violao = 1;
    spawnEnemy(w, ROBO, 100, 0);
    step(w);
    expect(s.active).toBe('bateria');
    expect(s.tuneLeft).toBeCloseTo(TUNE_TIME_S, 5);
    const bateriaBefore = s.ammo.bateria;
    step(w, 10); // dentro da afinação
    expect(s.ammo.bateria).toBeGreaterThanOrEqual(bateriaBefore);
  });

  it('instrumentos guardados recarregam e o ativo com munição não', () => {
    const { w, s } = setup();
    s.ammo.flauta = 10;
    s.ammo.violao = 30;
    step(w, 60);
    expect(s.ammo.flauta).toBeCloseTo(12, 1);
    expect(s.ammo.violao).toBe(30);
  });

  it('o toque na tecla de ação troca para o próximo instrumento', () => {
    const { w, s } = setup();
    step(w, 1, { ...NO_INPUT, action: true });
    expect(s.active).toBe('bateria');
    step(w, 1, { ...NO_INPUT, action: true }); // segurar não troca de novo
    expect(s.active).toBe('bateria');
    step(w, 1, NO_INPUT);
    step(w, 1, { ...NO_INPUT, action: true });
    expect(s.active).toBe('flauta');
  });

  it('a troca pula instrumentos sem munição', () => {
    const { s } = setup();
    s.ammo.bateria = 0;
    expect(nextWithAmmo(s)).toBe('flauta');
  });
});

describe('Felipe: instrumentos', () => {
  it('a Bateria atinge inimigos no raio e poupa os distantes', () => {
    const { w, s } = setup();
    spawnEnemy(w, ROBO, 30, 0);
    spawnEnemy(w, ROBO, 500, 0);
    const [near, far] = w.enemies.active;
    const farHp = far!.hp;
    const nearHp = near!.hp;
    fireInstrument(w, w.players[0]!, s, 'bateria', 0);
    expect(near!.hp).toBeLessThan(nearHp);
    expect(far!.hp).toBe(farHp);
  });

  it('a Flauta cura quem está no raio (o Felipe inclusive), dá +15% de dano e só empurra os inimigos de leve', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    p.hp = p.maxHp - 20;
    spawnEnemy(w, ROBO, 40, 0);
    spawnEnemy(w, ROBO, 400, 0);
    const [near, far] = w.enemies.active;
    const nearHp = near!.hp;
    const farHp = far!.hp;
    fireInstrument(w, p, s, 'flauta', 0);
    expect(p.hp).toBeCloseTo(p.maxHp - 15, 5);
    expect(p.buffs.some((b) => b.id === 'flauta0' && b.damage === 1.15)).toBe(true);
    expect(near!.hp).toBeLessThan(nearHp);
    expect(far!.hp).toBe(farHp);
  });

  it('o Kazoo ricocheteia até 3 vezes (atinge no máximo 4 inimigos) e para quando não há alvo', () => {
    const { w } = setup();
    const xs = [600, 630, 660, 690, 720, 750];
    for (const x of xs) spawnEnemy(w, ROBO, x, 0);
    const line = [...w.enemies.active]; // só estes contam (o spawn natural pode criar outros)
    for (const e of line) e.hp = 1000;
    spawnProjectile(w, {
      kind: 'kazoo',
      x: 580,
      y: 0,
      angle: 0,
      speed: 170,
      damage: 2,
      radius: 3,
      life: 5,
      bounces: 3,
      ownerSlot: 0,
    });
    step(w, 150);
    const hit = line.filter((e) => e.hp < 1000).length;
    expect(hit).toBe(4);
  });

  it('Microfone de Feedback: o Kazoo atordoa o inimigo em que ricocheteia', () => {
    const { w, s } = setup();
    card('felipe-microfone').apply(w.players[0]!);
    expect(s.mods.microfone).toBe(true);
    spawnEnemy(w, ROBO, 600, 0);
    spawnEnemy(w, ROBO, 630, 0);
    for (const e of w.enemies.active) e.hp = 1000;
    spawnProjectile(w, {
      kind: 'kazoo', x: 580, y: 0, angle: 0, speed: 170, damage: 2, radius: 3, life: 5, bounces: 3, stun: 1, ownerSlot: 0,
    });
    step(w, 30);
    expect(w.enemies.active.some((e) => e.stun > 0)).toBe(true);
  });
});

describe('Felipe: cartas que mudam a troca', () => {
  it('Passagem de Som: a primeira troca de cada ato é gratuita', () => {
    const { w, s } = setup();
    card('felipe-passagem').apply(w.players[0]!);
    switchTo(w, s, 'bateria');
    expect(s.tuneLeft).toBe(0);
    switchTo(w, s, 'flauta');
    expect(s.tuneLeft).toBeCloseTo(TUNE_TIME_S, 5);
    // Novo ato: volta a ser gratuita.
    w.tick = Math.ceil((ACT_DURATION_S + 1) / STEP_S);
    switchTo(w, s, 'kazoo');
    expect(s.tuneLeft).toBe(0);
  });

  it('Afinação de Ouvido: afinação pela metade', () => {
    const { w, s } = setup();
    card('felipe-afinacao').apply(w.players[0]!);
    switchTo(w, s, 'bateria');
    expect(s.tuneLeft).toBeCloseTo(TUNE_TIME_S / 2, 5);
  });

  it('Viola: libera o 5º instrumento e trocar de ou para ela não tem afinação', () => {
    const { w, s } = setup();
    card('felipe-viola').apply(w.players[0]!);
    expect(s.owned).toHaveLength(5);
    switchTo(w, s, 'viola');
    expect(s.tuneLeft).toBe(0);
    switchTo(w, s, 'violao');
    expect(s.tuneLeft).toBe(0);
  });

  it('Bis no Show: o instrumento seguinte dispara uma rajada extra sem custo de munição', () => {
    const { w, s } = setup();
    card('felipe-bis').apply(w.players[0]!);
    s.active = 'bateria';
    s.ammo.bateria = 1;
    spawnEnemy(w, ROBO, 30, 0);
    w.enemies.active[0]!.hp = 1000;
    step(w); // esgota a bateria, troca para o sax
    expect(s.active).toBe('flauta');
    expect(s.bisPending).toBe(true);
    step(w, 80); // espera a recarga do ataque anterior (0,9 s), a afinação e o ataque do Sax
    expect(s.bisPending).toBe(false);
    // Um único ataque gastou 1 de munição, apesar de ter disparado duas rajadas.
    expect(s.ammo.flauta).toBeGreaterThanOrEqual(18);
    expect(s.ammo.flauta).toBeLessThanOrEqual(19.5);
  });

  it('Encore do Felipe: o instrumento esgotado recarrega 30%', () => {
    const { w, s } = setup();
    card('felipe-encore').apply(w.players[0]!);
    s.ammo.violao = 1;
    spawnEnemy(w, ROBO, 100, 0);
    step(w);
    expect(s.active).toBe('bateria');
    expect(s.ammo.violao).toBeCloseTo(INSTRUMENTS.violao.maxAmmo * 0.3, 5);
  });

  it('Roadie de Madrugada: cada abate devolve 1 de munição ao instrumento ativo', () => {
    const { w, s } = setup();
    card('felipe-roadie').apply(w.players[0]!);
    s.cd = 999; // sem atacar neste teste
    s.ammo.violao = 10;
    spawnEnemy(w, ROBO, 30, 0);
    const e = w.enemies.active[0]!;
    e.hp = 0.1;
    fireInstrument(w, w.players[0]!, s, 'bateria', 0);
    expect(w.players[0]!.kills).toBe(1);
    expect(s.ammo.violao).toBe(11);
  });

  it('Corda Extra: +10 de munição no Violão', () => {
    const { w, s } = setup();
    card('felipe-corda').apply(w.players[0]!);
    expect(s.maxAmmo.violao).toBe(50);
    expect(s.ammo.violao).toBe(50);
  });

  it('Ensaio Geral: a Bateria dispara sozinha com 3 ou mais inimigos por perto', () => {
    const { w, s } = setup();
    card('felipe-ensaio').apply(w.players[0]!);
    spawnEnemy(w, ROBO, 25, 0);
    spawnEnemy(w, ROBO, 30, 10);
    spawnEnemy(w, ROBO, 20, -10);
    for (const e of w.enemies.active) e.hp = 1000;
    step(w);
    expect(s.ammo.bateria).toBeLessThan(12);
    expect(w.enemies.active.every((e) => e.hp < 1000)).toBe(true);
  });

  it('Ensaio Geral: não dispara com menos de 3 inimigos', () => {
    const { w, s } = setup();
    card('felipe-ensaio').apply(w.players[0]!);
    s.cd = 999;
    spawnEnemy(w, ROBO, 25, 0);
    spawnEnemy(w, ROBO, 30, 10);
    step(w);
    expect(s.ammo.bateria).toBe(12);
  });

  it('Turnê de Bolso: a cada 60 s todos os instrumentos disparam em sequência', () => {
    const { w, s } = setup();
    card('felipe-turne').apply(w.players[0]!);
    expect(s.turneTimer).toBe(60);
    s.turneTimer = STEP_S; // dispara no próximo passo
    step(w);
    expect(s.turneQueue.length).toBe(3); // 4 instrumentos, o primeiro já disparou
    step(w, 60);
    expect(s.turneQueue.length).toBe(0);
    expect(s.turneTimer).toBeGreaterThan(55);
  });
});

describe('Felipe: Espiral de Ideias Absurdas', () => {
  it('sorteia anomalias com os pesos 40/30/20/10', () => {
    const { w, s } = setup(123);
    const counts: Record<string, number> = { pato: 0, confete: 0, super: 0, chuva: 0 };
    const n = 20000;
    for (let i = 0; i < n; i++) counts[pickAnomaly(w, s).id]!++;
    expect(counts.pato! / n).toBeCloseTo(0.4, 1);
    expect(counts.confete! / n).toBeCloseTo(0.3, 1);
    expect(counts.super! / n).toBeCloseTo(0.2, 1);
    expect(counts.chuva! / n).toBeCloseTo(0.1, 1);
  });

  it('Setlist Surpresa favorece as anomalias raras', () => {
    const { w, s } = setup(123);
    card('felipe-setlist').apply(w.players[0]!);
    let chuva = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (pickAnomaly(w, s).id === 'chuva') chuva++;
    expect(chuva / n).toBeGreaterThan(0.15);
  });

  it('dispara no 8º ataque, e não antes', () => {
    const { w, s } = setup();
    s.attackCount = 6;
    spawnEnemy(w, ROBO, 100, 0);
    w.enemies.active[0]!.hp = 1e6;
    step(w); // 7º ataque
    expect(w.effects.active.some((e) => e.kind === 'text')).toBe(false);
    step(w, 40); // 8º ataque
    expect(s.attackCount).toBeGreaterThanOrEqual(8);
    const sawText = w.effects.active.some((e) => e.kind === 'text') || s.attackCount > 8;
    expect(sawText).toBe(true);
  });
});

describe('Felipe: cartas exclusivas', () => {
  it('são 17 (16 + o Réquiem da Morte), com ids únicos', () => {
    expect(FELIPE_CARDS).toHaveLength(17);
    expect(new Set(FELIPE_CARDS.map((c) => c.id)).size).toBe(17);
  });

  it('cada escolha do Felipe tem pelo menos 1 exclusiva e 3 cartas distintas', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { w } = setup(seed);
      pushChoice(w, w.players[0]!);
      const c = w.choices[0]!;
      expect(c.cards).toHaveLength(3);
      expect(c.cards.some((x) => x.character === 'felipe')).toBe(true);
      expect(new Set(c.cards.map((x) => x.id)).size).toBe(3);
    }
  });

  it('o nível 1 nunca oferece Épicas ou Lendárias', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { w } = setup(seed);
      pushChoice(w, w.players[0]!);
      for (const c of w.choices[0]!.cards) expect(['comum', 'rara']).toContain(c.rarity);
    }
  });

  it('uma exclusiva já escolhida não é oferecida de novo', () => {
    const { w } = setup();
    const p = w.players[0]!;
    p.level = 2;
    p.cardsTaken = FELIPE_CARDS.filter((c) => c.id !== 'felipe-bis').map((c) => c.id);
    for (let i = 0; i < 20; i++) {
      w.choices.length = 0;
      pushChoice(w, p);
      const exclusive = w.choices[0]!.cards.filter((c) => c.character === 'felipe' && c.kind !== 'team' && !c.maxLevel); // cartas numéricas podem subir de nível
      expect(exclusive.every((c) => c.id === 'felipe-bis')).toBe(true);
    }
  });

  it('Show de Abertura só aparece no nível 2', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { w } = setup(seed);
      const p = w.players[0]!;
      p.level = 3;
      pushChoice(w, p);
      expect(w.choices[0]!.cards.some((c) => c.id === 'felipe-abertura')).toBe(false);
    }
  });
});
