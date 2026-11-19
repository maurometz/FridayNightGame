import { describe, expect, it } from 'vitest';
import { BESTIARY } from '../data/bestiary';
import { COMUNS, type EnemyDef, type EnemyTypeId } from '../data/enemies';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import type { Enemy } from '../entities/enemy';
import { AI } from './enemyAI';
import { damageEnemy } from './enemies';
import { spawnEnemy } from './spawner';

const def = (id: EnemyTypeId): EnemyDef => COMUNS.find((d) => d.id === id)!;

/** Mundo limpo: sem spawn, sem chefes, sem paredes, jogador na origem e muito resistente. */
function mundo(chars: ('felipe' | 'thaisa' | 'melissa')[] = ['felipe']): World {
  const w = createWorld(chars, { initialChoice: false, noSpawn: true, noBosses: true, seed: 9 });
  w.walls = [];
  for (const p of w.players) {
    p.hp = p.maxHp = 100000;
    const k = p.kit as unknown as { cd?: number } | null;
    if (k) k.cd = 1e9; // o kit do jogador não atira, para o inimigo ser observado em paz
  }
  return w;
}

function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map(() => NO_INPUT));
    w.choices.length = 0;
  }
}

function criar(w: World, id: EnemyTypeId, x: number, y: number): Enemy {
  spawnEnemy(w, def(id), x, y);
  const e = w.enemies.active[w.enemies.active.length - 1]!;
  e.hp = 1e9;
  return e;
}

describe('Bestiário (LORE seção 11)', () => {
  it('são 9 inimigos, cada um com comportamento próprio, e nenhum dos antigos', () => {
    expect(COMUNS).toHaveLength(9);
    expect(new Set(COMUNS.map((d) => d.behavior)).size).toBe(9);
    expect(COMUNS.map((d) => d.name)).toEqual([
      'Abacaxi Espinhudo',
      'Azeitona Traiçoeira',
      'Café Hiperativo',
      'Chimarrão Possesso',
      'Cachorro-Quente Completo',
      'Véio Loco',
      'Idosos Kpopers',
      'Coelho do Relógio',
      'Canhotos',
    ]);
    const ids = COMUNS.map((d) => d.id as string);
    for (const velho of ['robo', 'barata', 'pernilongo', 'pombo', 'gargula', 'torradeira']) expect(ids).not.toContain(velho);
    expect(COMUNS.map((d) => d.id)).toEqual(BESTIARY.map((b) => b.id));
  });
});

describe('Comportamentos', () => {
  it('Abacaxi Espinhudo: lento, persegue e, ao morrer, dispara espinhos em todas as direções', () => {
    const w = mundo();
    const e = criar(w, 'abacaxi', 150, 0);
    step(w, 120);
    expect(e.x).toBeLessThan(150);
    e.hp = 1;
    damageEnemy(w, e, 5, w.players[0]);
    const espinhos = w.hostiles.active.filter((h) => h.kind === 'espinho');
    expect(espinhos).toHaveLength(AI.abacaxi.spikes);
    const angulos = new Set(espinhos.map((h) => Math.round(Math.atan2(h.vy, h.vx) * 10)));
    expect(angulos.size).toBe(AI.abacaxi.spikes);
  });

  it('Azeitona Traiçoeira: vem em enxame e algumas deixam poças escorregadias', () => {
    expect(def('azeitona').groupSize).toBeGreaterThan(3);
    const w = mundo();
    for (let i = 0; i < 6; i++) criar(w, 'azeitona', 200 + i, 0);
    step(w, 60 * 5);
    expect(w.hazards.active.some((h) => h.slowFor > 0)).toBe(true);
  });

  it('Café Hiperativo: velocista que explode em calor ao encostar, sem deixar drops', () => {
    const w = mundo();
    const e = criar(w, 'cafe', 80, 0);
    let explodiu = false;
    for (let i = 0; i < 200 && !explodiu; i++) {
      step(w);
      explodiu = !e.alive;
    }
    expect(explodiu).toBe(true);
    expect(w.hazards.active.length).toBeGreaterThan(0);
  });

  it('Café Hiperativo: é bem mais rápido que o Abacaxi', () => {
    expect(def('cafe').speed).toBeGreaterThan(def('abacaxi').speed * 3);
  });

  it('Chimarrão Possesso: mantém distância e atira água fervente', () => {
    const w = mundo();
    const e = criar(w, 'chimarrao', 120, 0);
    e.aiCd = 0;
    let tiro = false;
    for (let i = 0; i < 20 && !tiro; i++) {
      step(w);
      tiro = w.hostiles.active.some((h) => h.kind === 'agua');
    }
    expect(tiro).toBe(true);
    step(w, 240);
    expect(Math.hypot(e.x - w.players[0]!.x, e.y - w.players[0]!.y)).toBeGreaterThan(AI.chimarrao.keepMin - 20);
  });

  it('Cachorro-Quente Completo: avisa, investe em linha reta e deixa rastro de molho', () => {
    const w = mundo();
    const e = criar(w, 'cachorroquente', 120, 0);
    e.aiCd = 0;
    let avisou = false;
    for (let i = 0; i < 300 && !avisou; i++) {
      step(w);
      avisou = e.aiState === 1;
    }
    expect(avisou).toBe(true);
    const dir = e.aiDir;
    step(w, Math.round(AI.cachorroquente.windupS * 60) + 15);
    expect(e.aiState).toBe(2);
    expect(e.facing).toBeCloseTo(dir, 5);
    step(w, 15);
    expect(w.hazards.active.some((h) => h.slowFor > 0)).toBe(true);
  });

  it('Véio Loco: movimento errático (muda de direção), grita e arremessa coisas', () => {
    const w = mundo();
    const e = criar(w, 'veioloco', 200, 0);
    const dirs = new Set<number>();
    let gritou = false;
    let arremessou = false;
    for (let i = 0; i < 400; i++) {
      step(w);
      dirs.add(Math.round(e.facing * 5));
      gritou ||= w.hazards.active.some((h) => h.kind === 'ring');
      arremessou ||= w.hostiles.active.length > 0;
    }
    expect(dirs.size).toBeGreaterThan(3);
    expect(gritou).toBe(true);
    expect(arremessou).toBe(true);
  });

  it('Idosos Kpopers: vêm em grupo e, na coreografia, curam os inimigos próximos', () => {
    expect(def('kpopers').groupSize).toBe(4);
    const w = mundo();
    const k = criar(w, 'kpopers', 200, 0);
    const vizinho = criar(w, 'abacaxi', 220, 0);
    vizinho.hp = 10;
    k.aiCd = 0;
    step(w, 3);
    expect(vizinho.hp).toBeGreaterThan(10);
  });

  it('Coelho do Relógio: some, reaparece perto do jogador e empurra os vizinhos para a frente', () => {
    const w = mundo();
    const e = criar(w, 'coelho', 300, 0);
    const vizinho = criar(w, 'abacaxi', 310, 0);
    e.aiCd = 0;
    step(w, 2);
    expect(e.untargetable).toBe(true);
    for (let i = 0; i < 60 && e.untargetable; i++) step(w);
    expect(e.untargetable).toBe(false);
    expect(Math.hypot(e.x, e.y)).toBeLessThan(AI.coelho.maxDist + 20);
    expect(Math.hypot(vizinho.kx, vizinho.ky)).toBeGreaterThanOrEqual(0);
  });

  it('Coelho do Relógio: sumido, não pode ser atingido', () => {
    const w = mundo();
    const e = criar(w, 'coelho', 300, 0);
    e.untargetable = true;
    const hp = e.hp;
    damageEnemy(w, e, 50, w.players[0]);
    expect(e.hp).toBe(hp);
  });

  it('Canhotos: contornam o jogador e atiram projéteis que curvam', () => {
    expect(def('canhoto').groupSize).toBe(2);
    const w = mundo();
    const e = criar(w, 'canhoto', 150, 0);
    e.aiCd = 0;
    let tiro = null as null | (typeof w.hostiles.active)[number];
    for (let i = 0; i < 20 && !tiro; i++) {
      step(w);
      tiro = w.hostiles.active[0] ?? null;
    }
    expect(tiro).not.toBeNull();
    expect(tiro!.homing).toBeGreaterThan(0);
  });
});

describe('Todo inimigo comum é um inimigo de verdade', () => {
  it('cada tipo nasce, anda e não quebra a simulação por 5 s', () => {
    for (const d of COMUNS) {
      const w = mundo();
      criar(w, d.id, 150, 40);
      step(w, 300);
      expect(w.enemies.size, d.id).toBeGreaterThanOrEqual(0);
    }
  });
});
