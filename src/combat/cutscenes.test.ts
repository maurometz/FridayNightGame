import { describe, expect, it } from 'vitest';
import { BOSS_DEFEAT, BOSS_INTRO, PORTAL_INTRO } from '../data/cutscenes';
import { BOSSES } from '../data/enemies';
import { PHASE_TUNING } from '../data/acts';
import { YOUTH } from '../data/youth';
import { STEP_S } from '../data/balance';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { chefeVivo } from './bosses';
import { damageEnemy } from './enemies';
import { TRANSICAO_MEIO, TRANSICAO_QUADROS, aoFimDaCutscene, pularTransicao, tickTransicao } from './run';
import { spawnEnemy } from './spawner';
import { COMUNS } from '../data/enemies';

function mundo(cutscenes: boolean): World {
  const w = createWorld(['felipe'], { initialChoice: false, noSpawn: true, seed: 5, cutscenes });
  for (const p of w.players) p.hp = p.maxHp = 1e9;
  return w;
}
function passo(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map(() => NO_INPUT));
    w.choices.length = 0;
    w.advice = null;
  }
}
function ateOFim(w: World): void {
  w.tick = w.phaseStartTick + Math.ceil(PHASE_TUNING[w.act]!.durationS / STEP_S) + 1;
  passo(w);
}
function matar(w: World): void {
  damageEnemy(w, chefeVivo(w)!, 1e9, w.players[0]);
}
const textos = (w: World): string[] => (w.cutscene?.lines ?? []).map((l) => l.text);

describe('Cutscenes de resgate e de chefe', () => {
  it('todo chefe tem cutscene de introdução e de derrota, com falas curtas e legíveis', () => {
    for (const b of BOSSES) {
      expect(BOSS_INTRO[b.id]?.length, `intro ${b.id}`).toBeGreaterThanOrEqual(4);
      expect(BOSS_DEFEAT[b.id]?.length, `derrota ${b.id}`).toBeGreaterThanOrEqual(4);
      for (const l of [...BOSS_INTRO[b.id]!, ...BOSS_DEFEAT[b.id]!]) expect(l.text.length, `${b.id}: ${l.text}`).toBeLessThanOrEqual(120);
    }
    expect(PORTAL_INTRO.length).toBeGreaterThan(3);
  });

  it('a introdução do chefe aparece quando ele nasce, e o jogo fica parado até ela acabar', () => {
    const w = mundo(true);
    ateOFim(w);
    expect(chefeVivo(w)?.def.id).toBe('salsichas');
    expect(w.cutscene).not.toBeNull();
    expect(textos(w)[0]).toBe(BOSS_INTRO['salsichas']![0]!.text);
    const t = w.tick;
    passo(w, 60);
    expect(w.tick).toBe(t);
  });

  it('derrotar o chefe abre a cutscene da derrota e, depois dela, a de resgate com o encontro inteiro', () => {
    const w = mundo(true);
    ateOFim(w);
    w.cutscene = null;
    matar(w);
    const t = textos(w);
    expect(t[0]).toBe(BOSS_DEFEAT['salsichas']![0]!.text);
    const tamires = YOUTH.find((y) => y.id === 'tamires')!;
    const iDerrota = t.indexOf(BOSS_DEFEAT['salsichas']!.at(-1)!.text);
    const iResgate = t.indexOf(tamires.encounter[0]!.text);
    expect(iDerrota).toBeGreaterThan(-1);
    expect(iResgate).toBeGreaterThan(iDerrota);
    for (const l of tamires.encounter) expect(t).toContain(l.text);
    expect(w.act).toBe(1);
  });

  it('os nomes das cutscenes são os por extenso (jovens, Comitê, Lucas, chefes)', () => {
    const w = mundo(true);
    ateOFim(w);
    w.cutscene = null;
    matar(w);
    const nomes = new Set(w.cutscene!.lines.map((l) => l.who));
    expect(nomes.has('Tamires')).toBe(true);
    expect(nomes.has('Thaisa') || nomes.has('Melissa')).toBe(true);
    expect([...nomes].every((n) => n === '' || n[0] === n[0]!.toUpperCase())).toBe(true);
  });

  it('a fase sem chefe (Ivoti) tem a cutscene do portal e o resgate da Rebeca', () => {
    const w = mundo(true);
    w.act = 1;
    w.phaseStartTick = w.tick;
    ateOFim(w);
    const t = textos(w);
    expect(t).toContain(PORTAL_INTRO[0]!.text);
    expect(t).toContain(YOUTH.find((y) => y.id === 'rebeca')!.encounter[0]!.text);
    expect(w.act).toBe(2);
  });

  it('o Tiago W leva ao fechamento com o relógio parado, depois do resgate de Estevão e Big John', () => {
    const w = mundo(true);
    w.act = 6;
    w.phaseStartTick = w.tick;
    ateOFim(w);
    w.cutscene = null;
    matar(w);
    const t = textos(w);
    const iBig = t.indexOf(YOUTH.find((y) => y.id === 'bigjohn')!.encounter[0]!.text);
    const iRelogio = t.findIndex((x) => x.includes('relógio'));
    expect(iBig).toBeGreaterThan(-1);
    expect(iRelogio).toBeGreaterThan(iBig);
    // O grupo só vai para a Arena depois das cutscenes e do vórtice.
    expect(w.act).toBe(6);
    expect(w.faseDestino).toBe(7);
  });

  it('derrotar o Tempo mostra a cena final e, depois, a vitória', () => {
    const w = mundo(true);
    w.act = 7;
    w.phaseStartTick = w.tick;
    ateOFim(w);
    w.cutscene = null;
    matar(w);
    expect(w.status).toBe('victory');
    expect(textos(w)[0]).toBe(BOSS_DEFEAT['tempo']![0]!.text);
  });

  it('com as cutscenes desligadas (testes, modo dev), tudo continua em balões e o jogo não pausa', () => {
    const w = mundo(false);
    ateOFim(w);
    expect(w.cutscene).toBeNull();
    matar(w);
    expect(w.cutscene).toBeNull();
    expect(w.messages.some((m) => m.text.includes('resgatado'))).toBe(true);
  });
});

describe('Transporte da igreja para a Arena do Tempo', () => {
  function aposTiagoW(): World {
    const w = mundo(true);
    w.act = 6;
    w.phaseStartTick = w.tick;
    ateOFim(w);
    w.cutscene = null;
    matar(w);
    return w;
  }

  it('depois das cutscenes começa a transição, e o jogo fica parado enquanto ela roda', () => {
    const w = aposTiagoW();
    expect(w.transicao).toBeNull(); // ainda na cutscene
    w.cutscene = null;
    aoFimDaCutscene(w);
    expect(w.transicao).not.toBeNull();
    const t = w.tick;
    passo(w, 120);
    expect(w.tick).toBe(t);
  });

  it('no meio do vórtice a fase troca, o campo é limpo e o grupo chega no centro da arena', () => {
    const w = aposTiagoW();
    spawnEnemy(w, COMUNS[0]!, 100, 100);
    w.players[0]!.x = 300;
    w.players[0]!.y = -200;
    w.cutscene = null;
    aoFimDaCutscene(w);
    for (let i = 0; i < TRANSICAO_MEIO - 1; i++) tickTransicao(w);
    expect(w.act).toBe(6);
    tickTransicao(w);
    expect(w.act).toBe(7);
    expect(w.faseDestino).toBeNull();
    expect(w.enemies.active.filter((e) => e.alive)).toHaveLength(0);
    expect(w.messages.every((m) => !m.text.includes('Aviso de chefe'))).toBe(true);
    expect(Math.abs(w.players[0]!.x)).toBeLessThan(30);
    expect(w.players[0]!.y).toBeLessThan(60);
    let fim: string | null = null;
    for (let i = TRANSICAO_MEIO; i < TRANSICAO_QUADROS + 5 && !fim; i++) fim = tickTransicao(w);
    expect(fim).toBe('fim');
    expect(w.transicao).toBeNull();
  });

  it('Esc pula o vórtice: a troca acontece na hora e o jogo volta', () => {
    const w = aposTiagoW();
    w.cutscene = null;
    aoFimDaCutscene(w);
    pularTransicao(w);
    expect(w.act).toBe(7);
    expect(w.transicao).toBeNull();
    const t = w.tick;
    passo(w, 3);
    expect(w.tick).toBeGreaterThan(t);
  });

  it('na Arena do Tempo não aparece nenhum inimigo comum: só o Tempo e as mecânicas dele', () => {
    const w = createWorld(['felipe'], { initialChoice: false, noSpawn: false, seed: 9 });
    for (const p of w.players) p.hp = p.maxHp = 1e9;
    w.act = 7;
    w.phaseStartTick = w.tick;
    passo(w, 60 * 40);
    const vivos = w.enemies.active.filter((e) => e.alive);
    expect(vivos.some((e) => e.def.id === 'tempo')).toBe(true);
    expect(vivos.filter((e) => !e.def.boss)).toHaveLength(0);
  });

  it('sem cutscenes (testes, modo dev sem cutscenes) a ida para a Arena é imediata', () => {
    const w = mundo(false);
    w.act = 6;
    w.phaseStartTick = w.tick;
    ateOFim(w);
    matar(w);
    expect(w.act).toBe(7);
    expect(w.transicao).toBeNull();
  });
});

describe('Efeitos e jovens na tela', () => {
  it('quem foi resgatado aparece ao lado do grupo na fase seguinte', () => {
    const w = mundo(false);
    ateOFim(w);
    matar(w);
    expect(w.act).toBe(1);
    expect(w.youthNaFase.map((j) => j.id)).toEqual(['tamires']);
    expect(w.resgatadosRecentes).toHaveLength(0);
  });

  it('o grupo da fase seguinte começa sem os jovens da anterior', () => {
    const w = mundo(false);
    ateOFim(w);
    matar(w);
    ateOFim(w); // Ivoti, sem chefe: resgata a Rebeca e vai para o Parcão
    expect(w.youthNaFase.map((j) => j.id)).toEqual(['rebeca']);
  });

  it('os holofotes do RM usam a imagem do efeito', async () => {
    const { RM } = await import('../data/enemies');
    const { spawnBoss } = await import('./bosses');
    const w = mundo(false);
    spawnBoss(w, RM);
    const rm = w.enemies.active.find((e) => e.def.id === 'rm')!;
    rm.aiState = 0;
    rm.aiCd = 0;
    w.trance = { slot: 0, meter: 50, caught: false };
    w.players[0]!.x = 300; // longe: o RM não prende ninguém e ataca
    for (let i = 0; i < 20; i++) passo(w);
    expect(w.hazards.active.some((h) => h.sprite === 'holofote_rm')).toBe(true);
  });
});

describe('Pisos e props de cenário', () => {
  it('a fase 1 tem o sofá como prop na primeira parede, e a fase 5 (mesma planta) não', async () => {
    const { PHASE_TUNING } = await import('../data/acts');
    expect(PHASE_TUNING[0]!.walls[0]!.prop).toBe('sofa');
    expect(PHASE_TUNING[4]!.walls.some((w) => w.prop)).toBe(false);
  });
});
