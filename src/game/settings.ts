// Opções do jogador (GDD A.12): volumes, acessibilidade, controles remapeados.
// Salvas no localStorage; qualquer falha de leitura ou escrita (janela anônima, armazenamento cheio) é ignorada.

import { DEFAULT_KEYMAPS, type KeyMap } from '../data/controls';

export type EmotionLevel = 'normal' | 'reduzido' | 'desligado';
export type TextSize = 'normal' | 'grande' | 'maior';

/** Modo dev (menu): começar em qualquer fase para testar sem perder tempo. Não é para jogar de verdade. */
export interface DevSettings {
  /** Fase inicial: 1 a 7 (mapas) ou 8 (Arena do Tempo). */
  fase: number;
  /** Segundos de exploração de cada fase até o chefe. 0 = o valor padrão da fase. */
  duracaoS: number;
  invulneravel: boolean;
  /** Multiplicador do dano causado pelos jogadores. */
  danoMul: number;
  /** Mostrar as cutscenes de resgate e de chefe (desligue para testar mais rápido). */
  cutscenes: boolean;
}

export const DEV_DURACOES: readonly number[] = [0, 5, 10, 20, 30, 60, 90, 150];
export const DEV_DANOS: readonly number[] = [1, 2, 5, 10, 50, 100, 1000];

export function defaultDev(): DevSettings {
  return { fase: 1, duracaoS: 0, invulneravel: false, danoMul: 1, cutscenes: true };
}

export interface Settings {
  /** Volumes de 0 a 10 (o áudio chega na Fase 8). */
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reduceShake: boolean;
  reduceFlash: boolean;
  /** Intensidade das paletas do ciclo emocional. */
  emotion: EmotionLevel;
  textSize: TextSize;
  /** Mostrar de novo as interações já vistas na mesma partida. */
  repeatInteractions: boolean;
  /** As cutscenes passam as falas sozinhas (sem precisar clicar). */
  autoCutscene: boolean;
  /** Teclas de P1 e P2. */
  keymaps: KeyMap[];
  /** Modo dev (ver DevSettings). */
  dev: DevSettings;
}

export const KEY_ACTIONS = ['up', 'down', 'left', 'right', 'action', 'ultimate', 'card1', 'card2', 'card3', 'reroll'] as const;
export type KeyAction = (typeof KEY_ACTIONS)[number];

export function defaultSettings(): Settings {
  return {
    musicVolume: 7,
    sfxVolume: 8,
    muted: false,
    reduceShake: false,
    reduceFlash: false,
    emotion: 'normal',
    textSize: 'normal',
    repeatInteractions: false,
    autoCutscene: false,
    keymaps: DEFAULT_KEYMAPS.map((m) => ({ ...m })),
    dev: defaultDev(),
  };
}

/** Escala de intensidade das paletas do ciclo emocional. */
export function emotionScaleOf(level: EmotionLevel): number {
  return level === 'normal' ? 1 : level === 'reduzido' ? 0.5 : 0;
}

/** Altura lógica alvo por tamanho de texto: menor altura = tudo maior na tela. */
export function targetHeightOf(size: TextSize): number {
  return size === 'normal' ? 270 : size === 'grande' ? 216 : 180;
}

const STORAGE_KEY = 'profecia.settings.v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

/** Aceita um objeto qualquer (por exemplo, um JSON antigo ou adulterado) e devolve Settings válidas. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown, f: boolean): boolean => (typeof v === 'boolean' ? v : f);
  const keymaps = d.keymaps.map((def, i) => {
    const saved = Array.isArray(r.keymaps) ? (r.keymaps[i] as Record<string, unknown> | undefined) : undefined;
    const out: Record<string, string> = { ...def };
    if (saved && typeof saved === 'object') {
      for (const a of KEY_ACTIONS) {
        const v = saved[a];
        if (typeof v === 'string' && v.length > 0 && v.length < 32) out[a] = v;
      }
    }
    // Configurações antigas: o P2 usava Numpad 1 e 2 para ação e Ultimate. Passa para as teclas novas (sem teclado numérico).
    if (i === 1 && out.action === 'Numpad1' && out.ultimate === 'Numpad2') {
      out.action = def.action;
      out.ultimate = def.ultimate;
    }
    return out as unknown as KeyMap;
  });
  return {
    musicVolume: clampInt(r.musicVolume, 0, 10, d.musicVolume),
    sfxVolume: clampInt(r.sfxVolume, 0, 10, d.sfxVolume),
    muted: bool(r.muted, d.muted),
    reduceShake: bool(r.reduceShake, d.reduceShake),
    reduceFlash: bool(r.reduceFlash, d.reduceFlash),
    emotion: r.emotion === 'reduzido' || r.emotion === 'desligado' ? r.emotion : 'normal',
    textSize: r.textSize === 'grande' || r.textSize === 'maior' ? r.textSize : 'normal',
    repeatInteractions: bool(r.repeatInteractions, d.repeatInteractions),
    autoCutscene: bool(r.autoCutscene, d.autoCutscene),
    keymaps,
    dev: sanitizeDev(r.dev),
  };
}

function sanitizeDev(raw: unknown): DevSettings {
  const d = defaultDev();
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  return {
    fase: clampInt(r.fase, 1, 8, d.fase),
    duracaoS: typeof r.duracaoS === 'number' && DEV_DURACOES.includes(r.duracaoS) ? r.duracaoS : d.duracaoS,
    invulneravel: typeof r.invulneravel === 'boolean' ? r.invulneravel : d.invulneravel,
    danoMul: typeof r.danoMul === 'number' && DEV_DANOS.includes(r.danoMul) ? r.danoMul : d.danoMul,
    cutscenes: typeof r.cutscenes === 'boolean' ? r.cutscenes : d.cutscenes,
  };
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(storage: StorageLike | null = defaultStorage()): Settings {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: Settings, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento: as opções valem só nesta sessão */
  }
}

/**
 * Atribui uma tecla a uma ação. Se a tecla já era usada por outra ação (de P1 ou P2), as duas trocam de tecla,
 * assim nunca existem duas ações na mesma tecla. Devolve true se algo mudou.
 */
export function rebind(s: Settings, player: number, action: KeyAction, code: string): boolean {
  const map = s.keymaps[player];
  if (!map || map[action] === code) return false;
  const antiga = map[action];
  for (const outro of s.keymaps) {
    for (const a of KEY_ACTIONS) {
      if (outro[a] === code) (outro as Record<KeyAction, string>)[a] = antiga;
    }
  }
  (map as Record<KeyAction, string>)[action] = code;
  return true;
}

/** Nome legível de uma tecla (KeyboardEvent.code). */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  const map: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Espaço',
    Enter: 'Enter',
    ShiftLeft: 'Shift E',
    ShiftRight: 'Shift D',
    ControlLeft: 'Ctrl E',
    ControlRight: 'Ctrl D',
    Backspace: 'Apagar',
    Tab: 'Tab',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
  };
  return map[code] ?? code;
}
