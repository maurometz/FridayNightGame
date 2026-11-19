import { describe, expect, it } from 'vitest';
import { PHASES, PHASE_TUNING } from '../data/acts';
import { BOSSES, PHASE_ENEMIES, COMUNS } from '../data/enemies';
import { MAX_ENEMIES, STEP_S } from '../data/balance';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { chefeVivo } from './bosses';
import { damageEnemy } from './enemies';
import { ARENA_INDEX, PHASE_COUNT, tempoNaFase, tempoRestante } from './run';
import { spawnEnemy, spawnRate } from './spawner';
import { hitPlayer } from './teamEffects';

function mundo(opts: { noSpawn?: boolean; noBosses?: boolean; players?: number } = {}): World {
  const chars = (['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'] as const).slice(0, opts.players ?? 1);
  const w = createWorld(chars, { initialChoice: false, noSpawn: opts.noSpawn ?? true, noBosses: opts.noBosses ?? false, seed: 3 });
  // Jogadores invulneráveis: aqui medimos o diretor da partida, não a sobrevivência.
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

/** Pula para o instante em que a exploração da fase atual termina. */
function ateOFimDaFase(w: World): void {
  w.tick = w.phaseStartTick + Math.ceil(PHASE_TUNING[w.act]!.durationS / STEP_S) + 1;
  passo(w);
}

function matarChefe(w: World): void {
  const c = chefeVivo(w)!;
  damageEnemy(w, c, 1e9, w.players[0]);
  passo(w);
}

describe('Fases (campanha de 7 mapas + Arena do Tempo)', () => {
  it('são 8 fases: 7 mapas e a Arena do Tempo, com afinação para cada uma', () => {
    expect(PHASES).toHaveLength(8);
    expect(PHASE_TUNING).toHaveLength(8);
    expect(PHASE_COUNT).toBe(8);
    expect(ARENA_INDEX).toBe(7);
    expect(PHASES[7]!.secret).toBe(true);
  });

  it('a campanha começa na fase 1, sem chefe e com as paredes da casa', () => {
    const w = mundo();
    expect(w.act).toBe(0);
    expect(w.bossFight).toBe(false);
    expect(w.walls.length).toBeGreaterThan(0);
    expect(chefeVivo(w)).toBeUndefined();
  });

  it('cada chefe da lista é o chefe da fase certa, e a fase 2 não tem chefe', () => {
    expect(PHASES.map((f) => f.boss)).toEqual(['salsichas', null, 'juninho', 'rm', 'christopher', 'ale', 'tiagow', 'tempo']);
    expect(BOSSES.map((b) => b.id)).toEqual(['salsichas', 'juninho', 'rm', 'christopher', 'ale', 'tiagow', 'tempo']);
  });

  it('nenhuma fase começa com uma parede em cima do ponto de partida dos jogadores', () => {
    for (const t of PHASE_TUNING) {
      for (const wall of t.walls) {
        const dentro = 0 >= wall.x - 12 && 0 <= wall.x + wall.w + 12 && 0 >= wall.y - 12 && 0 <= wall.y + wall.h + 12;
        expect(dentro).toBe(false);
      }
    }
  });
});

describe('Tempo da fase', () => {
  it('conta a exploração até o chefe e zera a cada fase', () => {
    const w = mundo();
    expect(tempoRestante(w)).toBe(PHASE_TUNING[0]!.durationS);
    w.tick = 60 * 30;
    expect(tempoNaFase(w)).toBeCloseTo(30);
    expect(tempoRestante(w)).toBeCloseTo(PHASE_TUNING[0]!.durationS - 30);
  });
});

describe('Chefe da fase e avanço', () => {
  it('ao fim da exploração nasce o chefe da fase e os inimigos comuns param de nascer', () => {
    const w = mundo({ noSpawn: false });
    ateOFimDaFase(w);
    expect(chefeVivo(w)?.def.id).toBe('salsichas');
    expect(w.bossFight).toBe(true);
    const antes = w.enemies.active.filter((e) => !e.def.boss).length;
    passo(w, 600);
    expect(w.enemies.active.filter((e) => !e.def.boss && e.alive).length).toBeLessThanOrEqual(antes + 4); // só o que o chefe invoca
  });

  it('o chefe nasce uma vez só por fase', () => {
    const w = mundo();
    ateOFimDaFase(w);
    passo(w, 120);
    // As Salsichas são 1 líder (a barra de vida) e 3 corpos que dividem a vida dele.
    expect(w.enemies.active.filter((e) => e.def.boss && e.leader === 0)).toHaveLength(1);
    expect(w.enemies.active.filter((e) => e.leader !== 0)).toHaveLength(3);
  });

  it('derrotar As Salsichas resgata a Tamires e leva à fase 2 (Ivoti)', () => {
    const w = mundo();
    ateOFimDaFase(w);
    matarChefe(w);
    expect(w.rescued).toContain('tamires');
    expect(w.bossesDefeated).toContain('salsichas');
    expect(w.act).toBe(1);
    expect(w.bossFight).toBe(false);
    expect(w.messages.some((m) => m.text.includes('foi derrotado'))).toBe(true);
  });

  it('a fase 2 não tem chefe: ao fim da exploração resgata a Rebeca e o portal leva ao Parcão', () => {
    const w = mundo();
    ateOFimDaFase(w);
    matarChefe(w);
    ateOFimDaFase(w);
    expect(w.rescued).toContain('rebeca');
    expect(w.act).toBe(2);
    expect(chefeVivo(w)).toBeUndefined();
  });

  it('o resgate dá um efeito leve e conta a cena de encontro', () => {
    const w = mundo();
    ateOFimDaFase(w);
    matarChefe(w);
    expect(w.messages.some((m) => m.text.includes('resgatado'))).toBe(true);
  });

  it('derrotar o Tiago W resgata Estevão e Big John, para o relógio e leva à Arena do Tempo', () => {
    const w = mundo();
    w.act = 6;
    w.phaseStartTick = w.tick;
    ateOFimDaFase(w);
    expect(chefeVivo(w)?.def.id).toBe('tiagow');
    matarChefe(w);
    expect(w.rescued).toEqual(expect.arrayContaining(['estevao', 'bigjohn']));
    expect(w.act).toBe(ARENA_INDEX);
    expect(w.status).toBe('playing');
    expect(w.moodOverride?.mood).toBe('queda');
  });

  it('na Arena do Tempo nasce o Tempo e derrotá-lo é a vitória', () => {
    const w = mundo();
    w.act = ARENA_INDEX;
    w.phaseStartTick = w.tick;
    ateOFimDaFase(w);
    expect(chefeVivo(w)?.def.id).toBe('tempo');
    matarChefe(w);
    expect(w.status).toBe('victory');
    expect(w.bossesDefeated).toContain('tempo');
  });

  it('derrotar um chefe intermediário não encerra a partida', () => {
    const w = mundo();
    ateOFimDaFase(w);
    matarChefe(w);
    expect(w.status).toBe('playing');
  });

  it('com o limite de 300 inimigos cheio, o chefe ainda nasce (abre espaço)', () => {
    const w = mundo();
    for (let i = 0; i < MAX_ENEMIES + 20; i++) spawnEnemy(w, COMUNS[0]!, 500, 500);
    ateOFimDaFase(w);
    expect(chefeVivo(w)).toBeDefined();
  });

  it('a vida do chefe cresce com o número de jogadores', () => {
    const w1 = mundo({ players: 1 });
    const w3 = mundo({ players: 3 });
    ateOFimDaFase(w1);
    ateOFimDaFase(w3);
    expect(chefeVivo(w3)!.hp / chefeVivo(w1)!.hp).toBeCloseTo(2);
  });

  it('sem chefes (testes), a fase não avança sozinha', () => {
    const w = mundo({ noBosses: true });
    ateOFimDaFase(w);
    expect(w.act).toBe(0);
    expect(chefeVivo(w)).toBeUndefined();
  });
});

describe('Curva de spawn', () => {
  it('cresce de forma linear dentro da fase', () => {
    expect(spawnRate(0, 120, 1)).toBeGreaterThan(spawnRate(0, 60, 1));
    const a = spawnRate(0, 60, 1) - spawnRate(0, 0, 1);
    const b = spawnRate(0, 120, 1) - spawnRate(0, 60, 1);
    expect(a).toBeCloseTo(b);
  });

  it('sobe um degrau a cada fase nova', () => {
    for (let f = 1; f < 7; f++) expect(spawnRate(f, 0, 1)).toBeGreaterThan(spawnRate(f - 1, 0, 1));
  });

  it('a taxa também cresce com jogadores extras', () => {
    expect(spawnRate(0, 0, 3)).toBeGreaterThan(spawnRate(0, 0, 1));
  });

  it('a partida respeita o teto de 300 inimigos ativos', () => {
    const w = mundo({ noSpawn: false, noBosses: true, players: 5 });
    w.act = 6;
    passo(w, 60 * 40);
    expect(w.enemies.size).toBeLessThanOrEqual(MAX_ENEMIES);
  }, 30000);
});

describe('Bestiário por fase', () => {
  it('toda fase tem inimigos comuns para sortear e só usa o bestiário novo', () => {
    expect(PHASE_ENEMIES).toHaveLength(8);
    for (const lista of PHASE_ENEMIES) {
      expect(lista.length).toBeGreaterThan(0);
      for (const d of lista) expect(COMUNS).toContain(d);
    }
  });

  it('o Coelho do Relógio aparece em todas as fases (pista do Tempo)', () => {
    for (let i = 0; i < 7; i++) expect(PHASE_ENEMIES[i]!.some((d) => d.id === 'coelho')).toBe(true);
  });

  it('a vida dos inimigos comuns cresce a cada fase', () => {
    const w1 = mundo();
    const w5 = mundo();
    w5.act = 4;
    spawnEnemy(w1, COMUNS[0]!, 0, 100);
    spawnEnemy(w5, COMUNS[0]!, 0, 100);
    expect(w5.enemies.active[0]!.hp).toBeGreaterThan(w1.enemies.active[0]!.hp);
  });
});

describe('Modo dev', () => {
  const dev = (o: Partial<import('../game/settings').DevSettings> = {}): import('../game/settings').DevSettings => ({ fase: 1, duracaoS: 0, invulneravel: false, danoMul: 1, cutscenes: true, ...o });

  it('a duração da fase pode ser trocada (e o relógio e o chefe seguem o novo valor)', () => {
    const w = createWorld(['felipe'], { initialChoice: false, noSpawn: true, seed: 3, dev: dev({ duracaoS: 10 }) });
    for (const p of w.players) p.hp = p.maxHp = 1e9;
    expect(tempoRestante(w)).toBe(10);
    w.tick = Math.round(11 / STEP_S);
    passo(w);
    expect(chefeVivo(w)?.def.id).toBe('salsichas');
  });

  it('a Arena do Tempo ignora a duração do modo dev', () => {
    const w = createWorld(['felipe'], { initialChoice: false, noSpawn: true, seed: 3, dev: dev({ duracaoS: 90 }) });
    w.act = ARENA_INDEX;
    expect(tempoRestante(w)).toBe(PHASE_TUNING[ARENA_INDEX]!.durationS);
  });

  it('invulnerável: nenhum golpe tira vida', () => {
    const w = createWorld(['felipe'], { initialChoice: false, noSpawn: true, noBosses: true, seed: 3, dev: dev({ invulneravel: true }) });
    const p = w.players[0]!;
    const hp = p.hp;
    hitPlayer(w, p, 50);
    expect(p.hp).toBe(hp);
    w.dev = null;
    hitPlayer(w, p, 50);
    expect(p.hp).toBeLessThan(hp);
  });

  it('o multiplicador de dano vale para tudo que os jogadores causam', () => {
    const w1 = createWorld(['felipe'], { initialChoice: false, noSpawn: true, noBosses: true, seed: 3 });
    const w2 = createWorld(['felipe'], { initialChoice: false, noSpawn: true, noBosses: true, seed: 3, dev: dev({ danoMul: 10 }) });
    for (const w of [w1, w2]) {
      spawnEnemy(w, COMUNS[0]!, 100, 0);
      w.enemies.active[0]!.hp = 1e6;
      damageEnemy(w, w.enemies.active[0]!, 10, w.players[0]);
    }
    const tirou = (w: World): number => 1e6 - w.enemies.active[0]!.hp;
    expect(tirou(w2)).toBeCloseTo(tirou(w1) * 10, 3);
  });
});

describe('Rebalanceamento: aquecimento e dano por fase', () => {
  it('o spawn parte de uma fração no começo da fase e chega a 100%', async () => {
    const { aquecimento } = await import('./spawner');
    expect(aquecimento(0)).toBeLessThan(0.6);
    expect(aquecimento(0)).toBeGreaterThan(0);
    expect(aquecimento(1000)).toBe(1);
    expect(aquecimento(10)).toBeGreaterThan(aquecimento(0));
  });

  it('o dano dos inimigos nunca diminui de uma fase para a seguinte e o fim é bem mais forte que o começo', async () => {
    const { danoDaFase, ENEMY_DAMAGE_MUL } = await import('../data/acts');
    for (let f = 1; f < ENEMY_DAMAGE_MUL.length; f++) expect(danoDaFase(f)).toBeGreaterThanOrEqual(danoDaFase(f - 1));
    expect(danoDaFase(6)).toBeGreaterThan(danoDaFase(0) * 2);
  });

  it('a vida dos inimigos comuns sobe a cada fase', () => {
    for (let f = 1; f < 7; f++) expect(PHASE_TUNING[f]!.hpMul).toBeGreaterThan(PHASE_TUNING[f - 1]!.hpMul);
  });
});
