import type { KeyMap } from '../data/controls';

/**
 * Entrada abstrata de um jogador. A simulação só enxerga isto, nunca teclado ou gamepad.
 * No online, é exatamente o que o cliente envia ao host.
 */
export interface PlayerInput {
  /** Eixos em [-1, 1]. */
  readonly moveX: number;
  readonly moveY: number;
  readonly action: boolean;
  readonly ultimate: boolean;
}

export const NO_INPUT: PlayerInput = { moveX: 0, moveY: 0, action: false, ultimate: false };

/** Fonte de entrada de um jogador (teclado, gamepad, IA, rede). */
export interface InputSource {
  poll(): PlayerInput;
}

const GAME_KEYS_PREVENT_DEFAULT = /^(Arrow|Numpad|Space)/;

/** Teclado. Cada instância usa um KeyMap, então P1 e P2 coexistem no mesmo teclado. */
export class KeyboardInput implements InputSource {
  constructor(
    private readonly keys: { has(code: string): boolean },
    private readonly map: KeyMap,
  ) {}

  poll(): PlayerInput {
    const k = this.keys;
    const m = this.map;
    return {
      moveX: (k.has(m.right) ? 1 : 0) - (k.has(m.left) ? 1 : 0),
      moveY: (k.has(m.down) ? 1 : 0) - (k.has(m.up) ? 1 : 0),
      action: k.has(m.action),
      ultimate: k.has(m.ultimate),
    };
  }
}

/**
 * Estado do teclado. Além das teclas seguradas, guarda os toques: uma tecla apertada e solta entre dois
 * passos da simulação (um toque muito rápido) ainda é vista no passo seguinte, em vez de se perder.
 */
export class KeyboardState {
  readonly down = new Set<string>();
  private readonly tapped = new Set<string>();

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      // Digitando num campo de texto (lobby online): a tecla não é do jogo.
      if (typeof HTMLElement !== 'undefined' && e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (GAME_KEYS_PREVENT_DEFAULT.test(e.code)) e.preventDefault();
      this.down.add(e.code);
      this.tapped.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    // Perder o foco não pode deixar teclas "presas".
    target.addEventListener('blur', () => {
      this.down.clear();
      this.tapped.clear();
    });
  }

  /** A tecla está segurada ou foi tocada desde o último passo? */
  has(code: string): boolean {
    return this.down.has(code) || this.tapped.has(code);
  }

  /** Chame depois de ler as entradas de cada passo: os toques já foram vistos. */
  endStep(): void {
    this.tapped.clear();
  }
}

/** Rastreia as teclas pressionadas, compartilhado por todos os KeyboardInput. */
export function trackKeyboard(target: Window): KeyboardState {
  return new KeyboardState(target);
}

/** Zona morta do analógico. */
const STICK_DEADZONE = 0.3;

/**
 * Controle (Gamepad API, mapeamento "standard"). Analógico esquerdo ou direcional para andar,
 * A / X para a ação e B / Y / gatilhos para a Ultimate. Sem controle conectado, devolve NO_INPUT.
 */
export class GamepadInput implements InputSource {
  constructor(private readonly index: number) {}

  private pad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
    return navigator.getGamepads()[this.index] ?? null;
  }

  poll(): PlayerInput {
    const g = this.pad();
    if (!g) return NO_INPUT;
    const b = (i: number): boolean => g.buttons[i]?.pressed === true;
    let x = g.axes[0] ?? 0;
    let y = g.axes[1] ?? 0;
    if (Math.abs(x) < STICK_DEADZONE) x = 0;
    if (Math.abs(y) < STICK_DEADZONE) y = 0;
    if (b(14)) x = -1;
    if (b(15)) x = 1;
    if (b(12)) y = -1;
    if (b(13)) y = 1;
    return { moveX: x, moveY: y, action: b(0) || b(2), ultimate: b(1) || b(3) || b(4) || b(5) || b(6) || b(7) };
  }
}

/** Soma várias fontes de entrada de um mesmo jogador (por exemplo, teclado e controle). */
export class MergedInput implements InputSource {
  private readonly sources: readonly InputSource[];
  constructor(...sources: InputSource[]) {
    this.sources = sources;
  }

  poll(): PlayerInput {
    let moveX = 0;
    let moveY = 0;
    let action = false;
    let ultimate = false;
    for (const s of this.sources) {
      const i = s.poll();
      moveX += i.moveX;
      moveY += i.moveY;
      action = action || i.action;
      ultimate = ultimate || i.ultimate;
    }
    return { moveX: Math.max(-1, Math.min(1, moveX)), moveY: Math.max(-1, Math.min(1, moveY)), action, ultimate };
  }
}

/** Botões que escolhem cartas no controle: A, B, X = cartas 1, 2, 3; Y = rerolar. Devolve o toque (borda) deste passo. */
export class GamepadCardKeys {
  private prev: boolean[] = [false, false, false, false];

  constructor(private readonly index: number) {}

  /** `pick` é o índice da carta tocada (0 a 2), `reroll` se Y foi tocado. */
  poll(): { pick: number | null; reroll: boolean } {
    const g = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads()[this.index] : null;
    const now = [0, 1, 2, 3].map((i) => g?.buttons[i]?.pressed === true);
    let pick: number | null = null;
    for (let i = 0; i < 3; i++) if (now[i] && !this.prev[i]) pick = i;
    const reroll = now[3]! && !this.prev[3]!;
    this.prev = now;
    return { pick, reroll };
  }
}
