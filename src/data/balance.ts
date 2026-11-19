// Valores de balanceamento. Ajustar aqui, nunca espalhados pelo código.

/** Altura lógica alvo: a escala inteira é escolhida para chegar perto dela. */
export const TARGET_LOGICAL_HEIGHT = 270;

/**
 * Resolução lógica do jogo (pixel art). Acompanha o tamanho da janela (ver `setLogicalSize`),
 * por isso são variáveis "vivas": quem importa sempre lê o valor atual.
 */
export let LOGICAL_WIDTH = 480;
export let LOGICAL_HEIGHT = 270;

export function setLogicalSize(w: number, h: number): void {
  LOGICAL_WIDTH = w;
  LOGICAL_HEIGHT = h;
}

/** Tamanho de um tile em pixels lógicos. Alcances do GDD são dados em tiles. */
export const TILE = 16;

/** Simulação em passo fixo de 60 Hz. */
export const SIM_HZ = 60;
export const STEP_MS = 1000 / SIM_HZ;
export const STEP_S = 1 / SIM_HZ;

/** Velocidade base (100%) em pixels por segundo: 5 tiles/s. */
export const BASE_SPEED_PX_PER_S = 5 * TILE;

// ---- Limites de entidades (GDD A.3: teto de 300 inimigos ativos) ----
export const MAX_ENEMIES = 300;
export const MAX_PROJECTILES = 1000;
export const MAX_GEMS = 600;

// ---- Níveis e XP (GDD A.5). XP para sair do nível n = base + porNivel * n (crescimento linear). Calibrar nos playtests. ----
// Com 30 níveis, o total é de ~6.350 XP: um jogador forte chega ao 30 perto dos 12 minutos (antes chegava aos 10).
export const MAX_LEVEL = 30;
export const XP_BASE = 8;
export const XP_PER_LEVEL = 13;

// ---- Jogador ----
export const PLAYER_RADIUS = 6;
export const PLAYER_INVULN_S = 0.6;
/** Raio de coleta de gemas: 3 tiles. */
export const BASE_PICKUP_RADIUS = 3 * TILE;
export const GEM_MAGNET_SPEED = 180;
export const GEM_COLLECT_DIST = 5;

// ---- Spawn (Ato 1, provisório até a Fase 4) ----
/** Distância do spawn ao jogador: fora da tela (meia diagonal de 480x270 ~ 275 px). */
export const SPAWN_RING_PX = 300;
export const SPAWN_BASE_PER_S = 1.5;
export const SPAWN_RAMP_PER_S = 0.04;
/** Aquecimento: no começo de cada fase a taxa de spawn parte de uma fração e chega a 100% em SPAWN_WARMUP_S. */
export const SPAWN_WARMUP_S = 30;
export const SPAWN_WARMUP_MIN = 0.4;
/** Decisão de design: vida e spawn crescem por jogador extra (+50% cada). */
export const COOP_SCALE_PER_EXTRA_PLAYER = 0.5;

// ---- Colisão ----
export const HASH_CELL = 32;
/** Maior raio de inimigo (os chefes), usado para dimensionar as consultas ao hash. */
export const MAX_ENEMY_RADIUS = 16;
