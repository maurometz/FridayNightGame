import { describe, expect, it } from 'vitest';
import { acertarInimigo, multiplicadorDeCritico } from '../characters/melissa';
import type { MelissaState } from '../characters/melissaState';
import { focoMax, onKillHook, onProjectileHit } from '../characters/kitHooks';
import { regenDeFoco } from '../characters/mauro';
import type { MauroState } from '../characters/mauroState';
import type { FelipeState } from '../characters/felipeState';
import { raioDaAura } from '../characters/thayssaState';
import type { ThayssaState } from '../characters/thayssaState';
import { fireInstrument, switchTo } from '../characters/felipe';
import { BOSSES, COMUNS } from '../data/enemies';
import { AURA_RADIUS } from '../data/thayssa';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import type { CharacterId } from '../data/characters';
import type { Enemy } from '../entities/enemy';
import type { Projectile } from '../entities/projectile';
import { getCard } from './cardPool';
import { damageEnemy } from './enemies';
import { hitPlayer } from './teamEffects';
import { spawnEnemy } from './spawner';

function cena(ids: CharacterId[] = ['felipe']): World {
  return createWorld(ids, { seed: 3, noSpawn: true, noBosses: true, initialChoice: false });
}

function pegar(w: World, slot: number, id: string, nivel = 1): void {
  const c = getCard(id);
  if (!c) throw new Error(`carta ${id} não existe`);
  const p = w.players[slot]!;
  c.apply(p, nivel);
  p.cardLevels[id] = nivel;
  if (!p.cardsTaken.includes(id)) p.cardsTaken.push(id);
}

function inimigo(w: World, x: number, y: number, hp = 1000, def = COMUNS[0]!): Enemy {
  spawnEnemy(w, def, x, y);
  const e = w.enemies.active[w.enemies.active.length - 1]!;
  e.hp = hp;
  return e;
}

describe('poderes gerais (cartas comuns novas)', () => {
  it('Cafeína Pura, Tênis Novo, Plano de Saúde e Caderninho mexem nos atributos', () => {
    const w = cena();
    const p = w.players[0]!;
    pegar(w, 0, 'shared-cafeina');
    expect(p.baseDamageMul).toBeCloseTo(1.1, 5);
    const v = p.speedMul;
    pegar(w, 0, 'shared-tenis');
    expect(p.speedMul).toBeCloseTo(v * 1.1, 5);
    const hp = p.maxHp;
    p.hp = 10;
    pegar(w, 0, 'shared-plano-saude');
    expect(p.maxHp).toBe(hp + 20);
    expect(p.hp).toBe(30);
    pegar(w, 0, 'shared-caderninho');
    expect(p.xpMul).toBeCloseTo(1.12, 5);
  });

  it('Pão de Alho Mágico cura uma parte do dano causado', () => {
    const w = cena();
    const p = w.players[0]!;
    p.hp = 50;
    pegar(w, 0, 'shared-pao-alho', 1);
    pegar(w, 0, 'shared-pao-alho', 2);
    pegar(w, 0, 'shared-pao-alho', 3); // 6%
    damageEnemy(w, inimigo(w, 20, 0), 100, p);
    expect(p.hp).toBeCloseTo(56, 3);
  });

  it('Lanche da Madrugada cura a cada abate', () => {
    const w = cena();
    const p = w.players[0]!;
    p.hp = 50;
    pegar(w, 0, 'shared-lanche');
    damageEnemy(w, inimigo(w, 20, 0, 1), 5, p);
    expect(p.hp).toBeCloseTo(50.5, 5);
  });

  it('Meme Bem Cronometrado aumenta o dano do crítico', () => {
    const w = cena();
    const p = w.players[0]!;
    p.critChance = 1;
    const e = inimigo(w, 200, 0, 1000);
    damageEnemy(w, e, 10, p);
    expect(1000 - e.hp).toBeCloseTo(20, 5);
    pegar(w, 0, 'shared-meme');
    const e2 = inimigo(w, 200, 0, 1000);
    damageEnemy(w, e2, 10, p);
    expect(1000 - e2.hp).toBeCloseTo(25, 5);
  });

  it('Manual do Chefe só vale contra chefes', () => {
    const w = cena();
    const p = w.players[0]!;
    pegar(w, 0, 'shared-manual-chefe');
    const comum = inimigo(w, 300, 0, 1000);
    damageEnemy(w, comum, 10, p);
    expect(1000 - comum.hp).toBeCloseTo(10, 5);
    const chefe = inimigo(w, 300, 0, 1000, BOSSES[0]!);
    damageEnemy(w, chefe, 10, p);
    expect(1000 - chefe.hp).toBeCloseTo(12, 5);
  });

  it('Adrenalina vale com pouco HP e Noite Bem Dormida com HP cheio', () => {
    const w = cena();
    const p = w.players[0]!;
    pegar(w, 0, 'shared-adrenalina');
    pegar(w, 0, 'shared-noite-dormida');
    const dano = (): number => {
      const e = inimigo(w, 300, 0, 1000);
      damageEnemy(w, e, 10, p);
      return 1000 - e.hp;
    };
    expect(dano()).toBeCloseTo(11.2, 5); // cheio: +12%
    p.hp = p.maxHp * 0.7;
    expect(dano()).toBeCloseTo(10, 5); // no meio: nada
    p.hp = p.maxHp * 0.3;
    expect(dano()).toBeCloseTo(12.5, 5); // baixo: +25%
  });

  it('Abraço de Urso só vale bem perto', () => {
    const w = cena();
    const p = w.players[0]!;
    pegar(w, 0, 'shared-abraco-urso');
    const perto = inimigo(w, 30, 0, 1000);
    const longe = inimigo(w, 200, 0, 1000);
    damageEnemy(w, perto, 10, p);
    damageEnemy(w, longe, 10, p);
    expect(1000 - perto.hp).toBeCloseTo(12, 5);
    expect(1000 - longe.hp).toBeCloseTo(10, 5);
  });

  it('Pipoca Explosiva faz abates explodirem e ferirem os vizinhos', () => {
    const w = cena();
    const p = w.players[0]!;
    pegar(w, 0, 'shared-pipoca', 3); // 30 de dano
    let explodiu = 0;
    for (let i = 0; i < 40; i++) {
      const alvo = inimigo(w, 100, 0, 1);
      const vizinho = inimigo(w, 110, 0, 1000);
      damageEnemy(w, alvo, 5, p);
      if (vizinho.hp < 1000) explodiu++;
      vizinho.alive = false;
    }
    expect(explodiu).toBeGreaterThan(5);
    expect(explodiu).toBeLessThan(40);
  });

  it('Gingado de Esquina desvia de golpes (com 50% de chance, mais ou menos metade)', () => {
    const w = cena();
    const p = w.players[0]!;
    p.perks.dodge = 0.5;
    p.maxHp = p.hp = 100000;
    for (let i = 0; i < 200; i++) hitPlayer(w, p, 1);
    const levou = 100000 - p.hp;
    expect(levou).toBeGreaterThan(60);
    expect(levou).toBeLessThan(140);
  });

  it('Capa de Chuva Espinhosa machuca quem está perto de quem levou o golpe', () => {
    const w = cena();
    const p = w.players[0]!;
    pegar(w, 0, 'shared-capa-espinhos');
    const e = inimigo(w, 10, 0, 100);
    hitPlayer(w, p, 5);
    expect(e.hp).toBeLessThan(100);
  });

  it('Guarda-Chuva Reforçado gera escudo aos poucos, até 25% do HP', () => {
    const w = cena();
    const p = w.players[0]!;
    pegar(w, 0, 'shared-guarda-chuva', 3); // 1,8/s
    for (let i = 0; i < 60 * 30; i++) stepWorld(w, [NO_INPUT]);
    expect(p.shield).toBeGreaterThan(0);
    expect(p.shield).toBeLessThanOrEqual(p.maxHp * 0.25 + 0.1);
  });

  it('Café Requentado levanta quem cai, uma vez só', () => {
    const w = cena();
    const p = w.players[0]!;
    pegar(w, 0, 'shared-cafe-requentado');
    hitPlayer(w, p, 99999);
    expect(p.hp).toBeCloseTo(p.maxHp * 0.4, 3);
    expect(p.perks.secondWind).toBe(0);
    p.shield = 0;
    p.hp = 1;
    hitPlayer(w, p, 99999);
    expect(p.hp).toBeLessThanOrEqual(0);
  });

  it('as cartas comuns novas podem ser repetidas até o nível 3 e a Lendária é única', () => {
    for (const id of ['shared-cafeina', 'shared-pao-alho', 'shared-pipoca']) expect(getCard(id)!.maxLevel).toBe(3);
    expect(getCard('shared-cafe-requentado')!.maxLevel ?? 1).toBe(1);
  });
});

describe('Felipe: cartas novas', () => {
  const felipe = (): { w: World; p: ReturnType<typeof cena>['players'][0]; s: FelipeState } => {
    const w = cena(['felipe']);
    const p = w.players[0]!;
    return { w, p, s: p.kit as FelipeState };
  };

  it('Pedal de Distorção: o Violão causa +30%', () => {
    const base = felipe();
    fireInstrument(base.w, base.p, base.s, 'violao', 0);
    const d0 = (base.w.projectiles.active[0] as Projectile).damage;
    const a = felipe();
    pegar(a.w, 0, 'felipe-pedal');
    fireInstrument(a.w, a.p, a.s, 'violao', 0);
    expect((a.w.projectiles.active[0] as Projectile).damage).toBeCloseTo(d0 * 1.3, 5);
  });

  it('Solo de Improviso: depois de trocar, o próximo ataque vale o dobro (uma vez)', () => {
    const { w, s } = felipe();
    pegar(w, 0, 'felipe-solo');
    expect(s.soloReady).toBe(false);
    switchTo(w, s, 'flauta');
    expect(s.soloReady).toBe(true);
  });

  it('Camarim Reservado acelera a recarga dos guardados (3 níveis)', () => {
    const { w, s } = felipe();
    pegar(w, 0, 'felipe-camarim', 1);
    pegar(w, 0, 'felipe-camarim', 2);
    expect(s.rechargeMul).toBeCloseTo(1.6, 5);
  });

  it('Fã-Clube: a cada 20 abates, +3% de dano permanente, até 10 vezes', () => {
    const { w, p } = felipe();
    pegar(w, 0, 'felipe-fa-clube');
    for (let i = 0; i < 20; i++) onKillHook(p, w);
    expect(p.baseDamageMul).toBeCloseTo(1.03, 5);
    for (let i = 0; i < 20 * 20; i++) onKillHook(p, w);
    expect(p.baseDamageMul).toBeCloseTo(Math.pow(1.03, 10), 5);
  });
});

describe('Mauro: cartas novas', () => {
  it('Post-it Colado deixa o inimigo lento; Fichamento aumenta Foco e regeneração', () => {
    const w = cena(['mauro']);
    const p = w.players[0]!;
    const s = p.kit as MauroState;
    const foco0 = focoMax(s);
    const reg0 = regenDeFoco(s);
    pegar(w, 0, 'mauro-fichamento');
    expect(focoMax(s)).toBe(foco0 + 25);
    expect(regenDeFoco(s)).toBeCloseTo(reg0 + 1.5, 5);
    pegar(w, 0, 'mauro-postit');
    const e = inimigo(w, 50, 0);
    onProjectileHit(p, { kind: 'runa' } as Projectile, e);
    expect(e.slow).toBeGreaterThanOrEqual(1.5);
  });

  it('Nota Dupla: no 5º ataque saem duas runas', () => {
    const w = cena(['mauro']);
    const p = w.players[0]!;
    const s = p.kit as MauroState;
    pegar(w, 0, 'mauro-nota-dupla');
    s.attackCount = 4;
    inimigo(w, 80, 0);
    stepWorld(w, [NO_INPUT]);
    expect(w.projectiles.active.filter((x) => (x as Projectile).kind === 'runa').length).toBe(2);
  });

  it('Leitura Dinâmica dá XP e velocidade de ataque', () => {
    const w = cena(['mauro']);
    const p = w.players[0]!;
    const xp = p.xpMul;
    pegar(w, 0, 'mauro-leitura-dinamica');
    expect(p.xpMul).toBeCloseTo(xp * 1.12, 5);
    expect(p.attackSpeedMul).toBeCloseTo(1.08, 5);
  });
});

describe('Melissa: cartas novas', () => {
  function golpeNasCostas(w: World): { p: ReturnType<typeof cena>['players'][0]; s: MelissaState; e: Enemy } {
    const p = w.players[0]!;
    const s = p.kit as MelissaState;
    const e = inimigo(w, 40, 0);
    e.facing = 0; // olhando para longe da Melissa: ela está nas costas
    e.spot = 3;
    return { p, s, e };
  }

  it('Passe de Bastidores cura e Autógrafo atordoa quando o Holofote é acertado', () => {
    const w = cena(['melissa']);
    pegar(w, 0, 'melissa-bastidores');
    pegar(w, 0, 'melissa-autografo');
    const { p, s, e } = golpeNasCostas(w);
    p.hp = 20;
    expect(acertarInimigo(w, p, s, e, 5)).toBe(true);
    expect(p.hp).toBeCloseTo(24, 5);
    expect(e.stun).toBeGreaterThanOrEqual(1);
  });

  it('After Party estende a explosão de velocidade e Close-Up sobe o crítico para x2,5', () => {
    const w = cena(['melissa']);
    const a = w.players[0]!.kit as MelissaState;
    const crit0 = multiplicadorDeCritico(a);
    pegar(w, 0, 'melissa-closeup');
    expect(multiplicadorDeCritico(a)).toBeCloseTo(crit0 + 0.5, 5);
    const w2 = cena(['melissa']);
    const { p, s, e } = golpeNasCostas(w2);
    acertarInimigo(w2, p, s, e, 5);
    const base = s.burstLeft;
    const w3 = cena(['melissa']);
    pegar(w3, 0, 'melissa-afterparty');
    const g = golpeNasCostas(w3);
    acertarInimigo(w3, g.p, g.s, g.e, 5);
    expect(g.s.burstLeft).toBeCloseTo(base + 1.5, 5);
  });
});

describe('Thaisa: cartas novas', () => {
  it('Repeteco: o 4º golpe causa +80%', () => {
    const golpe = (comCarta: boolean, golpesAntes: number): number => {
      const w = cena(['thaisa']);
      if (comCarta) pegar(w, 0, 'thaisa-repeteco');
      (w.players[0]!.kit as { swings: number }).swings = golpesAntes;
      const e = inimigo(w, 20, 0, 1000);
      stepWorld(w, [NO_INPUT]);
      return 1000 - e.hp;
    };
    const base = golpe(false, 0);
    expect(golpe(true, 0)).toBeCloseTo(base, 5); // 1º golpe: normal
    expect(golpe(true, 3)).toBeCloseTo(base * 1.8, 5); // 4º golpe: +80%
  });

  it('Colher de Pau deixa os atingidos lentos', () => {
    const w = cena(['thaisa']);
    pegar(w, 0, 'thaisa-colher');
    const e = inimigo(w, 20, 0, 1000);
    stepWorld(w, [NO_INPUT]);
    expect(e.slow).toBeGreaterThan(0);
  });

  it('Costela no Bafo: com 3 acúmulos de Pico, recebe 20% menos dano', () => {
    const w = cena(['thaisa']);
    pegar(w, 0, 'thaisa-costela');
    const p = w.players[0]!;
    stepWorld(w, [NO_INPUT]);
    const sem = p.damageTakenMul;
    (p.kit as { stacks: number[] }).stacks = [4, 4, 4];
    stepWorld(w, [NO_INPUT]);
    expect(p.damageTakenMul).toBeCloseTo(sem * 0.8, 5);
  });

  it('Estoque de Marmitas aumenta o HP máximo', () => {
    const w = cena(['thaisa']);
    const p = w.players[0]!;
    const hp = p.maxHp;
    pegar(w, 0, 'thaisa-marmita');
    expect(p.maxHp).toBe(hp + 25);
  });
});

describe('Thayssa: cartas novas', () => {
  it('Abraço Apertado aumenta o raio em 20%', () => {
    const w = cena(['thayssa']);
    const s = w.players[0]!.kit as ThayssaState;
    expect(raioDaAura(s)).toBe(AURA_RADIUS);
    pegar(w, 0, 'thayssa-abraco-apertado');
    expect(raioDaAura(s)).toBeCloseTo(AURA_RADIUS * 1.2, 5);
  });

  it('Playlist Compartilhada: trocar de modo dá velocidade de ataque a quem está na aura', () => {
    const w = cena(['thayssa', 'felipe']);
    w.players[1]!.x = 20;
    pegar(w, 0, 'thayssa-playlist');
    stepWorld(w, [{ moveX: 0, moveY: 0, action: true, ultimate: false }, NO_INPUT]);
    expect(w.players[1]!.buffs.some((b) => b.id === 'playlist0')).toBe(true);
  });

  it('Lágrima Doce cura quem está na aura a cada pulso da Euforia', () => {
    const w = cena(['thayssa', 'felipe']);
    w.players[1]!.x = 20;
    w.players[1]!.hp = 10;
    pegar(w, 0, 'thayssa-lagrima-doce');
    for (let i = 0; i < 90; i++) stepWorld(w, [NO_INPUT, NO_INPUT]);
    expect(w.players[1]!.hp).toBeGreaterThan(10);
  });
});
