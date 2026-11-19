import { describe, expect, it } from 'vitest';
import { decidir } from '../ai/companion';
import type { CharacterId } from '../data/characters';
import { REVIVE_HP_FRACTION, REVIVE_TIME_S } from '../data/revive';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { revivedoresPerto } from './revive';

function cena(ids: CharacterId[]): World {
  const w = createWorld(ids, { seed: 7, noSpawn: true, noBosses: true, initialChoice: false });
  w.walls = [];
  ids.forEach((_, i) => {
    const p = w.players[i]!;
    p.x = p.prevX = i * 10;
    p.y = p.prevY = 0;
  });
  return w;
}

function passos(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map(() => NO_INPUT));
    w.choices.length = 0;
  }
}

const segundos = (s: number): number => Math.round(s * 60);

describe('reviver um aliado caído', () => {
  it('um aliado vivo perto por 3 s levanta o caído com 40% de vida e invulnerabilidade', () => {
    const w = cena(['felipe', 'mauro']);
    const mauro = w.players[1]!;
    mauro.hp = 0;
    passos(w, segundos(REVIVE_TIME_S) - 5);
    expect(mauro.hp).toBe(0);
    expect(mauro.reviveProgress).toBeGreaterThan(2);
    passos(w, 10);
    expect(mauro.hp).toBeCloseTo(mauro.maxHp * REVIVE_HP_FRACTION, 5);
    expect(mauro.invuln).toBeGreaterThan(1);
    expect(mauro.reviveProgress).toBe(0);
  });

  it('sem ninguém perto o caído fica no chão e o progresso vai voltando', () => {
    const w = cena(['felipe', 'mauro']);
    const [felipe, mauro] = w.players as [(typeof w.players)[0], (typeof w.players)[0]];
    mauro.hp = 0;
    passos(w, segundos(1.5));
    const antes = mauro.reviveProgress;
    expect(antes).toBeGreaterThan(1);
    felipe.x = felipe.prevX = 500; // se afastou
    passos(w, segundos(1));
    expect(revivedoresPerto(w, mauro)).toBe(0);
    expect(mauro.reviveProgress).toBeLessThan(antes);
    expect(mauro.hp).toBe(0);
  });

  it('dois aliados perto revivem na metade do tempo', () => {
    const w = cena(['felipe', 'thaisa', 'mauro']);
    w.players[2]!.hp = 0;
    passos(w, segundos(REVIVE_TIME_S / 2) + 5);
    expect(w.players[2]!.hp).toBeGreaterThan(0);
  });

  it('só quem está vivo reanima: dois caídos juntos não se levantam', () => {
    const w = cena(['felipe', 'mauro', 'thaisa']);
    w.players[1]!.hp = 0;
    w.players[2]!.hp = 0;
    w.players[0]!.x = w.players[0]!.prevX = 600;
    passos(w, segundos(5));
    expect(w.players[1]!.hp).toBe(0);
    expect(w.players[2]!.hp).toBe(0);
  });

  it('com todos caídos a partida acaba (ninguém para reviver)', () => {
    const w = cena(['felipe', 'mauro']);
    for (const p of w.players) p.hp = 0;
    passos(w, 2);
    expect(w.status).toBe('gameover');
  });

  it('o companheiro IA vai até o jogador caído e fica ao lado dele', () => {
    const w = cena(['felipe', 'mauro']);
    const [lider, ia] = w.players as [(typeof w.players)[0], (typeof w.players)[0]];
    lider.hp = 0;
    ia.x = ia.prevX = 120;
    const entrada = decidir(w, ia, lider);
    expect(entrada.moveX).toBeLessThan(0); // anda em direção ao caído
    ia.x = lider.x + 3;
    const perto = decidir(w, ia, lider);
    expect(Math.hypot(perto.moveX, perto.moveY)).toBe(0); // já está do lado, fica parado
  });
});
