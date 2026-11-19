// Núcleo do lockstep do co-op online (sem rede, sem DOM, sem mundo): só o relógio e as filas de entrada.
//
// Todo navegador simula a partida inteira. A simulação é determinística (RNG com seed, passo fixo), então basta
// todos os navegadores aplicarem as MESMAS entradas nos MESMOS passos. Cada jogador manda a entrada do passo
// `t + delay` quando a simulação está no passo `t`; um passo só roda quando chegaram as entradas de todos.

import { NO_INPUT, type PlayerInput } from '../engine/input';

/** Ações fora do passo da simulação (cartas, cutscenes...). Entram no quadro de um passo e valem para todos ao mesmo tempo. */
export type NetCmd =
  | { c: 'pick'; i: number }
  | { c: 'reroll' }
  | { c: 'ban'; i: number }
  | { c: 'advice'; i: number }
  | { c: 'cut'; k: 'next' | 'skip' | 'auto' }
  | { c: 'trans' }
  | { c: 'dlg' };

/** Quadro de entrada em fio: [passo, moveX*100, moveY*100, bits (1 = ação, 2 = ultimate), comandos?]. */
export type WireFrame = [number, number, number, number, NetCmd[]?];

/** Quadros de espera (15 s a 60 Hz) em que o personagem de quem saiu fica parado antes de a IA assumir. */
export const PARK_TICKS = 15 * 60;

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

/** Entrada -> quadro de fio. O jogador local também usa a versão quantizada, para todos verem o mesmo número. */
export function toFrame(tick: number, input: PlayerInput, cmds: NetCmd[]): WireFrame {
  const f: WireFrame = [tick, Math.round(clamp1(input.moveX) * 100), Math.round(clamp1(input.moveY) * 100), (input.action ? 1 : 0) | (input.ultimate ? 2 : 0)];
  if (cmds.length > 0) f.push(cmds);
  return f;
}

export function fromFrame(f: WireFrame): PlayerInput {
  return { moveX: f[1] / 100, moveY: f[2] / 100, action: (f[3] & 1) !== 0, ultimate: (f[3] & 2) !== 0 };
}

export interface LockstepOptions {
  /** Quantos jogadores humanos a partida tem (slots 0 a n-1). */
  slots: number;
  /** Slot deste navegador. */
  me: number;
  /** Atraso de entrada, em passos (4 a 10). */
  delay: number;
  /** Lê a entrada do jogador local agora. */
  poll: () => PlayerInput;
  /** Envia quadros aos outros. */
  send: (frames: WireFrame[]) => void;
}

export interface NetStep {
  /** Número do passo executado (0, 1, 2...). */
  tick: number;
  /** Entrada de cada slot neste passo (NO_INPUT para quem saiu). */
  inputs: PlayerInput[];
  /** Comandos, na ordem dos slots. */
  cmds: { slot: number; cmd: NetCmd }[];
  /** `gone[s]`: o jogador saiu antes deste passo; `goneFor[s]`: há quantos passos. */
  gone: boolean[];
  goneFor: number[];
}

export class Lockstep {
  /** Próximo passo a executar. */
  tick = 0;
  readonly slots: number;
  readonly me: number;
  readonly delay: number;
  private readonly frames: Map<number, WireFrame>[];
  /** `left[s]`: último passo cuja entrada de `s` chegou antes de ele sair. */
  private readonly left: (number | null)[];
  private nextLocal: number;
  private pending: NetCmd[] = [];
  private outbox: WireFrame[] = [];
  private readonly poll: () => PlayerInput;
  private readonly sendFn: (frames: WireFrame[]) => void;

  constructor(o: LockstepOptions) {
    this.slots = o.slots;
    this.me = o.me;
    this.delay = o.delay;
    this.poll = o.poll;
    this.sendFn = o.send;
    this.frames = Array.from({ length: o.slots }, () => new Map());
    this.left = Array.from({ length: o.slots }, () => null);
    this.nextLocal = o.delay; // os passos 0 a delay-1 são neutros para todos
    this.pump();
  }

  /** Enfileira um comando do jogador local: vai no próximo quadro e vale para todos no mesmo passo. */
  command(cmd: NetCmd): void {
    this.pending.push(cmd);
  }

  /** Quadros que chegaram do jogador `slot`. */
  receive(slot: number, frames: readonly WireFrame[]): void {
    const buf = this.frames[slot];
    if (!buf || slot === this.me) return;
    for (const f of frames) if (Array.isArray(f) && f.length >= 4) buf.set(f[0], f);
  }

  /** O jogador `slot` saiu; `last` é o último passo dele que o servidor repassou. */
  depart(slot: number, last: number): void {
    if (slot === this.me || this.left[slot] !== null || slot < 0 || slot >= this.slots) return;
    this.left[slot] = Math.max(last, this.delay - 1);
  }

  isGone(slot: number, tick = this.tick): boolean {
    const l = this.left[slot];
    return l !== null && l !== undefined && tick > l;
  }

  private has(slot: number, tick: number): boolean {
    return tick < this.delay || this.isGone(slot, tick) || (this.frames[slot]?.has(tick) ?? false);
  }

  /** Dá para executar o próximo passo? */
  ready(): boolean {
    for (let s = 0; s < this.slots; s++) if (!this.has(s, this.tick)) return false;
    return true;
  }

  /** Quem está faltando para o próximo passo (para avisar "esperando fulano"). */
  waitingFor(): number[] {
    const r: number[] = [];
    for (let s = 0; s < this.slots; s++) if (!this.has(s, this.tick)) r.push(s);
    return r;
  }

  /** Gera as entradas locais até `delay` passos à frente. */
  private pump(): void {
    while (this.nextLocal <= this.tick + this.delay) {
      const f = toFrame(this.nextLocal, this.poll(), this.pending);
      this.pending = [];
      this.frames[this.me]!.set(this.nextLocal, f);
      this.outbox.push(f);
      this.nextLocal++;
    }
  }

  /** Executa o próximo passo, se todas as entradas chegaram; senão devolve null. */
  step(): NetStep | null {
    if (!this.ready()) return null;
    const t = this.tick;
    const inputs: PlayerInput[] = [];
    const cmds: { slot: number; cmd: NetCmd }[] = [];
    const gone: boolean[] = [];
    const goneFor: number[] = [];
    for (let s = 0; s < this.slots; s++) {
      const l = this.left[s];
      const sumiu = this.isGone(s, t);
      gone.push(sumiu);
      goneFor.push(sumiu && l !== null && l !== undefined ? t - l - 1 : 0);
      const f = t < this.delay || sumiu ? undefined : this.frames[s]!.get(t);
      inputs.push(f ? fromFrame(f) : NO_INPUT);
      if (f?.[4]) for (const cmd of f[4]) cmds.push({ slot: s, cmd });
      this.frames[s]!.delete(t);
    }
    this.tick++;
    this.pump();
    return { tick: t, inputs, cmds, gone, goneFor };
  }

  /** Manda o que foi gerado desde a última chamada. */
  flush(): void {
    if (this.outbox.length === 0) return;
    const out = this.outbox;
    this.outbox = [];
    this.sendFn(out);
  }
}
