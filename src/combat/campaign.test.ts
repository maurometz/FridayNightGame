import { danoDaFase } from '../data/acts';
import { describe, expect, it } from 'vitest';
import { COLLECTIBLES, MAX_COLLECTIBLES_PER_PHASE, MAX_COLLECTIBLES_PER_RUN } from '../data/gallery';
import { RANDOM_EVENTS, type EventId } from '../data/randomEvents';
import { SAFE_ROOMS, SAFE_ROOM_INTERACTIONS, SAFE_ROOM_POS } from '../data/safeRooms';
import { COMUNS } from '../data/enemies';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { todasAsInteracoes } from '../data/interactions';
import { candidatas } from '../narrative/interactions';
import { finalizarStats } from '../data/stats';
import { defaultMeta, recordRun, sanitizeMeta } from '../game/meta';
import { sortearColecionaveis, updateCollectibles } from './collectibles';
import { damageEnemy } from './enemies';
import { QUIZ, iniciarEvento, sortearEvento } from './events';
import { irParaFase } from './run';
import { dentroDaZona, zonaSegura } from './safeRoom';
import { spawnEnemy } from './spawner';
import { hitPlayer } from './teamEffects';

function mundo(chars: ('felipe' | 'thaisa' | 'mauro')[] = ['felipe'], noBosses = false): World {
  const w = createWorld(chars, { initialChoice: false, noSpawn: true, noBosses, seed: 11 });
  for (const p of w.players) p.hp = p.maxHp = 1000;
  return w;
}
function passo(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    stepWorld(w, w.players.map(() => NO_INPUT));
    w.choices.length = 0;
  }
}
const naSala = (w: World): void => {
  const z = zonaSegura(w)!;
  w.players.forEach((p, i) => {
    p.x = z.x + i * 8;
    p.y = z.y;
  });
};

describe('Safe Rooms', () => {
  it('toda fase de 1 a 7 tem uma Safe Room com posição e falas; a Arena do Tempo não tem', () => {
    expect(SAFE_ROOMS).toHaveLength(7);
    for (const s of SAFE_ROOMS) {
      expect(SAFE_ROOM_POS[s.id]).toBeDefined();
      expect(SAFE_ROOM_INTERACTIONS.some((i) => i.room === s.id), s.id).toBe(true);
    }
    const w = mundo();
    w.act = 7;
    expect(zonaSegura(w)).toBeNull();
  });

  it('as falas das Safe Rooms seguem as regras de escrita (2 a 4 linhas de até 90 caracteres)', () => {
    for (const i of SAFE_ROOM_INTERACTIONS) {
      expect(i.lines.length, i.id).toBeGreaterThanOrEqual(2);
      expect(i.lines.length, i.id).toBeLessThanOrEqual(4);
      for (const l of i.lines) expect(l.text.length, i.id).toBeLessThanOrEqual(90);
      if (i.tag !== 'queda') for (const l of i.lines) expect(l.text.toLowerCase(), i.id).not.toContain('mudar');
    }
  });

  it('as falas entram na biblioteca de interações', () => {
    const ids = todasAsInteracoes().map((i) => i.id);
    for (const i of SAFE_ROOM_INTERACTIONS) expect(ids).toContain(i.id);
  });

  it('dentro da sala ninguém leva dano, e o aviso de entrada aparece uma vez', () => {
    const w = mundo();
    naSala(w);
    const hp = w.players[0]!.hp;
    hitPlayer(w, w.players[0]!, 100);
    expect(w.players[0]!.hp).toBe(hp);
    passo(w, 5);
    passo(w, 5);
    expect(w.messages.filter((m) => m.text.startsWith('Safe Room:'))).toHaveLength(1);
    w.players[0]!.x = 0;
    w.players[0]!.y = 0;
    hitPlayer(w, w.players[0]!, 100);
    expect(w.players[0]!.hp).toBeLessThan(hp);
  });

  it('os inimigos não entram na zona e o grupo se recupera lá dentro', () => {
    const w = mundo();
    const z = zonaSegura(w)!;
    spawnEnemy(w, COMUNS[0]!, z.x + 5, z.y);
    passo(w, 3);
    const e = w.enemies.active[0]!;
    expect(Math.hypot(e.x - z.x, e.y - z.y)).toBeGreaterThanOrEqual(z.r);
    w.players[0]!.hp = 500;
    naSala(w);
    passo(w, 120);
    expect(w.players[0]!.hp).toBeGreaterThan(500);
  });

  it('duas pessoas na sala disparam uma conversa exclusiva, em qualquer humor', () => {
    const w = mundo(['felipe', 'thaisa']);
    naSala(w);
    const c = candidatas(w);
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((x) => SAFE_ROOM_INTERACTIONS.some((s) => s.id === x.inter.id))).toBe(true);
    expect(dentroDaZona(w, w.players[0]!.x, w.players[0]!.y)).toBe(true);
  });
});

describe('Eventos aleatórios', () => {
  it('há 3 minigames que pausam o combate e 7 eventos em tempo real', () => {
    expect(RANDOM_EVENTS.filter((e) => e.pausesCombat).map((e) => e.id)).toEqual(['bexigas', 'domingao', 'fruitninja']);
    expect(RANDOM_EVENTS.filter((e) => !e.pausesCombat)).toHaveLength(7);
  });

  it('cada fase sorteia um instante para o evento, antes do chefe', () => {
    const w = mundo();
    sortearEvento(w, 150);
    expect(w.eventAtS).toBeGreaterThanOrEqual(20);
    expect(w.eventAtS).toBeLessThan(150 * 0.7);
    expect(w.eventRolled).toBe(false);
  });

  it('no máximo 1 evento por fase: ao chegar a hora, dispara uma vez', () => {
    const w = mundo();
    w.eventAtS = 1;
    w.tick = 120;
    passo(w);
    expect(w.eventRolled).toBe(true);
    expect(!!w.minigame || !!w.realtimeEvent).toBe(true);
  });

  it('um minigame pausa o spawn e o combate: os inimigos ficam parados', () => {
    const w = createWorld(['felipe'], { initialChoice: false, noSpawn: false, noBosses: true, seed: 11 });
    for (const p of w.players) p.hp = p.maxHp = 1e9;
    spawnEnemy(w, COMUNS[0]!, 120, 0);
    const e = w.enemies.active[0]!;
    iniciarEvento(w, 'fruitninja');
    expect(w.minigame).not.toBeNull();
    const x = e.x;
    const n = w.enemies.size;
    passo(w, 120);
    expect(e.x).toBe(x);
    expect(w.enemies.size).toBe(n);
  });

  it('o relógio da fase também fica parado durante o minigame', () => {
    const w = mundo();
    iniciarEvento(w, 'bexigas');
    const t0 = w.tick - w.phaseStartTick;
    passo(w, 60);
    expect(w.tick - w.phaseStartTick).toBeLessThanOrEqual(t0 + 1);
  });

  it('os minigames terminam sozinhos, pagam a recompensa e contam como evento concluído', () => {
    for (const id of ['bexigas', 'domingao', 'fruitninja'] as EventId[]) {
      const w = mundo();
      iniciarEvento(w, id);
      passo(w, 60 * 30);
      expect(w.minigame, id).toBeNull();
      expect(w.stats.eventsCompleted, id).toContain(id);
    }
  });

  it('Fruit Ninja: tocar numa fruta dá o buff dela', () => {
    const w = mundo();
    iniciarEvento(w, 'fruitninja');
    const mg = w.minigame!;
    const p = w.players[0]!;
    mg.items.push({ x: p.x, y: p.y, vx: 0, vy: 0, kind: 'laranja', alive: true, tag: 0 });
    passo(w, 2);
    expect(p.buffs.some((b) => b.id === 'fruta-dano')).toBe(true);
    expect(mg.score).toBeGreaterThan(0);
  });

  it('Domingão do Pedrão: quem fica na zona certa acerta e o grupo ganha buff', () => {
    const w = mundo();
    iniciarEvento(w, 'domingao');
    const mg = w.minigame!;
    const certa = mg.items.find((i) => i.tag === mg.question!.correct)!;
    w.players[0]!.x = certa.x;
    w.players[0]!.y = certa.y;
    passo(w, 60 * 15);
    expect(w.players[0]!.buffs.some((b) => b.id === 'minigame')).toBe(true);
    expect(QUIZ.every((q) => q.options.length === 3 && q.correct >= 0 && q.correct < 3)).toBe(true);
  });

  it('Bexigas: rebater pontua', () => {
    const w = mundo();
    iniciarEvento(w, 'bexigas');
    const b = w.minigame!.items[0]!;
    w.players[0]!.x = b.x + 2;
    w.players[0]!.y = b.y;
    passo(w, 3);
    expect(w.minigame!.score).toBeGreaterThan(0);
  });

  it('eventos em tempo real aplicam o efeito e saem de cena', () => {
    const w = mundo();
    w.players[0]!.hp = 100;
    iniciarEvento(w, 'lanche');
    passo(w, 60 * 7);
    expect(w.realtimeEvent).toBeNull();
    expect(w.players[0]!.hp).toBeGreaterThan(100);
    expect(w.stats.eventsCompleted).toContain('lanche');
  });

  it('Pega Miguel: encostar dá XP extra (gemas)', () => {
    const w = mundo();
    iniciarEvento(w, 'miguel');
    const ev = w.realtimeEvent!;
    w.players[0]!.x = ev.x;
    w.players[0]!.y = ev.y;
    passo(w, 2);
    expect(w.gems.active.length).toBeGreaterThan(0);
    expect(w.realtimeEvent).toBeNull();
  });

  it('Jorginho Pitbull atordoa os inimigos com o caos visual', () => {
    const w = mundo();
    spawnEnemy(w, COMUNS[0]!, 60, 0);
    iniciarEvento(w, 'jorginho');
    passo(w, 90);
    expect(w.enemies.active[0]!.stun).toBeGreaterThan(0);
  });

  it('Thiagão: encoraja (buff) ou exorta (debuff) o grupo', () => {
    const w = mundo();
    iniciarEvento(w, 'thiagao');
    passo(w, 100);
    expect(w.players[0]!.buffs.find((x) => x.id === 'thiagao')).toBeDefined();
  });
});

describe('Galeria do Mauro (colecionáveis)', () => {
  it('são 14 itens e nunca cabem todos numa partida', () => {
    expect(COLLECTIBLES).toHaveLength(14);
    expect(MAX_COLLECTIBLES_PER_RUN).toBeLessThan(COLLECTIBLES.length);
    expect(MAX_COLLECTIBLES_PER_PHASE).toBeLessThanOrEqual(2);
  });

  it('em nenhuma fase aparecem mais que o limite, e só itens daquela fase', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = createWorld(['felipe'], { initialChoice: false, noSpawn: true, seed });
      for (let f = 0; f < 7; f++) {
        w.act = f;
        sortearColecionaveis(w);
        expect(w.floorCollectibles.length).toBeLessThanOrEqual(MAX_COLLECTIBLES_PER_PHASE);
        for (const c of w.floorCollectibles) expect(COLLECTIBLES.find((x) => x.id === c.id)!.fases).toContain(f + 1);
      }
    }
  });

  it('jogando muitas partidas e pegando tudo, ninguém junta os 14 de uma vez', () => {
    let max = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = createWorld(['felipe'], { initialChoice: false, noSpawn: true, seed });
      for (let f = 0; f < 7; f++) {
        irParaFase(w, f);
        for (const c of [...w.floorCollectibles]) {
          w.players[0]!.x = c.x;
          w.players[0]!.y = c.y;
          updateCollectibles(w);
        }
      }
      max = Math.max(max, w.collected.length);
    }
    expect(max).toBeLessThanOrEqual(MAX_COLLECTIBLES_PER_RUN);
    expect(max).toBeLessThan(14);
  });

  it('encostar no item o coleta, avisa e o tira do chão', () => {
    const w = mundo();
    w.floorCollectibles = [{ id: 'bexiga', x: 5, y: 0 }];
    w.players[0]!.x = 5;
    w.players[0]!.y = 0;
    updateCollectibles(w);
    expect(w.collected).toContain('bexiga');
    expect(w.floorCollectibles).toHaveLength(0);
    expect(w.messages.some((m) => m.text.includes('Galeria do Mauro'))).toBe(true);
  });

  it('o que foi achado fica salvo entre as partidas, sem repetir', () => {
    let m = recordRun(defaultMeta(), { character: 'felipe', victory: false, kills: 1, seconds: 10, collected: ['bola', 'bexiga'] });
    m = recordRun(m, { character: 'felipe', victory: false, kills: 1, seconds: 10, collected: ['bola', 'cruzes'] });
    expect([...m.gallery].sort()).toEqual(['bexiga', 'bola', 'cruzes']);
    expect(sanitizeMeta({ gallery: ['a', 3, 'a'] }).gallery).toEqual(['a']);
  });

  it('com as Cruzes do Djanho, o Alê surta no começo da luta', () => {
    const w = mundo(['felipe'], false);
    w.collected.push('cruzes');
    w.act = 5;
    w.phaseStartTick = w.tick;
    w.tick += 60 * 400;
    passo(w, 3);
    expect(w.enemies.active.some((e) => e.def.id === 'ale')).toBe(true);
    expect(w.messages.some((m) => m.text.includes('CRUZES'))).toBe(true);
  });
});

describe('Estatísticas da partida', () => {
  it('conta dano causado por fonte e por personagem, abates e dano sofrido', () => {
    const w = mundo(['felipe', 'mauro']);
    spawnEnemy(w, COMUNS[0]!, 100, 0);
    const e = w.enemies.active[0]!;
    e.hp = 1e6;
    damageEnemy(w, e, 40, w.players[0]);
    damageEnemy(w, e, 10, w.players[1]);
    expect(w.stats.totalDamageDealt).toBeCloseTo(50, 5);
    expect(w.stats.damageByCharacter.felipe).toBeCloseTo(40, 5);
    expect(Object.keys(w.stats.damageBySource).length).toBe(2);
    e.hp = 1;
    damageEnemy(w, e, 5, w.players[0]);
    expect(w.stats.enemiesDefeated).toBe(1);
    hitPlayer(w, w.players[0]!, 25 / danoDaFase(w.act));
    expect(w.stats.totalDamageTaken).toBeCloseTo(25, 8);
  });

  it('o resumo final ordena o dano por fonte e junta jovens, chefes e itens', () => {
    const w = mundo();
    w.stats.damageBySource['A'] = 5;
    w.stats.damageBySource['B'] = 50;
    w.rescued.push('tamires');
    w.bossesDefeated.push('salsichas');
    w.collected.push('bola');
    const s = finalizarStats(w.stats, { durationS: 10, bossesDefeated: w.bossesDefeated, youthRescued: w.rescued, collectiblesFound: w.collected });
    expect(s.damageBySource.map((d) => d.label)).toEqual(['B', 'A']);
    expect(s.durationS).toBe(10);
    expect(s.youthRescued).toEqual(['tamires']);
    expect(s.collectiblesFound).toEqual(['bola']);
  });

  it('a cutscene pausa o jogo até acabar', () => {
    const w = mundo();
    w.cutscene = { lines: [{ who: 'lucas', text: 'Oi' }], index: 0 };
    const t = w.tick;
    passo(w, 30);
    expect(w.tick).toBe(t);
    w.cutscene = null;
    passo(w, 3);
    expect(w.tick).toBeGreaterThan(t);
  });
});
