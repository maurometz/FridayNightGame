import { describe, expect, it } from 'vitest';
import { PHASE_TUNING } from '../data/acts';
import { MOOD_FADE_S, PHASE_MOOD_BEATS } from '../data/emotion';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld } from '../engine/world';
import { moodAt, stepBlend, targetMood } from './emotion';

/** Mundo vazio, sem inimigos nem chefes, só para ver o ciclo emocional andar. */
function vazio(): ReturnType<typeof createWorld> {
  return createWorld(['felipe'], { initialChoice: false, noSpawn: true, noBosses: true });
}

function avancar(w: ReturnType<typeof vazio>, segundos: number): void {
  const passos = Math.round(segundos * 60);
  for (let i = 0; i < passos; i++) stepWorld(w, [NO_INPUT]);
}

describe('Ciclo emocional: beats por fase (GDD A.8)', () => {
  it('as quedas e os respiros disparam nos beats de cada fase', () => {
    const esperado: [number, number, 'respiro' | 'queda'][] = [
      [0, 0, 'respiro'], // fase 1 abre em respiro
      [0, 0.49, 'respiro'],
      [0, 0.5, 'queda'], // caixas de papelão
      [3, 0, 'queda'], // cinema, relógio parado
      [3, 0.7, 'respiro'], // RM derrotado
      [6, 0, 'queda'], // igreja, o último evento
      [6, 0.5, 'respiro'], // salão cheio
      [6, 0.95, 'queda'], // o relógio para
      [7, 0, 'queda'], // Arena do Tempo
      [7, 0.9, 'respiro'], // sobrevive ao Tempo
    ];
    for (const [fase, frac, mood] of esperado) expect(moodAt(fase, frac), `fase ${fase + 1} em ${frac}`).toBe(mood);
  });

  it('todas as fases têm beats, em ordem, e há quedas e respiros na campanha', () => {
    for (let i = 0; i < 8; i++) {
      const chave = i === 7 ? 'extra' : i + 1;
      const beats = PHASE_MOOD_BEATS.filter((b) => b.fase === chave);
      expect(beats.length, `fase ${chave}`).toBeGreaterThan(0);
      for (let k = 1; k < beats.length; k++) expect(beats[k]!.at).toBeGreaterThanOrEqual(beats[k - 1]!.at);
    }
    expect(PHASE_MOOD_BEATS.some((b) => b.mood === 'queda')).toBe(true);
    expect(PHASE_MOOD_BEATS.some((b) => b.mood === 'respiro')).toBe(true);
  });

  it('um evento especial (o relógio que para) sobrepõe os beats', () => {
    expect(targetMood(0, 0, null)).toBe('respiro');
    expect(targetMood(0, 0, { mood: 'queda' })).toBe('queda');
    expect(targetMood(3, 0, { mood: 'respiro' })).toBe('respiro');
  });
});

describe('Ciclo emocional: fade de 3 s, sem corte seco', () => {
  it('a troca completa leva 3 s', () => {
    expect(MOOD_FADE_S).toBe(3);
    let b = 0;
    for (let i = 0; i < 90; i++) b = stepBlend(b, 'queda', 1 / 60);
    expect(b).toBeCloseTo(0.5, 5); // 1,5 s: metade
    for (let i = 0; i < 90; i++) b = stepBlend(b, 'queda', 1 / 60);
    expect(b).toBeCloseTo(1, 5);
  });

  it('nunca passa de 0 nem de 1, e volta no mesmo ritmo', () => {
    let b = 0.99;
    b = stepBlend(b, 'queda', 1);
    expect(b).toBe(1);
    b = stepBlend(b, 'respiro', 1.5);
    expect(b).toBeCloseTo(0.5, 5);
    b = stepBlend(b, 'respiro', 10);
    expect(b).toBe(0);
  });

  it('em nenhum quadro a mistura salta mais que 1/180 (sem corte seco)', () => {
    let b = 0;
    let maior = 0;
    for (let i = 0; i < 400; i++) {
      const novo = stepBlend(b, i < 200 ? 'queda' : 'respiro', 1 / 60);
      maior = Math.max(maior, Math.abs(novo - b));
      b = novo;
    }
    expect(maior).toBeLessThan(1 / 170);
  });

  it('na partida, a queda da fase 1 começa na metade da exploração e a paleta fria chega 3 s depois', () => {
    const w = vazio();
    const meio = PHASE_TUNING[0]!.durationS * 0.5;
    avancar(w, 5);
    expect(w.mood).toBe('respiro');
    expect(w.moodBlend).toBe(0);
    w.tick = Math.round((meio - 1) * 60);
    avancar(w, 2.1);
    expect(w.mood).toBe('queda');
    avancar(w, 0.5);
    expect(w.moodBlend).toBeGreaterThan(0.3);
    expect(w.moodBlend).toBeLessThan(0.8);
    avancar(w, 3);
    expect(w.moodBlend).toBe(1);
  });

  it('um evento especial força a queda e depois volta ao respiro, com fade nos dois sentidos', () => {
    const w = vazio();
    avancar(w, 5);
    w.moodOverride = { mood: 'queda', left: 4 };
    avancar(w, 3.5);
    expect(w.moodBlend).toBeGreaterThan(0.9);
    avancar(w, 1); // acabou o evento
    expect(w.moodOverride).toBeNull();
    avancar(w, 3.2);
    expect(w.moodBlend).toBe(0);
  });
});
