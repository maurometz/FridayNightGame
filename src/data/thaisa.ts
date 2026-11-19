// Parâmetros do kit da Thaisa (GDD A.4). Valores iniciais, ajustáveis nos playtests.

// ---- Golpe Pesado de Violoncelo ----
/** Alcance do arco em pixels (o violoncelo é grande: 2,75 tiles). */
export const GOLPE_REACH = 44;
/** Abertura total do arco, em graus. */
export const GOLPE_ARC_DEG = 150;
export const GOLPE_MAX_ARC_DEG = 220;
export const GOLPE_DAMAGE = 9;
export const GOLPE_COOLDOWN_S = 1;
/** Quanto tempo o arco fica visível e ativo na tela. */
export const GOLPE_VISIBLE_S = 0.22;

// ---- Knockback e colisão ----
/** Velocidade inicial do empurrão (px/s). Com atrito de 0,9 por passo, empurra cerca de 40 px. */
export const KNOCKBACK_SPEED = 260;
export const KNOCKBACK_FRICTION = 0.9;
/** Abaixo desta velocidade o inimigo para de ser "arremessado". */
export const KNOCKBACK_MIN_SPEED = 10;
/** Acima desta velocidade o inimigo conta como arremessado (causa dano de colisão e perde o controle). */
export const THROWN_SPEED = 60;
export const COLLISION_DAMAGE = 4;
export const WALL_DAMAGE = 6;
export const COLLISION_COOLDOWN_S = 0.25;

// ---- Pico de Glicose ----
export const PICO_MAX = 5;
export const PICO_MAX_MAESTRO = 7;
export const PICO_STACK_DURATION_S = 4;
export const PICO_ATTACK_SPEED = 0.08;
export const PICO_ARC = 0.05;
export const PICO_DAMAGE = 0.05;

// ---- Estômago Sem Fundo ----
/** Chance base de uma comida cair ao matar um inimigo. */
export const FOOD_DROP_BASE = 0.02;
/** Com a Thaisa na partida, as comidas aparecem com o dobro de frequência. */
export const FOOD_DROP_THAISA_MUL = 2;
export const FOOD_LIFETIME_S = 25;
export const FOOD_PICKUP_RADIUS = 14;
export const MAX_FOODS = 40;

// ---- Cartas ----
export const ARCO_LARGO_MUL = 1.25;
export const SOPA_MUL = 1.2;
export const SISMICA_EVERY_SWINGS = 3;
export const ONDA_SPEED = 160;
export const ONDA_RADIUS = 12;
export const ONDA_LIFETIME_S = 0.9;
export const ONDA_DAMAGE_MUL = 0.8;
export const ONDA_KNOCK_SPEED = 200;
export const PE_FIRME_S = 1;
export const AFINACAO_PESADA_MUL = 1.5;
export const SHIELD_CAP_FRACTION = 0.3;
export const BUFE_SHIELD = 15;
export const RODIZIO_PULSE_EVERY_S = 1;
export const RODIZIO_PULSE_RADIUS = 40;
export const RODIZIO_PULSE_DAMAGE = 3;
export const CARDAPIO_BUFF_S = 5;
export const FORTALEZA_BLOCK_S = 0.25;
