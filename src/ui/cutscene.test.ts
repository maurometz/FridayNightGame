import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../engine/input';
import { createWorld, stepWorld } from '../engine/world';
import {
  ESPERA_AUTO_BASE,
  completarLinha,
  esperaAuto,
  interagir,
  letrasVisiveis,
  linhaCompleta,
  matizDoRetrato,
  quadrosParaCompletar,
  tickCutscene,
  type CutsceneState,
} from './cutscene';
import { cutsceneBotoes, dentro } from './cutsceneView';

const cena = (): CutsceneState => ({
  lines: [
    { who: 'Lucas', text: 'Primeira fala da cena.', retrato: 'lucas' },
    { who: 'Tamires', text: 'Segunda.', retrato: 'tamires' },
    { who: '', text: 'Narração final.' },
  ],
  index: 0,
});

describe('Cutscene: texto animado e avanço por clique', () => {
  it('o texto aparece aos poucos e fica completo no tempo calculado', () => {
    const cs = cena();
    expect(letrasVisiveis(cs)).toBe(0);
    expect(linhaCompleta(cs)).toBe(false);
    for (let i = 0; i < 10; i++) tickCutscene(cs, false);
    expect(letrasVisiveis(cs)).toBeGreaterThan(0);
    expect(linhaCompleta(cs)).toBe(false);
    for (let i = 0; i < quadrosParaCompletar(cs.lines[0]!.text); i++) tickCutscene(cs, false);
    expect(linhaCompleta(cs)).toBe(true);
  });

  it('o primeiro clique completa o texto; o segundo passa para a próxima fala; a última encerra', () => {
    const cs = cena();
    expect(interagir(cs)).toBe('completou');
    expect(cs.index).toBe(0);
    expect(linhaCompleta(cs)).toBe(true);
    expect(interagir(cs)).toBe('proxima');
    expect(cs.index).toBe(1);
    expect(letrasVisiveis(cs)).toBe(0); // a nova fala recomeça do zero
    interagir(cs);
    expect(interagir(cs)).toBe('proxima');
    interagir(cs);
    expect(interagir(cs)).toBe('fim');
  });

  it('sem o modo automático, a cena espera o clique para sempre', () => {
    const cs = cena();
    for (let i = 0; i < 5000; i++) tickCutscene(cs, false);
    expect(cs.index).toBe(0);
    expect(linhaCompleta(cs)).toBe(true);
  });

  it('modo automático: espera o texto completo mais um tempo e passa sozinho até o fim', () => {
    const cs = cena();
    const quadros0 = quadrosParaCompletar(cs.lines[0]!.text) + esperaAuto(cs.lines[0]!.text);
    for (let i = 0; i < quadros0 - 1; i++) expect(tickCutscene(cs, true)).toBeNull();
    expect(cs.index).toBe(0);
    tickCutscene(cs, true);
    expect(cs.index).toBe(1);
    let fim = false;
    for (let i = 0; i < 20000 && !fim; i++) fim = tickCutscene(cs, true) === 'fim';
    expect(fim).toBe(true);
    expect(esperaAuto('')).toBe(ESPERA_AUTO_BASE);
  });

  it('o modo automático dá mais tempo a falas mais longas', () => {
    expect(esperaAuto('x'.repeat(100))).toBeGreaterThan(esperaAuto('x'.repeat(10)));
  });

  it('as barras e o escurecimento entram com o tempo (quadros desde a abertura)', () => {
    const cs = cena();
    for (let i = 0; i < 7; i++) tickCutscene(cs, false);
    expect(cs.open).toBe(7);
  });

  it('completarLinha mostra tudo de uma vez', () => {
    const cs = cena();
    completarLinha(cs);
    expect(letrasVisiveis(cs)).toBeGreaterThanOrEqual(cs.lines[0]!.text.length);
  });
});

describe('Cutscene: botões e retrato genérico', () => {
  it('os botões AUTO e PULAR não se sobrepõem e ficam na faixa de cima', () => {
    const b = cutsceneBotoes();
    expect(b.auto.x + b.auto.w).toBeLessThanOrEqual(b.pular.x);
    expect(dentro(b.pular, b.pular.x + 2, b.pular.y + 2)).toBe(true);
    expect(dentro(b.pular, b.auto.x + 2, b.auto.y + 2)).toBe(false);
    expect(b.auto.y + b.auto.h).toBeLessThan(30);
  });

  it('o retrato genérico tem cor estável por personagem e varia entre eles', () => {
    expect(matizDoRetrato('tamires')).toBe(matizDoRetrato('tamires'));
    const cores = new Set(['tamires', 'rebeca', 'crazy', 'debora', 'francis', 'fabi'].map(matizDoRetrato));
    expect(cores.size).toBeGreaterThan(3);
    expect(matizDoRetrato('x')).toBeGreaterThanOrEqual(0);
    expect(matizDoRetrato('x')).toBeLessThan(360);
  });
});

describe('Cutscene: o jogo atrás fica parado', () => {
  it('com a cutscene aberta nada anda: nem o tempo, nem os inimigos, nem os jogadores', () => {
    const w = createWorld(['felipe'], { initialChoice: false, noSpawn: false, noBosses: true, seed: 8 });
    w.cutscene = cena();
    const t = w.tick;
    const x = w.players[0]!.x;
    for (let i = 0; i < 300; i++) {
      stepWorld(w, [{ ...NO_INPUT, moveX: 1 }]);
      tickCutscene(w.cutscene!, false);
    }
    expect(w.tick).toBe(t);
    expect(w.players[0]!.x).toBe(x);
    expect(w.enemies.size).toBe(0);
    w.cutscene = null;
    stepWorld(w, [NO_INPUT]);
    expect(w.tick).toBe(t + 1);
  });
});
