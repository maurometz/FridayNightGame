// Parâmetros do kit da Melissa (GDD A.4). Valores iniciais, ajustáveis nos playtests.

// ---- Florete de bastão de K-pop ----
/** Alcance do golpe em pixels (2 tiles). */
export const FLORETE_REACH = 32;
/** Abertura total do golpe, em graus. */
export const FLORETE_ARC_DEG = 120;
export const FLORETE_DAMAGE = 7;
export const FLORETE_COOLDOWN_S = 0.5;

// ---- Holofotes ----
/** Distância máxima em que um Holofote pode aparecer num inimigo. */
export const HOLOFOTE_RANGE = 150;
export const HOLOFOTE_DURATION_S = 3;
/** Arco das costas do inimigo, oposto à frente (GDD: 90°). */
export const BACK_ARC_DEG = 90;
export const CRIT_MUL = 2;
/** Explosão de velocidade ao acertar um Holofote: +30% por 2 s. */
export const BURST_SPEED_MUL = 1.3;
export const BURST_DURATION_S = 2;

// ---- Atrasada com Estilo ----
export const ATRASADA_SPEED_MUL = 1.25;
/** Quanto a distância até um aliado precisa cair por passo para contar como "aproximando-se". */
export const ATRASADA_MIN_CLOSING_PX = 0.05;
export const ATRASADA_HOLD_S = 0.25;

// ---- Reação Exagerada ----
export const REACAO_RADIUS = 56;
export const REACAO_DAMAGE = 8;
export const REACAO_STUN_S = 1;
export const REACAO_COOLDOWN_S = 12;

// ---- Cartas ----
export const INVESTIDA_DISTANCE = 56;
export const INVESTIDA_DURATION_S = 0.14;
export const INVESTIDA_COOLDOWN_S = 4;
export const INVESTIDA_DAMAGE = 8;
/** Raio em torno da Melissa em que a investida corta inimigos. */
export const INVESTIDA_HIT_RADIUS = 14;
export const BIS_WINDOW_S = 3;

export const FANCAM_COOLDOWN_S = 8;
export const FANCAM_RANGE = 90;
export const FANCAM_ARC_DEG = 110;
export const FANCAM_BLIND_S = 2;

export const PROTAGONISTA_CRIT_MUL = 3;
export const PROTAGONISTA_DURATION_S = 5;
export const PROTAGONISTA_INVULN_S = 0.5;

export const FANDOM_CRIT = 0.05;
/** Alcance da aura do Fandom Organizado: 6 tiles. */
export const FANDOM_RADIUS = 96;

export const LIGHTSTICK_REACH_MUL = 1.3;
export const CAMERA_EXTRA_S = 1;
export const ROTINA_EVERY_HITS = 3;
export const SHOW_RADIUS = 40;
export const SHOW_DAMAGE = 12;
export const ENSAIO_ATTACK_SPEED = 1.1;
