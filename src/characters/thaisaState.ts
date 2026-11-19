import {
  ARCO_LARGO_MUL,
  GOLPE_ARC_DEG,
  GOLPE_MAX_ARC_DEG,
  GOLPE_REACH,
  PICO_ARC,
  PICO_ATTACK_SPEED,
  PICO_DAMAGE,
  PICO_MAX,
  PICO_MAX_MAESTRO,
  PICO_STACK_DURATION_S,
} from '../data/thaisa';

export interface ThaisaMods {
  /** Pancada Sísmica Fortissimo: a cada 3 golpes, uma onda grave percorre o chão. */
  sismica: boolean;
  /** Rodízio Livre: cura excedente vira escudo (máx. 30% do HP máximo) e cria aura de choque. */
  rodizio: boolean;
  /** Fortaleza Acústica: bloqueia projéteis inimigos durante o arco. */
  fortaleza: boolean;
  /** Segunda Porção: comidas dão +1 acúmulo de Pico. */
  segunda: boolean;
  /** Arco Largo de Família: alcance do arco +25%. */
  arcoLargo: boolean;
  /** Pé Firme: imune a knockback por 1 s após cada golpe. */
  peFirme: boolean;
  /** Cardápio do Dia: comidas dão um buff aleatório extra. */
  cardapio: boolean;
  /** Bufê Livre: toda comida de cura também ativa um escudo. */
  bufe: boolean;
  /** Maestro do Cansaço: Pico máximo sobe para 7. */
  maestro: boolean;
  /** Grave que Não Para: a onda grave empurra e marca inimigos. */
  grave: boolean;
  /** Sopa de Família: cura das comidas +20%. */
  sopa: boolean;
  /** Afinação Pesada: dano de colisão contra paredes +50%. */
  afinacaoPesada: boolean;
  /** Repeteco: a cada 4 golpes, o golpe seguinte causa +80% de dano. */
  repeteco: boolean;
  /** Colher de Pau: o arco deixa os atingidos lentos por 2 s. */
  colher: boolean;
  /** Costela no Bafo: com 3 ou mais acúmulos de Pico, -20% de dano recebido. */
  costela: boolean;
  // ---- Cartas de equipe ----
  /** Pode Passar: a comida pega também cura um aliado a até 4 tiles. */
  podePassar: boolean;
  /** Muro Humano: aliados a até 3 tiles recebem 15% de redução de dano. */
  muro: boolean;
  /** Arco Coletivo: o arco empurra inimigos na direção de aliados, que ganham +15% de dano. */
  arcoColetivo: boolean;
  /** Roda de Mate: a cada 10 s, Pico para a Thaisa e velocidade de ataque para aliados próximos. */
  roda: boolean;
  /** Retaguarda Gaúcha: quando um aliado cai, escudo para a Thaisa e velocidade para os aliados. */
  retaguarda: boolean;
}

export interface ThaisaState {
  readonly type: 'thaisa';
  /** Segundos até o próximo golpe. */
  cd: number;
  swings: number;
  /** Um temporizador por acúmulo de Pico de Glicose (segundos restantes). */
  stacks: number[];
  /** Direção do último golpe (para desenhar o violoncelo). */
  aim: number;
  /** Segundos em que o arco do último golpe continua ativo e visível. */
  swingLeft: number;
  /** Segundos restantes de imunidade a knockback (Pé Firme). Os efeitos de empurrão em jogadores chegam com os chefes (Fase 4). */
  knockImmuneLeft: number;
  /** Segundos restantes em que o arco bloqueia projéteis inimigos (Fortaleza Acústica). Vale quando houver projéteis inimigos (Fase 4). */
  blockLeft: number;
  /** Tempo até o próximo pulso de choque do Rodízio Livre. */
  pulseCd: number;
  /** Segundos até a próxima rodada de mate (Roda de Mate). */
  rodaCd: number;
  mods: ThaisaMods;
}

/** Máximo de acúmulos de Pico de Glicose (7 com Maestro do Cansaço). */
export function picoMax(s: ThaisaState): number {
  return s.mods.maestro ? PICO_MAX_MAESTRO : PICO_MAX;
}

/**
 * Ganha acúmulos de Pico. Cada acúmulo tem o próprio temporizador de 4 s.
 * Com o Pico cheio, comer renova o acúmulo mais antigo.
 */
export function darPico(s: ThaisaState, quantidade: number): void {
  const max = picoMax(s);
  for (let i = 0; i < quantidade; i++) {
    if (s.stacks.length < max) {
      s.stacks.push(PICO_STACK_DURATION_S);
    } else {
      let lowest = 0;
      for (let j = 1; j < s.stacks.length; j++) if (s.stacks[j]! < s.stacks[lowest]!) lowest = j;
      s.stacks[lowest] = PICO_STACK_DURATION_S;
    }
  }
}

export interface PicoBonus {
  /** Multiplicador de velocidade de ataque. */
  attack: number;
  /** Multiplicador do tamanho do arco. */
  arc: number;
  /** Multiplicador de dano. */
  damage: number;
}

/** Bônus do Pico de Glicose: por acúmulo, +8% de velocidade de ataque, +5% de arco e +5% de dano. */
export function bonusDoPico(s: ThaisaState): PicoBonus {
  const n = s.stacks.length;
  return { attack: 1 + n * PICO_ATTACK_SPEED, arc: 1 + n * PICO_ARC, damage: 1 + n * PICO_DAMAGE };
}

const DEG = Math.PI / 180;

/** Alcance atual do arco: base, Pico de Glicose (+5% por acúmulo) e Arco Largo de Família (+25%). */
export function alcanceDoGolpe(s: ThaisaState): number {
  return GOLPE_REACH * bonusDoPico(s).arc * (s.mods.arcoLargo ? ARCO_LARGO_MUL : 1);
}

/** Abertura total atual do arco, em radianos (cresce com o Pico, limitada a 220°). */
export function aberturaDoGolpe(s: ThaisaState): number {
  return Math.min(GOLPE_MAX_ARC_DEG, GOLPE_ARC_DEG * bonusDoPico(s).arc) * DEG;
}

export function createThaisaState(): ThaisaState {
  return {
    type: 'thaisa',
    cd: 0,
    swings: 0,
    stacks: [],
    aim: 0,
    swingLeft: 0,
    knockImmuneLeft: 0,
    blockLeft: 0,
    pulseCd: 0,
    rodaCd: 0,
    mods: {
      podePassar: false,
      muro: false,
      arcoColetivo: false,
      roda: false,
      retaguarda: false,
      sismica: false,
      rodizio: false,
      fortaleza: false,
      segunda: false,
      arcoLargo: false,
      peFirme: false,
      cardapio: false,
      bufe: false,
      maestro: false,
      grave: false,
      sopa: false,
      afinacaoPesada: false,
      repeteco: false,
      colher: false,
      costela: false,
    },
  };
}
