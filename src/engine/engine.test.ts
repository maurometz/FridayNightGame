import { describe, expect, it } from 'vitest';
import { BASE_SPEED_PX_PER_S, STEP_MS } from '../data/balance';
import { KeyboardInput, KeyboardState, NO_INPUT } from './input';
import { advanceAccumulator, MAX_FRAME_MS } from './loop';
import { Rng } from './rng';
import { fitWindow, integerScale } from './scale';
import { createWorld, normalizeMove, stepWorld } from './world';
import { DEFAULT_KEYMAPS } from '../data/controls';

describe('advanceAccumulator', () => {
  it('roda 1 passo por 16,67 ms e guarda o resto', () => {
    const r = advanceAccumulator(0, STEP_MS + 2);
    expect(r.steps).toBe(1);
    expect(r.acc).toBeCloseTo(2, 5);
  });

  it('acumula quadros curtos até completar um passo', () => {
    let acc = 0;
    let steps = 0;
    for (let i = 0; i < 10; i++) {
      const r = advanceAccumulator(acc, 6);
      acc = r.acc;
      steps += r.steps;
    }
    // 60 ms / 16,67 ms = 3,6 passos, então 3 passos e sobra o resto
    expect(steps).toBe(3);
    expect(acc).toBeCloseTo(60 - 3 * STEP_MS, 5);
  });

  it('limita quadros muito longos', () => {
    const r = advanceAccumulator(0, 10_000);
    expect(r.steps).toBeLessThanOrEqual(Math.ceil(MAX_FRAME_MS / STEP_MS));
  });

  it('ignora tempo negativo', () => {
    expect(advanceAccumulator(0, -50).steps).toBe(0);
  });
});

describe('fitWindow (tela dinâmica)', () => {
  it('usa escala inteira e ocupa a janela quase toda', () => {
    expect(fitWindow(1920, 1080)).toEqual({ scale: 4, w: 480, h: 270 });
    expect(fitWindow(1600, 900)).toEqual({ scale: 3, w: 533, h: 300 });
    expect(fitWindow(2560, 1440)).toEqual({ scale: 5, w: 512, h: 288 });
  });
  it('limita a largura a 21:9', () => {
    const f = fitWindow(3440, 600);
    expect(f.w / f.h).toBeLessThanOrEqual(21 / 9 + 0.01);
  });
  it('janelas pequenas ainda mostram pelo menos 320x180', () => {
    const f = fitWindow(800, 400);
    expect(f.w).toBeGreaterThanOrEqual(320);
    expect(f.h).toBeGreaterThanOrEqual(180);
  });
});

describe('integerScale', () => {
  it('usa a maior escala inteira que cabe', () => {
    expect(integerScale(1920, 1080)).toBe(4);
    expect(integerScale(1280, 720)).toBe(2);
    expect(integerScale(960, 540)).toBe(2);
  });

  it('nunca é menor que 1', () => {
    expect(integerScale(200, 100)).toBe(1);
  });
});

describe('Rng', () => {
  it('é determinístico para a mesma seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it('seeds diferentes dão sequências diferentes', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('int respeita os limites', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe('movimento', () => {
  it('normaliza a diagonal', () => {
    const v = normalizeMove(1, 1);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 5);
  });

  it('Felipe anda a velocidade base em 1 s (60 passos)', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    const x0 = w.players[0]!.x;
    for (let i = 0; i < 60; i++) stepWorld(w, [{ ...NO_INPUT, moveX: 1 }]);
    expect(w.players[0]!.x - x0).toBeCloseTo(BASE_SPEED_PX_PER_S, 3);
  });

  it('diagonal não é mais rápida que reta', () => {
    const a = createWorld(['felipe'], { initialChoice: false });
    const b = createWorld(['felipe'], { initialChoice: false });
    for (let i = 0; i < 60; i++) {
      stepWorld(a, [{ ...NO_INPUT, moveX: 1 }]);
      stepWorld(b, [{ ...NO_INPUT, moveX: 1, moveY: 1 }]);
    }
    const da = Math.hypot(a.players[0]!.x, a.players[0]!.y);
    const db = Math.hypot(b.players[0]!.x, b.players[0]!.y);
    expect(db).toBeCloseTo(da, 3);
  });

  it('suporta vários jogadores com entradas independentes', () => {
    const w = createWorld(['felipe', 'thaisa'], { initialChoice: false });
    const y0 = w.players.map((p) => p.y);
    stepWorld(w, [{ ...NO_INPUT, moveY: -1 }, NO_INPUT]);
    expect(w.players[0]!.y).toBeLessThan(y0[0]!);
    expect(w.players[1]!.y).toBe(y0[1]);
  });

  it('jogador sem entrada fica parado', () => {
    const w = createWorld(['felipe'], { initialChoice: false });
    stepWorld(w, []);
    expect(w.players[0]!.moving).toBe(false);
  });
});

describe('KeyboardState: toques rápidos não se perdem', () => {
  /** Janela falsa com addEventListener, para testar sem navegador. */
  function janela(): { win: Window; tecla: (tipo: 'keydown' | 'keyup', code: string) => void } {
    const handlers: Record<string, ((e: { code: string; preventDefault(): void }) => void)[]> = {};
    const win = {
      addEventListener: (tipo: string, fn: (e: { code: string; preventDefault(): void }) => void) => {
        (handlers[tipo] ??= []).push(fn);
      },
    } as unknown as Window;
    const tecla = (tipo: 'keydown' | 'keyup', code: string): void => {
      for (const fn of handlers[tipo] ?? []) fn({ code, preventDefault: () => undefined });
    };
    return { win, tecla };
  }

  it('uma tecla apertada e solta entre dois passos ainda é vista no passo seguinte', () => {
    const { win, tecla } = janela();
    const kb = new KeyboardState(win);
    tecla('keydown', 'KeyG');
    tecla('keyup', 'KeyG');
    expect(kb.down.has('KeyG')).toBe(false);
    expect(kb.has('KeyG')).toBe(true);
    kb.endStep();
    expect(kb.has('KeyG')).toBe(false); // visto uma vez só
  });

  it('segurar continua valendo até soltar', () => {
    const { win, tecla } = janela();
    const kb = new KeyboardState(win);
    tecla('keydown', 'KeyW');
    kb.endStep();
    expect(kb.has('KeyW')).toBe(true);
    tecla('keyup', 'KeyW');
    expect(kb.has('KeyW')).toBe(false);
  });

  it('o toque vira Ultimate no KeyboardInput', () => {
    const { win, tecla } = janela();
    const kb = new KeyboardState(win);
    tecla('keydown', 'KeyG');
    tecla('keyup', 'KeyG');
    expect(new KeyboardInput(kb, DEFAULT_KEYMAPS[0]!).poll().ultimate).toBe(true);
  });
});

describe('KeyboardInput', () => {
  it('P1 usa WASD e P2 usa setas, sem interferência', () => {
    const keys = new Set<string>(['KeyD', 'ArrowUp']);
    const p1 = new KeyboardInput(keys, DEFAULT_KEYMAPS[0]!).poll();
    const p2 = new KeyboardInput(keys, DEFAULT_KEYMAPS[1]!).poll();
    expect(p1.moveX).toBe(1);
    expect(p1.moveY).toBe(0);
    expect(p2.moveX).toBe(0);
    expect(p2.moveY).toBe(-1);
  });

  it('teclas opostas se anulam', () => {
    const keys = new Set<string>(['KeyA', 'KeyD']);
    expect(new KeyboardInput(keys, DEFAULT_KEYMAPS[0]!).poll().moveX).toBe(0);
  });
});

describe('co-op local: câmera compartilhada', () => {
  it('com a coleira ligada, os jogadores vivos não se afastam mais do que cabe na tela', async () => {
    const { createWorld, stepWorld } = await import('./world');
    const { LOGICAL_WIDTH } = await import('../data/balance');
    const w = createWorld(['felipe', 'mauro'], { noSpawn: true, noBosses: true, initialChoice: false, coopLeash: true });
    const direita = { moveX: 1, moveY: 0, action: false, ultimate: false };
    const parado = { moveX: 0, moveY: 0, action: false, ultimate: false };
    for (let t = 0; t < 600; t++) stepWorld(w, [direita, parado]);
    expect(Math.abs(w.players[0]!.x - w.players[1]!.x)).toBeLessThanOrEqual(LOGICAL_WIDTH);
    expect(w.players[0]!.x).toBeGreaterThan(w.players[1]!.x);
  });

  it('sem a coleira (solo e IA), nada limita a distância', async () => {
    const { createWorld, stepWorld } = await import('./world');
    const w = createWorld(['felipe', 'mauro'], { noSpawn: true, noBosses: true, initialChoice: false });
    const direita = { moveX: 1, moveY: 0, action: false, ultimate: false };
    const parado = { moveX: 0, moveY: 0, action: false, ultimate: false };
    for (let t = 0; t < 600; t++) stepWorld(w, [direita, parado]);
    expect(w.players[0]!.x - w.players[1]!.x).toBeGreaterThan(300);
  });

  it('um jogador caído não prende o vivo: a coleira só vale entre os vivos', async () => {
    const { createWorld, stepWorld } = await import('./world');
    const w = createWorld(['felipe', 'mauro'], { noSpawn: true, noBosses: true, initialChoice: false, coopLeash: true });
    w.players[1]!.hp = 0;
    const direita = { moveX: 1, moveY: 0, action: false, ultimate: false };
    for (let t = 0; t < 600; t++) stepWorld(w, [direita, { moveX: 0, moveY: 0, action: false, ultimate: false }]);
    expect(w.players[0]!.x).toBeGreaterThan(300);
  });
});

describe('co-op local com 5 jogadores', () => {
  it('cinco jogadores vivos ficam todos dentro de uma tela uns dos outros', async () => {
    const { createWorld, stepWorld } = await import('./world');
    const { LOGICAL_WIDTH, LOGICAL_HEIGHT } = await import('../data/balance');
    const w = createWorld(['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'], { noSpawn: true, noBosses: true, initialChoice: false, coopLeash: true });
    const parado = { moveX: 0, moveY: 0, action: false, ultimate: false };
    const entradas = [
      { ...parado, moveX: 1 },
      { ...parado, moveX: -1 },
      { ...parado, moveY: 1 },
      { ...parado, moveY: -1 },
      parado,
    ];
    for (let t = 0; t < 900; t++) stepWorld(w, entradas);
    const xs = w.players.map((p) => p.x);
    const ys = w.players.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(LOGICAL_WIDTH);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(LOGICAL_HEIGHT);
  });
});

describe('dispositivos do co-op local', () => {
  it('os dispositivos padrão são únicos e começam pelos dois teclados', async () => {
    const { dispositivosPadrao, indiceDoControle, cartasDoDispositivo, MAX_LOCAL_PLAYERS, DEFAULT_KEYMAPS } = await import('../data/controls');
    const d = dispositivosPadrao(MAX_LOCAL_PLAYERS);
    expect(d).toEqual(['teclado1', 'teclado2', 'controle1', 'controle2', 'controle3']);
    expect(indiceDoControle('teclado2')).toBe(-1);
    expect(indiceDoControle('controle3')).toBe(2);
    expect(cartasDoDispositivo('teclado2', DEFAULT_KEYMAPS).escolher).toEqual(['Digit4', 'Digit5', 'Digit6']);
    expect(cartasDoDispositivo('teclado1', DEFAULT_KEYMAPS).escolher).toEqual(['Digit1', 'Digit2', 'Digit3']);
    expect(cartasDoDispositivo('controle1', DEFAULT_KEYMAPS).escolher).toEqual([]);
  });

  it('nenhuma tecla padrão usa o teclado numérico e nenhuma se repete entre os jogadores', async () => {
    const { DEFAULT_KEYMAPS } = await import('../data/controls');
    const todas = DEFAULT_KEYMAPS.flatMap((m) => Object.values(m));
    expect(todas.some((c) => c.startsWith('Numpad'))).toBe(false);
    expect(new Set(todas).size).toBe(todas.length);
  });
});
