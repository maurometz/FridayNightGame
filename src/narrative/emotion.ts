import { MOOD_FADE_S, PHASE_MOOD_BEATS, type Mood } from '../data/emotion';

/** Chave da fase nos beats: índice 0 a 6 vira fase 1 a 7; índice 7 é a Arena do Tempo. */
function chaveDaFase(index: number): number | 'extra' {
  return index >= 7 ? 'extra' : index + 1;
}

/**
 * Humor de base na fase `index` (0 a 7), em `frac` (0 = início da fase, 1 = fim),
 * pelos beats de PHASE_MOOD_BEATS.
 */
export function moodAt(index: number, frac: number): Mood {
  const chave = chaveDaFase(index);
  let mood: Mood = 'respiro';
  for (const b of PHASE_MOOD_BEATS) {
    if (b.fase !== chave) continue;
    if (b.at <= frac) mood = b.mood;
  }
  return mood;
}

/** Humor que vale agora: o de um evento especial (ex.: o relógio que para), se houver, senão o dos beats. */
export function targetMood(index: number, frac: number, override: { mood: Mood } | null): Mood {
  return override ? override.mood : moodAt(index, frac);
}

/**
 * Mistura entre as paletas: 0 = respiro (quente), 1 = queda (fria).
 * Anda em direção ao alvo de modo que a troca completa leva MOOD_FADE_S (3 s), sem corte seco.
 */
export function stepBlend(blend: number, target: Mood, dt: number): number {
  const goal = target === 'queda' ? 1 : 0;
  const step = dt / MOOD_FADE_S;
  if (blend < goal) return Math.min(goal, blend + step);
  if (blend > goal) return Math.max(goal, blend - step);
  return blend;
}
