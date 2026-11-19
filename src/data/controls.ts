// Mapeamentos padrão de teclado (GDD A.12). Remapeáveis na Fase 7.
// Usamos KeyboardEvent.code, que não depende do layout do teclado.

export interface KeyMap {
  readonly up: string;
  readonly down: string;
  readonly left: string;
  readonly right: string;
  readonly action: string;
  readonly ultimate: string;
  /** Escolher a carta 1, 2 ou 3 na tela de nível, e rerolar. (Shift + a tecla da carta bane.) */
  readonly card1: string;
  readonly card2: string;
  readonly card3: string;
  readonly reroll: string;
}

// Nenhuma tecla padrão depende do teclado numérico (muitos notebooks não têm).
export const DEFAULT_KEYMAPS: readonly KeyMap[] = [
  // P1
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'KeyF', ultimate: 'KeyG', card1: 'Digit1', card2: 'Digit2', card3: 'Digit3', reroll: 'KeyR' },
  // P2
  {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    action: 'Comma',
    ultimate: 'Period',
    card1: 'Digit4',
    card2: 'Digit5',
    card3: 'Digit6',
    reroll: 'Digit7',
  },
];

// ---- Co-op local: de 2 a 5 jogadores, cada um com um dispositivo próprio ----

/** Dispositivo de entrada de um jogador do co-op local. */
export type DeviceId = 'teclado1' | 'teclado2' | 'controle1' | 'controle2' | 'controle3' | 'controle4';

export const DEVICES: readonly DeviceId[] = ['teclado1', 'teclado2', 'controle1', 'controle2', 'controle3', 'controle4'];

export const DEVICE_LABEL: Readonly<Record<DeviceId, string>> = {
  teclado1: 'Teclado 1 (WASD)',
  teclado2: 'Teclado 2 (setas)',
  controle1: 'Controle 1',
  controle2: 'Controle 2',
  controle3: 'Controle 3',
  controle4: 'Controle 4',
};

/** Máximo de jogadores no mesmo computador (GDD: 2 a 5). */
export const MAX_LOCAL_PLAYERS = 5;

/** Índice do controle na Gamepad API, ou -1 se o dispositivo é um teclado. */
export function indiceDoControle(d: DeviceId): number {
  return d.startsWith('controle') ? Number(d.slice(-1)) - 1 : -1;
}

/** Dispositivos padrão por ordem de jogador: dois teclados e depois os controles. */
export function dispositivosPadrao(n: number): DeviceId[] {
  return DEVICES.slice(0, Math.min(n, DEVICES.length));
}

/** Teclas de escolher carta de um dispositivo (vêm do mapa de teclas remapeável). Controles usam A/B/X/Y e não têm teclas. */
export function cartasDoDispositivo(d: DeviceId, keymaps: readonly KeyMap[]): { escolher: readonly string[]; rerolar: string | null } {
  const m = d === 'teclado1' ? keymaps[0] : d === 'teclado2' ? keymaps[1] : undefined;
  if (!m) return { escolher: [], rerolar: null };
  return { escolher: [m.card1, m.card2, m.card3], rerolar: m.reroll };
}
