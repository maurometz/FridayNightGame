// Parâmetros do kit da Thayssa (GDD A.4). Valores iniciais, ajustáveis nos playtests.

// ---- Aura ----
/** Raio base do anel: 3 tiles. */
export const AURA_RADIUS = 48;
/** Transição entre os modos: sem atacar e sem buffs. */
export const TRANSICAO_S = 0.4;

// ---- Modo Euforia (dourado/rosa) ----
/** +20% de velocidade de movimento e de ataque para aliados no anel. */
export const EUFORIA_BUFF = 0.2;
/** Pulso de dano rítmico: 1 a cada 0,5 s. */
export const EUFORIA_PULSE_EVERY_S = 0.5;
export const EUFORIA_PULSE_DAMAGE = 3;

// ---- Modo Sobrecarga Emocional (violeta/azul) ----
/** -25% de dano recebido para aliados no anel. */
export const SOBRECARGA_REDUCAO = 0.25;
/** Regeneração de 1 HP/s para aliados no anel. */
export const SOBRECARGA_REGEN_PER_S = 1;
/** Pulso de repulsão pesado. */
export const SOBRECARGA_PULSE_EVERY_S = 1;
export const SOBRECARGA_PULSE_DAMAGE = 2;
export const SOBRECARGA_PULSE_KNOCK = 200;

// ---- Risada Contagiante ----
/** Chance de um inimigo morto na aura soltar um brilho. */
export const RISADA_SPARKLE_CHANCE = 0.1;
/** Cada abate dentro da aura reduz a recarga dos aliados na aura. */
export const RISADA_COOLDOWN_CUT_S = 0.5;
/** O brilho vira cura pequena ou gema de XP (50% cada). */
export const BRILHO_HEAL = 6;
export const BRILHO_XP = 3;

// ---- Cartas ----
export const DROP_RADIUS = 64;
export const DROP_DAMAGE = 12;
export const RESSONANCIA_DURATION_S = 4;
/** A Ressonância Dupla recarrega sozinha (o GDD não diz quando ativa). */
export const RESSONANCIA_COOLDOWN_S = 30;
export const ABRACO_RADIUS_MUL = 1.5;
export const ABRACO_BUFF_MUL = 1.2;
export const METRONOMO_TRANSICAO_S = 0.2;
export const PE_NO_CHAO_REGEN = 0.5;
export const SINCRONIA_RADIUS = 80;
export const SINCRONIA_HEAL = 10;
export const ENTREGA_XP_SHARE = 0.5;
export const ULTIMO_HP_FRACTION = 0.1;
export const ULTIMO_INVULN_S = 2;
export const ULTIMO_COOLDOWN_S = 30;
export const DANCA_SWITCHES = 5;
/** As trocas contam como "seguidas" se feitas dentro deste intervalo uma da outra. */
export const DANCA_WINDOW_S = 6;
export const DANCA_RADIUS = 80;
export const DANCA_DAMAGE = 25;
export const GARGALHADA_CHANCE = 0.15;
export const GARGALHADA_XP = 2;
export const PALMAS_EVERY_S = 10;
export const PALMAS_KNOCK = 220;
export const PALMAS_RADIUS_MUL = 1.5;

// ---- Megafone (ataque basico) ----
/** O grito sai quando ha um inimigo a ate 130 px. */
export const MEGAFONE_RANGE = 130;
export const MEGAFONE_REACH = 120;
/** Meia-abertura do cone, em radianos (38 graus). */
export const MEGAFONE_HALF_ARC = (38 * Math.PI) / 180;
export const MEGAFONE_COOLDOWN_S = 4.5;
export const MEGAFONE_DAMAGE = 7;
export const MEGAFONE_KNOCK = 180;
/** Sobrecarga: o grito atordoa. */
export const MEGAFONE_STUN_S = 0.7;
/** Euforia: o grito anima quem esta na aura (+25% de velocidade de ataque). */
export const MEGAFONE_BUFF_S = 3;
export const MEGAFONE_ATTACK = 1.25;
