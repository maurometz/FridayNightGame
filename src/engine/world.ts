import { updateKits } from '../characters/kits';
import { createSynergy, tryActivateUltimate, updateSynergy } from '../synergy';
import type { SynergyState } from '../synergy/state';
import { chooseAdvice, type PendingAdvice } from '../combat/advice';
import { updateHazards, updateHostiles } from '../combat/hostile';
import type { Message } from '../combat/messages';
import { iniciarPartida, updateRun } from '../combat/run';
import type { Mood } from '../data/emotion';
import type { DevSettings } from '../game/settings';
import type { CutsceneState } from '../ui/cutscene';
import { createLiveStats, type LiveStats } from '../data/stats';
import type { FloorCollectible, Minigame, RealtimeEvent } from '../entities/gameEvent';
import { createInteractionState, updateInteractions, type InteractionState } from '../narrative/interactions';
import { createHazard, type Hazard } from '../entities/hazard';
import { createHostile, type Hostile } from '../entities/hostile';
import { pushOutOfWalls, type Wall } from './walls';
import { createDamageNumber, MAX_DAMAGE_NUMBERS, type DamageNumber } from '../combat/damageNumbers';
import { createEffect, type Effect } from '../entities/effect';
import { createFood, type Food } from '../entities/food';
import { emTranse } from '../combat/bosses';
import { updateFoods } from '../combat/foods';
import { MAX_FOODS } from '../data/thaisa';
import { updateDamageNumbers } from '../combat/damageNumbers';
import { updateRevive } from '../combat/revive';
import { updateStatus } from '../combat/status';
import { updateVehicles } from '../combat/vehicles';
import { VEHICLES, type VehiclePickup } from '../data/vehicles';
import { updateEffects } from '../combat/effects';
import { updateMinigame } from '../combat/events';
import { updateMessages } from '../combat/messages';
import { updatePerks } from '../combat/perks';
import { healPlayer } from '../combat/playerStats';
import { updateEnemies } from '../combat/enemies';
import { updateGems } from '../combat/gems';
import { chooseCard, pushChoice, type PendingChoice } from '../combat/leveling';
import { updateProjectiles } from '../combat/projectiles';
import { updateSpawner } from '../combat/spawner';
import { BASE_SPEED_PX_PER_S, HASH_CELL, LOGICAL_HEIGHT, LOGICAL_WIDTH, MAX_ENEMIES, MAX_GEMS, MAX_PROJECTILES, STEP_S } from '../data/balance';
import type { CharacterId } from '../data/characters';
import { createEnemy, type Enemy } from '../entities/enemy';
import { createGem, type Gem } from '../entities/gem';
import { createPlayer, type Player } from '../entities/player';
import { createProjectile, type Projectile } from '../entities/projectile';
import { NO_INPUT, type PlayerInput } from './input';
import { Pool } from './pool';
import { Rng } from './rng';
import { SpatialHash } from './spatialHash';

export type WorldStatus = 'playing' | 'gameover' | 'victory';

export type { Wall };

/**
 * Estado da simulação. Não conhece canvas, teclado nem rede:
 * recebe PlayerInput por jogador e avança um passo fixo.
 */
export interface World {
  tick: number;
  status: WorldStatus;
  players: Player[];
  enemies: Pool<Enemy>;
  projectiles: Pool<Projectile>;
  gems: Pool<Gem>;
  /** Efeitos visuais de curta duração (anéis, feixes, textos). */
  effects: Pool<Effect>;
  /** Números de dano flutuantes (só visual). */
  damageNumbers: Pool<DamageNumber>;
  /** Veículos no chão esperando o dono. */
  vehiclePickups: VehiclePickup[];
  /** Comidas no chão. */
  foods: Pool<Food>;
  /** Perigos no chão (avisos e impactos dos inimigos e chefes). */
  hazards: Pool<Hazard>;
  /** Projéteis inimigos. */
  hostiles: Pool<Hostile>;
  /** Paredes do cenário do ato atual. */
  walls: Wall[];
  /** Fase atual da campanha: 0 a 6 (fases 1 a 7) e 7 (Arena do Tempo). */
  act: number;
  /** Tick em que a fase atual começou. */
  phaseStartTick: number;
  /** O chefe da fase já nasceu (ou a fase sem chefe já acabou). */
  bossSpawned: boolean;
  /** Chefe em campo: os inimigos comuns param de nascer. */
  bossFight: boolean;
  /** Jovens já resgatados (ids de data/youth.ts). */
  rescued: string[];
  /** Chefes derrotados (ids de BossId). */
  bossesDefeated: string[];
  /** Transe do RM: quem está encantado (slot) e quanto falta para quebrar. */
  trance: { slot: number; meter: number; caught: boolean } | null;
  /**
   * Melissa convidada da luta contra o RM: aparece só quando a Melissa não está na partida, para fazer as mecânicas
   * do transe, e some quando o RM cai. Não é um jogador (não está em `players`): os inimigos a ignoram.
   * Quando ela é a encantada, `trance.slot` vale CONVIDADA_SLOT.
   */
  convidada: Player | null;
  /** Humor do ciclo emocional e mistura de paleta (0 = respiro, 1 = queda). */
  mood: Mood;
  moodBlend: number;
  /** Humor imposto por um evento da história (Termo de Encerramento). */
  moodOverride: { mood: Mood; left: number } | null;
  /** Fila de mensagens e falas na tela. */
  messages: Message[];
  /** Conselho do Lucas pendente (pausa o jogo até escolher). */
  advice: PendingAdvice | null;
  /** O Lucas está em cena (fase 3 do Tiago W). */
  lucasVisible: boolean;
  /** Safe Rooms já visitadas (para o aviso de entrada). */
  safeSeen: string[];
  /** Contadores da tela de estatísticas. */
  stats: LiveStats;
  /** Fonte de dano em curso (Ultimates, Saideira). Nulo: a arma do personagem. */
  statSource: string | null;
  /** Colecionáveis da Galeria do Mauro achados nesta partida. */
  collected: string[];
  /** Colecionáveis no chão da fase atual. */
  floorCollectibles: FloorCollectible[];
  /** O evento aleatório desta fase já foi sorteado (no máximo 1 por fase). */
  eventRolled: boolean;
  /** Segundos da fase em que o evento vai disparar (sorteado ao entrar na fase). */
  eventAtS: number;
  /** Evento em tempo real em cena. */
  realtimeEvent: RealtimeEvent | null;
  /** Minigame em andamento: pausa o combate e o spawn. */
  minigame: Minigame | null;
  /** Jovens resgatados na fase que acabou: aparecem no começo da fase seguinte. */
  resgatadosRecentes: string[];
  /** Jovens que acompanham o grupo na fase atual (desenhados com a imagem de npcs/, se existir). */
  youthNaFase: { id: string; x: number; y: number }[];
  /** Fase para onde o grupo vai depois das cutscenes (a Arena do Tempo, depois do Tiago W). Nulo = nenhuma. */
  faseDestino: number | null;
  /** Transição em andamento (vórtice do Tempo): o jogo fica parado. `t` conta os quadros de tela. */
  transicao: { t: number } | null;
  /** Cutscenes de resgate e de chefe ligadas (desligadas nos testes e no modo dev). */
  cutscenesOn: boolean;
  /** Cutscene em andamento (pausa o jogo até acabar). */
  cutscene: CutsceneState | null;
  /** Modo dev (menu): duração das fases, invulnerabilidade e dano. Nulo numa partida normal. */
  dev: DevSettings | null;
  /** Sem chefes (testes). */
  noBosses: boolean;
  /** Co-op local: a câmera é compartilhada, então os jogadores vivos não podem se afastar mais do que cabe na tela. */
  coopLeash: boolean;
  /** Sinergia: barras por par, Ultimates em andamento e a Saideira. */
  synergy: SynergyState;
  /** Fração da velocidade dos inimigos (1 = normal, 0,25 = câmera lenta da Pausa Dramática). */
  enemySpeedMul: number;
  /** Clones que provocam os inimigos (Sobremesa Espectral). `t` é o raio da provocação. */
  decoys: { x: number; y: number; t: number }[];
  /** Hash dos inimigos, reconstruído a cada passo. */
  hash: SpatialHash<Enemy>;
  rng: Rng;
  /** Escolhas de carta pendentes. Enquanto houver uma, a simulação pausa. */
  choices: PendingChoice[];
  nextUid: number;
  spawnAcc: number;
  /** Modo de teste de carga: mantém este número de inimigos, jogadores invulneráveis, cartas automáticas. */
  stress: number;
  /** Buffer reaproveitado nas consultas ao hash. */
  scratch: Enemy[];
  /** Sem spawn natural de inimigos. */
  noSpawn: boolean;
  /** Conversas entre personagens (A.10). */
  interactions: InteractionState;
}

/** Slot da Melissa convidada da luta do RM (fora do intervalo dos jogadores reais, que vão de 0 a 4). */
export const CONVIDADA_SLOT = 9;

export interface WorldOptions {
  seed?: number;
  /** Mantém N inimigos vivos o tempo todo (teste de carga). 0 desliga. */
  stress?: number;
  /** Abre a escolha de carta do nível 1 antes da partida (GDD A.5). Padrão: true. */
  initialChoice?: boolean;
  /** Desliga o spawn natural de inimigos (testes e cenários controlados). */
  noSpawn?: boolean;
  /** Desliga os chefes dos horários marcados (testes e cenários controlados). */
  noBosses?: boolean;
  /** Co-op local: limita a distância entre os jogadores vivos ao tamanho da tela. */
  coopLeash?: boolean;
  /** Permite repetir interações já vistas na mesma partida. */
  repeatInteractions?: boolean;
  /** Liga as cutscenes de resgate e de chefe (o main liga numa partida normal). */
  cutscenes?: boolean;
  /** Modo dev: invulnerabilidade, multiplicador de dano e duração das fases (a fase inicial é aplicada por quem cria o mundo). */
  dev?: DevSettings;
}

/** Margem de segurança até a borda da tela no co-op local, em pixels. */
const LEASH_MARGEM = 28;

/** Centro da câmera no co-op: o ponto médio dos jogadores vivos (ou de todos, se ninguém está de pé). */
export function centroDoGrupo(world: World): { x: number; y: number } {
  let lista = world.players.filter((p) => p.hp > 0);
  if (lista.length === 0) lista = world.players;
  let x = 0;
  let y = 0;
  for (const p of lista) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, lista.length);
  return { x: x / n, y: y / n };
}

/** Mantém os jogadores vivos dentro de uma tela um do outro (a câmera é uma só). */
function limitarDistancia(world: World): void {
  const vivos = world.players.filter((p) => p.hp > 0);
  if (vivos.length < 2) return;
  const c = centroDoGrupo(world);
  const meioL = LOGICAL_WIDTH / 2 - LEASH_MARGEM;
  const meioA = LOGICAL_HEIGHT / 2 - LEASH_MARGEM;
  for (const p of vivos) {
    p.x = Math.min(c.x + meioL, Math.max(c.x - meioL, p.x));
    p.y = Math.min(c.y + meioA, Math.max(c.y - meioA, p.y));
  }
}

export function createWorld(characters: readonly CharacterId[], opts: WorldOptions = {}): World {
  const world: World = {
    tick: 0,
    status: 'playing',
    players: characters.map((id, slot) => createPlayer(slot, id, slot * 24, 0)),
    enemies: new Pool(createEnemy, MAX_ENEMIES),
    projectiles: new Pool(createProjectile, MAX_PROJECTILES),
    gems: new Pool(createGem, MAX_GEMS),
    effects: new Pool(createEffect, 96),
    damageNumbers: new Pool(createDamageNumber, MAX_DAMAGE_NUMBERS),
    vehiclePickups: [],
    foods: new Pool(createFood, MAX_FOODS),
    hazards: new Pool(createHazard, 96),
    hostiles: new Pool(createHostile, 160),
    walls: [],
    act: 0,
    phaseStartTick: 0,
    bossSpawned: false,
    bossFight: false,
    rescued: [],
    bossesDefeated: [],
    trance: null,
    convidada: null,
    mood: 'respiro',
    moodBlend: 0,
    moodOverride: null,
    messages: [],
    advice: null,
    lucasVisible: false,
    noBosses: opts.noBosses ?? false,
    coopLeash: opts.coopLeash ?? false,
    dev: opts.dev ?? null,
    safeSeen: [],
    stats: createLiveStats(),
    statSource: null,
    collected: [],
    floorCollectibles: [],
    eventRolled: false,
    eventAtS: 0,
    realtimeEvent: null,
    minigame: null,
    cutscene: null,
    resgatadosRecentes: [],
    youthNaFase: [],
    faseDestino: null,
    transicao: null,
    cutscenesOn: opts.cutscenes ?? false,
    synergy: createSynergy(characters.length),
    enemySpeedMul: 1,
    decoys: [],
    hash: new SpatialHash<Enemy>(HASH_CELL),
    rng: new Rng(opts.seed ?? 1),
    choices: [],
    nextUid: 1,
    spawnAcc: 0,
    stress: opts.stress ?? 0,
    scratch: [],
    noSpawn: opts.noSpawn ?? false,
    interactions: createInteractionState(opts.repeatInteractions ?? false),
  };
  iniciarPartida(world);
  if (opts.initialChoice ?? true) {
    for (const p of world.players) pushChoice(world, p);
  }
  return world;
}

/** Raio do jogador contra paredes do cenário. */
const PLAYER_WALL_RADIUS = 5;

/** Vetor de movimento normalizado: andar na diagonal não é mais rápido. */
export function normalizeMove(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len <= 1) return { x, y };
  return { x: x / len, y: y / len };
}

export function stepWorld(world: World, inputs: readonly PlayerInput[]): void {
  if (world.status !== 'playing') return;
  // Cutscene: o jogo espera (quem desenha avança as falas).
  if (world.cutscene) return;
  // Transição entre a igreja e a Arena do Tempo: o jogo espera.
  if (world.transicao) return;

  // Conselho do Lucas pendente: o jogo pausa. No teste de carga escolhe-se o primeiro.
  if (world.advice) {
    if (world.stress > 0) chooseAdvice(world, 0);
    if (world.advice) return;
  }

  if (world.choices.length > 0) {
    // No teste de carga ninguém escolhe cartas, então escolhe a primeira.
    if (world.stress > 0) {
      const c = world.choices[0];
      if (c) chooseCard(world, c.slot, 0);
    }
    if (world.choices.length > 0) return;
  }

  world.tick++;

  for (const p of world.players) {
    p.prevX = p.x;
    p.prevY = p.y;
    if (p.hp <= 0) {
      p.moving = false;
      continue;
    }
    // Regeneração permanente (Garrafa Térmica).
    if (p.regenPerS > 0) healPlayer(p, p.regenPerS * STEP_S);
    // Movimento imposto (avanço conjunto da Entrada Sincronizada).
    if (p.forcedMove) {
      p.x += p.forcedMove.vx * STEP_S;
      p.y += p.forcedMove.vy * STEP_S;
      p.forcedMove.left -= STEP_S;
      if (p.forcedMove.left <= 0) p.forcedMove = null;
    }
    // Em transe (RM): a pessoa perde o controle; a Melissa persegue e ataca os aliados sozinha (ver combat/bosses.ts).
    const input = emTranse(world, p) ? NO_INPUT : (inputs[p.slot] ?? NO_INPUT);
    // Confusão (conselho ruim do Lucas): o movimento fica invertido.
    const inv = p.confusedLeft > 0 ? -1 : 1;
    // TDAH: durante a distração, o jogador anda para um lado qualquer, ignorando o controle.
    const dir = p.distractedLeft > 0 ? { x: p.tdahDx, y: p.tdahDy } : normalizeMove(input.moveX * inv, input.moveY * inv);
    // Lentidão (multas do Síndico, poças do Golem): -50% de velocidade.
    const lento = p.slowLeft > 0 ? 0.5 : 1;
    const veiculo = p.vehicle ? VEHICLES[p.vehicle.id].speedMul : 1;
    const speed = BASE_SPEED_PX_PER_S * p.speedMul * p.buffSpeedMul * p.kitSpeedMul * p.auraSpeedMul * veiculo * lento * STEP_S;
    p.x += dir.x * speed;
    p.y += dir.y * speed;
    // As paredes do cenário bloqueiam os jogadores.
    if (world.walls.length > 0) {
      const r = pushOutOfWalls(world.walls, p.x, p.y, PLAYER_WALL_RADIUS);
      p.x = r.x;
      p.y = r.y;
    }
    p.moving = dir.x !== 0 || dir.y !== 0;
    if (dir.x !== 0) p.facing = dir.x > 0 ? 1 : -1;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - STEP_S);
    if (p.slowLeft > 0) p.slowLeft = Math.max(0, p.slowLeft - STEP_S);
    if (p.confusedLeft > 0) p.confusedLeft = Math.max(0, p.confusedLeft - STEP_S);
  }

  if (world.coopLeash) limitarDistancia(world);

  // Minigame de evento: o combate e o spawn ficam pausados (o relógio da fase também).
  if (world.minigame) {
    world.phaseStartTick++;
    updateMinigame(world);
    updateMessages(world, STEP_S);
    updateEffects(world);
    updateDamageNumbers(world);
    return;
  }

  // Ultimate: o toque na tecla ativa a Saideira ou a melhor dupla do jogador.
  for (const p of world.players) {
    const quer = emTranse(world, p) ? false : (inputs[p.slot] ?? NO_INPUT).ultimate;
    if (quer && !p.ultPrev) tryActivateUltimate(world, p);
    p.ultPrev = quer;
  }

  updateRun(world);
  updateSpawner(world);
  updateEnemies(world);
  updateStatus(world);
  updateRevive(world);
  updateVehicles(world);
  updateKits(world, inputs);
  updatePerks(world);
  world.statSource = 'Ultimates e Saideira';
  updateSynergy(world);
  world.statSource = null;
  updateProjectiles(world);
  updateHazards(world);
  updateHostiles(world);
  updateGems(world);
  updateFoods(world);
  updateEffects(world);
  updateDamageNumbers(world);
  updateInteractions(world);

  if (world.players.every((p) => p.hp <= 0)) world.status = 'gameover';
}
