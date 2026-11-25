// Chefes (GDD A.7, LORE seção 6).
//  - BOSS_ROSTER (no fim do arquivo): o elenco NOVO de chefes, um por fase, cada um aparece uma vez.
// Todo ataque é telegrafado com pelo menos 1 s de antecedência. Valores iniciais, ajustáveis nos playtests.

import type { BossId } from './acts';

/** Aviso mínimo (em segundos) antes de qualquer ataque de chefe causar dano. */
export const MIN_TELEGRAPH_S = 1;

// ---- Parâmetros dos chefes (campanha nova) ----
export const SALSICHAS_CFG = {
  /** Pausa entre um ataque e o próximo (fases 1 e 3: um ataque da matilha por vez, ou dois combinados na fase 3). */
  cooldown: 3.4,
  /**
   * Fases pela vida restante: acima de `dividida` a matilha anda unida; entre `dividida` e `salsichao` ela se separa
   * (cada cachorro ataca por conta própria); abaixo de `salsichao` os quatro viram um Salsichão só, em fúria.
   */
  fases: { dividida: 0.66, salsichao: 0.33 },
  /** Geraldo, o líder: trenzinho de latidos em fila, um depois do outro. */
  trenzinho: { warnS: 1.2, count: 5, gap: 0.12, speed: 130, damage: 8 },
  /** Geraldo no Salsichão: depois do trenzinho, ondas circulares ao redor da matilha. */
  cerco: { count: 3, gap: 0.5, speed: 85, maxRadius: 190, thickness: 9, damage: 10, warnS: 1.2 },
  /** Monet, a artista: poças de tinta que ficam no chão (dano contínuo e lentidão). */
  monet: { warnS: 1.3, count: 4, radius: 26, lifeS: 6, dps: 6, slowFor: 1.2, impact: 4, scatter: 70 },
  /** Toddy: investida rasante em linha reta, com a trilha marcada no chão. */
  toddy: { warnS: 1.4, steps: 9, stepDist: 26, radius: 15, damage: 11, dashS: 0.4, runSpeed: 320 },
  /** Bucky: abocanha o grupo, puxa quem estiver dentro para o centro e deixa lento. */
  bucky: { warnS: 1.4, radius: 58, damage: 6, pull: -130, pullS: 0.5, slowFor: 1.5, runSpeed: 220 },
  /** Fase 2 (matilha dividida): cada cachorro tem o seu relógio e rodeia os jogadores. */
  divisao: { cooldown: 5.2, orbit: 120, stagger: 1.2, speed: 70 },
  /**
   * Fase 2: cada cachorro tem um vigor (um quarto da vida desta fase). Quando acaba, ele se deita exausto (sem atacar,
   * sem dano de contato) por `exaustoS` segundos e volta com `volta` do vigor.
   */
  vigor: { exaustoS: 9, volta: 0.6 },
  /** Fase 3 (Salsichão): fila bem colada, mais rápida, ataques mais frequentes e combinados. */
  salsichao: {
    /** Posição dos três corpos em relação ao Geraldo (no centro), em px. Positivo = para a frente. Cobrem o comprimento do sprite. */
    offsets: [28, -28, -46],
    speedMul: 1.35,
    cooldownMul: 0.8,
    combo: 2,
    extraLatidos: 2,
    extraPocas: 2,
    /** Duração da animação em que os quatro correm, giram e se fundem; e do clarão no fim. */
    fusaoS: 2.2,
    clarao: 0.4,
  },
  /** Comida: cachorros e jogadores disputam. Quem come primeiro leva o prêmio. */
  comida: {
    /** Cachorro que come: fica parado comendo (vulnerável) e cura o chefe esta fração da vida máxima. */
    stunS: 3.5,
    healFrac: 0.025,
    /** Distância em que um cachorro livre sente a comida e corre para ela. */
    seekPx: 240,
    /** Velocidade do cachorro correndo atrás da comida (px/s). */
    corridaPx: 110,
    /** Jogador que come perto da matilha distrai os cachorros que estiverem neste raio por `distractS`. */
    distractPx: 120,
    distractS: 2.5,
    /** A geladeira abre e solta uma comida: a primeira depois de `firstS` e as outras a cada `everyS`. */
    geladeira: { x: 140, y: -78, firstS: 5, everyS: 14, maxNoChao: 3 },
  },
};

export const JUNINHO_CFG = {
  cooldown: 3.6,
  /** Recarga entre ataques do Juninho em cada fase da luta (1 Expediente, 2 Reestruturação, 3 Prazo final). */
  cooldownFase: [3.6, 3.1, 2.4],
  /** Fases pela vida restante: abaixo de `reestruturacao` entra a fase 2; abaixo de `prazo`, a fase 3. */
  fases: { reestruturacao: 0.6, prazo: 0.3 },
  /** Drones: lasers telegrafados nas posições dos jogadores (na fase 3 vêm em dobro). */
  lasers: { warnS: 1.4, radius: 20, damage: 14 },
  /** Zonas de cronograma: lentidão no chão; quando o prazo acaba elas explodem. */
  cronograma: { count: 3, warnS: 1.3, lifeS: 6, radius: 30, slowFor: 3, impact: 4, scatter: 85, prazoWarnS: 0.7, prazoDamage: 16 },
  /** Notificação de e-mail: leque de projéteis curtos. */
  email: { count: 5, spreadDeg: 70, speed: 95, damage: 6 },
  /** Reunião obrigatória: puxa todos para o centro e deixa lento. */
  reuniao: { warnS: 1.6, radius: 105, pull: -260, pullS: 0.5, damage: 8, slowFor: 2.5 },
  /** Quando o escudo da Melina quebra, o grupo todo cambaleia por este tempo (vulnerável). */
  quebraStunS: 2.5,
  /** Mariana, a Azulete hiperativa: investidas em linha reta com rastro de tinta; cansa depois de algumas. */
  mariana: {
    speed: 38,
    dashSpeed: 250,
    dashLenPx: 140,
    warnS: 0.9,
    gapS: 0.45,
    /** Investidas seguidas antes de ficar sem fôlego, por fase. */
    dashes: [3, 3, 4],
    exaustoS: [3.5, 3, 2.5],
    cooldownS: [3, 2.6, 2],
    /** Rastro de tinta: poças a cada `stepPx`, com dano no impacto e dano contínuo + lentidão depois. */
    trail: { radius: 14, stepPx: 28, lifeS: 4, impact: 4, dps: 4, slowFor: 1.5 },
    /** Dano extra que ela leva sem fôlego (e, se tropeçar numa zona de cronograma, ela cansa na hora). */
    exaustaDanoMul: 1.5,
  },
  /** Melina, a Azulete sarcástica: escudo no Juninho e ironias que dão debuff. */
  melina: {
    speed: 30,
    distJuninho: 60,
    /** Vida do escudo (fração da vida máxima do chefe) por fase, duração e recarga (conta quando não há escudo). */
    escudoFrac: [0.05, 0.06, 0.07],
    escudoS: 7,
    escudoWarnS: 1,
    escudoCdS: [11, 10, 8],
    /** Acertar a Melina com o escudo ativo causa dano extra ao escudo (múltiplo do dano). */
    escudoBonusNaMelina: 1,
    ironiaEveryS: [4.5, 3.5, 2.8],
    ironiaCount: [1, 3, 3],
    ironiaSpread: 30,
    ironiaSpeed: 85,
    ironiaDamage: 4,
    /** Debuff da ironia: dano e velocidade de ataque do jogador atingido, por `debuffS` segundos. */
    debuff: { s: 5, damage: 0.8, attack: 0.85 },
  },
};

export const RM_CFG = {
  cooldown: 4,
  /** Depois que o transe quebra, o RM descansa estes segundos antes de encantar de novo. */
  descansoS: 8,
  /** Encanto: o feixe puxa o personagem encantado na direção do RM (px/s). */
  pullSpeed: 26,
  /** Distância em que o encantado alcança o RM e entra em transe. */
  catchPx: 22,
  /** Barra de transe: começa cheia. Esvazia com a aura da Thayssa, com a Pausa Dramática ou por toque dos aliados. */
  trance: { max: 100, passiveDrain: 1.5, thayssaDrain: 12, thayssaRadius: 90, touchDrain: 8, touchRadius: 26, pausaDrain: 100 },
  /** Enquanto em transe, o encantado atira "habilidades corrompidas" no aliado mais próximo. */
  corruptEveryS: 1.3,
  corruptDamage: 7,
  /**
   * Onda de aplausos: enquanto a Melissa é puxada e há aliados colados nela, o RM solta uma onda em volta dela (aviso de `warnS`)
   * que empurra os aliados para longe (`push` px/s por `pushS` s) e causa um dano leve. Conta só com aliados perto (`nearPx`).
   */
  onda: { everyS: 5, warnS: 0.9, radius: 70, nearPx: 80, push: 320, pushS: 0.3, damage: 6 },
  /** Melissa convidada em transe: sai do lado do RM e persegue a equipe, golpeando de perto (px/s, px, dano, segundos de recarga). */
  convidada: { speed: 74, leash: 210, reach: 26, hitDamage: 9, hitCooldownS: 1.1, desnorteadaS: 2.5, andarSpeed: 18 },
  /** Ataques do próprio RM: refletores no chão e raios de palco. */
  holofotes: { count: 3, warnS: 1.3, radius: 26, damage: 12, scatter: 80 },
};

export const CHRISTOPHER_CFG = {
  cooldown: 3.2,
  /** Recarga entre ataques por fase (1 Brincadeira, 2 Hora do doce, 3 Birra total). */
  cooldownFase: [3.2, 2.7, 2.2],
  /** Fases pela vida restante: abaixo de `doce` entra a fase 2; abaixo de `birraTotal`, a fase 3. */
  fases: { doce: 0.65, birraTotal: 0.3 },
  /** Na fase 2 ele anda mais rápido (se entope de doce da Expointer). */
  doceVelMul: 1.3,
  /**
   * Atenção (0 a 100): sobe se alguém está perto, desce se ninguém está. Zerada = birra. Muito alta (animado) = ele ataca mais depressa.
   */
  atencao: { max: 100, inicio: 60, perto: 130, sobePorS: 4, descePorS: 8, animadoAcima: 90, animadoCooldownMul: 0.8, aposBirra: 50, ganhoDivertido: 10 },
  /** Birra: anéis com vãos para atravessar; depois dela ele chora exausto (vulnerável). */
  birra: { rings: [3, 3, 4], gap: 0.5, speed: 110, maxRadius: 240, thickness: 12, damage: 16, warnS: 1.2, vaoHalf: [0.6, 0.55, 0.45], exaustoS: 4, exaustoDanoMul: 1.4 },
  /** Chuva de brinquedos: bolas que rolam por uma linha, estourando em sequência (cada passo avisa antes). */
  brinquedos: { bolas: 3, passos: 8, passoPx: 28, radius: 16, warnS: 1, passoDelayS: 0.16, damage: 10, distInicio: 110 },
  /** Pique-pega: a marca precisa passar para um aliado por toque, senão explode em quem a carrega. */
  pique: { timeS: 6, passaPx: 22, passaCdS: 1.2, explosao: { radius: 42, warnS: 0.5, damage: 18 } },
  /** Esconde-esconde: 3 cópias e o Christopher de verdade em carrossel. Acertar uma cópia dá um susto; acertar o verdadeiro o atordoa. */
  esconde: { copias: 3, duracaoS: 9, raio: 110, omega: 0.7, hihiEveryS: 2.5, sustoRadius: 16, sustoDamage: 8, achouStunS: 3, achouDanoMul: 1.5 },
  /** Regras da arena: uma por vez, com aviso na tela. `every` = a cada quantos ataques uma regra nova começa, por fase. */
  regras: {
    every: [4, 3, 3],
    avisoS: 1,
    lava: { duracaoS: 9, dps: 7, tapetes: 2, raio: 36, scatter: 100 },
    pesados: { duracaoS: 8, dano: 1.2 },
    reverso: { duracaoS: 5 },
  },
};

export const ALE_CFG = {
  cooldown: 3.2,
  /** Apito: depois do aviso, quem se mover durante a janela leva dano ("parar!"). */
  apito: { warnS: 1.5, windowS: 1.6, damage: 12, movePx: 5 },
  /** Cronograma rígido: faixas de zonas de perigo em fila. */
  fila: { count: 5, warnS: 1.3, radius: 22, damage: 12, gap: 38 },
  /** Se o grupo achou as Cruzes do Djanho, o Alê surta e fica atordoado por este tempo no começo da luta. */
  cruzes: { stunS: 5 },
  /** Obstáculos de acampamento: abacaxis-bola entram em campo. */
  obstaculos: { count: 2 },
};

export const TIAGOW_CFG = {
  cooldown: 3.2,
  /** Piadas: perdem o rumo por um instante (provocação). */
  provocacao: { confusaoS: 1.5, every: 4 },
  tiros: { count: 5, spreadDeg: 60, speed: 100, damage: 8, warnS: 1.0 },
  carimbo: { warnS: 1.3, radius: 30, damage: 18 },
  /** Aprende: a cada N segundos ganha 4% de resistência, até o teto. */
  resistencia: { everyS: 12, step: 0.04, max: 0.4 },
  /** Fases pela vida: acima de 66%, entre 33% e 66%, abaixo de 33% (chegada do Lucas). */
  phase1Below: 0.66,
  phase2Below: 0.33,
  fase3Cooldown: 2.6,
};

export const TEMPO_CFG = {
  cooldown: 3.4,
  /** Ponteiros: varredura rotativa de perigos ao longo de um raio. */
  ponteiro: { steps: 7, stepGap: 0.12, stepDist: 30, warnS: 1.3, radius: 18, damage: 14 },
  /** Folhas de calendário: perigos espalhados que somem. */
  folhas: { count: 5, warnS: 1.2, lifeS: 5, radius: 24, dps: 6, impact: 6, scatter: 95 },
  /** Vínculo: se os jogadores vivos ficarem a até esta distância, o Tempo desacelera. */
  vinculoPx: 120,
  vinculoSlow: 1.6,
};


/** Conselhos do Lucas (fase 3 do Tiago W). Um é útil, os outros dois são inúteis ou atrapalham. */
export type AdviceEffect = 'unidade' | 'confusao' | 'nada';

export interface AdviceDef {
  readonly effect: AdviceEffect;
  readonly text: string;
}

export const ADVICE_OPTIONS: readonly AdviceDef[] = [
  { effect: 'unidade', text: 'Fiquem juntos. Sempre funciona melhor.' },
  { effect: 'confusao', text: 'Usem a estratégia de sempre.' },
  { effect: 'nada', text: 'Respirem fundo e esperem o chefe cansar.' },
];

export const ADVICE_UNIDADE = { damage: 1.2, shieldFraction: 0.2, durationS: 20 };
export const ADVICE_CONFUSAO_S = 4;

/** Linha final do Lucas (GDD A.9). */
export const LUCAS_LINHA_FINAL = 'Toda profecia tem um último capítulo. A gente só não escolhe quando ele começa.';

// =====================================================================================
// ELENCO NOVO DE CHEFES (LORE seção 6). Cada chefe aparece uma única vez.
// =====================================================================================

export interface BossMechanic {
  readonly name: string;
  readonly description: string;
}

export interface BossMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

export interface BossDef {
  readonly id: BossId;
  readonly name: string;
  /** Fase (1 a 7), 'extra' para a Arena do Tempo, ou null para chefes secretos opcionais. */
  readonly fase: 1 | 3 | 4 | 5 | 6 | 7 | 'extra' | null;
  readonly concept: string;
  readonly members?: readonly BossMember[];
  readonly mechanics: readonly BossMechanic[];
  /** Fala de entrada, exibida no aviso de chefe. */
  readonly introLine: string;
  /** Pistas plantadas em outros pontos do jogo. */
  readonly foreshadowing?: readonly string[];
  readonly falseFinal?: boolean;
  readonly secret?: boolean;
  /** Condição para desbloquear (chefes secretos). */
  readonly unlock?: string;
  /** Vida base (valor inicial, ajustável nos playtests). */
  readonly hp: number;
}

export const BOSS_ROSTER: readonly BossDef[] = [
  {
    id: 'salsichas',
    name: 'As Salsichas: Geraldo, Monet, Toddy e Bucky',
    fase: 1,
    concept: 'Quatro cachorros salsichas gigantes que agem como uma matilha coordenada dentro da casa.',
    members: [
      { id: 'geraldo', name: 'Geraldo', role: 'Líder do trenzinho' },
      { id: 'monet', name: 'Monet', role: 'Cerco de latidos' },
      { id: 'toddy', name: 'Toddy', role: 'Investida lateral' },
      { id: 'bucky', name: 'Bucky', role: 'Fecha o círculo' },
    ],
    mechanics: [
      { name: 'Um ataque por cachorro', description: 'Geraldo solta o trenzinho de latidos, Monet pinta poças de tinta, Toddy faz uma investida rasante e Bucky abocanha e puxa o grupo.' },
      { name: 'Matilha dividida', description: 'Com dois terços da vida, os quatro se separam e atacam cada um por conta própria. Quem perde o vigor se deita exausto.' },
      { name: 'Salsichão', description: 'Com um terço da vida, os quatro viram uma fila só, mais rápida, com ataques combinados.' },
      { name: 'Corrida pela comida', description: 'A geladeira se abre e solta comida. Quem chega primeiro leva: o cachorro que come se cura e fica parado; o jogador que come distrai a matilha.' },
    ],
    introLine: 'Au! Au! Au! Au!',
    hp: 900,
  },
  {
    id: 'juninho',
    name: 'Juninho e as Azuletes',
    fase: 3,
    concept: 'CEO rabugento (não é velho, só ranzinza), acima do peso e mestre em tecnologia, com duas capangas pintadas de azul.',
    members: [
      { id: 'juninho', name: 'Juninho', role: 'CEO: drones, lasers, zonas de cronograma, e-mails e reunião obrigatória' },
      { id: 'mariana', name: 'Mariana', role: 'Azulete hiperativa: investidas com rastro de tinta; cansa depois de algumas' },
      { id: 'melina', name: 'Melina', role: 'Azulete sarcástica: escudo no Juninho e ironias que dão debuff' },
    ],
    mechanics: [
      { name: 'Drones', description: 'Dois drones miram lasers telegrafados nos jogadores (em dobro na fase 3).' },
      { name: 'Zonas de cronograma', description: 'Áreas de burocracia no chão deixam lento; quando o prazo acaba, explodem. A Mariana tropeça nelas.' },
      { name: 'Notificação de e-mail', description: 'Leque de projéteis curtos.' },
      { name: 'Reunião obrigatória', description: 'Um círculo grande puxa todo mundo para perto do Juninho e deixa lento.' },
      { name: 'Rastro de tinta', description: 'Mariana investe em linha reta e deixa poças de tinta azul; depois de 3 ou 4 investidas ela fica sem fôlego e leva +50% de dano.' },
      { name: 'Escudo sarcástico', description: 'Melina bota um escudo no Juninho; quebrá-lo (ou acertar a Melina, que o desgasta em dobro) atordoa o grupo.' },
      { name: 'Ironia', description: 'Projéteis lentos da Melina que dão debuff de dano e velocidade de ataque por 5 s.' },
      { name: 'Fases', description: 'Expediente (100 a 60%), Reestruturação (60 a 30%) e Prazo final (abaixo de 30%, com "hora extra").' },
    ],
    introLine: 'Isso aqui não estava no cronograma.',
    hp: 1500,
  },
  {
    id: 'rm',
    name: 'RM (Kim Namjoon)',
    fase: 4,
    concept: 'Ídolo que tenta roubar a Melissa do Comitê.',
    mechanics: [
      { name: 'Feixe de encanto', description: 'RM cria um feixe de luz que puxa a Melissa na direção dele. O time precisa interceptar ou puxá-la de volta.' },
      { name: 'Transe', description: 'Se a Melissa alcançar o RM, ela se junta a ele e ataca a própria equipe com versões corrompidas das suas habilidades.' },
      { name: 'Quebrar o transe', description: 'O time esvazia a barra de transe com ataques não letais, com a Pausa Dramática do Mauro ou com a aura da Thayssa.' },
    ],
    introLine: 'Vem comigo. O palco é grande.',
    hp: 1800,
  },
  {
    id: 'christopher',
    name: 'Christopher',
    fase: 5,
    concept: 'Um conceito de destruição com mentalidade infantil e forma etérea. Faz sempre o que quer, não escuta ninguém e adora atenção.',
    mechanics: [
      { name: 'Atenção', description: 'Uma barra de atenção: sobe com alguém por perto e desce com todo mundo longe. Muito alta, ele ataca mais depressa; zerada, entra em birra.' },
      { name: 'Birra', description: 'Anéis de choque com vãos para atravessar. Depois ele chora exausto: não ataca e leva +40% de dano.' },
      { name: 'Pique-pega', description: 'Marca um jogador: a marca passa por toque para um aliado em 6 s ou explode em quem a carrega.' },
      { name: 'Esconde-esconde', description: 'Três cópias e o verdadeiro giram em carrossel. Acertar uma cópia dá um susto; achar o verdadeiro o atordoa.' },
      { name: 'Chuva de brinquedos', description: 'Bolas rolam pelo chão e estouram em sequência (cada passo avisa antes).' },
      { name: 'Regras da arena', description: 'O chão é lava (só os tapetes salvam), pés pesados (lento, mas com mais dano) e tudo ao contrário (controles invertidos).' },
      { name: 'Fases', description: 'Brincadeira (100 a 65%), Hora do doce (65 a 30%, mais rápido) e Birra total (abaixo de 30%).' },
    ],
    introLine: 'EU QUERO! EU QUERO! ME OLHA!',
    hp: 3500,
  },
  {
    id: 'ale',
    name: 'Alê',
    fase: 6,
    concept: 'Tecnicamente foi quem criou o Comitê, mas nem sabe disso. É o comandante dos retiros e eventos que o Comitê organiza.',
    mechanics: [
      { name: 'Apito', description: 'O apito dá ordens: parar, correr, formar fila. Quem desobedece leva dano.' },
      { name: 'Cronograma rígido', description: 'A arena segue um cronograma de atividades em turnos, telegrafado.' },
      { name: 'Obstáculos de acampamento', description: 'Barracas, cordas e bolas de vôlei viram obstáculos na arena.' },
      { name: 'Reação às Cruzes do Djanho', description: 'Se o grupo coletou as Cruzes do Djanho, o Alê reage de forma especial.' },
    ],
    introLine: 'Atenção, atenção! Formar fila!',
    foreshadowing: ['Cruzes do Djanho na Galeria do Mauro'],
    hp: 2400,
  },
  {
    id: 'tiagow',
    name: 'Tiago W',
    fase: 7,
    concept: 'Irmão mais velho do Sábio Lucas. Não tem medo de nada, faz piadas o tempo todo e sabe muito sobre tudo. Falso chefe final.',
    falseFinal: true,
    mechanics: [
      { name: 'Provocações', description: 'Piadas constantes que aplicam debuffs de provocação e irritação.' },
      { name: 'Conhece tudo', description: 'Adapta-se: cria resistência aos padrões de ataque repetidos pelos jogadores.' },
      { name: 'Conselho de irmão', description: 'Lucas aparece e dá os três conselhos clássicos (bom, confuso, inútil).' },
    ],
    introLine: 'Ah, os famosos Escolhidos. Meu irmão me falou bastante de vocês.',
    hp: 2800,
  },
  {
    id: 'tempo',
    name: 'O Próprio Tempo',
    fase: 'extra',
    concept:
      'A inevitabilidade de o ano acabar e de o grupo mudar. O grupo não destrói o Tempo: sobrevive a ele e prova que o vínculo continua, mesmo à distância.',
    secret: true,
    unlock: 'Derrotar o Tiago W na Igreja Unidos. O relógio para e o grupo é levado para a Arena do Tempo.',
    foreshadowing: [
      'Relógio do Coelho do Relógio',
      'Folhas de calendário nas fases',
      'Falas nas Safe Rooms sobre o fim do ano',
      'Calendário de 7 de setembro na Galeria do Mauro (espelho do 31 de dezembro)',
    ],
    mechanics: [
      { name: 'Ponteiros', description: 'Ponteiros gigantes varrem a arena num ritmo que acelera e desacelera.' },
      { name: 'Folhas de calendário', description: 'Folhas viram plataformas e depois cinzas: o chão se perde aos poucos.' },
      { name: 'Vínculo', description: 'Quanto mais perto os cinco ficam, mais o Tempo desacelera. O objetivo é sobreviver, não destruir.' },
    ],
    introLine: 'Todo ano acaba. Isso não é pessoal.',
    hp: 4000,
  },
  {
    id: 'lula',
    name: 'Lula',
    fase: null,
    concept: 'Chefe secreto opcional (easter egg). Não interfere na trama principal.',
    secret: true,
    unlock: 'Condição especial a definir no playtest.',
    mechanics: [{ name: 'A definir', description: 'Tom de piada interna, sem sátira política. Mecânica a definir.' }],
    introLine: 'A definir.',
    hp: 1000,
  },
  {
    id: 'bolsonaro',
    name: 'Bolsonaro',
    fase: null,
    concept: 'Chefe secreto opcional (easter egg). Não interfere na trama principal.',
    secret: true,
    unlock: 'Condição especial a definir no playtest.',
    mechanics: [{ name: 'A definir', description: 'Tom de piada interna, sem sátira política. Mecânica a definir.' }],
    introLine: 'A definir.',
    hp: 1000,
  },
];

export function bossById(id: BossId): BossDef {
  return BOSS_ROSTER.find((b) => b.id === id)!;
}
