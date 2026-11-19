// Armas do pool compartilhado (GDD A.5). Cada uma tem 3 níveis. Valores iniciais, ajustáveis nos playtests.
// Os valores por nível são funções do nível (1 a 3).

/** Fatias de Pizza Orbitantes: giram ao redor do jogador e causam dano de contato. */
export const PIZZA = {
  slices: (lv: number): number => 1 + lv,
  radius: (lv: number): number => 30 + 4 * lv,
  damage: (lv: number): number => 3 + lv,
  speed: 2.2, // rad/s
  hitRadius: 7,
  hitCooldown: 0.5,
};

/** Roteador Wi-Fi Agressivo: fica no chão, pulsa sinal e deixa inimigos "sem sinal" (lentos). */
export const ROTEADOR = {
  cooldown: (lv: number): number => 10 - lv,
  duration: 5,
  radius: (lv: number): number => 44 + 6 * lv,
  damage: (lv: number): number => 2 * lv,
  pulseEvery: 1,
  slowFor: 1.2,
};

/** Chinelo Bumerangue de Mãe: vai, volta e bate mais forte na volta. */
export const CHINELO = {
  cooldown: (lv: number): number => 2.4 - 0.2 * lv,
  damage: (lv: number): number => 6 + 2 * lv,
  speed: 150,
  outTime: 0.6,
  returnMul: 1.5,
  range: 200,
  radius: 5,
};

/** Chicote de Fone de Ouvido Enrolado: cada "nó" aumenta o dano. */
export const CHICOTE = {
  cooldown: (lv: number): number => 1.4 - 0.1 * lv,
  damage: (lv: number): number => 5 + lv,
  reach: (lv: number): number => 40 + 6 * lv,
  arcDeg: 80,
  knotBonus: 0.15,
  maxKnots: 5,
};

/** Ventilador de Teto Furioso: cone de vento que empurra inimigos. */
export const VENTILADOR = {
  reach: (lv: number): number => 56 + 8 * lv,
  arcDeg: 90,
  push: (lv: number): number => 30 + 15 * lv, // px/s
  damage: (lv: number): number => 1.5 * lv,
  tickEvery: 0.5,
};

/** Panela de Pressão: explode depois de 1 s, com aviso no chão. */
export const PANELA = {
  cooldown: (lv: number): number => 3.8 - 0.4 * lv,
  delay: 1,
  radius: (lv: number): number => 32 + 4 * lv,
  damage: (lv: number): number => 12 + 3 * lv,
  range: 180,
};

/** Controle Remoto sem Pilha: projétil lento que atordoa o primeiro inimigo atingido. */
export const CONTROLE = {
  cooldown: (lv: number): number => 2.9 - 0.3 * lv,
  damage: (lv: number): number => 4 + lv,
  speed: 90,
  stun: (lv: number): number => 1.25 + 0.25 * lv,
  radius: 5,
  range: 180,
};

/** Mangueira do Quintal: jato perfurante que deixa uma poça que desacelera. */
export const MANGUEIRA = {
  cooldown: (lv: number): number => 2.7 - 0.3 * lv,
  damage: (lv: number): number => 3 + 1.5 * lv,
  length: (lv: number): number => 95 + 15 * lv,
  width: 12,
  puddleRadius: (lv: number): number => 19 + 3 * lv,
  puddleDuration: 4,
  slowFor: 0.5,
};

/** Fogos de Fim de Ano: salvas aleatórias em área, com aviso. */
export const FOGOS = {
  cooldown: (lv: number): number => 5.7 - 0.7 * lv,
  bursts: (lv: number): number => 2 + lv,
  delay: 0.8,
  radius: (lv: number): number => 23 + 3 * lv,
  damage: (lv: number): number => 7 + 3 * lv,
  scatter: 150,
};

/** Violão emprestado pelo Felipe (Passa a Vez). */
export const EMPRESTADO = {
  cooldown: 0.6,
  count: 3,
  speed: 200,
  lifetime: 0.9,
  damage: 3,
  range: 190,
};
