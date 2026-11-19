// Parâmetros do kit do Mauro (GDD A.4). Valores iniciais, ajustáveis nos playtests.

// ---- Tomo Arcano ----
export const FOCO_MAX = 100;
export const FOCO_REGEN_PER_S = 5;
/** Custo de cada Nota de Rodapé. */
export const NOTA_COST = 8;
export const NOTA_COST_PE_DE_PAGINA = 6;
/** Segundos entre disparos (limitado também pelo Foco). */
export const NOTA_COOLDOWN_S = 0.35;
export const NOTA_RANGE = 200;
export const NOTA_SPEED = 220;
export const NOTA_RADIUS = 4;
export const NOTA_LIFETIME_S = 1.5;
export const NOTA_BASE_DAMAGE = 6;

// ---- Conhecimento (escalonamento por abates, GDD: soft cap após 500) ----
/** A cada 100 abates o dano sobe. */
export const KILLS_PER_STEP = 100;
/** Ganho de dano por degrau antes do soft cap (+10%). */
export const STEP_BONUS = 0.1;
/** Depois de 500 abates, o ganho por degrau cai à metade. */
export const SOFTCAP_KILLS = 500;
export const SOFTCAP_FACTOR = 0.5;

// ---- Saltos ----
export const JUMPS_BASE = 3;
/** +1 salto a cada 200 abates. */
export const KILLS_PER_JUMP = 200;
export const JUMPS_MAX = 8;

// ---- Memória Fotográfica ----
export const XP_BONUS_BASE = 0.15;
/** Um reroll grátis a cada 3 níveis. */
export const FREE_REROLL_EVERY_LEVELS = 3;
/** Recordação Perfeita: +0,5% por segundo sem dano, teto de +50%. */
export const PERFEITA_PER_S = 0.005;
export const PERFEITA_MAX = 0.5;

// ---- Cartas ----
export const EDICAO_FOCO_BONUS = 30;
export const EDICAO_REGEN_BONUS = 2;
export const SALA_STILL_S = 3;
export const SALA_BONUS = 0.2;
/** Índice Remissivo: dano extra em inimigos marcados. */
export const MARK_DAMAGE_BONUS = 0.1;
/** Sobrecarga Enciclopédica: +5% a cada 100 abates, com teto (decisão de design: +25%). */
export const SOBRECARGA_STEP = 0.05;
export const SOBRECARGA_MAX = 0.25;
/** Bibliografia Comentada: a cada 10 abates, +1 carga de salto (máx. 5), gasta na próxima Nota. */
export const BIBLIO_KILLS_PER_CHARGE = 10;
export const BIBLIO_MAX_CHARGES = 5;
/** Mestre da Nota Longa: a cada 5 saltos, explosão em área. */
export const MESTRE_EVERY_JUMPS = 5;
export const MESTRE_RADIUS = 40;
export const MESTRE_DAMAGE_MUL = 1.5;
/** Rodapé do Rodapé: o eco repete o dano após este tempo. */
export const ECO_DELAY_S = 1;
export const ECO_RADIUS = 14;
/** Revisão de Prova: Foco devolvido por acerto em chefe. */
export const REVISAO_FOCO = 6;
/** Enciclopédia Viva: dano fixo somado por nível. */
export const ENCICLOPEDIA_PER_LEVEL = 1;

// ---- Órbita de Clássicos ----
export const ORBITA_BOOKS = 3;
export const ORBITA_RADIUS = 36;
export const ORBITA_SPEED = 2.2; // rad/s
export const ORBITA_HIT_RADIUS = 8;
export const ORBITA_DAMAGE = 3;
export const ORBITA_HIT_COOLDOWN_S = 0.4;
export const ORBITA_PUSH_PX = 8;
