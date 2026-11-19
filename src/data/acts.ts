// Estrutura da campanha: 7 mapas estáticos + a Arena do Tempo (GDD A.7, LORE seção 5).
// PHASES descreve cada fase; PHASE_TUNING (mais abaixo) afina duração, spawn, vida e cenário.

import type { Wall } from '../engine/walls';
import type { Mood } from './emotion';
import type { CollectibleId } from './gallery';
import type { SafeRoomId } from './safeRooms';
import type { YouthId } from './youth';

export type FloorTheme = 'madeira' | 'asfalto' | 'pedra';

export interface PropDef {
  readonly id: 'caixas' | 'calendario' | 'tigela';
  readonly x: number;
  readonly y: number;
  /** Segundo DA FASE em que o objeto aparece. */
  readonly appearAt: number;
}

/** Afinação de cada fase (índice 0 = fase 1 ... 6 = fase 7, 7 = Arena do Tempo). Valores iniciais. */
export interface PhaseTuning {
  /** Segundos de exploração até o chefe da fase (ou até o portal, na fase 2). */
  readonly durationS: number;
  /** Inimigos por segundo no início da fase e quanto sobe por segundo. */
  readonly spawnBase: number;
  readonly spawnRamp: number;
  /** Multiplicador de vida dos inimigos comuns da fase. */
  readonly hpMul: number;
  readonly walls: readonly Wall[];
  readonly props: readonly PropDef[];
}

const CASA: readonly Wall[] = [
  { x: -110, y: -70, w: 56, h: 22 },
  { x: 70, y: 36, w: 26, h: 26 },
  { x: 20, y: -120, w: 90, h: 14 },
];
/** Casa do Felipe (fase 1): as paredes são o sofá, a mesinha de centro e a bancada da cozinha. */
const PROPS_CASA: readonly string[] = ['sofa', 'mesinha', 'bancada'];
const CASA_FASE1: readonly Wall[] = CASA.map((w, i) => ({ ...w, prop: PROPS_CASA[i] }));
const RUA: readonly Wall[] = [
  { x: -130, y: 50, w: 44, h: 20 },
  { x: 84, y: -84, w: 44, h: 20 },
  { x: -6, y: -110, w: 12, h: 12 },
];
const IGREJA: readonly Wall[] = [
  { x: -100, y: -50, w: 64, h: 10 },
  { x: -100, y: -26, w: 64, h: 10 },
  { x: 40, y: 30, w: 64, h: 10 },
  { x: -4, y: -100, w: 14, h: 14 },
];

export const PHASE_TUNING: readonly PhaseTuning[] = [
  { durationS: 150, spawnBase: 1.2, spawnRamp: 0.022, hpMul: 1, walls: CASA_FASE1, props: [{ id: 'caixas', x: -150, y: -96, appearAt: 60 }, { id: 'tigela', x: -60, y: 70, appearAt: 0 }] },
  { durationS: 120, spawnBase: 2.5, spawnRamp: 0.02, hpMul: 1.25, walls: RUA, props: [] },
  { durationS: 150, spawnBase: 3.5, spawnRamp: 0.02, hpMul: 1.55, walls: RUA, props: [] },
  { durationS: 150, spawnBase: 4.5, spawnRamp: 0.02, hpMul: 1.9, walls: IGREJA, props: [] },
  { durationS: 150, spawnBase: 5.5, spawnRamp: 0.02, hpMul: 2.3, walls: CASA, props: [{ id: 'calendario', x: 110, y: -128, appearAt: 0 }] },
  { durationS: 150, spawnBase: 6.5, spawnRamp: 0.02, hpMul: 2.7, walls: RUA, props: [{ id: 'calendario', x: 110, y: -128, appearAt: 0 }] },
  { durationS: 150, spawnBase: 7.5, spawnRamp: 0.02, hpMul: 3.2, walls: IGREJA, props: [] },
  { durationS: 4, spawnBase: 4, spawnRamp: 0, hpMul: 3, walls: [], props: [] },
];

/**
 * Multiplicador do dano que os inimigos (contato, projéteis, áreas e chefes) causam, por fase (0 a 7).
 * Antes só a vida crescia, então a partir da fase 3 o grupo quase não sofria dano: agora o perigo sobe junto.
 */
export const ENEMY_DAMAGE_MUL: readonly number[] = [0.7, 0.9, 1.05, 1.25, 1.45, 1.7, 1.95, 1.95];

export function danoDaFase(index: number): number {
  return ENEMY_DAMAGE_MUL[Math.min(Math.max(0, index), ENEMY_DAMAGE_MUL.length - 1)]!;
}

/** Afinação da fase pelo índice (0 a 7). */
export function tuningDaFase(index: number): PhaseTuning {
  return PHASE_TUNING[Math.min(Math.max(0, index), PHASE_TUNING.length - 1)]!;
}


// =====================================================================================
// CAMPANHA NOVA: 7 mapas + Arena do Tempo (LORE seção 5)
// =====================================================================================

export type PhaseId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'extra';

export type BossId = 'salsichas' | 'juninho' | 'rm' | 'christopher' | 'ale' | 'tiagow' | 'tempo' | 'lula' | 'bolsonaro';

/**
 * Os mapas são ESTÁTICOS e completos (nada de geração procedural): salas de exploração,
 * Safe Rooms e alterações dinâmicas durante as lutas contra chefes. A implementação pode ser
 * progressiva nas próximas versões, mas a arquitetura já é esta.
 */
export interface MapArchitecture {
  /** Sempre falso: não há geração procedural. */
  readonly procedural: false;
  /** Salas de exploração (nomes de referência para quem desenhar o mapa). */
  readonly rooms: readonly string[];
  readonly safeRooms: readonly SafeRoomId[];
  /** O que o mapa muda durante a luta contra o chefe. */
  readonly bossFightChanges: readonly string[];
}

export interface PhaseDef {
  readonly id: PhaseId;
  /** 1 a 7, e 8 para a Arena do Tempo (só para ordenar). */
  readonly order: number;
  readonly name: string;
  readonly scenario: string;
  readonly rescue: readonly YouthId[];
  /** Chefe único da fase (se houver). */
  readonly boss: BossId | null;
  /** Falso chefe final: o jogador acha que é o último. */
  readonly falseFinalBoss?: boolean;
  /** Fase secreta: só abre depois do Tiago W. */
  readonly secret?: boolean;
  readonly floor: FloorTheme | 'arena';
  readonly map: MapArchitecture;
  /** Colecionáveis que podem aparecer na fase (a Galeria do Mauro). */
  readonly collectibles: readonly CollectibleId[];
  /** Humor de abertura da fase. */
  readonly openingMood: Mood;
  /** Desfecho narrativo curto. */
  readonly outcome: string;
}

export const PHASES: readonly PhaseDef[] = [
  {
    id: 1,
    order: 1,
    name: 'A Casa e a Geladeira do Felipe',
    scenario: 'Sala, cozinha e o interior da geladeira, que é maior por dentro.',
    rescue: ['tamires'],
    boss: 'salsichas',
    floor: 'madeira',
    map: {
      procedural: false,
      rooms: ['Sala', 'Cozinha', 'Corredor', 'Interior da geladeira'],
      safeRooms: ['f1-despensa'],
      bossFightChanges: ['Comida cai no chão e distrai as salsichas', 'A passagem da geladeira se fecha'],
    },
    collectibles: ['arminha', 'papelao', 'headset'],
    openingMood: 'respiro',
    outcome: 'Tamires resgatada. A matilha de salsichas é derrotada.',
  },
  {
    id: 2,
    order: 2,
    name: 'Ivoti',
    scenario: 'Cidadezinha de interior: ruas calmas, praça, varanda, cuca em toda parte.',
    rescue: ['rebeca'],
    boss: null,
    floor: 'asfalto',
    map: {
      procedural: false,
      rooms: ['Praça', 'Rua principal', 'Padaria', 'Clareira do portal'],
      safeRooms: ['f2-varanda'],
      bossFightChanges: ['Sem chefe: encontro com o Lucas e os aprendizes no portal'],
    },
    collectibles: ['papelao', 'postes', 'mascara', 'bexiga'],
    openingMood: 'respiro',
    outcome: 'Rebeca resgatada. No portal, Lucas apresenta Marina, Matias e Gideão e abre o caminho para o Parcão.',
  },
  {
    id: 3,
    order: 3,
    name: 'O Parcão',
    scenario: 'O parque da cidade: lago, quiosques, gramado e uma sede de empresa improvisada.',
    rescue: ['crazy'],
    boss: 'juninho',
    floor: 'pedra',
    map: {
      procedural: false,
      rooms: ['Entrada', 'Gramado', 'Lago', 'Quiosque', 'Escritório improvisado do Juninho'],
      safeRooms: ['f3-quiosque'],
      bossFightChanges: ['Zonas de cronograma pintam o chão', 'Drones sobrevoam a arena', 'Rastros de tinta azul cobrem o gramado'],
    },
    collectibles: ['arminha', 'postes', 'bola', 'chave', 'bomba'],
    openingMood: 'respiro',
    outcome: 'Crazy resgatado. Juninho e as Azuletes são derrotados.',
  },
  {
    id: 4,
    order: 4,
    name: 'O Cinema',
    scenario: 'Sala de projeção, saguão, corredor das poltronas e uma tela que mostra o que não deveria.',
    rescue: ['debora'],
    boss: 'rm',
    floor: 'pedra',
    map: {
      procedural: false,
      rooms: ['Bilheteria', 'Saguão', 'Corredor das poltronas', 'Sala de projeção'],
      safeRooms: ['f4-saguao'],
      bossFightChanges: ['A tela vira palco', 'Um feixe de luz puxa a Melissa em direção ao RM'],
    },
    collectibles: ['guitarra', 'oculos', 'mascara', 'headset'],
    openingMood: 'queda',
    outcome: 'Débora resgatada. RM é derrotado; a Melissa continua no Comitê.',
  },
  {
    id: 5,
    order: 5,
    name: 'A Expointer',
    scenario: 'Pavilhões, currais, feira, estande de maquinário e o céu aberto do parque de exposições.',
    rescue: ['francis', 'fabi'],
    boss: 'christopher',
    floor: 'madeira',
    map: {
      procedural: false,
      rooms: ['Pavilhão principal', 'Currais', 'Feira de produtos', 'Arena central'],
      safeRooms: ['f5-galpao'],
      bossFightChanges: ['As regras da arena mudam de repente (gravidade, direção, tamanho)'],
    },
    collectibles: ['terere', 'chave', 'bomba', 'calendario'],
    openingMood: 'respiro',
    outcome: 'Francis e Fabi resgatados. Christopher é derrotado (ou finalmente recebe atenção).',
  },
  {
    id: 6,
    order: 6,
    name: 'O Sítio da Dona Marlene',
    scenario: 'Retiro de interior: casa, campo de vôlei, horta, trilha, varanda grande e um sino.',
    rescue: ['robson', 'gabriel'],
    boss: 'ale',
    floor: 'madeira',
    map: {
      procedural: false,
      rooms: ['Casa da Dona Marlene', 'Campo de vôlei', 'Horta', 'Trilha', 'Pátio do retiro'],
      safeRooms: ['f6-varanda-marlene'],
      bossFightChanges: ['O apito divide a arena em turnos', 'Obstáculos de acampamento aparecem na arena'],
    },
    collectibles: ['cruzes', 'bola', 'terere', 'bexiga'],
    openingMood: 'respiro',
    outcome: 'Robson e Gabriel resgatados. Alê é derrotado e continua sem saber que criou o Comitê.',
  },
  {
    id: 7,
    order: 7,
    name: 'A Igreja Unidos',
    scenario: 'O último evento: pátio, salão, sala do coral, vitrais e bancos de madeira.',
    rescue: ['estevao', 'bigjohn'],
    boss: 'tiagow',
    falseFinalBoss: true,
    floor: 'pedra',
    map: {
      procedural: false,
      rooms: ['Pátio', 'Salão do evento', 'Corredor dos vitrais', 'Sala do coral'],
      safeRooms: ['f7-sala-de-coral'],
      bossFightChanges: ['O salão se enche de jovens aplaudindo', 'No fim, o relógio da parede para'],
    },
    collectibles: ['guitarra', 'oculos', 'headset', 'calendario'],
    openingMood: 'queda',
    outcome: 'Estevão e Big John resgatados. Tiago W é derrotado. O evento acontece. O relógio para.',
  },
  {
    id: 'extra',
    order: 8,
    name: 'A Arena do Tempo',
    scenario: 'Um espaço fora de lugar: ponteiros gigantes, folhas de calendário caindo, relógios parados.',
    rescue: [],
    boss: 'tempo',
    secret: true,
    floor: 'arena',
    map: {
      procedural: false,
      rooms: ['Arena única'],
      safeRooms: [],
      bossFightChanges: ['Ponteiros varrem o chão', 'Folhas de calendário viram plataformas e depois cinzas'],
    },
    collectibles: [],
    openingMood: 'queda',
    outcome: 'O grupo sobrevive ao Tempo e prova que o vínculo continua. Epílogo.',
  },
];

/** Gatilho da Arena do Tempo: derrotar o Tiago W na Igreja Unidos. */
export const TIME_ARENA_TRIGGER = {
  afterBoss: 'tiagow' as BossId,
  cutsceneLine: 'O relógio da parede parou. Todos os relógios do mundo pararam junto.',
};

export function phaseById(id: PhaseId): PhaseDef {
  return PHASES.find((p) => p.id === id)!;
}

// ---- Cutscenes (início da campanha, resgates, transições principais) ----
export type CutsceneKind = 'inicio' | 'resgate' | 'transicao' | 'epilogo';

export interface CutsceneDef {
  readonly id: string;
  readonly kind: CutsceneKind;
  /** Legenda de uma linha. Os diálogos completos ficam em lucas.ts e youth.ts. */
  readonly caption: string;
  readonly phase?: PhaseId;
  readonly source: 'lucas.ts' | 'youth.ts' | 'acts.ts';
}

export const CUTSCENES: readonly CutsceneDef[] = [
  { id: 'intro', kind: 'inicio', caption: 'Sexta à noite, casa do Felipe. Lucas surge do nada.', source: 'lucas.ts' },
  { id: 'resgate-tamires', kind: 'resgate', caption: 'Tamires, ao lado da geladeira.', phase: 1, source: 'youth.ts' },
  { id: 'resgate-rebeca', kind: 'resgate', caption: 'Rebeca, esperando para economizar bateria.', phase: 2, source: 'youth.ts' },
  { id: 'portal-ivoti', kind: 'transicao', caption: 'No portal: Lucas, Marina, Matias e Gideão.', phase: 2, source: 'lucas.ts' },
  { id: 'resgate-crazy', kind: 'resgate', caption: 'Crazy e a lista de equipamentos.', phase: 3, source: 'youth.ts' },
  { id: 'resgate-debora', kind: 'resgate', caption: 'Débora desenhando no meio do caos.', phase: 4, source: 'youth.ts' },
  { id: 'resgate-francis-fabi', kind: 'resgate', caption: 'Francis (lá de cima) e Fabi (com a cuia).', phase: 5, source: 'youth.ts' },
  { id: 'resgate-robson-gabriel', kind: 'resgate', caption: 'Robson segura o portão. Gabriel está ali. Ninguém sabe por quê.', phase: 6, source: 'youth.ts' },
  { id: 'resgate-estevao-bigjohn', kind: 'resgate', caption: 'Estevão faz continência. Big John já carregou as cadeiras.', phase: 7, source: 'youth.ts' },
  { id: 'relogio-para', kind: 'transicao', caption: 'O relógio para. O grupo vai para a Arena do Tempo.', phase: 'extra', source: 'acts.ts' },
  { id: 'epilogo', kind: 'epilogo', caption: 'Última sexta do ano. Comitê, sem data para acabar.', source: 'acts.ts' },
];

// ---- Epílogo ----
export const EPILOGUE_INTRO: readonly string[] = [
  'Última sexta do ano.',
  'Ninguém comentou o calendário.',
  'A casa ficou quieta por um tempo.',
  'Então alguém pegou o violão.',
];

export const EPILOGUE_LINES = {
  felipe: 'Eu não sei o que vem. Mas já tem uma música pensando nisso.',
  mauro: 'Vou anotar. Não sei o que vou lembrar, mas vou anotar.',
  melissa: 'A gente marca a próxima. Mesmo que seja em chamada.',
  thaisa: 'A gente se vê. Eu sei que a gente se vê.',
  thayssa: 'A gente se abraça de novo. Vai demorar, mas vai.',
} as const;

export const EPILOGUE_FINAL = 'Comitê — sem data para acabar.';
