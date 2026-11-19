import { MAX_LEVEL, XP_BASE, XP_PER_LEVEL } from '../data/balance';

/** XP necessário para sair do nível `level` e ir ao seguinte: base + porNivel * nível. */
export function xpToNext(level: number): number {
  return XP_BASE + XP_PER_LEVEL * level;
}

/** XP total acumulado do nível 1 até chegar ao nível máximo. */
export function totalXpToMaxLevel(): number {
  let sum = 0;
  for (let l = 1; l < MAX_LEVEL; l++) sum += xpToNext(l);
  return sum;
}
