// Reviver um aliado caído (GDD A.13: o caído espera um aliado chegar perto). Valores iniciais, ajustáveis nos playtests.

/** Distância (px) em que um aliado vivo conta como "perto" para reviver. */
export const REVIVE_RADIUS = 28;
/** Segundos de um aliado por perto para levantar o caído. Dois aliados juntos revivem em metade do tempo. */
export const REVIVE_TIME_S = 3;
/** Sem ninguém perto, o progresso volta a esta velocidade (relativa ao tempo real). */
export const REVIVE_DECAY = 0.5;
/** Com quanta vida o caído se levanta e por quanto tempo fica invulnerável. */
export const REVIVE_HP_FRACTION = 0.4;
export const REVIVE_INVULN_S = 2;
