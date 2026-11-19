// Tela de estatísticas pós-partida (LORE seção 10): resumo da run exibido junto/após o Epílogo.
// Este arquivo só descreve o formato e os rótulos. A coleta fica a cargo do motor.

import type { CharacterId } from './characters';

/** Fonte de dano: arma, habilidade ou Ultimate. */
export interface DamageSource {
  /** Id interno da arma/habilidade/Ultimate. */
  readonly id: string;
  readonly label: string;
  readonly character?: CharacterId;
  readonly damage: number;
}

export interface RunStats {
  readonly durationS: number;
  readonly totalDamageDealt: number;
  readonly totalDamageTaken: number;
  /** Dano causado, discriminado por arma/habilidade/Ultimate. */
  readonly damageBySource: readonly DamageSource[];
  /** Dano causado por personagem. */
  readonly damageByCharacter: Readonly<Partial<Record<CharacterId, number>>>;
  readonly enemiesDefeated: number;
  readonly bossesDefeated: readonly string[];
  readonly eventsCompleted: readonly string[];
  readonly youthRescued: readonly string[];
  readonly collectiblesFound: readonly string[];
  readonly deaths: number;
  readonly revives: number;
  readonly ultimatesUsed: number;
  readonly saideirasUsed: number;
}

/** Rótulos em português da tela final. */
export const STATS_LABELS = {
  title: 'Resumo da Sexta',
  totalDamageDealt: 'Dano total causado',
  totalDamageTaken: 'Dano sofrido',
  damageBySource: 'Dano por arma e habilidade',
  enemiesDefeated: 'Inimigos derrotados',
  bossesDefeated: 'Chefes derrotados',
  eventsCompleted: 'Eventos concluídos',
  youthRescued: 'Jovens resgatados',
  collectiblesFound: 'Itens da Galeria do Mauro',
  ultimatesUsed: 'Ultimates de dupla usadas',
  saideirasUsed: 'Saideiras',
  deaths: 'Quedas',
  revives: 'Reanimações',
  durationS: 'Tempo de partida',
} as const;

export function emptyRunStats(): RunStats {
  return {
    durationS: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    damageBySource: [],
    damageByCharacter: {},
    enemiesDefeated: 0,
    bossesDefeated: [],
    eventsCompleted: [],
    youthRescued: [],
    collectiblesFound: [],
    deaths: 0,
    revives: 0,
    ultimatesUsed: 0,
    saideirasUsed: 0,
  };
}

// ---- Contadores vivos da partida (o motor atualiza; `finalizarStats` gera o RunStats da tela final) ----

/** Versão mutável dos contadores, guardada no mundo durante a partida. */
export interface LiveStats {
  totalDamageDealt: number;
  totalDamageTaken: number;
  damageBySource: Record<string, number>;
  damageByCharacter: Partial<Record<CharacterId, number>>;
  enemiesDefeated: number;
  eventsCompleted: string[];
  ultimatesUsed: number;
  saideirasUsed: number;
  deaths: number;
  revives: number;
}

export function createLiveStats(): LiveStats {
  return {
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    damageBySource: {},
    damageByCharacter: {},
    enemiesDefeated: 0,
    eventsCompleted: [],
    ultimatesUsed: 0,
    saideirasUsed: 0,
    deaths: 0,
    revives: 0,
  };
}

/** Soma dano causado: total, por personagem (se houver) e por arma/habilidade. */
export function registrarDano(live: LiveStats, amount: number, source: string, character?: CharacterId): void {
  if (amount <= 0) return;
  live.totalDamageDealt += amount;
  live.damageBySource[source] = (live.damageBySource[source] ?? 0) + amount;
  if (character) live.damageByCharacter[character] = (live.damageByCharacter[character] ?? 0) + amount;
}

/** Monta o resumo final da partida a partir dos contadores e do estado do mundo. */
export function finalizarStats(
  live: LiveStats,
  extra: { durationS: number; bossesDefeated: readonly string[]; youthRescued: readonly string[]; collectiblesFound: readonly string[] },
): RunStats {
  const damageBySource: DamageSource[] = Object.entries(live.damageBySource)
    .map(([label, damage]) => ({ id: label, label, damage: Math.round(damage) }))
    .sort((a, b) => b.damage - a.damage);
  const byChar: Partial<Record<CharacterId, number>> = {};
  for (const [k, v] of Object.entries(live.damageByCharacter)) byChar[k as CharacterId] = Math.round(v);
  return {
    durationS: extra.durationS,
    totalDamageDealt: Math.round(live.totalDamageDealt),
    totalDamageTaken: Math.round(live.totalDamageTaken),
    damageBySource,
    damageByCharacter: byChar,
    enemiesDefeated: live.enemiesDefeated,
    bossesDefeated: extra.bossesDefeated,
    eventsCompleted: live.eventsCompleted,
    youthRescued: extra.youthRescued,
    collectiblesFound: extra.collectiblesFound,
    deaths: live.deaths,
    revives: live.revives,
    ultimatesUsed: live.ultimatesUsed,
    saideirasUsed: live.saideirasUsed,
  };
}
