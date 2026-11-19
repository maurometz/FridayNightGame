import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../data/characters';
import { COMUNS } from '../data/enemies';
import { MEGAFONE_STUN_S } from '../data/thayssa';
import { REQUIEM_COOLDOWN_S } from '../data/felipe';
import { VEHICLES, VEHICLE_OF, VEHICLE_PICKUP_LIFE_S } from '../data/vehicles';
import { NO_INPUT, type PlayerInput } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import type { ThayssaState } from '../characters/thayssaState';
import { getCard } from './cardPool';
import { aplicarTdah } from './status';
import { spawnEnemy } from './spawner';
import { hitPlayer } from './teamEffects';
import { montar } from './vehicles';

const ROBO = COMUNS[0]!;

function cena(ids: CharacterId[]): World {
  const w = createWorld(ids, { seed: 5, noSpawn: true, noBosses: true, initialChoice: false });
  w.walls = [];
  ids.forEach((_, i) => {
    const p = w.players[i]!;
    p.x = p.prevX = i * 20;
    p.y = p.prevY = 0;
  });
  return w;
}

function passos(w: World, n: number, input: PlayerInput = NO_INPUT): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map((_, s) => (s === 0 ? input : NO_INPUT)));
    w.choices.length = 0;
  }
}

function pegar(w: World, slot: number, id: string): void {
  const c = getCard(id)!;
  c.apply(w.players[slot]!, 1);
}

describe('Réquiem da Morte (carta do Felipe)', () => {
  it('quem cai perto do Felipe se levanta com metade da vida e uma onda empurra os inimigos', () => {
    const w = cena(['felipe', 'mauro']);
    pegar(w, 0, 'felipe-requiem');
    const mauro = w.players[1]!;
    mauro.hp = 1;
    spawnEnemy(w, ROBO, mauro.x + 30, 0);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    hitPlayer(w, mauro, 50);
    expect(mauro.hp).toBeCloseTo(mauro.maxHp * 0.5, 5);
    expect(mauro.invuln).toBeGreaterThan(1);
    expect(e.hp).toBeLessThan(1000);
    expect(e.kx).toBeGreaterThan(0);
  });

  it('só toca uma vez a cada 90 s e só para quem está ao alcance', () => {
    const w = cena(['felipe', 'mauro']);
    pegar(w, 0, 'felipe-requiem');
    const felipe = w.players[0]!;
    const mauro = w.players[1]!;
    mauro.hp = 1;
    hitPlayer(w, mauro, 50);
    expect(mauro.hp).toBeGreaterThan(0);
    expect((felipe.kit as { requiemCd: number }).requiemCd).toBeCloseTo(REQUIEM_COOLDOWN_S, 5);
    mauro.invuln = 0;
    mauro.hp = 1;
    hitPlayer(w, mauro, 50);
    expect(mauro.hp).toBeLessThanOrEqual(0); // em recarga

    const w2 = cena(['felipe', 'mauro']);
    pegar(w2, 0, 'felipe-requiem');
    w2.players[1]!.x = 2000; // longe demais
    w2.players[1]!.hp = 1;
    hitPlayer(w2, w2.players[1]!, 50);
    expect(w2.players[1]!.hp).toBeLessThanOrEqual(0);
  });

  it('o Felipe também se levanta sozinho', () => {
    const w = cena(['felipe']);
    pegar(w, 0, 'felipe-requiem');
    const f = w.players[0]!;
    f.hp = 1;
    hitPlayer(w, f, 50);
    expect(f.hp).toBeGreaterThan(0);
  });

  it('sem a carta, ninguém se levanta', () => {
    const w = cena(['felipe', 'mauro']);
    w.players[1]!.hp = 1;
    hitPlayer(w, w.players[1]!, 50);
    expect(w.players[1]!.hp).toBeLessThanOrEqual(0);
  });
});

describe('Megafone da Thayssa', () => {
  it('grita no inimigo mais próximo: fere, empurra e, na Euforia, anima quem está na aura', () => {
    const w = cena(['thayssa']);
    const p = w.players[0]!;
    const s = p.kit as ThayssaState;
    spawnEnemy(w, ROBO, 70, -8);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    s.megaCd = 0;
    passos(w, 2);
    expect(e.hp).toBeLessThan(1000);
    expect(p.buffs.some((b) => b.id === 'megafone0')).toBe(true);
    expect(s.megaCd).toBeGreaterThan(3);
  });

  it('na Sobrecarga o grito atordoa; sem inimigo por perto não grita', () => {
    const w = cena(['thayssa']);
    const s = w.players[0]!.kit as ThayssaState;
    s.mode = 'sobrecarga';
    s.megaCd = 0;
    passos(w, 3);
    expect(s.megaCd).toBe(0); // ninguém por perto: segue pronto

    spawnEnemy(w, ROBO, 70, -8);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    passos(w, 1);
    expect(e.stun).toBeGreaterThan(MEGAFONE_STUN_S - 0.2);
  });
});

describe('TDAH', () => {
  it('de tempos em tempos o jogador se distrai e anda sozinho; depois o debuff acaba', () => {
    const w = cena(['mauro']);
    const p = w.players[0]!;
    aplicarTdah(p, 12);
    let distraiu = false;
    let moveuSozinho = false;
    for (let i = 0; i < 60 * 12 + 30; i++) {
      const x0 = p.x;
      const y0 = p.y;
      passos(w, 1);
      if (p.distractedLeft > 0) {
        distraiu = true;
        if (Math.hypot(p.x - x0, p.y - y0) > 0) moveuSozinho = true;
      }
    }
    expect(distraiu).toBe(true);
    expect(moveuSozinho).toBe(true);
    expect(p.tdahLeft).toBe(0);
    expect(p.distractedLeft).toBe(0);
  });

  it('enquanto está focado, ataca mais rápido (+15%)', () => {
    const w = cena(['mauro']);
    const p = w.players[0]!;
    aplicarTdah(p, 30);
    passos(w, 2);
    expect(p.buffs.some((b) => b.id === 'tdahFoco' && b.attack === 1.15)).toBe(true);
  });
});

describe('Veículos', () => {
  it('cada personagem tem o seu', () => {
    expect(new Set(Object.values(VEHICLE_OF)).size).toBe(5);
    expect(VEHICLES[VEHICLE_OF.thayssa].name).toBe('Cavalo Crioulo');
    expect(VEHICLES[VEHICLE_OF.thaisa].name).toBe('Carroça da Madrugada');
    expect(VEHICLES[VEHICLE_OF.felipe].name).toBe('Skate');
    expect(VEHICLES[VEHICLE_OF.mauro].name).toBe('Armadura Mark III');
  });

  it('aparece no chão perto do dono, e ele monta ao encostar', () => {
    const w = cena(['melissa']);
    const p = w.players[0]!;
    p.vehicleNextIn = 0;
    passos(w, 2);
    expect(w.vehiclePickups).toHaveLength(1);
    const v = w.vehiclePickups[0]!;
    expect(Math.hypot(v.x - p.x, v.y - p.y)).toBeGreaterThan(30);
    expect(p.vehicle).toBeNull();
    p.x = p.prevX = v.x;
    p.y = p.prevY = v.y;
    passos(w, 1);
    expect(p.vehicle?.id).toBe('c3');
    expect(w.vehiclePickups).toHaveLength(0);
  });

  it('o veículo no chão some se ninguém pegar', () => {
    const w = cena(['mauro']);
    w.players[0]!.vehicleNextIn = 0;
    passos(w, 2);
    expect(w.vehiclePickups).toHaveLength(1);
    passos(w, Math.ceil(VEHICLE_PICKUP_LIFE_S * 60) + 5);
    expect(w.vehiclePickups).toHaveLength(0);
  });

  it('montado, anda mais rápido, ganha o buff e desmonta depois da duração', () => {
    const w = cena(['melissa']);
    const p = w.players[0]!;
    const direita: PlayerInput = { ...NO_INPUT, moveX: 1 };
    const x0 = p.x;
    passos(w, 30, direita);
    const andou = p.x - x0;

    const w2 = cena(['melissa']);
    const q = w2.players[0]!;
    montar(w2, q);
    const x1 = q.x;
    passos(w2, 30, direita);
    expect(q.x - x1).toBeGreaterThan(andou * 1.8);
    expect(q.buffs.some((b) => b.id === 'veiculo' && b.crit === 0.3)).toBe(true);

    passos(w2, Math.ceil(VEHICLES.c3.durationS * 60) + 5, direita);
    expect(q.vehicle).toBeNull();
    expect(q.vehicleNextIn).toBeGreaterThan(60);
  });

  it('atropela os inimigos no caminho', () => {
    const w = cena(['thayssa']);
    const p = w.players[0]!;
    spawnEnemy(w, ROBO, 12, 0);
    const e = w.enemies.active[0]!;
    e.hp = 1000;
    montar(w, p);
    passos(w, 2, { ...NO_INPUT, moveX: 1 });
    expect(e.hp).toBeLessThan(1000);
  });

  it('a Armadura Mark III deixa o Foco do Mauro sempre cheio e a Carroça cura quem está perto', () => {
    const w = cena(['mauro']);
    const mauro = w.players[0]!;
    (mauro.kit as { foco: number }).foco = 0;
    montar(w, mauro);
    passos(w, 2);
    expect((mauro.kit as { foco: number }).foco).toBeGreaterThanOrEqual(100);

    const w2 = cena(['thaisa', 'felipe']);
    const [thaisa, felipe] = w2.players as [(typeof w2.players)[0], (typeof w2.players)[0]];
    felipe.hp = felipe.maxHp - 30;
    const antes = felipe.hp;
    montar(w2, thaisa);
    passos(w2, 60);
    expect(felipe.hp).toBeGreaterThan(antes + 1);
  });

  it('quem cai perde o veículo', () => {
    const w = cena(['thaisa']);
    const p = w.players[0]!;
    montar(w, p);
    p.hp = 0;
    passos(w, 1);
    expect(p.vehicle).toBeNull();
  });
});
