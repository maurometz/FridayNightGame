// Parâmetros das cartas de equipe (GDD A.4.1). Todas dependem de aliados por perto.
// Distâncias em pixels (1 tile = 16 px). Valores iniciais, ajustáveis nos playtests.

// ---- Felipe ----
/** Coro de Apoio: aliados a até 6 tiles recebem +5% de dano enquanto o Felipe ataca. */
export const CORO_RADIUS = 96;
export const CORO_BONUS = 0.05;
/** Quanto tempo depois de um ataque o Felipe ainda conta como "atacando". */
export const CORO_ACTIVE_S = 0.6;
/** Sinal de Passagem: ao trocar de instrumento, o próximo aliado a até 4 tiles ganha um empurrão. */
export const SINAL_RADIUS = 64;
export const SINAL_CUT_S = 1;
/** Intervalo Compartilhado: ao esgotar uma munição, aliados próximos recarregam mais rápido. */
export const INTERVALO_RADIUS = 96;
export const INTERVALO_CUT_S = 1.5;
/** Quem Canta Junto: aliados que atacam o mesmo inimigo causam +10% de dano. */
export const QUEM_CANTA_BONUS = 0.1;
export const QUEM_CANTA_S = 1;
/** Passa a Vez: a cada 45 s, o Felipe empresta um instrumento ao aliado mais próximo por 10 s. */
export const PASSA_EVERY_S = 45;
export const PASSA_DURATION_S = 10;
export const PASSA_RADIUS = 128;

// ---- Mauro ----
/** Trabalho em Grupo: uma runa por ataque pula para um aliado, que ganha +10% de dano por 3 s. */
export const TRABALHO_RANGE = 128;
export const TRABALHO_DAMAGE = 1.1;
export const TRABALHO_S = 3;
/** Resumo Coletivo: aliados que sofrem dano dividem 10% com o Mauro, que regenera Foco com isso. */
export const RESUMO_RADIUS = 128;
export const RESUMO_SHARE = 0.1;
export const RESUMO_FOCO_MUL = 2;
/** Bibliografia Compartilhada: a cada abate do Mauro, aliados próximos recarregam mais rápido. */
export const BIBLIO_COLETIVA_RADIUS = 96;
export const BIBLIO_COLETIVA_CUT_S = 0.3;
/** No nível 20 as Notas viram "Citação": mais dano. */
export const CITACAO_LEVEL = 20;
export const CITACAO_MUL = 1.25;
/** Revisão por Pares: quando um aliado sobe de nível, o Mauro ganha 50 de XP. */
export const PARES_XP = 50;
/** Índice Coletivo: a cada 100 abates do grupo, +5% de dano para todos (teto +50%). */
export const INDICE_KILLS_PER_STEP = 100;
export const INDICE_BONUS = 0.05;
export const INDICE_MAX = 0.5;

// ---- Melissa ----
/** Torcida Organizada: aliados perto ganham +5% de velocidade de ataque. */
export const TORCIDA_RADIUS = 96;
export const TORCIDA_BONUS = 0.05;
/** Passe de Holofote: ao acertar um Holofote, um aliado ganha crítico em outro inimigo por 3 s. */
export const PASSE_RANGE = 120;
export const PASSE_S = 3;
/** Entrada Sincronizada: Melissa e um aliado a até 4 tiles avançam juntos e causam dano em área. */
export const ENTRADA_RADIUS = 64;
export const ENTRADA_AREA = 32;
export const ENTRADA_DAMAGE = 10;
/** Cobertura do Encore: aliado abaixo de 30% de HP dá velocidade à Melissa. */
export const COBERTURA_HP = 0.3;
export const COBERTURA_SPEED = 1.3;
export const COBERTURA_S = 3;
export const COBERTURA_COOLDOWN_S = 10;
/** Coreografia de Grupo: a cada 3 Holofotes acertados pelo grupo, Reação Exagerada no time. */
export const COREOGRAFIA_EVERY = 3;
export const COREOGRAFIA_RADIUS = 96;
export const COREOGRAFIA_AREA = 40;
export const COREOGRAFIA_DAMAGE = 6;
export const COREOGRAFIA_STUN_S = 0.8;

// ---- Thaisa ----
/** Pode Passar: a comida que a Thaisa pega também cura um aliado a até 4 tiles. */
export const PODE_PASSAR_RADIUS = 64;
/** Muro Humano: aliados a até 3 tiles recebem 15% de redução de dano. */
export const MURO_RADIUS = 48;
export const MURO_REDUCTION = 0.15;
/** Arco Coletivo: o arco empurra inimigos na direção de aliados, que ganham +15% de dano. */
export const ARCO_COLETIVO_RANGE = 160;
export const ARCO_COLETIVO_DAMAGE = 1.15;
export const ARCO_COLETIVO_S = 3;
/** Roda de Mate: a cada 10 s, a Thaisa ganha 1 Pico e aliados próximos ganham velocidade de ataque. */
export const RODA_EVERY_S = 10;
export const RODA_RADIUS = 64;
export const RODA_ATTACK = 1.08;
export const RODA_S = 4;
/** Retaguarda Gaúcha: quando um aliado cai, a Thaisa ganha escudo e aliados +20% de velocidade. */
export const RETAGUARDA_SPEED = 1.2;
export const RETAGUARDA_S = 5;
export const RETAGUARDA_RADIUS = 128;
export const RETAGUARDA_SHIELD = 0.3;

// ---- Thayssa ----
/** Mão Estendida: aliados que entram no anel ganham +10% de velocidade por 2 s. */
export const MAO_SPEED = 1.1;
export const MAO_S = 2;
/** Abraço em Grupo: aliados no anel recebem 1 HP/s a mais na Euforia. */
export const ABRACO_GRUPO_REGEN = 1;
/** Escudo de Afeto: aliados no anel dividem 20% do dano recebido pela Thayssa. */
export const ESCUDO_AFETO_SHARE = 0.2;
/** Círculo Completo: com 3 ou mais aliados no anel, +1 pulso e +1 tile de raio. */
export const CIRCULO_MIN_ALLIES = 3;
export const CIRCULO_RADIUS_BONUS = 16;
