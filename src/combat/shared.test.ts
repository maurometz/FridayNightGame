import { describe, expect, it } from 'vitest';
import { COMUNS } from '../data/enemies';
import { CHICOTE, CHINELO, EMPRESTADO, FOGOS, MANGUEIRA, PANELA, PIZZA, ROTEADOR } from '../data/sharedWeapons';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { damagePlayer } from './playerStats';
import { damageEnemy } from './enemies';
import { getCard } from './cardPool';
import { equiparArma } from './sharedWeapons';
import { createExtraWeapon, type SharedWeaponId } from './sharedWeaponTypes';
import { spawnEnemy } from './spawner';
import type { Enemy } from '../entities/enemy';

const ROBO = COMUNS[0]!;

function setup(seed = 1, chars: ('felipe' | 'thaisa')[] = ['felipe']): World {
  const w = createWorld(chars, { initialChoice: false, seed, noSpawn: true });
  // O ataque do próprio personagem atrapalharia a medição das armas: deixa-o sem recarga.
  for (const p of w.players) {
    const k = p.kit as unknown as { cd: number } | null;
    if (k) k.cd = 1e9;
  }
  return w;
}

function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map(() => NO_INPUT));
    w.choices.length = 0;
  }
}

/** Inimigo atordoado e com muita vida, para medir o efeito sem ele fugir ou morrer. */
function alvo(w: World, x: number, y: number, hp = 1000): Enemy {
  spawnEnemy(w, ROBO, x, y);
  const e = w.enemies.active[w.enemies.active.length - 1]!;
  e.stun = 9999;
  e.hp = hp;
  return e;
}

function dar(w: World, id: SharedWeaponId, level = 1): void {
  equiparArma(w.players[0]!, id, level);
}

describe('Armas compartilhadas: equipar e subir de nível', () => {
  it('equipar cria a arma no nível 1 e repetir só sobe o nível', () => {
    const w = setup();
    const p = w.players[0]!;
    equiparArma(p, 'pizza', 1);
    equiparArma(p, 'pizza', 2);
    expect(p.extraWeapons).toHaveLength(1);
    expect(p.extraWeapons[0]!.level).toBe(2);
  });

  it('as cartas de arma equipam a arma certa', () => {
    const w = setup();
    getCard('shared-chinelo')!.apply(w.players[0]!);
    expect(w.players[0]!.extraWeapons.map((x) => x.id)).toEqual(['chinelo']);
  });
});

describe('Fatias de Pizza Orbitantes', () => {
  it('têm mais fatias a cada nível e giram ao redor do jogador', () => {
    expect([1, 2, 3].map((lv) => PIZZA.slices(lv))).toEqual([2, 3, 4]);
  });

  it('causam dano de contato a quem está na órbita, e só a ele', () => {
    const w = setup();
    dar(w, 'pizza');
    const noRaio = alvo(w, 0, 0);
    // Coloca o inimigo exatamente onde a primeira fatia estará.
    const wp = w.players[0]!.extraWeapons[0]!;
    step(w, 1);
    const perto = alvo(w, 0, 0);
    noRaio.x = w.players[0]!.x + PIZZA.radius(1);
    noRaio.y = w.players[0]!.y - 8;
    perto.x = 400;
    perto.y = 400;
    let dano = false;
    for (let i = 0; i < 200 && !dano; i++) {
      step(w);
      noRaio.x = w.players[0]!.x + Math.cos(wp.angle) * PIZZA.radius(1);
      noRaio.y = w.players[0]!.y - 8 + Math.sin(wp.angle) * PIZZA.radius(1);
      dano = noRaio.hp < 1000;
    }
    expect(dano).toBe(true);
    expect(perto.hp).toBe(1000);
  });
});

describe('Roteador Wi-Fi Agressivo', () => {
  it('deixa um roteador no chão que deixa inimigos lentos e pulsa dano', () => {
    const w = setup();
    dar(w, 'roteador');
    const e = alvo(w, 30, 0);
    e.stun = 0;
    step(w, 5);
    const p = w.players[0]!;
    expect(p.extraWeapons[0]!.zones).toHaveLength(1);
    expect(e.slow).toBeGreaterThan(0);
    expect(e.hp).toBeLessThan(1000);
  });

  it('o roteador some depois de 5 s', () => {
    const w = setup();
    dar(w, 'roteador');
    step(w, 2);
    expect(w.players[0]!.extraWeapons[0]!.zones).toHaveLength(1);
    step(w, 60 * 5 + 10);
    // Pode ter nascido um novo, mas o primeiro expirou: nunca há mais de um.
    expect(w.players[0]!.extraWeapons[0]!.zones.length).toBeLessThanOrEqual(1);
    expect(ROTEADOR.duration).toBe(5);
  });

  it('inimigos lentos andam metade da velocidade', () => {
    const run = (slow: boolean): number => {
      const w = setup();
      spawnEnemy(w, ROBO, 200, 0);
      const e = w.enemies.active[0]!;
      e.hp = 1000;
      const x0 = e.x;
      for (let i = 0; i < 60; i++) {
        if (slow) e.slow = 1;
        stepWorld(w, [NO_INPUT]);
      }
      return x0 - e.x;
    };
    const normal = run(false);
    const lento = run(true);
    expect(lento / normal).toBeGreaterThan(0.4);
    expect(lento / normal).toBeLessThan(0.6);
  });
});

describe('Chinelo Bumerangue de Mãe', () => {
  it('vai até o inimigo, volta até o jogador e some ao chegar', () => {
    const w = setup();
    dar(w, 'chinelo');
    alvo(w, 120, 0);
    step(w, 2);
    expect(w.projectiles.active.some((p) => p.kind === 'chinelo')).toBe(true);
    let voltou = false;
    for (let i = 0; i < 200; i++) {
      step(w);
      const c = w.projectiles.active.find((p) => p.kind === 'chinelo');
      if (c?.returning) voltou = true;
    }
    expect(voltou).toBe(true);
  });

  it('bate mais forte na volta e pode acertar o mesmo inimigo duas vezes', () => {
    const w = setup();
    dar(w, 'chinelo', 3);
    // Inimigo parado no caminho de ida e volta (a ~60 px).
    const e = alvo(w, 60, -8);
    const hps: number[] = [];
    let ultimo = e.hp;
    for (let i = 0; i < 180; i++) {
      step(w);
      if (e.hp < ultimo) {
        hps.push(ultimo - e.hp);
        ultimo = e.hp;
      }
    }
    expect(hps.length).toBeGreaterThanOrEqual(2);
    expect(hps[1]!).toBeGreaterThan(hps[0]!);
    expect(CHINELO.returnMul).toBe(1.5);
  });
});

describe('Chicote de Fone de Ouvido Enrolado', () => {
  it('cada golpe seguido que acerta dá um nó, e errar zera os nós', () => {
    const w = setup();
    dar(w, 'chicote');
    const e = alvo(w, 25, -8);
    const wp = w.players[0]!.extraWeapons[0]!;
    step(w, 1);
    expect(wp.knots).toBe(1);
    step(w, Math.ceil(CHICOTE.cooldown(1) * 60) + 2);
    expect(wp.knots).toBe(2);
    expect(e.hp).toBeLessThan(1000);
  });

  it('os nós nunca passam do máximo', () => {
    const w = setup();
    dar(w, 'chicote', 3);
    alvo(w, 25, -8);
    step(w, 60 * 12);
    expect(w.players[0]!.extraWeapons[0]!.knots).toBeLessThanOrEqual(CHICOTE.maxKnots);
  });

  it('o dano cresce com os nós', () => {
    const w = setup();
    dar(w, 'chicote');
    const e = alvo(w, 25, -8);
    const danos: number[] = [];
    let ultimo = e.hp;
    for (let i = 0; i < 60 * 6; i++) {
      step(w);
      if (e.hp < ultimo) {
        danos.push(ultimo - e.hp);
        ultimo = e.hp;
      }
    }
    expect(danos.length).toBeGreaterThanOrEqual(3);
    expect(danos[2]!).toBeGreaterThan(danos[0]!);
  });
});

describe('Ventilador de Teto Furioso', () => {
  it('empurra os inimigos que estão no cone, e só eles', () => {
    const w = setup();
    dar(w, 'ventilador');
    const naFrente = alvo(w, 30, -8);
    const atras = alvo(w, -30, -8);
    const x0 = naFrente.x;
    step(w, 30);
    expect(naFrente.x).toBeGreaterThan(x0 + 5);
    expect(atras.x).toBeCloseTo(-30, 5);
  });
});

describe('Panela de Pressão', () => {
  it('avisa no chão e explode depois de 1 s', () => {
    const w = setup();
    dar(w, 'panela');
    const e = alvo(w, 80, 0);
    step(w, 1);
    const wp = w.players[0]!.extraWeapons[0]!;
    expect(wp.pending).toHaveLength(1);
    expect(w.effects.active.some((x) => x.kind === 'ring' && x.life > 0.5)).toBe(true); // aviso
    expect(e.hp).toBe(1000);
    step(w, Math.round(PANELA.delay * 60) + 3);
    expect(e.hp).toBeLessThan(1000);
    expect(wp.pending.length).toBeLessThanOrEqual(1);
  });
});

describe('Controle Remoto sem Pilha', () => {
  it('atordoa o primeiro inimigo atingido', () => {
    const w = setup();
    dar(w, 'controle');
    spawnEnemy(w, ROBO, 90, -8);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    e.stun = 0;
    let stun = 0;
    for (let i = 0; i < 120; i++) {
      step(w);
      stun = Math.max(stun, e.stun);
    }
    expect(stun).toBeGreaterThan(1);
    expect(e.hp).toBeLessThan(1000);
  });
});

describe('Mangueira do Quintal', () => {
  it('atravessa inimigos e deixa uma poça que desacelera', () => {
    const w = setup();
    dar(w, 'mangueira');
    const a = alvo(w, 30, -8);
    const b = alvo(w, 60, -8);
    step(w, 1);
    expect(a.hp).toBeLessThan(1000);
    expect(b.hp).toBeLessThan(1000);
    const wp = w.players[0]!.extraWeapons[0]!;
    expect(wp.zones).toHaveLength(1);
    expect(wp.zones[0]!.pulseCd).toBe(Infinity); // poça não causa dano, só desacelera
    expect(wp.zones[0]!.t).toBeGreaterThan(MANGUEIRA.puddleDuration - 0.2);
  });
});

describe('Fogos de Fim de Ano', () => {
  it('só dispara com inimigos na tela, agenda salvas com aviso e explode', () => {
    const w = setup(3);
    dar(w, 'fogos');
    step(w, 3);
    expect(w.players[0]!.extraWeapons[0]!.pending).toHaveLength(0); // sem inimigos, nada
    for (let i = 0; i < 6; i++) alvo(w, 20 + i * 6, 10);
    step(w, 3);
    const wp = w.players[0]!.extraWeapons[0]!;
    expect(wp.pending).toHaveLength(FOGOS.bursts(1));
    const antes = wp.pending.length;
    step(w, Math.round(FOGOS.delay * 60) + 3);
    expect(wp.pending.length).toBeLessThan(antes + 1);
  });
});

describe('Violão emprestado (Passa a Vez)', () => {
  it('dispara um leque e expira sozinho', () => {
    const w = setup(1, ['felipe', 'thaisa']);
    const ally = w.players[1]!;
    ally.extraWeapons.push(createExtraWeapon('emprestado', 1, 2, 0));
    spawnEnemy(w, ROBO, ally.x + 80, ally.y);
    w.enemies.active[0]!.hp = 1000;
    step(w, 3);
    expect(w.projectiles.active.some((p) => p.ownerSlot === 1)).toBe(true);
    step(w, 60 * 3);
    expect(ally.extraWeapons.some((x) => x.id === 'emprestado')).toBe(false);
    expect(EMPRESTADO.count).toBe(3);
  });
});

describe('Passivas do pool compartilhado', () => {
  it('Soro de Energético: +15% de velocidade e de ataque, -10% de HP máximo', () => {
    const w = setup();
    const p = w.players[0]!;
    const speed = p.speedMul;
    const hp = p.maxHp;
    getCard('shared-soro')!.apply(p);
    expect(p.speedMul).toBeCloseTo(speed * 1.15, 10);
    expect(p.attackSpeedMul).toBeCloseTo(1.15, 10);
    expect(p.maxHp).toBe(Math.round(hp * 0.9));
    expect(p.hp).toBeLessThanOrEqual(p.maxHp);
  });

  it('Carregador Universal: +40% de alcance de coleta', () => {
    const w = setup();
    getCard('shared-carregador')!.apply(w.players[0]!);
    expect(w.players[0]!.pickupMul).toBeCloseTo(1.4, 10);
  });

  it('Garrafa Térmica: regenera 0,5 HP por segundo', () => {
    const w = setup();
    const p = w.players[0]!;
    p.hp = 50;
    getCard('shared-garrafa')!.apply(p);
    step(w, 60 * 4);
    expect(p.hp - 50).toBeCloseTo(2, 1);
  });

  it('Plano de Internet Ilimitado: -10% de recarga (ataques mais rápidos)', () => {
    const w = setup();
    getCard('shared-plano')!.apply(w.players[0]!);
    expect(1 / w.players[0]!.attackSpeedMul).toBeCloseTo(0.9, 10);
  });

  it('Sorte de Sexta-Feira: +10% de chance de crítico', () => {
    const w = setup();
    getCard('shared-sorte')!.apply(w.players[0]!);
    expect(w.players[0]!.critChance).toBeCloseTo(0.1, 10);
  });

  it('Almofada do Sofá: -10% de dano recebido', () => {
    const w = setup();
    const p = w.players[0]!;
    getCard('shared-almofada')!.apply(p);
    step(w, 1);
    expect(p.damageTakenMul).toBeCloseTo(0.9, 10);
    const hp = p.hp;
    damagePlayer(p, 10);
    expect(hp - p.hp).toBeCloseTo(9, 10);
  });

  it('o crítico genérico dobra o dano na proporção da chance', () => {
    const w = setup(5);
    const p = w.players[0]!;
    p.critChance = 0.5;
    const e = alvo(w, 500, 500, 1e9);
    const n = 4000;
    for (let i = 0; i < n; i++) damageEnemy(w, e, 1, p);
    // Com 50% de chance de dobrar, o dano médio por golpe é 1,5.
    const media = (1e9 - e.hp) / n;
    expect(media).toBeGreaterThan(1.42);
    expect(media).toBeLessThan(1.58);
  });
});
