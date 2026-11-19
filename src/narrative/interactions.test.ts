import { describe, expect, it } from 'vitest';
import { INTERACTIONS, POIS } from '../data/interactions';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld, type World } from '../engine/world';
import { spawnEnemy } from '../combat/spawner';
import { COMUNS } from '../data/enemies';
import { candidatas, lineSeconds, skipDialogue } from './interactions';
import type { CharacterId } from '../data/characters';

const SOFA = POIS.find((p) => p.id === 'sofa')!;

function cena(ids: CharacterId[], repeat = false): World {
  const w = createWorld(ids, { noSpawn: true, noBosses: true, initialChoice: false, repeatInteractions: repeat });
  ids.forEach((_, i) => {
    const p = w.players[i]!;
    p.x = p.prevX = SOFA.x + i * 10;
    p.y = p.prevY = SOFA.y + 20;
  });
  return w;
}

const passos = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(w, [NO_INPUT, NO_INPUT, NO_INPUT]);
};

describe('biblioteca de interações (regras de escrita, A.10)', () => {
  it('2 a 4 linhas, até 90 caracteres, e todo ponto de interesse existe', () => {
    const pontos = new Set(POIS.map((p) => p.id));
    for (const i of INTERACTIONS) {
      expect(i.lines.length, i.id).toBeGreaterThanOrEqual(2);
      expect(i.lines.length, i.id).toBeLessThanOrEqual(4);
      for (const l of i.lines) expect(l.text.length, i.id).toBeLessThanOrEqual(90);
      if (i.poi !== 'lucas') expect(pontos.has(i.poi), i.id).toBe(true);
    }
  });

  it('ids únicos e a palavra "mudar" só aparece em falas de queda', () => {
    expect(new Set(INTERACTIONS.map((i) => i.id)).size).toBe(INTERACTIONS.length);
    for (const i of INTERACTIONS) {
      if (i.tag !== 'queda') for (const l of i.lines) expect(l.text.toLowerCase(), i.id).not.toContain('mudar');
    }
  });

  it('há pelo menos uma interação de incerteza (queda) em cada fase', () => {
    for (const ato of [0, 1, 2, 3, 4, 5, 6]) {
      const pontos = POIS.filter((p) => p.acts.includes(ato)).map((p) => p.id);
      expect(INTERACTIONS.some((i) => i.tag === 'queda' && pontos.includes(i.poi)), `fase ${ato + 1}`).toBe(true);
    }
  });
});

describe('disparo das interações', () => {
  it('duas pessoas perto do sofá começam uma conversa de respiro', () => {
    const w = cena(['felipe', 'mauro']);
    passos(w, 25);
    expect(w.interactions.dialogue?.id).toBe('sofa-felipe-mauro');
  });

  it('uma pessoa sozinha não conversa', () => {
    const w = cena(['felipe']);
    passos(w, 40);
    expect(w.interactions.dialogue).toBeNull();
  });

  it('longe do ponto (mais de 4 tiles) não dispara', () => {
    const w = cena(['felipe', 'mauro']);
    for (const p of w.players) p.x = p.prevX = SOFA.x + 200;
    passos(w, 40);
    expect(w.interactions.dialogue).toBeNull();
  });

  it('inimigo a menos de 3 tiles bloqueia', () => {
    const w = cena(['felipe', 'mauro']);
    spawnEnemy(w, COMUNS[0]!, w.players[0]!.x + 20, w.players[0]!.y);
    passos(w, 1);
    expect(candidatas(w)).toHaveLength(0);
  });

  it('a tag respeita o ciclo emocional: queda só durante queda', () => {
    const w = cena(['melissa', 'thayssa']);
    passos(w, 25);
    // Respiro: a conversa de queda (Melissa + Thayssa) não pode disparar.
    expect(candidatas(w).every((c) => c.inter.tag !== 'queda')).toBe(true);
    w.mood = 'queda';
    expect(candidatas(w).some((c) => c.inter.id === 'sofa-melissa-thayssa')).toBe(true);
  });

  it('cada interação aparece uma vez por partida (a menos que a opção deixe repetir)', () => {
    const w = cena(['felipe', 'mauro']);
    passos(w, 25);
    expect(w.interactions.used).toContain('sofa-felipe-mauro');
    expect(candidatas(w).some((c) => c.inter.id === 'sofa-felipe-mauro')).toBe(false);
    const r = cena(['felipe', 'mauro'], true);
    passos(r, 25);
    expect(candidatas(r).some((c) => c.inter.id === 'sofa-felipe-mauro')).toBe(true);
  });

  it('cooldown de 90 s por par, e a conversa termina sozinha', () => {
    const w = cena(['felipe', 'mauro'], true);
    passos(w, 25);
    const total = w.interactions.dialogue!.lines.length;
    // Deixa todas as linhas passarem.
    passos(w, Math.ceil(total * 5 * 60));
    expect(w.interactions.dialogue).toBeNull();
    // Logo depois, o par está em cooldown.
    expect(candidatas(w)).toHaveLength(0);
    // Depois de 90 s, volta a poder conversar.
    w.tick += 91 * 60;
    expect(candidatas(w).length).toBeGreaterThan(0);
  });

  it('pular avança as linhas e encerra a conversa', () => {
    const w = cena(['felipe', 'mauro']);
    passos(w, 25);
    const d = w.interactions.dialogue!;
    for (let i = 0; i < d.lines.length; i++) skipDialogue(w);
    expect(w.interactions.dialogue).toBeNull();
  });

  it('as falas são de quem tem o papel: "a" é o primeiro personagem da interação', () => {
    const w = cena(['mauro', 'felipe']); // ordem invertida de propósito
    passos(w, 25);
    const d = w.interactions.dialogue!;
    expect(w.players[d.lines[0]!.slot]!.characterId).toBe('felipe'); // "Você ainda tá pensando?"
    expect(w.players[d.lines[1]!.slot]!.characterId).toBe('mauro');
  });

  it('o tempo de cada linha é razoável', () => {
    expect(lineSeconds('Oi.')).toBeGreaterThanOrEqual(2.2);
    expect(lineSeconds('x'.repeat(90))).toBeLessThanOrEqual(5);
  });
});
