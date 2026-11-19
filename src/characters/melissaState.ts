export interface MelissaMods {
  /** Investida do Encore: libera o avanço cortante (tecla de ação). */
  investida: boolean;
  /** Flash de Fancam: cone que desorienta inimigos. */
  fancam: boolean;
  /** Síndrome de Protagonista: crítico x3 por 5 s e 0,5 s de invulnerabilidade após a Reação Exagerada. */
  protagonista: boolean;
  /** Ponto de Holofote Extra: dois Holofotes por ataque. */
  extraHolofote: boolean;
  /** Passo de Dança Vertical: o avanço atravessa obstáculos. */
  passoVertical: boolean;
  /** Fandom Organizado: aliados perto ganham +5% de crítico. */
  fandom: boolean;
  /** Lightstick Fora de Órbita: alcance do florete +30%. */
  lightstick: boolean;
  /** Rotina de Fim de Semana: a cada 3 Holofotes acertados, uma Reação Exagerada sem recarga. */
  rotina: boolean;
  /** Show Inesperado: o primeiro Holofote de cada inimigo explode em luz. */
  showInesperado: boolean;
  /** Bis de Coreografia: depois de um avanço, outro sem recarga em 3 s. */
  bis: boolean;
  /** Câmera de Celular: Holofotes duram 1 s a mais. */
  camera: boolean;
  /** Passe de Bastidores: cada Holofote acertado cura 4 HP. */
  backstage: boolean;
  /** After Party: a explosão de velocidade dura 1,5 s a mais. */
  afterparty: boolean;
  /** Autógrafo no Ato: o Holofote acertado atordoa o inimigo por 1 s. */
  autografo: boolean;
  /** Close-Up: o crítico do Holofote passa de x2 para x2,5. */
  closeUp: boolean;
  // ---- Cartas de equipe ----
  /** Torcida Organizada: aliados perto ganham +5% de velocidade de ataque. */
  torcida: boolean;
  /** Passe de Holofote: ao acertar um Holofote, um aliado ganha crítico em outro inimigo por 3 s. */
  passe: boolean;
  /** Entrada Sincronizada: Melissa e um aliado avançam juntos (precisa da Investida). */
  entrada: boolean;
  /** Cobertura do Encore: aliado abaixo de 30% de HP dá velocidade à Melissa. */
  cobertura: boolean;
  /** Coreografia de Grupo: a cada 3 Holofotes do grupo, Reação Exagerada no time. */
  coreografia: boolean;
}

export interface MelissaState {
  readonly type: 'melissa';
  /** Segundos até o próximo golpe. */
  cd: number;
  /** Holofotes acertados nas costas (conta para a Rotina de Fim de Semana). */
  spotHits: number;
  /** Segundos restantes da explosão de velocidade. */
  burstLeft: number;
  reacaoCd: number;
  /** Levou dano: processar Reação Exagerada no próximo passo. */
  reacaoPending: boolean;
  /** Reação grátis pedida pela Rotina de Fim de Semana. */
  reacaoFree: boolean;
  /** Segundos restantes do crítico x3 da Síndrome de Protagonista. */
  protagonistaLeft: number;
  dashCd: number;
  dashLeft: number;
  dashDirX: number;
  dashDirY: number;
  /** uids dos inimigos já cortados no avanço atual. */
  dashHits: number[];
  /** Há um segundo avanço gratuito disponível (Bis de Coreografia). */
  bisReady: boolean;
  bisWindow: number;
  /** O avanço em curso é o gratuito do Bis. */
  dashIsBis: boolean;
  prevAction: boolean;
  fancamCd: number;
  /** Distância até o aliado mais próximo no passo anterior, ou -1. */
  prevAllyDist: number;
  /** Segundos restantes do bônus de "aproximando-se de um aliado". */
  approachLeft: number;
  /** Holofotes acertados pelo grupo (Coreografia de Grupo). */
  groupHits: number;
  coberturaCd: number;
  mods: MelissaMods;
}

export function createMelissaState(): MelissaState {
  return {
    type: 'melissa',
    cd: 0,
    spotHits: 0,
    burstLeft: 0,
    reacaoCd: 0,
    reacaoPending: false,
    reacaoFree: false,
    protagonistaLeft: 0,
    dashCd: 0,
    dashLeft: 0,
    dashDirX: 1,
    dashDirY: 0,
    dashHits: [],
    bisReady: false,
    bisWindow: 0,
    dashIsBis: false,
    prevAction: false,
    fancamCd: 0,
    prevAllyDist: -1,
    approachLeft: 0,
    groupHits: 0,
    coberturaCd: 0,
    mods: {
      torcida: false,
      passe: false,
      entrada: false,
      cobertura: false,
      coreografia: false,
      investida: false,
      fancam: false,
      protagonista: false,
      extraHolofote: false,
      passoVertical: false,
      fandom: false,
      lightstick: false,
      rotina: false,
      showInesperado: false,
      bis: false,
      camera: false,
      backstage: false,
      afterparty: false,
      autografo: false,
      closeUp: false,
    },
  };
}
