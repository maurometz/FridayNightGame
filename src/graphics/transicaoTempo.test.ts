import { describe, expect, it } from 'vitest';
import { TRANSICAO_MEIO, TRANSICAO_QUADROS } from '../combat/run';
import { fatorTransicao } from './transicaoTempo';

describe('Vórtice do Tempo: curva da animação', () => {
  it('começa e termina com o mundo normal e tem o pico no instante da troca de fase', () => {
    for (const t of [0, TRANSICAO_QUADROS]) {
      const f = fatorTransicao(t);
      expect(f.escala).toBeCloseTo(1, 5);
      expect(f.rot).toBeCloseTo(0, 5);
      expect(f.brancura).toBe(0);
    }
    const meio = fatorTransicao(TRANSICAO_MEIO);
    expect(meio.k).toBeCloseTo(1, 5);
    expect(meio.brancura).toBeCloseTo(1, 5); // tela branca quando a arena toma o lugar da igreja
    expect(meio.escala).toBeLessThan(0.4);
    expect(meio.rot).toBeGreaterThan(2);
  });

  it('o mundo encolhe até o meio e volta, sem saltos', () => {
    let anterior = fatorTransicao(0).escala;
    for (let t = 1; t <= TRANSICAO_MEIO; t++) {
      const e = fatorTransicao(t).escala;
      expect(e).toBeLessThanOrEqual(anterior + 1e-9);
      expect(anterior - e).toBeLessThan(0.05);
      anterior = e;
    }
    for (let t = TRANSICAO_MEIO + 1; t <= TRANSICAO_QUADROS; t++) {
      const e = fatorTransicao(t).escala;
      expect(e).toBeGreaterThanOrEqual(anterior - 1e-9);
      expect(e - anterior).toBeLessThan(0.05);
      anterior = e;
    }
  });

  it('a transição dura cerca de 4 segundos, com a troca bem no meio', () => {
    expect(TRANSICAO_QUADROS / 60).toBeGreaterThan(3);
    expect(TRANSICAO_QUADROS / 60).toBeLessThan(6);
    expect(TRANSICAO_MEIO * 2).toBe(TRANSICAO_QUADROS);
  });
});
