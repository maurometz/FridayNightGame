// Meta-progressão (GDD Fase 7): estatísticas que ficam entre as partidas, no localStorage.
// A árvore de Melhorias ainda não existe (tela "em construção"); aqui só guardamos o histórico.

import type { CharacterId } from '../data/characters';

export interface CharacterRecord {
  runs: number;
  wins: number;
  bestKills: number;
}

export interface MetaProgress {
  runs: number;
  wins: number;
  totalKills: number;
  bestKills: number;
  /** Maior tempo sobrevivido, em segundos. */
  bestTime: number;
  perCharacter: Partial<Record<CharacterId, CharacterRecord>>;
  /** Últimas escolhas na seleção de personagem. */
  lastCharacter: CharacterId;
  lastCompanion: CharacterId | null;
  /** Colecionáveis da Galeria do Mauro já achados (em qualquer partida). */
  gallery: string[];
}

export interface RunResult {
  character: CharacterId;
  victory: boolean;
  kills: number;
  seconds: number;
  /** Colecionáveis achados na partida. */
  collected?: readonly string[];
}

const STORAGE_KEY = 'profecia.meta.v1';
const IDS: readonly CharacterId[] = ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'];

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function defaultMeta(): MetaProgress {
  return { runs: 0, wins: 0, totalKills: 0, bestKills: 0, bestTime: 0, perCharacter: {}, lastCharacter: 'felipe', lastCompanion: null, gallery: [] };
}

const nonNeg = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const isId = (v: unknown): v is CharacterId => typeof v === 'string' && (IDS as readonly string[]).includes(v);

export function sanitizeMeta(raw: unknown): MetaProgress {
  const d = defaultMeta();
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  const per: MetaProgress['perCharacter'] = {};
  if (typeof r.perCharacter === 'object' && r.perCharacter !== null) {
    for (const id of IDS) {
      const c = (r.perCharacter as Record<string, unknown>)[id];
      if (typeof c === 'object' && c !== null) {
        const cc = c as Record<string, unknown>;
        per[id] = { runs: nonNeg(cc.runs), wins: nonNeg(cc.wins), bestKills: nonNeg(cc.bestKills) };
      }
    }
  }
  return {
    runs: nonNeg(r.runs),
    wins: nonNeg(r.wins),
    totalKills: nonNeg(r.totalKills),
    bestKills: nonNeg(r.bestKills),
    bestTime: nonNeg(r.bestTime),
    perCharacter: per,
    lastCharacter: isId(r.lastCharacter) ? r.lastCharacter : d.lastCharacter,
    lastCompanion: isId(r.lastCompanion) ? r.lastCompanion : null,
    gallery: Array.isArray(r.gallery) ? [...new Set(r.gallery.filter((g): g is string => typeof g === 'string' && g.length < 40))] : [],
  };
}

/** Soma o resultado de uma partida ao histórico (devolve um objeto novo). */
export function recordRun(meta: MetaProgress, run: RunResult): MetaProgress {
  const antes = meta.perCharacter[run.character] ?? { runs: 0, wins: 0, bestKills: 0 };
  return {
    ...meta,
    runs: meta.runs + 1,
    wins: meta.wins + (run.victory ? 1 : 0),
    totalKills: meta.totalKills + run.kills,
    bestKills: Math.max(meta.bestKills, run.kills),
    bestTime: Math.max(meta.bestTime, Math.floor(run.seconds)),
    gallery: [...new Set([...meta.gallery, ...(run.collected ?? [])])],
    perCharacter: {
      ...meta.perCharacter,
      [run.character]: {
        runs: antes.runs + 1,
        wins: antes.wins + (run.victory ? 1 : 0),
        bestKills: Math.max(antes.bestKills, run.kills),
      },
    },
  };
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadMeta(storage: StorageLike | null = defaultStorage()): MetaProgress {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return sanitizeMeta(text ? JSON.parse(text) : null);
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaProgress, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* sem armazenamento: o histórico vale só nesta sessão */
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
