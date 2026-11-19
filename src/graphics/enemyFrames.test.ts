import { describe, expect, it } from 'vitest';
import { BESTIARY } from '../data/bestiary';
import { BOSSES, COMUNS, SALSICHAS_CORPOS } from '../data/enemies';
import { BOSS_STATE } from '../combat/bosses';
import { spawnEnemy } from '../combat/spawner';
import { createWorld, type World } from '../engine/world';
import type { Enemy } from '../entities/enemy';
import {
  CHEFE_FRAMES,
  DIRECOES,
  INIMIGOS_EXTERNOS,
  direcaoDe,
  NPCS_EXTERNOS,
  RETRATOS_EXTERNOS,
  RETRATO_POR_NOME,
  TRANSE_EXTERNOS,
  quadroDoInimigo,
  quadrosDe,
} from './enemyFrames';
import { YOUTH } from '../data/youth';
import { APPRENTICES } from '../data/lucas';

function mundo(): World {
  return createWorld(['felipe'], { initialChoice: false, noSpawn: true, noBosses: true, seed: 2 });
}
function inimigo(w: World, def: (typeof COMUNS)[number]): Enemy {
  spawnEnemy(w, def, 100, 0);
  return w.enemies.active[w.enemies.active.length - 1]!;
}
const chefe = (id: string) => BOSSES.find((b) => b.id === id)!;

describe('Folhas animadas: formato', () => {
  it('inimigo comum tem 8 direções e chefe tem 8 quadros, na ordem documentada', () => {
    expect(DIRECOES).toEqual(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);
    expect(CHEFE_FRAMES).toEqual(['idle0', 'idle1', 'walk0', 'walk1', 'attack', 'special', 'hurt', 'stun']);
    expect(quadrosDe('direcional')).toHaveLength(8);
    expect(quadrosDe('chefe')).toHaveLength(8);
  });

  it('todo inimigo comum, chefe e corpo das Salsichas tem folha esperada', () => {
    for (const d of COMUNS) expect(INIMIGOS_EXTERNOS[d.id]?.tipo, d.id).toBe('direcional');
    for (const d of [...BOSSES, ...SALSICHAS_CORPOS]) expect(INIMIGOS_EXTERNOS[d.id]?.tipo, d.id).toBe('chefe');
    expect(INIMIGOS_EXTERNOS.salsichao?.tipo).toBe('chefe'); // a fusão dos quatro (fase 3 da luta das Salsichas)
    expect(Object.keys(INIMIGOS_EXTERNOS)).toHaveLength(BESTIARY.length + BOSSES.length + SALSICHAS_CORPOS.length + 1);
  });

  it('há retrato para os cinco do Comitê, o Lucas, os aprendizes, os 10 jovens e todos os chefes', () => {
    for (const id of ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa', 'lucas']) expect(RETRATOS_EXTERNOS).toContain(id);
    for (const a of APPRENTICES) expect(RETRATOS_EXTERNOS).toContain(a.id);
    for (const y of YOUTH) expect(RETRATOS_EXTERNOS).toContain(y.id);
    for (const b of BOSSES) expect(RETRATOS_EXTERNOS).toContain(b.id);
    for (const id of ['monet', 'toddy', 'bucky', 'mariana', 'melina']) expect(RETRATOS_EXTERNOS).toContain(id);
  });

  it('todo nome falado por chefe nas cutscenes aponta para um retrato existente', () => {
    for (const id of Object.values(RETRATO_POR_NOME)) expect(RETRATOS_EXTERNOS).toContain(id);
  });

  it('NPCs de evento, jovens e aprendizes têm 2 quadros; o transe vale para os cinco do Comitê', () => {
    for (const id of ['pedrao', 'marciano', 'tiagoschneider', 'thiagao', 'miguel', 'valdir', 'oscar', 'jorginho', 'gabi']) expect(NPCS_EXTERNOS).toContain(id);
    for (const y of YOUTH) expect(NPCS_EXTERNOS).toContain(y.id);
    expect(TRANSE_EXTERNOS).toHaveLength(5);
  });
});

describe('Escolha do quadro', () => {
  it('o quadro de dano vale para o chefe, e o flash reduzido o troca pelo normal', () => {
    const w = mundo();
    const e = inimigo(w, chefe('juninho'));
    e.hitFlash = 0.08;
    expect(quadroDoInimigo(w, e, 'chefe')).toBe('hurt');
    expect(quadroDoInimigo(w, e, 'chefe', true)).not.toBe('hurt');
  });

  it('direção: o inimigo comum usa o desenho do lado para onde olha (leste = 0, o ângulo cresce para o sul)', () => {
    const PI = Math.PI;
    const casos: [number, string][] = [
      [0, 'east'],
      [PI / 4, 'south-east'],
      [PI / 2, 'south'],
      [(3 * PI) / 4, 'south-west'],
      [PI, 'west'],
      [-PI, 'west'],
      [(-3 * PI) / 4, 'north-west'],
      [-PI / 2, 'north'],
      [-PI / 4, 'north-east'],
      [0.1, 'east'],
      [PI / 2 + 0.2, 'south'],
    ];
    for (const [ang, esperado] of casos) expect(direcaoDe(ang), String(ang)).toBe(esperado);
  });

  it('comum: o quadro escolhido acompanha o facing do inimigo', () => {
    const w = mundo();
    const e = inimigo(w, COMUNS[0]!);
    e.facing = Math.PI / 2;
    expect(quadroDoInimigo(w, e, 'direcional')).toBe('south');
    e.facing = Math.PI;
    expect(quadroDoInimigo(w, e, 'direcional')).toBe('west');
    e.hitFlash = 0.08; // o dano é o flash branco do renderer, não um quadro
    expect(quadroDoInimigo(w, e, 'direcional')).toBe('west');
  });

  it('chefe: anda livre, descansa parado, avisa com o quadro de ataque e atordoado usa o stun', () => {
    const w = mundo();
    const e = inimigo(w, chefe('juninho'));
    e.aiState = BOSS_STATE.LIVRE;
    expect(['walk0', 'walk1']).toContain(quadroDoInimigo(w, e, 'chefe'));
    e.aiState = BOSS_STATE.DESCANSANDO;
    expect(['idle0', 'idle1']).toContain(quadroDoInimigo(w, e, 'chefe'));
    e.aiState = BOSS_STATE.PREPARANDO;
    expect(quadroDoInimigo(w, e, 'chefe')).toBe('attack');
    e.stun = 2;
    expect(quadroDoInimigo(w, e, 'chefe')).toBe('stun');
  });

  it('quadro especial: cada chefe tem o seu gatilho', () => {
    const w = mundo();
    const sal = inimigo(w, chefe('salsichas'));
    sal.aiState = BOSS_STATE.AQUECENDO; // comendo
    expect(quadroDoInimigo(w, sal, 'chefe')).toBe('special');

    const rm = inimigo(w, chefe('rm'));
    rm.aiState = BOSS_STATE.LIVRE;
    expect(['walk0', 'walk1']).toContain(quadroDoInimigo(w, rm, 'chefe'));
    w.trance = { slot: 0, meter: 50, caught: true };
    expect(quadroDoInimigo(w, rm, 'chefe')).toBe('special');
    w.trance = null;

    const chris = inimigo(w, chefe('christopher'));
    chris.aiT2 = 4.5;
    expect(quadroDoInimigo(w, chris, 'chefe')).toBe('special');

    const ale = inimigo(w, chefe('ale'));
    ale.aiState = BOSS_STATE.PREPARANDO; // janela do "parar"
    expect(quadroDoInimigo(w, ale, 'chefe')).toBe('special');

    const tiago = inimigo(w, chefe('tiagow'));
    tiago.aiState = BOSS_STATE.LIVRE;
    w.lucasVisible = true;
    expect(quadroDoInimigo(w, tiago, 'chefe')).toBe('special');

    const tempo = inimigo(w, chefe('tempo'));
    tempo.aiState = BOSS_STATE.LIVRE;
    tempo.aiY = 1;
    expect(quadroDoInimigo(w, tempo, 'chefe')).toBe('special');
  });
});
