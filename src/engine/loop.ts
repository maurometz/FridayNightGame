import { STEP_MS } from '../data/balance';

/** Limite de tempo acumulado por quadro, para evitar a "espiral da morte" após uma aba em segundo plano. */
export const MAX_FRAME_MS = 250;

export interface Advance {
  /** Quantos passos fixos de simulação executar. */
  readonly steps: number;
  /** Tempo restante no acumulador, em ms (sempre menor que STEP_MS). */
  readonly acc: number;
}

/** Função pura: consome o tempo de um quadro e diz quantos passos fixos rodar. */
export function advanceAccumulator(acc: number, frameMs: number, stepMs: number = STEP_MS): Advance {
  let total = acc + Math.min(Math.max(frameMs, 0), MAX_FRAME_MS);
  let steps = 0;
  while (total >= stepMs) {
    total -= stepMs;
    steps++;
  }
  return { steps, acc: total };
}

export interface LoopCallbacks {
  /** Um passo de simulação a 60 Hz. */
  update(): void;
  /** Desenho. `alpha` (0 a 1) é a fração do passo atual, para interpolação. */
  render(alpha: number): void;
}

/** Game loop com simulação em passo fixo e renderização desacoplada. */
export class GameLoop {
  private acc = 0;
  private last = 0;
  private rafId = 0;
  private running = false;

  constructor(private readonly cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const adv = advanceAccumulator(this.acc, now - this.last);
    this.last = now;
    this.acc = adv.acc;
    for (let i = 0; i < adv.steps; i++) this.cb.update();
    this.cb.render(this.acc / STEP_MS);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
