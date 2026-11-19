// Parâmetros do kit do Felipe fora dos instrumentos (GDD A.4).

/** Segundos de afinação (sem atacar) a cada troca de instrumento. */
export const TUNE_TIME_S = 0.3;

/** A passiva "Espiral de Ideias Absurdas" dispara a cada N ataques. */
export const ESPIRAL_EVERY = 8;

export type AnomalyId = 'pato' | 'confete' | 'super' | 'chuva';

export interface AnomalyDef {
  readonly id: AnomalyId;
  readonly name: string;
  /** Peso no sorteio (%). */
  readonly weight: number;
}

export const ANOMALIES: readonly AnomalyDef[] = [
  { id: 'pato', name: 'Pato de Borracha Gigante!', weight: 40 },
  { id: 'confete', name: 'Confete Explosivo!', weight: 30 },
  { id: 'super', name: 'Supervelocidade!', weight: 20 },
  { id: 'chuva', name: 'Chuva de Kazoos!', weight: 10 },
];

export const ANOMALY_PARAMS = {
  pato: { damage: 15, speed: 90, radius: 14, lifetime: 2.2, range: 260 },
  confete: { damage: 10, area: 36, range: 220 },
  super: { speedMul: 1.5, duration: 3 },
  chuva: { count: 10, damage: 2, speed: 150, lifetime: 1.2, bounces: 1 },
} as const;

/** Turnê de Bolso: intervalo entre rajadas e espaçamento entre instrumentos. */
export const TURNE_INTERVAL_S = 60;
export const TURNE_STEP_S = 0.25;

// ---- Flauta da Madrugada ----
/** HP que cada melodia cura em quem esta no raio (o Felipe inclusive). */
export const FLAUTA_HEAL = 5;
/** Bonus de dano das melodias (multiplicador) e quanto ele dura. */
export const FLAUTA_DAMAGE_BUFF = 1.15;
export const FLAUTA_BUFF_S = 4;

// ---- Requiem da Morte (carta lendaria) ----
/** Alcance em que o Felipe consegue tocar para um aliado que caiu. */
export const REQUIEM_RANGE = 320;
export const REQUIEM_COOLDOWN_S = 90;
/** Fracao do HP maximo com que o caido se levanta. */
export const REQUIEM_REVIVE_HP = 0.5;
export const REQUIEM_INVULN_S = 2;
export const REQUIEM_RADIUS = 96;
export const REQUIEM_DAMAGE = 30;
export const REQUIEM_KNOCK = 260;

/** Ensaio Geral: inimigos próximos necessários, raio, recarga e bônus de dano da Bateria automática. */
export const ENSAIO_MIN_ENEMIES = 3;
export const ENSAIO_RADIUS = 70;
export const ENSAIO_COOLDOWN_S = 1.2;
export const ENSAIO_DAMAGE_MUL = 1.5;

/** Microfone de Feedback: segundos de atordoamento por ricochete do Kazoo. */
export const MICROFONE_STUN_S = 1;

/** Afinação de Ouvido: multiplicador do tempo de afinação e da dispersão do Violão. */
export const AFINACAO_TUNE_MUL = 0.5;
export const AFINACAO_SPREAD_MUL = 0.6;

/** Encore do Felipe: fração da munição máxima devolvida ao esgotar. */
export const ENCORE_REFILL = 0.3;

/** Duração de um "ato" em segundos (para "primeira troca de cada ato"). */
export const ACT_DURATION_S = 5 * 60;
