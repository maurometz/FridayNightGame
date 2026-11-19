import { describe, expect, it } from 'vitest';
import { damagePlayer, healPlayer } from '../combat/playerStats';
import { foodDropChance, spawnFood } from '../combat/foods';
import { pushChoice } from '../combat/leveling';
import { spawnEnemy } from '../combat/spawner';
import { THAISA_CARDS } from '../combat/thaisaCards';
import { COMUNS } from '../data/enemies';
import { FOODS, type FoodDef } from '../data/foods';
import { CHARACTERS } from '../data/characters';
import {
  GOLPE_ARC_DEG,
  GOLPE_COOLDOWN_S,
  GOLPE_DAMAGE,
  GOLPE_REACH,
  PICO_MAX,
  PICO_MAX_MAESTRO,
  PICO_STACK_DURATION_S,
  FOOD_DROP_BASE,
  WALL_DAMAGE,
} from '../data/thaisa';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { aberturaDoGolpe, alcanceDoGolpe, recargaDoGolpe } from './thaisa';
import { bonusDoPico, darPico, picoMax, type ThaisaState } from './thaisaState';

const ROBO = COMUNS[0]!;
const food = (id: string): FoodDef => FOODS.find((f) => f.id === id)!;

function setup(seed = 1): { w: World; s: ThaisaState } {
  const w = createWorld(['thaisa'], { initialChoice: false, seed, noSpawn: true });
  return { w, s: w.players[0]!.kit as ThaisaState };
}

function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map(() => NO_INPUT));
    w.choices.length = 0; // não pausar por subida de nível
  }
}

function card(id: string): (typeof THAISA_CARDS)[number] {
  return THAISA_CARDS.find((c) => c.id === id)!;
}

/** Inimigo atordoado (não anda sozinho), para medir só o efeito do empurrão. */
function parado(w: World, x: number, y: number): ReturnType<typeof first> {
  spawnEnemy(w, ROBO, x, y);
  const e = w.enemies.active[w.enemies.active.length - 1]!;
  e.stun = 999;
  e.hp = 1000;
  return e;
}

function first(w: World): NonNullable<World['enemies']['active'][number]> {
  return w.enemies.active[0]!;
}

describe('Thaisa: atributos e Golpe Pesado', () => {
  it('é a tanque: 150 de HP e 85% de velocidade', () => {
    const { w } = setup();
    expect(w.players[0]!.maxHp).toBe(150);
    expect(CHARACTERS.thaisa.speed).toBe(0.85);
  });

  it('o golpe acerta inimigos dentro do arco e do alcance, e poupa os de fora', () => {
    const { w } = setup();
    const near = parado(w, 25, 0);
    const behind = parado(w, -35, 0); // do lado oposto ao alvo, fora do arco de 150°
    const far = parado(w, GOLPE_REACH + 80, 0);
    step(w);
    expect(near.hp).toBeLessThan(1000);
    expect(behind.hp).toBe(1000);
    expect(far.hp).toBe(1000);
  });

  it('empurra o inimigo para longe, cerca de 40 px', () => {
    const { w } = setup();
    const e = parado(w, 30, 0);
    const x0 = e.x;
    step(w, 60);
    const moved = e.x - x0;
    expect(moved).toBeGreaterThan(35);
    expect(moved).toBeLessThan(50);
    expect(Math.abs(e.y)).toBeLessThan(1);
  });

  it('o arco tem 150° e 44 px de base, e a recarga é 1 s', () => {
    const { s } = setup();
    expect(alcanceDoGolpe(s)).toBe(GOLPE_REACH);
    expect(aberturaDoGolpe(s)).toBeCloseTo((GOLPE_ARC_DEG * Math.PI) / 180, 10);
    const { w } = setup();
    expect(recargaDoGolpe(w.players[0]!, s)).toBe(GOLPE_COOLDOWN_S);
  });

  it('o arco visível é a hitbox: um efeito de arco aparece a cada golpe', () => {
    const { w } = setup();
    parado(w, 30, 0);
    step(w);
    const arc = w.effects.active.find((e) => e.kind === 'arc');
    expect(arc).toBeDefined();
    expect(arc!.radius).toBe(GOLPE_REACH);
  });
});

describe('Thaisa: dano de colisão', () => {
  it('inimigo arremessado contra outro causa dano nos dois e passa o impulso adiante', () => {
    const { w } = setup();
    const a = parado(w, 30, 0);
    const b = parado(w, 70, 0); // fora do alcance do golpe, no caminho do arremesso
    step(w, 40);
    expect(b.hp).toBeLessThan(1000);
    expect(a.hp).toBeLessThan(1000 - GOLPE_DAMAGE + 0.001); // golpe + colisão
    expect(b.kx).toBeGreaterThanOrEqual(0);
    expect(w.players[0]!.kills).toBe(0);
  });

  it('o dano de colisão é creditado à Thaisa (abates contam)', () => {
    const { w } = setup();
    const a = parado(w, 30, 0);
    const b = parado(w, 70, 0);
    a.hp = 1000;
    b.hp = 2; // morre na colisão
    step(w, 40);
    expect(b.alive).toBe(false);
    expect(w.players[0]!.kills).toBeGreaterThanOrEqual(1);
  });

  it('arremessado contra a parede sofre dano e para', () => {
    const { w } = setup();
    w.walls.push({ x: 60, y: -100, w: 10, h: 200 });
    const e = parado(w, 30, 0);
    step(w, 45);
    expect(1000 - e.hp).toBeGreaterThan(GOLPE_DAMAGE); // golpe + parede
    expect(e.x).toBeLessThan(60); // não atravessou
    expect(e.kx).toBe(0);
  });

  it('Afinação Pesada: dano contra paredes +50%', () => {
    const run = (withCard: boolean): number => {
      const { w } = setup();
      if (withCard) card('thaisa-afinacao').apply(w.players[0]!);
      w.walls.push({ x: 60, y: -100, w: 10, h: 200 });
      const e = parado(w, 30, 0);
      step(w, 45);
      return 1000 - e.hp - GOLPE_DAMAGE;
    };
    const base = run(false);
    const heavy = run(true);
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThanOrEqual(WALL_DAMAGE);
    expect(heavy / base).toBeCloseTo(1.5, 5);
  });

  it('empurrão leve não conta como arremesso (sem dano de colisão)', () => {
    const { w } = setup();
    const a = parado(w, 100, 0);
    const b = parado(w, 108, 0); // encostado, mas a não está sendo arremessado
    a.kx = 30; // abaixo do limite de arremesso
    step(w, 5);
    expect(a.hp).toBe(1000);
    expect(b.hp).toBe(1000);
  });
});

describe('Thaisa: Pico de Glicose', () => {
  it('cada acúmulo dá +8% de ataque, +5% de arco e +5% de dano', () => {
    const { s } = setup();
    darPico(s, 3);
    const b = bonusDoPico(s);
    expect(b.attack).toBeCloseTo(1.24, 10);
    expect(b.arc).toBeCloseTo(1.15, 10);
    expect(b.damage).toBeCloseTo(1.15, 10);
  });

  it('o máximo é 5 e comer com o Pico cheio apenas renova', () => {
    const { s } = setup();
    darPico(s, 8);
    expect(s.stacks).toHaveLength(PICO_MAX);
    s.stacks[0] = 1;
    darPico(s, 1);
    expect(s.stacks).toHaveLength(PICO_MAX);
    expect(Math.min(...s.stacks)).toBeGreaterThan(1);
  });

  it('cada acúmulo some depois de 4 s sem comer', () => {
    const { w, s } = setup();
    darPico(s, 2);
    step(w, 60 * 2);
    darPico(s, 1); // este é novo, o resto já gastou 2 s
    expect(s.stacks).toHaveLength(3);
    step(w, 60 * 2 + 5); // os dois primeiros passam de 4 s
    expect(s.stacks).toHaveLength(1);
    step(w, 60 * 2 + 5);
    expect(s.stacks).toHaveLength(0);
    expect(PICO_STACK_DURATION_S).toBe(4);
  });

  it('a velocidade de ataque do Pico encurta a recarga do golpe', () => {
    const { w, s } = setup();
    const base = recargaDoGolpe(w.players[0]!, s);
    darPico(s, 5);
    expect(recargaDoGolpe(w.players[0]!, s)).toBeCloseTo(base / 1.4, 10);
  });

  it('o arco e o alcance crescem com o Pico, e Arco Largo de Família soma +25%', () => {
    const { w, s } = setup();
    darPico(s, 2);
    expect(alcanceDoGolpe(s)).toBeCloseTo(GOLPE_REACH * 1.1, 10);
    card('thaisa-arco').apply(w.players[0]!);
    expect(alcanceDoGolpe(s)).toBeCloseTo(GOLPE_REACH * 1.1 * 1.25, 10);
  });

  it('a abertura do arco nunca passa de 220°', () => {
    const { s } = setup();
    s.mods.maestro = true;
    darPico(s, 7);
    expect(aberturaDoGolpe(s)).toBeLessThanOrEqual((220 * Math.PI) / 180 + 1e-9);
  });

  it('Maestro do Cansaço: máximo sobe para 7', () => {
    const { w, s } = setup();
    expect(picoMax(s)).toBe(PICO_MAX);
    card('thaisa-maestro').apply(w.players[0]!);
    expect(picoMax(s)).toBe(PICO_MAX_MAESTRO);
    darPico(s, 10);
    expect(s.stacks).toHaveLength(7);
  });
});

describe('Thaisa: Estômago Sem Fundo (comidas)', () => {
  it('a chance de cair comida dobra com a Thaisa na partida', () => {
    const solo = createWorld(['felipe'], { initialChoice: false });
    const com = createWorld(['felipe', 'thaisa'], { initialChoice: false });
    expect(foodDropChance(solo)).toBeCloseTo(FOOD_DROP_BASE, 10);
    expect(foodDropChance(com)).toBeCloseTo(FOOD_DROP_BASE * 2, 10);
  });

  it('as comidas seguem o GDD: curas 15, 10, 20 e 5; Pico 0, 1, 0 e 2', () => {
    expect(food('coxinha')).toMatchObject({ heal: 15, stacks: 0 });
    expect(food('paoDeQueijo')).toMatchObject({ heal: 10, stacks: 1 });
    expect(food('esfiha')).toMatchObject({ heal: 20, stacks: 0 });
    expect(food('brigadeiro')).toMatchObject({ heal: 5, stacks: 2 });
    const rare = FOODS.reduce((a, b) => (a.weight < b.weight ? a : b));
    expect(rare.id).toBe('brigadeiro');
  });

  it('comer cura e dá Pico', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    p.hp = 100;
    spawnFood(w, food('paoDeQueijo'), p.x, p.y);
    step(w);
    expect(p.hp).toBeGreaterThanOrEqual(110);
    expect(s.stacks).toHaveLength(1);
    expect(w.foods.size).toBe(0);
  });

  it('Brigadeiro dá 2 acúmulos', () => {
    const { w, s } = setup();
    const p = w.players[0]!;
    p.hp = 100;
    spawnFood(w, food('brigadeiro'), p.x, p.y);
    step(w);
    expect(s.stacks).toHaveLength(2);
  });

  it('a comida é compartilhada: outro jogador come, se cura e não ganha Pico', () => {
    const w = createWorld(['felipe', 'thaisa'], { initialChoice: false });
    const felipe = w.players[0]!;
    const s = w.players[1]!.kit as ThaisaState;
    felipe.hp = 50;
    felipe.x = 300;
    felipe.y = 300;
    spawnFood(w, food('esfiha'), felipe.x, felipe.y);
    step(w);
    expect(felipe.hp).toBe(70);
    expect(s.stacks).toHaveLength(0);
  });

  it('a comida some do chão depois de 25 s', () => {
    const { w } = setup();
    spawnFood(w, food('coxinha'), 500, 500);
    step(w, 60 * 24);
    expect(w.foods.size).toBe(1);
    step(w, 60 * 2);
    expect(w.foods.size).toBe(0);
  });

  it('Segunda Porção: +1 acúmulo por comida', () => {
    const { w, s } = setup();
    card('thaisa-segunda').apply(w.players[0]!);
    const p = w.players[0]!;
    spawnFood(w, food('paoDeQueijo'), p.x, p.y);
    step(w);
    expect(s.stacks).toHaveLength(2);
  });

  it('Sopa de Família: cura +20%', () => {
    const { w } = setup();
    const p = w.players[0]!;
    card('thaisa-sopa').apply(p);
    p.hp = 50;
    spawnFood(w, food('esfiha'), p.x, p.y);
    step(w);
    expect(p.hp).toBeCloseTo(74, 5);
  });

  it('matar inimigos faz cair comida, e mais com a Thaisa', () => {
    const drops = (seedCount: number, chars: ('thaisa' | 'felipe')[]): number => {
      let total = 0;
      for (let seed = 1; seed <= seedCount; seed++) {
        const w = createWorld(chars, { initialChoice: false, seed, noSpawn: true });
        const p = w.players[0]!;
        p.x = 400;
        p.y = 400;
        // 100 inimigos de 1 HP, a 30 px do jogador (longe do alcance de coleta das comidas).
        for (let i = 0; i < 100; i++) {
          spawnEnemy(w, ROBO, 430, 400);
          const e = w.enemies.active[w.enemies.active.length - 1]!;
          e.hp = 0.001;
          e.stun = 999;
        }
        step(w);
        total += w.foods.size;
      }
      return total;
    };
    const comThaisa = drops(30, ['thaisa']);
    const semThaisa = drops(30, ['felipe']);
    expect(comThaisa).toBeGreaterThan(semThaisa);
  });
});

describe('Thaisa: escudo, cura e buffs', () => {
  it('o escudo absorve dano antes do HP', () => {
    const { w } = setup();
    const p = w.players[0]!;
    p.shield = 10;
    damagePlayer(p, 4);
    expect(p.shield).toBe(6);
    expect(p.hp).toBe(150);
    damagePlayer(p, 10);
    expect(p.shield).toBe(0);
    expect(p.hp).toBe(146);
  });

  it('Rodízio Livre: cura excedente vira escudo, com teto de 30% do HP máximo', () => {
    const { w } = setup();
    const p = w.players[0]!;
    p.hp = 140;
    healPlayer(p, 20); // sobram 10
    expect(p.shield).toBe(0); // sem a carta, perde o excedente
    card('thaisa-rodizio').apply(p);
    p.hp = 140;
    healPlayer(p, 20);
    expect(p.hp).toBe(150);
    expect(p.shield).toBe(10);
    healPlayer(p, 500);
    expect(p.shield).toBeCloseTo(45, 5); // 30% de 150
  });

  it('Rodízio Livre: com escudo, a aura de choque pulsa ao redor', () => {
    const { w } = setup();
    const p = w.players[0]!;
    card('thaisa-rodizio').apply(p);
    p.shield = 20;
    const e = parado(w, 20, 20);
    const s = p.kit as ThaisaState;
    s.cd = 999; // sem golpe, para isolar a aura
    step(w, 5);
    expect(e.hp).toBeLessThan(1000);
  });

  it('Bufê Livre: toda comida de cura também dá escudo', () => {
    const { w } = setup();
    const p = w.players[0]!;
    card('thaisa-bufe').apply(p);
    spawnFood(w, food('coxinha'), p.x, p.y);
    step(w);
    expect(p.shield).toBeGreaterThan(0);
  });

  it('Cardápio do Dia: comer dá um buff aleatório que acaba e é desfeito por completo', () => {
    const { w } = setup(3);
    const p = w.players[0]!;
    card('thaisa-cardapio').apply(p);
    const speed0 = p.speedMul;
    const dmg0 = p.damageMul;
    spawnFood(w, food('coxinha'), p.x, p.y);
    step(w);
    expect(p.foodBuff).not.toBeNull();
    step(w, 60 * 6);
    expect(p.foodBuff).toBeNull();
    expect(p.speedMul).toBeCloseTo(speed0, 10);
    expect(p.damageMul).toBeCloseTo(dmg0, 10);
  });
});

describe('Thaisa: cartas exclusivas', () => {
  it('são 16 com ids únicos', () => {
    expect(THAISA_CARDS).toHaveLength(16);
    expect(new Set(THAISA_CARDS.map((c) => c.id)).size).toBe(16);
  });

  it('Pancada Sísmica Fortissimo: a cada 3 golpes, uma onda grave percorre o chão', () => {
    const { w, s } = setup();
    card('thaisa-sismica').apply(w.players[0]!);
    parado(w, 30, 0);
    let ondas = 0;
    for (let swing = 1; swing <= 3; swing++) {
      s.cd = 0;
      step(w);
      ondas = w.projectiles.active.filter((p) => p.kind === 'onda').length;
      if (swing < 3) expect(ondas).toBe(0);
    }
    expect(ondas).toBe(1);
  });

  it('Grave que Não Para: a onda empurra e marca os inimigos', () => {
    const { w, s } = setup();
    card('thaisa-sismica').apply(w.players[0]!);
    card('thaisa-grave').apply(w.players[0]!);
    s.swings = 2;
    const e = parado(w, 30, 0);
    e.stun = 999;
    const target = parado(w, 90, 0);
    s.cd = 0;
    step(w); // 3º golpe lança a onda
    step(w, 40); // a onda alcança o alvo
    expect(target.marked).toBe(true);
    expect(target.kx !== 0 || target.x > 90).toBe(true);
  });

  it('Pé Firme e Fortaleza Acústica ligam as janelas depois de cada golpe', () => {
    const { w, s } = setup();
    card('thaisa-pe-firme').apply(w.players[0]!);
    card('thaisa-fortaleza').apply(w.players[0]!);
    parado(w, 30, 0);
    step(w);
    expect(s.knockImmuneLeft).toBeGreaterThan(0.8);
    expect(s.blockLeft).toBeGreaterThan(0.1);
  });

  it('Grave que Não Para só aparece depois da Pancada Sísmica', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { w } = setup(seed);
      const p = w.players[0]!;
      p.level = 4;
      pushChoice(w, p);
      for (const c of w.choices[0]!.cards) expect(c.id).not.toBe('thaisa-grave');
    }
    let seen = false;
    for (let seed = 1; seed <= 300; seed++) {
      const { w } = setup(seed);
      const p = w.players[0]!;
      p.level = 4;
      p.cardsTaken = ['thaisa-sismica'];
      pushChoice(w, p);
      if (w.choices[0]!.cards.some((c) => c.id === 'thaisa-grave')) seen = true;
    }
    expect(seen).toBe(true);
  });

  it('toda escolha tem pelo menos 1 exclusiva da Thaisa', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { w } = setup(seed);
      pushChoice(w, w.players[0]!);
      expect(w.choices[0]!.cards.some((c) => c.character === 'thaisa')).toBe(true);
    }
  });
});
