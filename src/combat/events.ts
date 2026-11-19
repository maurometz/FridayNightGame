// Eventos aleatórios (LORE seção 12): no máximo 1 por fase.
// Minigames (bexigas, Domingão do Pedrão, Fruit Ninja Marciano) PAUSAM o combate e o spawn.
// Eventos em tempo real (lanche, Thiagão, Miguel, Valdir, Oscar, Jorginho, Gabi) rolam durante o combate.

import { STEP_S } from '../data/balance';
import { MAX_EVENTS_PER_PHASE, RANDOM_EVENTS, eventById, type EventId, type RandomEventDef } from '../data/randomEvents';
import type { MiniItem, Minigame, RealtimeEvent } from '../entities/gameEvent';
import type { World } from '../engine/world';
import type { Player } from '../entities/player';
import { spawnGem } from './gems';
import { pushMessage } from './messages';
import { addShield } from './playerStats';
import { addBuff } from './teamEffects';

/** Perguntas do Domingão do Pedrão (a certa é a de índice `correct`). */
export const QUIZ: readonly { text: string; options: string[]; correct: number }[] = [
  { text: 'Com o que a Thaisa golpeia?', options: ['Violoncelo', 'Guitarra', 'Pandeiro'], correct: 0 },
  { text: 'Qual a cor do cabelo da Melissa?', options: ['Loiro', 'Vermelho-carmim', 'Azul'], correct: 1 },
  { text: 'Quem é o marido da Débora?', options: ['Pedrão', 'Juninho', 'Oscar'], correct: 0 },
  { text: 'Que dia está circulado no calendário?', options: ['7 de setembro', '25 de dezembro', '31 de dezembro'], correct: 2 },
  { text: 'Quem criou o Comitê (sem saber)?', options: ['Alê', 'Tiago W', 'Lucas'], correct: 0 },
  { text: 'O que a Fabi não larga?', options: ['O violão', 'O chimarrão', 'O megafone'], correct: 1 },
  { text: 'Quem é o irmão do Big John?', options: ['Estevão', 'Robson', 'Crazy'], correct: 0 },
];

const ARENA_R = 110;
const MINIGAME_S: Record<Minigame['id'], number> = { bexigas: 22, domingao: 14, fruitninja: 16 };

function vivos(world: World): Player[] {
  return world.players.filter((p) => p.hp > 0);
}

/** Centro do grupo (onde os eventos acontecem). */
export function centroDoGrupo(world: World): { x: number; y: number } {
  const v = vivos(world);
  if (v.length === 0) return { x: 0, y: 0 };
  return { x: v.reduce((s, p) => s + p.x, 0) / v.length, y: v.reduce((s, p) => s + p.y, 0) / v.length };
}

/** Sorteia quando (e se) o evento da fase dispara. Chamado ao entrar numa fase. */
export function sortearEvento(world: World, duracaoS: number): void {
  world.eventRolled = false;
  world.realtimeEvent = null;
  world.minigame = null;
  // Entre 20 s e dois terços da exploração (nunca em cima do chefe).
  const fim = Math.max(25, duracaoS * 0.66);
  world.eventAtS = 20 + world.rng.next() * Math.max(1, fim - 20);
}

function escolher(world: World): RandomEventDef {
  const total = RANDOM_EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = world.rng.next() * total;
  for (const e of RANDOM_EVENTS) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return RANDOM_EVENTS[0]!;
}

function concluir(world: World, id: EventId): void {
  world.stats.eventsCompleted.push(id);
}

function falar(world: World, quem: string, texto: string, s = 3): void {
  pushMessage(world, quem, texto, s);
}

/** Inicia um evento específico (também usado em testes e no modo dev). */
export function iniciarEvento(world: World, id: EventId): void {
  const def = eventById(id);
  const c = centroDoGrupo(world);
  if (def.kind === 'minigame') {
    const mg: Minigame = {
      id: id as Minigame['id'],
      t: 0,
      duration: MINIGAME_S[id as Minigame['id']],
      score: 0,
      acc: 0,
      items: [],
      cx: c.x,
      cy: c.y,
      done: false,
    };
    if (id === 'domingao') {
      const q = QUIZ[world.rng.int(0, QUIZ.length - 1)]!;
      mg.question = q;
      [-1, 0, 1].forEach((k, i) => mg.items.push({ x: c.x + k * 70, y: c.y - 6, vx: 0, vy: 0, kind: 'zona', alive: true, tag: i }));
      falar(world, 'Pedrão', `Boa noite, Brasil! ${q.text}`, 4);
    } else if (id === 'bexigas') {
      mg.items.push({ x: c.x - ARENA_R, y: c.y, vx: 70, vy: 0, kind: 'bexiga', alive: true, tag: 3 }); // tag = vidas
      falar(world, '', 'Arremessar Bexigas! Toquem na bexiga para rebater.', 3.5);
    } else {
      falar(world, 'Marciano', 'Pega aí, que é da roça!', 3);
    }
    world.minigame = mg;
    return;
  }
  const lado = world.rng.next() < 0.5 ? -1 : 1;
  const ev: RealtimeEvent = {
    id,
    t: 0,
    duration: 5,
    x: c.x + lado * 150,
    y: c.y + (world.rng.next() - 0.5) * 80,
    vx: 0,
    vy: 0,
    applied: false,
    tag: 0,
  };
  if (id === 'thiagao') {
    ev.duration = 6;
    ev.vx = -lado * 70;
  } else if (id === 'miguel') {
    ev.duration = 12;
    ev.vx = -lado * 55;
    ev.vy = (world.rng.next() - 0.5) * 40;
  } else if (id === 'lanche') {
    ev.vx = -lado * 40;
  }
  world.realtimeEvent = ev;
}

/** Sorteia e dispara o evento da fase quando chega a hora. */
function talvezDisparar(world: World): void {
  if (world.eventRolled || world.minigame || world.realtimeEvent || world.bossFight) return;
  if (MAX_EVENTS_PER_PHASE < 1 || world.stress > 0 || world.noBosses || world.act > 6) return;
  if ((world.tick - world.phaseStartTick) * STEP_S < world.eventAtS) return;
  world.eventRolled = true;
  iniciarEvento(world, escolher(world).id);
}

// ------------------------------------------------------------------ tempo real

function curar(world: World, fracao: number): void {
  for (const p of vivos(world)) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * fracao);
}

function atordoarTela(world: World, raio: number, s: number): void {
  const c = centroDoGrupo(world);
  for (const e of world.enemies.active) {
    if (!e.alive || e.def.boss) continue;
    if (Math.hypot(e.x - c.x, e.y - c.y) <= raio) e.stun = Math.max(e.stun, s);
  }
}

function aplicar(world: World, ev: RealtimeEvent): void {
  ev.applied = true;
  switch (ev.id) {
    case 'lanche':
      falar(world, 'Tiago Schneider', 'Trouxe lanche.', 3);
      curar(world, 0.3);
      break;
    case 'thiagao': {
      const bom = world.rng.next() < 0.5;
      ev.tag = bom ? 1 : 0;
      if (bom) {
        falar(world, 'Thiagão', 'QUE MOMENTO! Vamos lá, time!', 3);
        for (const p of vivos(world)) addBuff(p, { id: 'thiagao', left: 15, damage: 1.2, speed: 0.1 });
      } else {
        falar(world, 'Thiagão', 'QUE MOMENTO... de ficar parado? Corre!', 3);
        for (const p of vivos(world)) addBuff(p, { id: 'thiagao', left: 10, damage: 0.85 });
      }
      break;
    }
    case 'valdir': {
      const frases = ['Tá bom assim.', 'Isso aí já deu.', 'No meu tempo era pior.'];
      falar(world, 'Valdir', frases[world.rng.int(0, frases.length - 1)]!, 3);
      break;
    }
    case 'oscar': {
      const truque = world.rng.int(0, 2);
      falar(world, 'Oscar', 'Nada na manga... (tem tudo na manga)', 3);
      if (truque === 0) curar(world, 0.2);
      else if (truque === 1) atordoarTela(world, 260, 2.5);
      else {
        const c = centroDoGrupo(world);
        for (let i = 0; i < 8; i++) spawnGem(world, c.x + Math.cos(i) * 24, c.y + Math.sin(i) * 24, 4);
      }
      break;
    }
    case 'jorginho': {
      const msgs = (eventById('jorginho').lines ?? []) as string[];
      falar(world, 'Jorginho', msgs[world.rng.int(0, Math.max(0, msgs.length - 1))] ?? '🤷🏾‍♂️', 4);
      atordoarTela(world, 280, 3);
      break;
    }
    case 'gabi':
      falar(world, 'Gabi', 'Quem está com dor? Todo mundo? Certo.', 3);
      curar(world, 0.4);
      for (const p of vivos(world)) addShield(p, p.maxHp * 0.1);
      break;
    default:
      break;
  }
}

function stepTempoReal(world: World): void {
  const ev = world.realtimeEvent;
  if (!ev) return;
  ev.t += STEP_S;
  ev.x += ev.vx * STEP_S;
  ev.y += ev.vy * STEP_S;
  if (ev.id === 'miguel') {
    // Treasure goblin: sai correndo; encostar nele dá XP extra.
    if (!ev.applied && ev.t === STEP_S) falar(world, 'Miguel', 'Pega Miguel!', 2.5);
    for (const p of vivos(world)) {
      if (Math.hypot(p.x - ev.x, p.y - ev.y) < 16) {
        ev.applied = true;
        for (let i = 0; i < 12; i++) spawnGem(world, ev.x + Math.cos(i) * 14, ev.y + Math.sin(i) * 14, 5);
        falar(world, 'Miguel', 'Ai! Peguei o XP errado!', 2.5);
        concluir(world, 'miguel');
        world.realtimeEvent = null;
        return;
      }
    }
    if (ev.t >= ev.duration) {
      falar(world, 'Miguel', '(escapou com o XP)', 2);
      world.realtimeEvent = null;
    }
    return;
  }
  if (!ev.applied && ev.t >= 1.2) aplicar(world, ev);
  // Jorginho solta uma segunda rodada de caos visual.
  if (ev.id === 'jorginho' && ev.applied && ev.tag === 0 && ev.t >= 3.2) {
    ev.tag = 1;
    aplicar(world, ev);
  }
  if (ev.t >= ev.duration) {
    concluir(world, ev.id);
    world.realtimeEvent = null;
  }
}

// ------------------------------------------------------------------ minigames

function tocando(p: Player, it: MiniItem, raio: number): boolean {
  return Math.hypot(p.x - it.x, p.y - it.y) < raio;
}

function recompensa(world: World, mg: Minigame): void {
  mg.done = true;
  const nivel = mg.id === 'bexigas' ? Math.min(4, Math.floor(mg.score / 4)) : mg.id === 'domingao' ? (mg.score > 0 ? 3 : 0) : Math.min(4, Math.floor(mg.score / 5));
  if (nivel > 0) {
    for (const p of vivos(world)) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1 * nivel);
      addBuff(p, { id: 'minigame', left: 15 + nivel * 5, damage: 1 + 0.05 * nivel });
    }
    for (let i = 0; i < nivel * 3; i++) {
      spawnGem(world, mg.cx + Math.cos(i * 1.3) * 26, mg.cy + Math.sin(i * 1.3) * 26, 4);
    }
  }
  falar(world, '', nivel > 0 ? `Recompensa nível ${nivel}! (pontos: ${mg.score})` : 'Não foi dessa vez.', 3.5);
  concluir(world, mg.id);
}

function stepBexigas(world: World, mg: Minigame): void {
  const b = mg.items[0];
  if (!b) return;
  b.x += b.vx * STEP_S;
  const bateu = vivos(world).some((p) => tocando(p, b, 16));
  if (bateu && mg.acc <= 0) {
    mg.score++;
    mg.acc = 0.45; // evita rebater várias vezes no mesmo instante
    b.vx = -Math.sign(b.vx) * Math.min(150, Math.abs(b.vx) * 1.08);
  }
  if (mg.acc > 0) mg.acc -= STEP_S;
  if (Math.abs(b.x - mg.cx) > ARENA_R + 10) {
    // A bexiga estourou: perde uma vida e recomeça do lado que errou.
    b.tag--;
    falar(world, '', `Estourou! (${Math.max(0, b.tag)} vidas)`, 1.5);
    b.x = mg.cx + Math.sign(b.x - mg.cx) * (ARENA_R - 10);
    b.vx = -Math.sign(b.vx) * 70;
    if (b.tag <= 0) mg.t = mg.duration;
  }
}

function stepFruit(world: World, mg: Minigame): void {
  mg.acc -= STEP_S;
  if (mg.acc <= 0) {
    mg.acc = 0.5;
    const tipos = ['maca', 'laranja', 'melancia', 'uva', 'banana'];
    mg.items.push({ x: mg.cx + (world.rng.next() - 0.5) * 2 * ARENA_R, y: mg.cy - 120, vx: 0, vy: 55 + world.rng.next() * 25, kind: tipos[world.rng.int(0, 4)]!, alive: true, tag: 0 });
  }
  for (const it of mg.items) {
    if (!it.alive) continue;
    it.y += it.vy * STEP_S;
    if (it.y > mg.cy + 130) it.alive = false;
    for (const p of vivos(world)) {
      if (!tocando(p, it, 14)) continue;
      it.alive = false;
      mg.score++;
      if (it.kind === 'maca') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.08);
      else if (it.kind === 'laranja') addBuff(p, { id: 'fruta-dano', left: 12, damage: 1.15 });
      else if (it.kind === 'melancia') addShield(p, p.maxHp * 0.1);
      else if (it.kind === 'uva') spawnGem(world, p.x, p.y - 6, 6);
      else addBuff(p, { id: 'fruta-vel', left: 10, speed: 0.15 });
      break;
    }
  }
  mg.items = mg.items.filter((i) => i.alive);
}

function stepQuiz(world: World, mg: Minigame): void {
  if (mg.t < mg.duration) return;
  const q = mg.question!;
  // No fim: quem está em cima da zona certa acerta. Ganha o grupo se a maioria acertou.
  const zona = mg.items.find((i) => i.tag === q.correct)!;
  const certos = vivos(world).filter((p) => Math.hypot(p.x - zona.x, p.y - zona.y) < 32).length;
  mg.score = certos * 2 >= Math.max(1, vivos(world).length) ? 1 : 0;
  falar(world, 'Pedrão', mg.score > 0 ? `Resposta certa: ${q.options[q.correct]}! Parabéns!` : `Era "${q.options[q.correct]}". Vai ter volta!`, 3.5);
}

/** Roda o minigame (chamado a cada passo; o combate fica parado enquanto ele existe). */
export function updateMinigame(world: World): void {
  const mg = world.minigame;
  if (!mg) return;
  mg.t += STEP_S;
  if (mg.id === 'bexigas') stepBexigas(world, mg);
  else if (mg.id === 'fruitninja') stepFruit(world, mg);
  if (mg.t >= mg.duration) {
    if (mg.id === 'domingao') stepQuiz(world, mg);
    if (!mg.done) recompensa(world, mg);
    world.minigame = null;
  }
}

/** Avanço dos eventos a cada passo da partida. */
export function updateEvents(world: World): void {
  talvezDisparar(world);
  stepTempoReal(world);
}
