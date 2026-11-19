import { STEP_S } from '../data/balance';
import { PHASES, TIME_ARENA_TRIGGER, tuningDaFase, type PhaseDef } from '../data/acts';
import { RELOGIO_PARA_QUEDA_S } from '../data/emotion';
import { BOSSES, bossDef } from '../data/enemies';
import { FOODS } from '../data/foods';
import { LUCAS_MOMENTS } from '../data/lucas';
import { YOUTH, youthDaFase, type YouthDef } from '../data/youth';
import { CHARACTERS } from '../data/characters';
import { RETRATO_POR_NOME } from '../graphics/enemyFrames';
import { BOSS_DEFEAT, BOSS_INTRO, PORTAL_INTRO, type CutsceneLine } from '../data/cutscenes';
import { moodAt, stepBlend } from '../narrative/emotion';
import type { Enemy } from '../entities/enemy';
import type { World } from '../engine/world';
import { chefeVivo, spawnBoss } from './bosses';
import { updateSafeRoom } from './safeRoom';
import { sortearEvento, updateEvents } from './events';
import { sortearColecionaveis, updateCollectibles } from './collectibles';
import { spawnFood } from './foods';
import { spawnGem } from './gems';
import { pushMessage, updateMessages } from './messages';
import { addShield } from './playerStats';
import { addBuff } from './teamEffects';

/** Nome por extenso de quem fala numa cutscene. */
function nomeDeQuemFala(who: string): string {
  if (who === 'lucas') return 'Lucas';
  const c = (CHARACTERS as Record<string, { name: string } | undefined>)[who];
  if (c) return c.name;
  return YOUTH.find((j) => j.id === who)?.name ?? who;
}

/** Id do retrato de quem fala (personagem, Lucas, jovem ou chefe), se houver. */
function retratoDeQuemFala(who: string): string | undefined {
  if (who === 'lucas' || (CHARACTERS as Record<string, unknown>)[who]) return who;
  if (YOUTH.some((j) => j.id === who)) return who;
  return RETRATO_POR_NOME[who];
}

/** Acrescenta falas à cutscene em andamento (ou abre uma nova). Só vale com as cutscenes ligadas. */
export function iniciarCutscene(world: World, linhas: readonly CutsceneLine[]): void {
  if (!world.cutscenesOn || linhas.length === 0) return;
  const novas = linhas.map((l) => ({ who: nomeDeQuemFala(l.who), text: l.text, retrato: retratoDeQuemFala(l.who) }));
  if (world.cutscene) world.cutscene.lines.push(...novas);
  else world.cutscene = { lines: novas, index: 0 };
}

/** Duração da transição para a Arena do Tempo, em quadros de tela (60 por segundo), e o instante da troca. */
export const TRANSICAO_QUADROS = 260;
export const TRANSICAO_MEIO = 130;

/** Quantas fases tem a campanha: 7 mapas + a Arena do Tempo. */
export const PHASE_COUNT = PHASES.length;
/** Índice da Arena do Tempo (secreta). */
export const ARENA_INDEX = PHASE_COUNT - 1;

/** Segundos decorridos na fase atual. */
export function tempoNaFase(world: World): number {
  return (world.tick - world.phaseStartTick) * STEP_S;
}

/** Duração da exploração da fase atual. O modo dev pode trocar o valor (menos na Arena do Tempo). */
export function duracaoDaFase(world: World): number {
  const padrao = tuningDaFase(world.act).durationS;
  const dev = world.dev?.duracaoS ?? 0;
  return dev > 0 && world.act !== ARENA_INDEX ? dev : padrao;
}

/** Segundos que faltam para o chefe da fase (ou para o portal, na fase sem chefe). */
export function tempoRestante(world: World): number {
  return Math.max(0, duracaoDaFase(world) - tempoNaFase(world));
}

/** Definição da fase atual. */
export function faseAtual(world: World): PhaseDef {
  return PHASES[Math.min(world.act, PHASE_COUNT - 1)]!;
}

/** Entra numa fase: paredes, mensagens e as falas do Lucas daquela fase. */
export function irParaFase(world: World, index: number): void {
  const i = Math.min(Math.max(0, index), PHASE_COUNT - 1);
  const fase = PHASES[i]!;
  world.act = i;
  world.phaseStartTick = world.tick;
  world.bossSpawned = false;
  world.bossFight = false;
  world.trance = null;
  world.convidada = null;
  world.walls = [...tuningDaFase(i).walls];
  // Quem acabou de ser resgatado fica por perto no começo da fase nova.
  world.youthNaFase = world.resgatadosRecentes.map((id, k) => ({ id, x: -64 + k * 30, y: -36 }));
  world.resgatadosRecentes = [];
  sortearEvento(world, duracaoDaFase(world));
  sortearColecionaveis(world);
  pushMessage(world, '', i < ARENA_INDEX ? `Fase ${i + 1}: ${fase.name}` : fase.name, 4);
  const momento = LUCAS_MOMENTS.find((m) => m.fase === (typeof fase.id === 'number' ? fase.id : -1) && m.kind !== 'portal');
  if (momento) for (const l of momento.lines) pushMessage(world, l.who === 'comite' ? 'Comitê' : l.who === 'lucas' ? 'Lucas' : l.who, l.text, 3.5);
}

/** Prepara a partida na fase pedida (0 = fase 1): paredes e nenhum chefe ainda. */
export function iniciarPartida(world: World, fase = 0): void {
  world.act = fase;
  world.phaseStartTick = world.tick;
  world.walls = [...tuningDaFase(fase).walls];
  world.bossSpawned = false;
  world.bossFight = false;
  sortearEvento(world, duracaoDaFase(world));
  sortearColecionaveis(world);
}

/** Fração (0 a 1) usada nos beats do ciclo emocional da fase atual. */
function fracaoEmocional(world: World): number {
  if (world.act === ARENA_INDEX) {
    const c = chefeVivo(world);
    return c ? 1 - c.hp / (c.aiX || c.hp) : 0;
  }
  const d = duracaoDaFase(world);
  return d > 0 ? Math.min(1, tempoNaFase(world) / d) : 0;
}

/**
 * Diretor da partida: avança as fases, chama o chefe da fase quando a exploração termina e
 * conduz o ciclo emocional. Sem chefe (fase 2), o fim da exploração abre o portal para a fase seguinte.
 */
export function updateRun(world: World): void {
  const t = tempoNaFase(world);
  const fase = faseAtual(world);

  if (world.stress === 0 && !world.noBosses && !world.bossSpawned && t >= duracaoDaFase(world)) {
    world.bossSpawned = true;
    if (fase.boss) {
      spawnBoss(world, bossDef(fase.boss as Parameters<typeof bossDef>[0]));
      world.bossFight = true;
      iniciarCutscene(world, BOSS_INTRO[fase.boss] ?? []);
    } else {
      // Fase sem chefe: portal com o Lucas e os aprendizes, e o resgate.
      if (world.cutscenesOn) iniciarCutscene(world, PORTAL_INTRO);
      else {
        const portal = LUCAS_MOMENTS.find((m) => m.kind === 'portal');
        if (portal) for (const l of portal.lines) pushMessage(world, l.who === 'comite' ? 'Comitê' : l.who === 'lucas' ? 'Lucas' : l.who, l.text, 3.5);
      }
      resgatarDaFase(world, world.act + 1);
      irParaFase(world, world.act + 1);
    }
  }

  // Ciclo emocional: o humor de base vem dos beats da fase; eventos especiais (o relógio que para) sobrepõem.
  if (world.moodOverride) {
    world.moodOverride.left -= STEP_S;
    if (world.moodOverride.left <= 0) world.moodOverride = null;
  }
  const alvo = world.moodOverride ? world.moodOverride.mood : moodAt(world.act, fracaoEmocional(world));
  world.mood = alvo;
  world.moodBlend = stepBlend(world.moodBlend, alvo, STEP_S);

  updateSafeRoom(world);
  updateEvents(world);
  updateCollectibles(world);
  updateMessages(world, STEP_S);
}

/** Aplica o efeito leve de um resgate e conta a cena de encontro. */
export function aplicarResgate(world: World, y: YouthDef, x: number, yy: number): void {
  if (world.rescued.includes(y.id)) return;
  world.rescued.push(y.id);
  world.resgatadosRecentes.push(y.id);
  if (world.cutscenesOn) {
    // Cutscene com o encontro inteiro.
    iniciarCutscene(world, y.encounter);
  } else {
    for (const l of y.encounter.slice(0, 2)) {
      const quem = l.who === y.id ? y.name : l.who === 'lucas' ? 'Lucas' : l.who.charAt(0).toUpperCase() + l.who.slice(1);
      pushMessage(world, quem, l.text, 3.5);
    }
  }
  pushMessage(world, '', `${y.name} foi resgatado(a)!`, 3);
  let efeito = y.effect;
  if (efeito === 'aleatorio') {
    const sorteio = ['cura', 'xp', 'escudo', 'dano'] as const;
    efeito = sorteio[world.rng.int(0, sorteio.length - 1)]!;
  }
  for (const p of world.players) {
    if (p.hp <= 0) continue;
    if (efeito === 'cura' || efeito === 'velocidade') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
    else if (efeito === 'escudo') addShield(p, p.maxHp * 0.3);
    else if (efeito === 'dano') addBuff(p, { id: 'resgate', left: 30, damage: 1.15 });
  }
  if (efeito === 'xp') for (let i = 0; i < 8; i++) spawnGem(world, x + Math.cos(i) * 16, yy + Math.sin(i) * 16, 5);
}

/** Resgata os jovens da fase `fase` (1 a 7). */
function resgatarDaFase(world: World, fase: number): void {
  const alvo = world.players.find((p) => p.hp > 0) ?? world.players[0];
  for (const y of youthDaFase(fase)) aplicarResgate(world, y, alvo?.x ?? 0, alvo?.y ?? 0);
}

/**
 * Recompensa e consequências ao derrotar um chefe. Cada chefe resgata os jovens da fase e abre a seguinte.
 * O Tiago W (falso chefe final) para o relógio e leva à Arena do Tempo; o Tempo encerra a partida com vitória.
 */
export function onBossKilled(world: World, e: Enemy): void {
  world.bossFight = false;
  world.bossesDefeated.push(e.def.id);
  world.lucasVisible = false;
  world.trance = null;
  // A Melissa convidada da luta do RM vai embora com o fim da luta.
  if (world.convidada) {
    world.convidada = null;
    pushMessage(world, '', 'Melissa se despede e some nos bastidores.', 3);
  }
  if (e.def.id === 'tempo') {
    world.status = 'victory';
    pushMessage(world, '', 'O Tempo passou. O vínculo ficou.', 5);
    iniciarCutscene(world, BOSS_DEFEAT['tempo'] ?? []);
    return;
  }
  pushMessage(world, '', `${e.def.name} foi derrotado!`, 4);
  // Chuva de gemas e duas comidas.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    spawnGem(world, e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, 6);
  }
  spawnFood(world, FOODS[2]!, e.x - 14, e.y);
  spawnFood(world, FOODS[0]!, e.x + 14, e.y);
  // Cutscene da derrota, depois o resgate (cada jovem tem a sua cena).
  iniciarCutscene(world, BOSS_DEFEAT[e.def.id] ?? []);
  resgatarDaFase(world, world.act + 1);
  const paraArena = e.def.id === TIME_ARENA_TRIGGER.afterBoss;
  if (paraArena) {
    // O evento acontece, mas o relógio da parede para.
    world.moodOverride = { mood: 'queda', left: RELOGIO_PARA_QUEDA_S };
    pushMessage(world, '', TIME_ARENA_TRIGGER.cutsceneLine, 5);
    iniciarCutscene(world, [{ who: 'mauro', text: '...O relógio da parede parou.' }, { who: '', text: TIME_ARENA_TRIGGER.cutsceneLine }]);
  }
  if (paraArena && world.cutscenesOn) {
    // O grupo é transportado para a Arena do Tempo: primeiro as cutscenes, depois o vórtice (aoFimDaCutscene).
    world.faseDestino = world.act + 1;
    if (!world.cutscene) aoFimDaCutscene(world);
  } else irParaFase(world, world.act + 1);
}

/** Chamado quando a cutscene acaba (ou é pulada): se o grupo está de partida para outra fase, começa a transição. */
export function aoFimDaCutscene(world: World): void {
  if (world.faseDestino !== null && !world.transicao) world.transicao = { t: 0 };
}

/** Entra na fase de destino: limpa o campo, troca de mapa e põe o grupo no centro, chegando do outro lado. */
function entrarNaFaseDestino(world: World): void {
  const d = world.faseDestino;
  if (d === null) return;
  world.faseDestino = null;
  for (const x of [...world.enemies.active]) world.enemies.release(x);
  for (const x of [...world.hazards.active]) world.hazards.release(x);
  for (const x of [...world.hostiles.active]) world.hostiles.release(x);
  for (const x of [...world.gems.active]) world.gems.release(x);
  for (const x of [...world.foods.active]) world.foods.release(x);
  world.messages.length = 0; // os avisos da igreja não seguem o grupo para a arena
  irParaFase(world, d);
  const n = world.players.length;
  world.players.forEach((p, i) => {
    p.x = p.prevX = (i - (n - 1) / 2) * 24;
    p.y = p.prevY = 30;
  });
}

/** Um quadro de tela da transição. Na metade (tela branca) a fase troca; no fim o jogo volta. */
export function tickTransicao(world: World): 'fim' | null {
  const tr = world.transicao;
  if (!tr) return null;
  tr.t++;
  if (tr.t >= TRANSICAO_MEIO) entrarNaFaseDestino(world);
  if (tr.t >= TRANSICAO_QUADROS) {
    world.transicao = null;
    return 'fim';
  }
  return null;
}

/** Pula a transição (Esc/Enter): faz a troca de fase agora e devolve o jogo. */
export function pularTransicao(world: World): void {
  if (!world.transicao) return;
  entrarNaFaseDestino(world);
  world.transicao = null;
}

/** O chefe da fase atual, se estiver vivo. */
export function chefeAtual(world: World): Enemy | undefined {
  return chefeVivo(world);
}

export { BOSSES };
